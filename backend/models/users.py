"""Readers: the user table, public profiles and account settings."""

from datetime import datetime
from typing import Annotated, Literal

from pydantic import StringConstraints
from sqlalchemy import Index, Text, text
from sqlmodel import Field, SQLModel

from api.models.base import (
    LANGUAGE_CODE,
    ApiModel,
    Stripped,
    created_at_field,
    language_code,
    language_codes,
    one_of,
    text_list,
    updated_at_field,
)

# admins also review suggestions
Role = Literal["admin", "member"]


class User(SQLModel, table=True):
    """A reader."""

    __tablename__ = "users"
    __table_args__ = (
        one_of("role", Role),
        language_code("site_language"),
        language_codes("reading_languages"),
        language_codes("languages"),
        # one account per address, ignoring case
        Index("uq_users_lower_email", text("lower(email)"), unique=True),
    )

    id: int | None = Field(default=None, primary_key=True)
    handle: str = Field(max_length=60, unique=True, index=True)
    email: str = Field(max_length=255, unique=True, index=True)
    name: str = Field(max_length=100)
    hashed_password: str | None = Field(default=None, max_length=255)
    is_email_verified: bool = Field(default=False, sa_column_kwargs={"server_default": "false"})
    role: str = Field(default="member", max_length=20, sa_column_kwargs={"server_default": "member"})

    # the profile other readers see
    tagline: str = Field(default="", max_length=100)
    location: str = Field(default="", max_length=100)
    bio: str = Field(default="", sa_type=Text)
    languages: list[str] = text_list()
    fields: list[str] = text_list()
    # a small square photo's name in storage, or null for initials
    photo: str | None = Field(default=None, sa_type=Text)

    # BCP 47 codes, most wanted first. Without reading languages, the browser's are used.
    site_language: str = Field(default="en", max_length=20, sa_column_kwargs={"server_default": "en"})
    reading_languages: list[str] = text_list()

    created_at: datetime | None = created_at_field()
    updated_at: datetime | None = updated_at_field()


class ProfileFields(ApiModel):
    tagline: str = Field(default="", max_length=100)
    location: str = Field(default="", max_length=100)
    bio: str = Field(default="", max_length=600)
    languages: list[str] = Field(default_factory=list, max_length=10)
    fields: list[str] = Field(default_factory=list, max_length=10)
    photo: str | None = Field(default=None, max_length=200_000)


class MeRead(ProfileFields):
    """The logged-in reader's own account."""

    id: str
    email: str
    name: str
    role: Role
    email_verified: bool
    site_language: str
    reading_languages: list[str]
    created_at: datetime


class MeUpdate(ApiModel):
    name: Stripped | None = Field(default=None, min_length=1, max_length=100)
    tagline: str | None = Field(default=None, max_length=100)
    location: str | None = Field(default=None, max_length=100)
    bio: str | None = Field(default=None, max_length=600)
    languages: list[str] | None = Field(default=None, max_length=10)
    fields: list[str] | None = Field(default=None, max_length=10)
    photo: str | None = Field(default=None, max_length=200_000)
    site_language: Annotated[str, StringConstraints(pattern=f"^{LANGUAGE_CODE}$", max_length=20)] | None = None
    reading_languages: list[str] | None = Field(default=None, max_length=10)


class ReaderRead(ApiModel):
    """A reader's public profile, with the works they've read and are reading, by slug."""

    id: str
    name: str
    tagline: str
    location: str
    languages: list[str]
    fields: list[str]
    bio: str
    photo: str | None
    read: list[str]
    reading: list[str]
    # our tracks they follow and completed, by slug; saved ones stay private
    following: list[str]
    completed: list[str]
