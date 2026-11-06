"""Works: what readers call books. Their titles are on their expressions."""

from datetime import datetime
from typing import Literal

from sqlalchemy import DateTime, Index, Text
from sqlmodel import Field, Relationship, SQLModel

from api.models.authors import Author, AuthorRead
from api.models.base import ApiModel, created_at_field, one_of, text_list, updated_at_field

Difficulty = Literal["approachable", "challenging", "demanding"]


WorkSource = Literal["catalogue", "suggestion", "openlibrary", "dataset"]


class WorkAuthor(SQLModel, table=True):
    """Who wrote a work, in the order they're named on it."""

    __tablename__ = "work_authors"

    work_id: int = Field(foreign_key="works.id", ondelete="CASCADE", primary_key=True)
    author_id: int = Field(foreign_key="authors.id", ondelete="CASCADE", primary_key=True, index=True)
    position: int = Field(default=0)


class Work(SQLModel, table=True):
    __tablename__ = "works"
    __table_args__ = (
        one_of("difficulty", Difficulty),
        one_of("source", WorkSource),
        Index("ix_works_categories", "categories", postgresql_using="gin"),
    )

    id: int | None = Field(default=None, primary_key=True)
    slug: str = Field(max_length=200, unique=True, index=True)
    # in order; write it through set_authors, which keeps the order
    authors: list[Author] = Relationship(
        link_model=WorkAuthor,
        sa_relationship_kwargs={"order_by": "WorkAuthor.position", "lazy": "selectin", "viewonly": True},
    )
    # first published; negative for BC
    year: int | None = None
    # a scholarly estimate, shown as "c. 1000"
    is_year_approximate: bool = Field(default=False, sa_column_kwargs={"server_default": "false"})
    url: str | None = Field(default=None, sa_type=Text)
    # only for the works we rated (curated)
    difficulty: str | None = Field(default=None, max_length=20)
    # Chosen and rated by us. The others are plain records from Open Library.
    is_curated: bool = Field(default=False, sa_column_kwargs={"server_default": "false"})
    # the catalogue file, a reader's suggestion, Open Library or a dataset
    source: str = Field(default="catalogue", max_length=20, sa_column_kwargs={"server_default": "catalogue"})
    # ids of the work, not an edition: Open Library ("OL450063W"), Wikidata ("Q150827"), and when
    # they were looked up
    ol_work: str | None = Field(default=None, max_length=20, unique=True)
    # Open Library's duplicates of this work, since a reader may pick any of them: "De donkere kamer
    # van Damokles" and "Donkere kamer van Damocles"
    other_ol_works: list[str] = text_list()
    wikidata: str | None = Field(default=None, max_length=20, unique=True)
    # our categories ("classics", "history"), from Open Library's subjects or the dataset
    categories: list[str] = text_list()
    identified_at: datetime | None = Field(default=None, sa_type=DateTime(timezone=True))
    created_at: datetime | None = created_at_field()
    updated_at: datetime | None = updated_at_field()


class OpenLibraryWork(ApiModel):
    """A work on Open Library that isn't on OpenRead yet: enough to show it and to add it."""

    ol_work: str
    title: str
    author: str | None
    year: int | None
    cover: str | None
    editions: int


class BookToMatch(ApiModel):
    """A book from another site's export, to find among ours (POST /works/match)."""

    title: str = Field(max_length=500)
    author: str = Field(default="", max_length=300)
    isbn: str | None = Field(default=None, max_length=20)


class WorkRead(ApiModel):
    """A work as the FE lists it: its original title and language (English until the original is
    known), its titles in English and the reader's languages, and its cover.
    """

    slug: str
    title: str
    language: str | None
    titles: dict[str, str] = Field(default_factory=dict)
    cover: str | None
    # in order, with their names in those languages
    authors: list[AuthorRead]
    year: int | None
    approximate: bool
    url: str | None
    difficulty: Difficulty | None
    curated: bool
    source: WorkSource
    categories: list[str] = Field(default_factory=list)
    ol_work: str | None
    wikidata: str | None


class WorkMatches(ApiModel):
    """The result of matching an export: each book's slug or None, in the export's order, and those
    works.
    """

    slugs: list[str | None]
    works: list[WorkRead]
