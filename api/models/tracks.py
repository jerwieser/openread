"""Reading tracks: ours and the ones readers make, and their stops in reading order."""

from datetime import datetime

from sqlalchemy import DateTime, Text, UniqueConstraint
from sqlmodel import Field, SQLModel

from api.models.base import ApiModel, Stripped, created_at_field, language_code, text_list, updated_at_field


class Track(SQLModel, table=True):
    """A reading track: ours (owner_id null), or one a reader made for themselves."""

    __tablename__ = "tracks"

    id: int | None = Field(default=None, primary_key=True)
    slug: str = Field(max_length=120, unique=True, index=True)
    owner_id: int | None = Field(default=None, foreign_key="users.id", ondelete="CASCADE", index=True)
    title: str = Field(max_length=120)
    tagline: str | None = Field(default=None, max_length=200)
    description: str = Field(default="", sa_type=Text)
    tags: list[str] = text_list()
    # background picture: its name in storage
    image: str | None = Field(default=None, sa_type=Text)
    source_label: str | None = Field(default=None, max_length=200)
    source_url: str | None = Field(default=None, sa_type=Text)
    # our tracks' order in the list
    position: int = Field(default=0)
    # retired: hidden from Discover, but readers who keep it can still finish it
    retired_at: datetime | None = Field(default=None, sa_type=DateTime(timezone=True))
    created_at: datetime | None = created_at_field()
    updated_at: datetime | None = updated_at_field()


class TrackStop(SQLModel, table=True):
    """One work on a track, in order, with the canon window and note where the track has them."""

    __tablename__ = "track_stops"
    __table_args__ = (UniqueConstraint("track_id", "position"),)

    id: int | None = Field(default=None, primary_key=True)
    track_id: int = Field(foreign_key="tracks.id", ondelete="CASCADE", index=True)
    position: int
    work_id: int = Field(foreign_key="works.id", ondelete="CASCADE", index=True)
    # its window in the canon the track follows, like the Canon van Nederland's
    canon_window: str | None = Field(default=None, max_length=200)
    note: str | None = Field(default=None, sa_type=Text)


class TrackTranslation(SQLModel, table=True):
    """A track's title, tagline and description in a language other than English."""

    __tablename__ = "track_translations"
    __table_args__ = (language_code("language"),)

    track_id: int = Field(foreign_key="tracks.id", ondelete="CASCADE", primary_key=True)
    language: str = Field(max_length=20, primary_key=True)
    title: str = Field(max_length=120)
    tagline: str | None = Field(default=None, max_length=200)
    description: str = Field(default="", sa_type=Text)
    created_at: datetime | None = created_at_field()
    updated_at: datetime | None = updated_at_field()


class TrackStopTranslation(SQLModel, table=True):
    """A stop's note in a language other than English. Keyed by track and work, not stop, because
    stops are recreated when the order changes.
    """

    __tablename__ = "track_stop_translations"
    __table_args__ = (language_code("language"),)

    track_id: int = Field(foreign_key="tracks.id", ondelete="CASCADE", primary_key=True)
    work_id: int = Field(foreign_key="works.id", ondelete="CASCADE", primary_key=True, index=True)
    language: str = Field(max_length=20, primary_key=True)
    note: str = Field(sa_type=Text)
    created_at: datetime | None = created_at_field()
    updated_at: datetime | None = updated_at_field()


class Source(ApiModel):
    label: str
    url: str


class StopRead(ApiModel):
    slug: str
    window: str | None
    note: str | None


class TrackRead(ApiModel):
    id: str
    title: str
    tagline: str | None
    description: str
    tags: list[str]
    image: str | None
    source: Source | None
    works: list[StopRead]
    retired: bool


class OwnTrackRead(ApiModel):
    """A reader's own track, in the shape the track editor works with."""

    id: str
    title: str
    description: str
    slugs: list[str]
    image: str | None
    created_at: datetime


class OwnTrackWrite(ApiModel):
    title: Stripped = Field(min_length=1, max_length=120)
    description: Stripped = Field(default="", max_length=600)
    slugs: list[str] = Field(min_length=1, max_length=100)
    image: str | None = Field(default=None, max_length=2_000_000)
