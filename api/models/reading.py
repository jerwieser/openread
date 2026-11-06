"""A reader's bookshelf: their status for each work, and the tracks they keep."""

from datetime import date, datetime
from typing import Literal

from sqlalchemy import CheckConstraint, DateTime
from sqlmodel import Field, SQLModel

from api.models.base import ApiModel, created_at_field, one_of, updated_at_field

# Only reading and finished are visible to other readers.
ReadingStatus = Literal["want", "reading", "paused", "finished", "stopped"]


class Reading(SQLModel, table=True):
    """A reader's status for a work, in any language or edition: reading War and Peace in Russian or
    Dutch is the same. No row means it isn't on their bookshelf.
    """

    __tablename__ = "readings"
    __table_args__ = (
        CheckConstraint("progress BETWEEN 0 AND 100", name="progress_percent"),
        one_of("status", ReadingStatus),
    )

    user_id: int = Field(foreign_key="users.id", ondelete="CASCADE", primary_key=True)
    # also indexed on its own, for a work's readers
    work_id: int = Field(foreign_key="works.id", ondelete="CASCADE", primary_key=True, index=True)
    status: str = Field(max_length=10)
    started_on: date | None = None
    finished_on: date | None = None
    # percent
    progress: int | None = None
    # each shelf lists the most recently changed first
    created_at: datetime | None = created_at_field()
    updated_at: datetime | None = updated_at_field()


class ReadingWrite(ApiModel):
    status: ReadingStatus | None


class ImportedStatus(ApiModel):
    slug: str
    status: ReadingStatus


class StatusImport(ApiModel):
    """Statuses imported from Goodreads or StoryGraph, matched to our works by the site. Existing
    statuses stay unless replace is true.
    """

    works: list[ImportedStatus] = Field(max_length=5000)
    replace: bool = False


# How far a reader is isn't stored: it follows from their statuses and the stops they skipped.
TrackFollowState = Literal["saved", "following", "paused", "completed"]


class TrackFollow(SQLModel, table=True):
    """A track a reader keeps on their bookshelf: one of ours or their own."""

    __tablename__ = "track_follows"
    __table_args__ = (one_of("state", TrackFollowState),)

    user_id: int = Field(foreign_key="users.id", ondelete="CASCADE", primary_key=True)
    track_id: int = Field(foreign_key="tracks.id", ondelete="CASCADE", primary_key=True, index=True)
    state: str = Field(max_length=10)
    # when they started (kept through pauses), paused and completed
    started_at: datetime | None = Field(default=None, sa_type=DateTime(timezone=True))
    paused_at: datetime | None = Field(default=None, sa_type=DateTime(timezone=True))
    completed_at: datetime | None = Field(default=None, sa_type=DateTime(timezone=True))
    created_at: datetime | None = created_at_field()
    updated_at: datetime | None = updated_at_field()


SkipReason = Literal["know-it", "no-copy", "not-useful"]


class TrackSkip(SQLModel, table=True):
    """A work skipped on one track: done there and nowhere else. By work, not stop, so it survives
    reordering.
    """

    __tablename__ = "track_skips"
    __table_args__ = (one_of("reason", SkipReason),)

    user_id: int = Field(foreign_key="users.id", ondelete="CASCADE", primary_key=True)
    track_id: int = Field(foreign_key="tracks.id", ondelete="CASCADE", primary_key=True, index=True)
    work_id: int = Field(foreign_key="works.id", ondelete="CASCADE", primary_key=True, index=True)
    reason: str | None = Field(default=None, max_length=20)
    created_at: datetime | None = created_at_field()


class FollowRead(ApiModel):
    track: str
    state: TrackFollowState
    started_at: datetime | None
    paused_at: datetime | None
    completed_at: datetime | None
    # skipped works, by slug
    skips: list[str]


class FollowWrite(ApiModel):
    state: TrackFollowState | None


class SkipWrite(ApiModel):
    reason: SkipReason | None = None
