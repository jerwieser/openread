"""A work's expressions and editions. An expression is one text of a work in one language, with its
own title. An edition is one publication of an expression. A work's cover is a special edition
without an ISBN: a work has one cover, not one per edition or language.
"""

from datetime import datetime

from sqlalchemy import Index, Text, UniqueConstraint, text
from sqlmodel import Field, SQLModel

from backend.models.base import ApiModel, created_at_field, language_code, updated_at_field


class Expression(SQLModel, table=True):
    """A work in one language, with at most one original per work (none until it's known).
    Translators aren't kept: translations into the same language are one expression.
    """

    __tablename__ = "expressions"
    __table_args__ = (
        UniqueConstraint("work_id", "language", name="uq_expressions_work_id_language"),
        Index("uq_expressions_original", "work_id", unique=True, postgresql_where=text("is_original")),
        language_code("language"),
    )

    id: int | None = Field(default=None, primary_key=True)
    work_id: int = Field(foreign_key="works.id", ondelete="CASCADE", index=True)
    # BCP 47: "ru", "nl", "pt-br"
    language: str = Field(max_length=20)
    # unknown for a few, only known to be published in this language
    title: str | None = Field(default=None, max_length=500)
    is_original: bool = Field(default=False, sa_column_kwargs={"server_default": "false"})
    # first published, where known
    year: int | None = None
    created_at: datetime | None = created_at_field()
    updated_at: datetime | None = updated_at_field()


class Edition(SQLModel, table=True):
    """One publication of an expression: Pushkin Press's 2014 paperback of the English Bonita
    Avenue.
    """

    __tablename__ = "editions"

    id: int | None = Field(default=None, primary_key=True)
    expression_id: int = Field(foreign_key="expressions.id", ondelete="CASCADE", index=True)
    # ISBN-13 (an ISBN-10 is converted); none before about 1970
    isbn: str | None = Field(default=None, max_length=13, unique=True)
    # its Open Library record ("OL7353617M")
    ol_edition: str | None = Field(default=None, max_length=20, unique=True)
    publisher: str | None = Field(default=None, max_length=300)
    year: int | None = None
    # Only for a work's cover picture: our copy in storage ("book_covers/….jpg") and its source URL, for
    # credit and to fetch it again. The site shows the source until the copy is made.
    cover: str | None = Field(default=None, max_length=200)
    cover_source: str | None = Field(default=None, sa_type=Text)
    created_at: datetime | None = created_at_field()
    updated_at: datetime | None = updated_at_field()


class ExpressionRead(ApiModel):
    """One of a work's languages: its title, whether it's the original, when it first came out, and
    how many editions we know.
    """

    language: str
    title: str | None
    original: bool
    year: int | None
    editions: int


class EditionRead(ApiModel):
    """One edition: who published it when, its ISBN and its Open Library record."""

    isbn: str | None
    publisher: str | None
    year: int | None
    ol_edition: str | None
