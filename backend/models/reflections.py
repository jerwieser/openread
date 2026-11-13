"""Reflections: essays readers write about works they read."""

from datetime import date, datetime
from typing import Literal

from sqlalchemy import Text
from sqlmodel import Field, SQLModel

from backend.models.base import ApiModel, Stripped, created_at_field, one_of, updated_at_field

ReflectionStatus = Literal["draft", "published"]


class Reflection(SQLModel, table=True):
    __tablename__ = "reflections"
    __table_args__ = (one_of("status", ReflectionStatus),)

    id: int | None = Field(default=None, primary_key=True)
    slug: str = Field(max_length=120, unique=True, index=True)
    user_id: int = Field(foreign_key="users.id", ondelete="CASCADE", index=True)
    work_id: int = Field(foreign_key="works.id", ondelete="CASCADE", index=True)
    title: str = Field(max_length=200)
    body: str = Field(sa_type=Text)
    status: str = Field(default="draft", max_length=20)
    # the day it's shown as written
    written_on: date | None = None
    created_at: datetime | None = created_at_field()
    updated_at: datetime | None = updated_at_field()


class ReflectionRead(ApiModel):
    id: str
    work_slug: str
    title: str
    author: str
    reader: str
    date: date | None
    text: str
    status: ReflectionStatus
    created_at: datetime


class ReflectionWrite(ApiModel):
    work_slug: str
    title: Stripped = Field(min_length=1, max_length=200)
    text: Stripped = Field(min_length=1, max_length=20_000)
    status: ReflectionStatus = "draft"
