"""How far a reader is on the tracks they follow, and what moves them along.

A reader's place isn't stored: a stop is done when its work is finished or skipped on that track,
and the first stop not done is up next. This module keeps what follows from that: the next work goes
on Want to read, and a track with every stop done is completed.
"""

from sqlmodel import Session, col, delete, select

from api.models import Reading, TrackFollow, TrackSkip, TrackStop
from api.utils import now


def stops(session: Session, track_id: int) -> list[int]:
    """Return the track's work ids, in order."""
    rows = session.exec(select(TrackStop.work_id).where(TrackStop.track_id == track_id).order_by(TrackStop.position))
    return list(rows)


def following_with_work(session: Session, user_id: int, work_id: int) -> list[int]:
    """Return the followed tracks (not paused) that have this work."""
    rows = session.exec(
        select(TrackFollow.track_id)
        .join(TrackStop, TrackStop.track_id == TrackFollow.track_id)
        .where(TrackFollow.user_id == user_id, TrackFollow.state == "following", TrackStop.work_id == work_id)
    )
    return list(set(rows))


def advance(session: Session, user_id: int, track_ids: list[int]) -> None:
    """Complete the tracks with every stop done, and put the next work on the others on Want to read
    if it has no status. Commits.
    """
    if not track_ids:
        return
    statuses = {s.work_id: s.status for s in session.exec(select(Reading).where(Reading.user_id == user_id))}
    for track_id in track_ids:
        follow = session.get(TrackFollow, (user_id, track_id))
        if follow is None or follow.state != "following":
            continue
        skipped = set(
            session.exec(select(TrackSkip.work_id).where(TrackSkip.user_id == user_id, TrackSkip.track_id == track_id))
        )
        up_next = next(
            (b for b in stops(session, track_id) if statuses.get(b) != "finished" and b not in skipped), None
        )
        if up_next is None:
            follow.state = "completed"
            follow.completed_at = now()
            session.add(follow)
        elif up_next not in statuses:
            session.add(Reading(user_id=user_id, work_id=up_next, status="want"))
            statuses[up_next] = "want"
    session.commit()


def skips_by_track(session: Session, user_id: int, track_ids: list[int]) -> dict[int, list[int]]:
    rows = session.exec(
        select(TrackSkip.track_id, TrackSkip.work_id).where(
            TrackSkip.user_id == user_id, col(TrackSkip.track_id).in_(track_ids)
        )
    )
    skips: dict[int, list[int]] = {}
    for track_id, work_id in rows:
        skips.setdefault(track_id, []).append(work_id)
    return skips


def tracks_with_work(session: Session, work_id: int) -> list[int]:
    """Return every track the work is on, so followers can move along once it's gone."""
    return list(set(session.exec(select(TrackStop.track_id).where(TrackStop.work_id == work_id))))


def stops_changed(session: Session, track_id: int) -> None:
    """After a track's stops changed: drop the skips of removed works and move followers along. A
    completed track stays completed, so its readers see the new stops and can continue it. Commits.
    """
    on_track = stops(session, track_id)
    session.exec(delete(TrackSkip).where(TrackSkip.track_id == track_id, col(TrackSkip.work_id).not_in(on_track)))
    session.commit()
    followers = session.exec(
        select(TrackFollow.user_id).where(TrackFollow.track_id == track_id, TrackFollow.state == "following")
    )
    for user_id in list(followers):
        advance(session, user_id, [track_id])
