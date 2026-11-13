"""A reader's own tracks: creating, changing and deleting them. They're private; sharing one goes
through a link that carries the track itself.
"""

from fastapi import APIRouter, HTTPException, status
from sqlmodel import delete, select

from api.clients.storage import delete_upload, save_upload
from api.db import SessionDep
from api.deps import CurrentUser
from api.models import OwnTrackRead, OwnTrackWrite, Track, TrackStop, User
from api.serialize import own_tracks_read, works_by_slug
from api.services.following import stops_changed
from api.utils import new_slug

router = APIRouter(prefix="/tracks", tags=["tracks"])


def own_track_or_404(session: SessionDep, slug: str, user: User) -> Track:
    track = session.exec(select(Track).where(Track.slug == slug)).first()
    if track is None or track.owner_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Track not found")
    return track


def set_stops(session: SessionDep, track: Track, slugs: list[str]) -> None:
    works = works_by_slug(session, list(dict.fromkeys(slugs)))
    session.exec(delete(TrackStop).where(TrackStop.track_id == track.id))
    for position, work in enumerate(works):
        session.add(TrackStop(track_id=track.id, position=position, work_id=work.id))


@router.post("", response_model=OwnTrackRead, status_code=status.HTTP_201_CREATED)
def create_track(payload: OwnTrackWrite, user: CurrentUser, session: SessionDep) -> OwnTrackRead:
    track = Track(
        slug=new_slug(payload.title),
        owner_id=user.id,
        title=payload.title,
        description=payload.description,
        image=save_upload(payload.image, None, "track_covers"),
    )
    session.add(track)
    session.flush()
    set_stops(session, track, payload.slugs)
    session.commit()
    session.refresh(track)
    return own_tracks_read(session, [track])[0]


@router.put("/{slug}", response_model=OwnTrackRead)
def update_track(slug: str, payload: OwnTrackWrite, user: CurrentUser, session: SessionDep) -> OwnTrackRead:
    track = own_track_or_404(session, slug, user)
    track.title = payload.title
    track.description = payload.description
    track.image = save_upload(payload.image, track.image, "track_covers")
    session.add(track)
    set_stops(session, track, payload.slugs)
    session.commit()
    stops_changed(session, track.id)
    session.refresh(track)
    return own_tracks_read(session, [track])[0]


@router.delete("/{slug}", status_code=status.HTTP_204_NO_CONTENT)
def delete_track(slug: str, user: CurrentUser, session: SessionDep) -> None:
    track = own_track_or_404(session, slug, user)
    session.delete(track)
    session.commit()
    delete_upload(track.image)
