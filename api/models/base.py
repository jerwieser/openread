"""Shared by all models: constraint names, timestamps, array columns, ApiModel and database checks."""

from datetime import datetime
from typing import Annotated, get_args

from pydantic import ConfigDict, StringConstraints
from pydantic.alias_generators import to_camel
from sqlalchemy import CheckConstraint, Column, DateTime, String, func
from sqlalchemy.dialects.postgresql import ARRAY
from sqlmodel import Field, SQLModel

# Deterministic constraint names so Alembic can reliably alter/drop them later.
SQLModel.metadata.naming_convention = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


def created_at_field() -> datetime | None:
    return Field(
        default=None,
        nullable=False,
        sa_type=DateTime(timezone=True),
        sa_column_kwargs={"server_default": func.now()},
    )


def updated_at_field() -> datetime | None:
    """The row's last change, kept by a database trigger (set_updated_at), so scripts and migrations
    move it too. A new table with updated_at needs the trigger in its migration.
    """
    return Field(
        default=None,
        nullable=False,
        sa_type=DateTime(timezone=True),
        sa_column_kwargs={"server_default": func.now(), "onupdate": func.now()},
    )


def text_list() -> list[str]:
    """A list of short strings, stored as a Postgres array (languages, tags, ...)."""
    return Field(
        default_factory=list,
        sa_column=Column(ARRAY(String(100)), nullable=False, server_default="{}"),
    )


class ApiModel(SQLModel):
    """Request and response bodies: camelCase in JSON, snake_case in Python."""

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


# Database checks, so a script or import can't write what the API wouldn't

# BCP 47, lower case: "nl", "pt-br", "zh-hant", and "und" for an unknown language
LANGUAGE_CODE = r"[a-z]{2,3}(-[a-z0-9]{2,8})*"

# Text a reader typed, without the spaces around it: min_length then counts what's left.
Stripped = Annotated[str, StringConstraints(strip_whitespace=True)]


def one_of(column: str, values: object) -> CheckConstraint:
    """Check that the column holds one of a Literal's values, or null: ck_<table>_<column>."""
    allowed = ", ".join(f"'{value}'" for value in get_args(values))
    return CheckConstraint(f"{column} IN ({allowed})", name=column)


def language_code(column: str) -> CheckConstraint:
    """Check that the column holds a language code."""
    return CheckConstraint(f"{column} ~ '^{LANGUAGE_CODE}$'", name=column)


def language_codes(column: str) -> CheckConstraint:
    """Check that the column, a list, holds language codes."""
    return CheckConstraint(f"array_to_string({column}, ',') ~ '^({LANGUAGE_CODE}(,|$))*$'", name=column)
