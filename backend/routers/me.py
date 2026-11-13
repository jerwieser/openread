"""The logged-in reader's own data: profile, bookshelf, tracks, reflections, messages and
suggestions.
"""

import re

from fastapi import APIRouter, BackgroundTasks, HTTPException, Response, status
from sqlalchemy import or_
from sqlmodel import col, select, update

from api.clients.storage import delete_upload, save_upload
from api.db import SessionDep
from api.deps import COOKIE_NAME, CurrentUser
from api.models import (
    OPENREAD,
    DirectMessage,
    FollowRead,
    FollowWrite,
    MarkRead,
    MeRead,
    MessageRead,
    MeUpdate,
    OwnTrackRead,
    Reading,
    ReadingStatus,
    ReadingWrite,
    Reflection,
    ReflectionRead,
    SkipWrite,
    StatusImport,
    Suggestion,
    SuggestionRead,
    Track,
    TrackFollow,
    TrackSkip,
    User,
    Work,
)
from api.models.base import LANGUAGE_CODE
from api.serialize import (
    me_read,
    messages_read,
    own_tracks_read,
    reader_by_handle,
    reflections_read,
    suggestions_read,
    work_by_slug,
    works_by_slug,
)
from api.services.enrich import enrich_later
from api.services.following import advance, following_with_work, skips_by_track, stops
from api.utils import now

router = APIRouter(prefix="/me", tags=["me"])


# Account


@router.patch("", response_model=MeRead)
def update_me(payload: MeUpdate, user: CurrentUser, session: SessionDep) -> MeRead:
    changes = payload.model_dump(exclude_unset=True)
    if changes.get("name") is None:
        changes.pop("name", None)
    if changes.get("site_language") is None:
        changes.pop("site_language", None)
    for field in ("languages", "reading_languages"):
        if field in changes:
            # language codes ("nl", "pt-br"), each once, in the reader's order
            codes = [code.strip().lower() for code in changes[field] or []]
            if not all(re.fullmatch(LANGUAGE_CODE, code) for code in codes):
                raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "That isn't a language code.")
            changes[field] = list(dict.fromkeys(codes))
    if "photo" in changes:
        changes["photo"] = save_upload(changes["photo"], user.photo, "user_profiles")
    user.sqlmodel_update(changes)
    session.add(user)
    session.commit()
    session.refresh(user)
    return me_read(user)


@router.delete("", status_code=status.HTTP_204_NO_CONTENT)
def delete_me(user: CurrentUser, session: SessionDep, response: Response) -> None:
    """Delete the account and everything that's theirs (the database cascades), pictures included."""
    pictures = [user.photo, *session.exec(select(Track.image).where(Track.owner_id == user.id))]
    session.delete(user)
    session.commit()
    for picture in pictures:
        delete_upload(picture)
    response.delete_cookie(COOKIE_NAME)


# Bookshelf and tracks


def _statuses(user: User, session: SessionDep) -> dict[str, str]:
    rows = session.exec(
        select(Work.slug, Reading.status)
        .join(Reading, Reading.work_id == Work.id)
        .where(Reading.user_id == user.id)
        .order_by(col(Reading.updated_at).desc())
    )
    return dict(rows.all())


@router.get("/statuses", response_model=dict[str, ReadingStatus])
def get_statuses(user: CurrentUser, session: SessionDep) -> dict[str, str]:
    """Return the reader's statuses by slug, most recently changed first."""
    return _statuses(user, session)


@router.post("/statuses/import", response_model=dict[str, ReadingStatus])
def import_statuses(payload: StatusImport, user: CurrentUser, session: SessionDep) -> dict[str, str]:
    """Set many statuses at once, from an import. Finished works move followed tracks along, as
    usual.
    """
    wanted = {item.slug: item.status for item in payload.works}  # a work given twice: the last one counts
    works = works_by_slug(session, list(wanted))
    current = {s.work_id: s for s in session.exec(select(Reading).where(Reading.user_id == user.id))}
    for work in works:
        status_now = current.get(work.id)
        if status_now is None:
            session.add(Reading(user_id=user.id, work_id=work.id, status=wanted[work.slug]))
        elif payload.replace and status_now.status != wanted[work.slug]:
            status_now.status = wanted[work.slug]
            session.add(status_now)
    session.commit()
    finished = [work.id for work in works if wanted[work.slug] == "finished"]
    advance(session, user.id, list({t for work_id in finished for t in following_with_work(session, user.id, work_id)}))
    return _statuses(user, session)


@router.put("/statuses/{slug}", response_model=dict[str, ReadingStatus])
def put_status(
    slug: str, payload: ReadingWrite, user: CurrentUser, session: SessionDep, background: BackgroundTasks
) -> dict[str, str]:
    """Set a work's status, or remove it with null. Returns every status, since finishing a work can
    put the next one on Want to read. An incomplete dataset work is completed in the background.
    """
    work = work_by_slug(session, slug)
    if payload.status and work.source == "dataset" and work.ol_work is None:
        background.add_task(enrich_later, work.id)
    current = session.get(Reading, (user.id, work.id))
    if payload.status is None:
        if current:
            session.delete(current)
    elif current:
        if current.status != payload.status:
            current.status = payload.status
            session.add(current)
    else:
        session.add(Reading(user_id=user.id, work_id=work.id, status=payload.status))
    session.commit()
    # finishing a work moves the tracks it's on along
    if payload.status == "finished":
        advance(session, user.id, following_with_work(session, user.id, work.id))
    return _statuses(user, session)


def _follows(user: User, session: SessionDep) -> list[FollowRead]:
    rows = list(
        session.exec(
            select(TrackFollow, Track.slug)
            .join(Track, Track.id == TrackFollow.track_id)
            .where(TrackFollow.user_id == user.id)
            .order_by(col(TrackFollow.updated_at).desc())
        )
    )
    skips = skips_by_track(session, user.id, [f.track_id for f, _ in rows])
    slugs = {
        b.id: b.slug
        for b in session.exec(select(Work).where(col(Work.id).in_({b for ids in skips.values() for b in ids})))
    }
    return [
        FollowRead(
            track=slug,
            state=f.state,
            started_at=f.started_at,
            paused_at=f.paused_at,
            completed_at=f.completed_at,
            skips=[slugs[b] for b in skips.get(f.track_id, [])],
        )
        for f, slug in rows
    ]


def _followable(session: SessionDep, slug: str, user: User) -> Track:
    """One of our tracks, or one of the reader's own; other readers' tracks aren't public. A retired
    track is only for the readers who already keep it."""
    track = session.exec(select(Track).where(Track.slug == slug)).first()
    if track is None or track.owner_id not in (None, user.id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No such track")
    if track.retired_at and session.get(TrackFollow, (user.id, track.id)) is None:
        raise HTTPException(
            status.HTTP_409_CONFLICT, "This track is retired: only readers who already keep it can follow it."
        )
    return track


@router.get("/follows", response_model=list[FollowRead])
def get_follows(user: CurrentUser, session: SessionDep) -> list[FollowRead]:
    """List the tracks the reader keeps, most recently changed first, with the works skipped on
    each.
    """
    return _follows(user, session)


@router.put("/follows/{slug}", response_model=list[FollowRead])
def put_follow(slug: str, payload: FollowWrite, user: CurrentUser, session: SessionDep) -> list[FollowRead]:
    """Save, follow, pause or complete a track; null removes it and its skips. Following puts the
    next work on Want to read, and completes the track if every stop is done.
    """
    track = _followable(session, slug, user)
    follow = session.get(TrackFollow, (user.id, track.id))
    if payload.state is None:
        if follow:
            session.delete(follow)
        for skip in session.exec(select(TrackSkip).where(TrackSkip.user_id == user.id, TrackSkip.track_id == track.id)):
            session.delete(skip)
        session.commit()
        return _follows(user, session)
    follow = follow or TrackFollow(user_id=user.id, track_id=track.id, state=payload.state)
    stamp = now()
    if payload.state == "saved":
        follow.started_at = follow.paused_at = follow.completed_at = None
    elif payload.state == "following":
        # resuming or continuing a track keeps the day they started
        follow.started_at = follow.started_at if follow.state in ("paused", "completed") else stamp
        follow.paused_at = follow.completed_at = None
    elif payload.state == "paused":
        follow.started_at = follow.started_at or stamp
        follow.paused_at = stamp
    else:
        follow.started_at = follow.started_at or stamp
        follow.completed_at = stamp
    follow.state = payload.state
    session.add(follow)
    session.commit()
    advance(session, user.id, [track.id])
    return _follows(user, session)


def _stop_or_404(session: SessionDep, slug: str, work_slug: str, user: User) -> tuple[Track, Work]:
    track = _followable(session, slug, user)
    work = work_by_slug(session, work_slug)
    if work.id not in stops(session, track.id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That book isn't on this track")
    if session.get(TrackFollow, (user.id, track.id)) is None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Follow the track to skip its books")
    return track, work


@router.put("/follows/{slug}/skips/{work_slug}", response_model=list[FollowRead])
def put_skip(slug: str, work_slug: str, payload: SkipWrite, user: CurrentUser, session: SessionDep) -> list[FollowRead]:
    """Skip a work on this track only: it counts as done here, and the next stop comes up."""
    track, work = _stop_or_404(session, slug, work_slug, user)
    skip = session.get(TrackSkip, (user.id, track.id, work.id)) or TrackSkip(
        user_id=user.id, track_id=track.id, work_id=work.id
    )
    skip.reason = payload.reason
    session.add(skip)
    # a skipped work comes off Want to read, unless another followed track has it up next
    waiting = session.get(Reading, (user.id, work.id))
    if waiting and waiting.status == "want":
        session.delete(waiting)
    session.commit()
    advance(session, user.id, list({track.id, *following_with_work(session, user.id, work.id)}))
    return _follows(user, session)


@router.delete("/follows/{slug}/skips/{work_slug}", response_model=list[FollowRead])
def delete_skip(slug: str, work_slug: str, user: CurrentUser, session: SessionDep) -> list[FollowRead]:
    """Put a skipped work back on the track. A completed track stays completed."""
    track, work = _stop_or_404(session, slug, work_slug, user)
    skip = session.get(TrackSkip, (user.id, track.id, work.id))
    if skip:
        session.delete(skip)
        session.commit()
    return _follows(user, session)


# Things they made


@router.get("/tracks", response_model=list[OwnTrackRead])
def my_tracks(user: CurrentUser, session: SessionDep) -> list[OwnTrackRead]:
    tracks = session.exec(select(Track).where(Track.owner_id == user.id).order_by(col(Track.created_at).desc()))
    return own_tracks_read(session, list(tracks))


@router.get("/reflections", response_model=list[ReflectionRead])
def my_reflections(user: CurrentUser, session: SessionDep) -> list[ReflectionRead]:
    reflections = session.exec(
        select(Reflection).where(Reflection.user_id == user.id).order_by(col(Reflection.created_at).desc())
    )
    return reflections_read(session, list(reflections))


@router.get("/suggestions", response_model=list[SuggestionRead])
def my_suggestions(user: CurrentUser, session: SessionDep) -> list[SuggestionRead]:
    suggestions = session.exec(
        select(Suggestion).where(Suggestion.user_id == user.id).order_by(col(Suggestion.created_at).desc())
    )
    return suggestions_read(session, list(suggestions))


# Messages


@router.get("/messages", response_model=list[MessageRead])
def my_messages(user: CurrentUser, session: SessionDep) -> list[MessageRead]:
    """List the messages to or from the reader, newest first."""
    messages = session.exec(
        select(DirectMessage)
        .where(or_(DirectMessage.sender_id == user.id, DirectMessage.recipient_id == user.id))
        .order_by(col(DirectMessage.created_at).desc())
    )
    return messages_read(session, list(messages))


@router.post("/messages/read", status_code=status.HTTP_204_NO_CONTENT)
def mark_read(payload: MarkRead, user: CurrentUser, session: SessionDep) -> None:
    """Mark everything the other reader sent as read."""
    if payload.other == OPENREAD:
        from_other = col(DirectMessage.sender_id).is_(None)
    else:
        from_other = DirectMessage.sender_id == reader_by_handle(session, payload.other).id
    session.exec(
        update(DirectMessage)
        .where(DirectMessage.recipient_id == user.id, from_other)
        .where(col(DirectMessage.read_at).is_(None))
        .values(read_at=now())
    )
    session.commit()
