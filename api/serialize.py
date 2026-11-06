"""Turn rows into API responses, plus the lookups the routers share."""

from fastapi import HTTPException, status
from sqlmodel import Session, col, select

from api.clients.storage import public_url
from api.models import (
    OPENREAD,
    DirectMessage,
    MeRead,
    MessageRead,
    OwnTrackRead,
    ReaderRead,
    Reading,
    Reflection,
    ReflectionRead,
    Source,
    StopRead,
    Suggestion,
    SuggestionRead,
    Track,
    TrackFollow,
    TrackRead,
    TrackStop,
    TrackStopTranslation,
    TrackTranslation,
    User,
    Work,
)
from api.services.works import by_ol_work, same_work


def work_by_slug(session: Session, slug: str) -> Work:
    work = session.exec(select(Work).where(Work.slug == slug)).first()
    if work is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"No book {slug!r}")
    return work


def works_by_slug(session: Session, slugs: list[str]) -> list[Work]:
    """The works in the order given; unknown slugs are an error."""
    found = {b.slug: b for b in session.exec(select(Work).where(col(Work.slug).in_(slugs)))}
    missing = [s for s in slugs if s not in found]
    if missing:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"No books {missing!r}")
    return [found[s] for s in slugs]


def reader_by_handle(session: Session, handle: str) -> User:
    user = session.exec(select(User).where(User.handle == handle)).first()
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"No reader {handle!r}")
    return user


# Responses


def me_read(user: User) -> MeRead:
    return MeRead(
        id=user.handle,
        email=user.email,
        name=user.name,
        role=user.role,
        email_verified=user.is_email_verified,
        site_language=user.site_language,
        reading_languages=user.reading_languages,
        created_at=user.created_at,
        tagline=user.tagline,
        location=user.location,
        bio=user.bio,
        languages=user.languages,
        fields=user.fields,
        photo=public_url(user.photo),
    )


def readers_read(session: Session, users: list[User]) -> list[ReaderRead]:
    """Return public profiles, with the works they finished and are reading and the tracks they
    follow and completed. Other statuses stay private.
    """
    ids = [u.id for u in users]
    rows = session.exec(
        select(Reading.user_id, Reading.status, Work.slug)
        .join(Work, Work.id == Reading.work_id)
        .where(col(Reading.user_id).in_(ids), col(Reading.status).in_(["reading", "finished"]))
        .order_by(Reading.updated_at)
    )
    works: dict[tuple[int, str], list[str]] = {}
    for user_id, state, slug in rows:
        works.setdefault((user_id, state), []).append(slug)
    # our tracks they follow (paused ones too) and completed; saved ones and their own stay private
    follows = session.exec(
        select(TrackFollow.user_id, TrackFollow.state, Track.slug)
        .join(Track, Track.id == TrackFollow.track_id)
        .where(col(TrackFollow.user_id).in_(ids), col(Track.owner_id).is_(None), TrackFollow.state != "saved")
        .order_by(col(TrackFollow.updated_at).desc())
    )
    tracks: dict[tuple[int, str], list[str]] = {}
    for user_id, state, slug in follows:
        tracks.setdefault((user_id, "completed" if state == "completed" else "following"), []).append(slug)
    return [
        ReaderRead(
            id=u.handle,
            name=u.name,
            tagline=u.tagline or "Reader on OpenRead",
            location=u.location,
            languages=u.languages,
            fields=u.fields,
            bio=u.bio,
            photo=public_url(u.photo),
            read=works.get((u.id, "finished"), []),
            reading=works.get((u.id, "reading"), []),
            following=tracks.get((u.id, "following"), []),
            completed=tracks.get((u.id, "completed"), []),
        )
        for u in users
    ]


def tracks_read(session: Session, tracks: list[Track], languages: list[str] | None = None) -> list[TrackRead]:
    """Return tracks with their stops, their texts in the first of these languages they're
    translated into, else English.
    """
    ids = [t.id for t in tracks]
    texts: dict[int, TrackTranslation] = {}
    notes: dict[tuple[int, int], str] = {}
    if languages:
        # the first language each has, in the reader's order
        rank = {lang: i for i, lang in enumerate(languages)}
        for found in session.exec(
            select(TrackTranslation).where(
                col(TrackTranslation.track_id).in_(ids), col(TrackTranslation.language).in_(languages)
            )
        ):
            have = texts.get(found.track_id)
            if have is None or rank[found.language] < rank[have.language]:
                texts[found.track_id] = found
        best: dict[tuple[int, int], int] = {}
        for found in session.exec(
            select(TrackStopTranslation).where(
                col(TrackStopTranslation.track_id).in_(ids), col(TrackStopTranslation.language).in_(languages)
            )
        ):
            key = (found.track_id, found.work_id)
            if key not in best or rank[found.language] < best[key]:
                best[key], notes[key] = rank[found.language], found.note
    stops = session.exec(
        select(TrackStop, Work.slug)
        .join(Work, Work.id == TrackStop.work_id)
        .where(col(TrackStop.track_id).in_([t.id for t in tracks]))
        .order_by(TrackStop.track_id, TrackStop.position)
    )
    by_track: dict[int, list[StopRead]] = {}
    for stop, slug in stops:
        note = notes.get((stop.track_id, stop.work_id), stop.note)
        by_track.setdefault(stop.track_id, []).append(StopRead(slug=slug, window=stop.canon_window, note=note))
    return [
        TrackRead(
            id=t.slug,
            title=texts[t.id].title if t.id in texts else t.title,
            tagline=(texts[t.id].tagline or t.tagline) if t.id in texts else t.tagline,
            description=(texts[t.id].description or t.description) if t.id in texts else t.description,
            tags=t.tags,
            image=public_url(t.image),
            source=Source(label=t.source_label, url=t.source_url) if t.source_label and t.source_url else None,
            works=by_track.get(t.id, []),
            retired=t.retired_at is not None,
        )
        for t in tracks
    ]


def own_tracks_read(session: Session, tracks: list[Track]) -> list[OwnTrackRead]:
    full = {t.id: t for t in tracks_read(session, tracks)}  # by slug
    return [
        OwnTrackRead(
            id=t.slug,
            title=t.title,
            description=t.description,
            slugs=[s.slug for s in full[t.slug].works],
            image=public_url(t.image),
            created_at=t.created_at,
        )
        for t in tracks
    ]


def reflections_read(session: Session, reflections: list[Reflection]) -> list[ReflectionRead]:
    works = {b.id: b.slug for b in session.exec(select(Work).where(col(Work.id).in_({r.work_id for r in reflections})))}
    authors = {u.id: u for u in session.exec(select(User).where(col(User.id).in_({r.user_id for r in reflections})))}
    return [
        ReflectionRead(
            id=r.slug,
            work_slug=works[r.work_id],
            title=r.title,
            author=authors[r.user_id].name,
            reader=authors[r.user_id].handle,
            date=r.written_on or r.created_at.date(),
            text=r.body,
            status=r.status,
            created_at=r.created_at,
        )
        for r in reflections
    ]


def handles(session: Session, ids: set[int]) -> dict[int, str]:
    return {u.id: u.handle for u in session.exec(select(User).where(col(User.id).in_(ids)))}


def messages_read(session: Session, messages: list[DirectMessage]) -> list[MessageRead]:
    ids = {m.sender_id for m in messages} | {m.recipient_id for m in messages}
    who = handles(session, ids - {None}) | {None: OPENREAD}
    return [
        MessageRead(
            id=m.id,
            from_=who[m.sender_id],
            to=who[m.recipient_id],
            text=m.body,
            created_at=m.created_at,
            read_at=m.read_at,
        )
        for m in messages
    ]


def suggestions_read(session: Session, suggestions: list[Suggestion]) -> list[SuggestionRead]:
    def duplicate(s: Suggestion) -> str | None:
        """Return the slug of the work we have for a waiting suggestion, if any."""
        if s.status != "pending":
            return None
        found = by_ol_work(session, s.ol_work) if s.ol_work else same_work(session, [s.title], [s.author])
        return found.slug if found else None

    users = {u.id: u for u in session.exec(select(User).where(col(User.id).in_({s.user_id for s in suggestions})))}
    works = {
        b.id: b.slug
        for b in session.exec(select(Work).where(col(Work.id).in_({s.work_id for s in suggestions if s.work_id})))
    }
    return [
        SuggestionRead(
            id=s.id,
            title=s.title,
            author=s.author,
            year=s.year,
            url=s.url,
            cover=s.cover,
            note=s.note,
            difficulty=s.difficulty,
            name=users[s.user_id].name,
            email=users[s.user_id].email,
            status=s.status,
            reason=s.reason,
            work=works.get(s.work_id),
            ol_work=s.ol_work,
            duplicate=duplicate(s),
            created_at=s.created_at,
            decided_at=s.decided_at,
        )
        for s in suggestions
    ]
