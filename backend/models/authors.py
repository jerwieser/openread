"""Authors of works, and their names in other languages."""

from datetime import datetime

from sqlmodel import Field, SQLModel

from backend.models.base import ApiModel, created_at_field, language_code, updated_at_field


class Author(SQLModel, table=True):
    """Someone who wrote works. One row each, and a work can have several."""

    __tablename__ = "authors"
    id: int | None = Field(default=None, primary_key=True)
    slug: str = Field(max_length=200, unique=True, index=True)
    # the name in English ("Leo Tolstoy"); other languages are in author_names
    name: str = Field(max_length=200, index=True)
    # Wikidata item ("Q7243"), once known
    wikidata: str | None = Field(default=None, max_length=20, unique=True)
    created_at: datetime | None = created_at_field()
    updated_at: datetime | None = updated_at_field()


class AuthorName(SQLModel, table=True):
    """An author's name in one language ("ru": "Лев Толстой"). From Wikidata, for the works we
    started from; no longer looked up for new ones.
    """

    __tablename__ = "author_names"
    __table_args__ = (language_code("language"),)

    author_id: int = Field(foreign_key="authors.id", ondelete="CASCADE", primary_key=True)
    language: str = Field(max_length=20, primary_key=True)
    name: str = Field(max_length=200)


class AuthorRead(ApiModel):
    slug: str
    name: str
    # in the languages the reader asked for (GET /works?languages=ru)
    names: dict[str, str] = Field(default_factory=dict)
