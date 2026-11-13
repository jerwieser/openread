"""Works readers suggest for the catalogue, and the admins who review them."""

from datetime import datetime
from typing import Annotated, Literal

from pydantic import StringConstraints
from sqlalchemy import DateTime, Text
from sqlmodel import Field, SQLModel

from backend.models.base import ApiModel, Stripped, created_at_field, one_of, updated_at_field
from backend.models.works import Difficulty

SuggestionStatus = Literal["pending", "approved", "rejected"]


class Suggestion(SQLModel, table=True):
    """A work a reader asked us to add. An admin approves it, which adds the work, or rejects it."""

    __tablename__ = "suggestions"
    __table_args__ = (one_of("status", SuggestionStatus), one_of("difficulty", Difficulty))

    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id", ondelete="CASCADE", index=True)
    title: str = Field(max_length=300)
    author: str = Field(max_length=200)
    year: int | None = None
    url: str | None = Field(default=None, sa_type=Text)
    cover: str | None = Field(default=None, sa_type=Text)
    note: str = Field(default="", sa_type=Text)
    difficulty: str = Field(default="challenging", max_length=20)
    status: str = Field(default="pending", max_length=20)
    reason: str | None = Field(default=None, sa_type=Text)
    work_id: int | None = Field(default=None, foreign_key="works.id", ondelete="SET NULL", index=True)
    # the Open Library work the reader picked ("OL450063W"), if any
    ol_work: str | None = Field(default=None, max_length=20)
    created_at: datetime | None = created_at_field()
    updated_at: datetime | None = updated_at_field()
    decided_at: datetime | None = Field(default=None, sa_type=DateTime(timezone=True))


class SuggestionWrite(ApiModel):
    title: Stripped = Field(min_length=1, max_length=300)
    author: Stripped = Field(min_length=1, max_length=200)
    year: int | None = Field(default=None, ge=-3000, le=2100)
    url: str | None = Field(default=None, max_length=2000)
    cover: str | None = Field(default=None, max_length=2000)
    note: str = Field(default="", max_length=1000)
    difficulty: Difficulty = "challenging"
    ol_work: Annotated[str, StringConstraints(pattern=r"^OL\d+W$", max_length=20)] | None = None


class SuggestionRead(ApiModel):
    id: int
    title: str
    author: str
    year: int | None
    url: str | None
    cover: str | None
    note: str
    difficulty: Difficulty
    name: str
    email: str
    status: SuggestionStatus
    reason: str | None
    work: str | None
    ol_work: str | None
    # while pending: the work we already have that matches, if any
    duplicate: str | None = None
    created_at: datetime
    decided_at: datetime | None


class SuggestionDecision(ApiModel):
    """Approve or reject a waiting suggestion, or send a decided one back to waiting."""

    status: SuggestionStatus
    reason: str | None = Field(default=None, max_length=500)
    difficulty: Difficulty | None = None
