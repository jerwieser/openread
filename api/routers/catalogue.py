"""The public catalogue: works, our tracks, readers' profiles and published reflections, plus
searching Open Library and adding its works.
"""

from dataclasses import dataclass
from typing import Annotated, Literal

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Path, Query, Request, status
from sqlmodel import col, exists, func, or_, select

from api.clients import openlibrary
from api.clients.storage import public_url
from api.db import SessionDep
from api.deps import CurrentUser
from api.models import (
    Author,
    AuthorName,
    AuthorRead,
    BookToMatch,
    Difficulty,
    Edition,
    EditionRead,
    Expression,
    ExpressionRead,
    OpenLibraryWork,
    ReaderRead,
    Reading,
    Reflection,
    ReflectionRead,
    Track,
    TrackRead,
    TrackStop,
    User,
    Work,
    WorkAuthor,
    WorkMatches,
    WorkRead,
)
from api.rate_limit import limiter
from api.serialize import readers_read, reflections_read, tracks_read, work_by_slug
from api.services.enrich import enrich_later
from api.services.expressions import PICTURE, shown_title, titles_of
from api.services.search import find_works
from api.services.works import by_ol_work, match, same_work, work_from_open_library

router = APIRouter(tags=["catalogue"])


Languages = Query("", max_length=200, description='the reader\'s languages, the most wanted first: "nl-nl,nl,en"')


def works_read(session: SessionDep, works: list[Work], languages: str) -> list[WorkRead]:
    """Build the responses for these works, with titles and authors' names only in English and the
    reader's languages: a work can have a title in a hundred languages.
    """
    wanted = list(dict.fromkeys(["en", *(lang.strip().lower() for lang in languages.split(",") if lang.strip())]))[:11]
    ids = [w.id for w in works]
    texts = titles_of(session, ids)
    # each work's cover: our copy, else its source
    covers: dict[int, str] = {}
    for work_id, copy, source in session.exec(
        select(Expression.work_id, Edition.cover, Edition.cover_source)
        .join(Expression, Expression.id == Edition.expression_id)
        .where(col(Expression.work_id).in_(ids), PICTURE)
        .order_by(Edition.id)
    ):
        covers.setdefault(work_id, public_url(copy) if copy else source)
    author_ids = {a.id for w in works for a in w.authors}
    names: dict[int, dict[str, str]] = {}
    for row in session.exec(
        select(AuthorName).where(col(AuthorName.author_id).in_(author_ids), col(AuthorName.language).in_(wanted))
    ):
        names.setdefault(row.author_id, {})[row.language] = row.name
    found = []
    for work in works:
        entry = texts[work.id]
        found.append(
            WorkRead.model_validate(
                work,
                update={
                    "title": shown_title(entry),
                    "approximate": work.is_year_approximate,
                    "curated": work.is_curated,
                    "language": entry["original"][0] if entry["original"] else None,
                    "titles": {lang: t for lang, t in entry["titles"].items() if lang in wanted},
                    "cover": covers.get(work.id),
                    "authors": [AuthorRead(slug=p.slug, name=p.name, names=names.get(p.id, {})) for p in work.authors],
                },
            )
        )
    return found


# on our tracks (not readers' own, or retired ones)
ON_OUR_TRACKS = (
    select(TrackStop.work_id)
    .join(Track, col(Track.id) == TrackStop.track_id)
    .where(col(Track.owner_id).is_(None), col(Track.retired_at).is_(None))
)
# sort title: the slug without "the", "a" or "an"
SORT_TITLE = func.regexp_replace(Work.slug, "^(the|a|an)-", "")
# for the popular order: how many readers have it, and whether it has a cover
READERS = select(func.count()).where(Reading.work_id == Work.id).correlate(Work).scalar_subquery()
COVERED = exists(
    select(Edition.id)
    .join(Expression, col(Expression.id) == Edition.expression_id)
    .where(Expression.work_id == Work.id, PICTURE)
).correlate(Work)
SORTS = {
    # Most shelved first, with covers first within each. Then Open Library's most read, which were
    # added in that order, then ours, then the dataset's.
    "popular": [
        READERS.desc(),
        COVERED.desc(),
        Work.source != "openlibrary",
        Work.source == "dataset",
        Work.id,
    ],
    "title": [SORT_TITLE, Work.id],
    "oldest": [col(Work.year).asc().nulls_last(), SORT_TITLE],
    "newest": [col(Work.year).desc().nulls_last(), SORT_TITLE],
}


@dataclass
class Browse:
    """Filters and sort order of the full list of works, shared by GET /works and GET /works/count."""

    author: str | None = Query(None, max_length=1000, description="the works of these authors, by their slugs: a,b")
    difficulty: Difficulty | None = None
    year_from: int | None = Query(None, description="first published in this year or later")
    year_until: int | None = Query(None, description="first published before this year")
    on_track: bool = Query(False, description="only the works on our reading tracks")
    category: str | None = Query(None, max_length=40, description='one of our categories: "classics"')
    sort: Literal["popular", "title", "oldest", "newest"] = "popular"

    def query(self):
        """Return the works these filters leave, unsorted."""
        query = select(Work)
        if self.author:
            query = query.where(
                col(Work.id).in_(
                    select(WorkAuthor.work_id)
                    .join(Author, col(Author.id) == WorkAuthor.author_id)
                    .where(col(Author.slug).in_(self.author.split(",")))
                )
            )
        if self.difficulty:
            query = query.where(Work.difficulty == self.difficulty)
        if self.year_from is not None:
            query = query.where(col(Work.year) >= self.year_from)
        if self.year_until is not None:
            query = query.where(col(Work.year) < self.year_until)
        if self.on_track:
            query = query.where(col(Work.id).in_(ON_OUR_TRACKS))
        if self.category:
            query = query.where(col(Work.categories).contains([self.category]))
        elif self.sort == "popular":
            # Only works on a bookshelf or not from the dataset, which has tens of thousands. A
            # category has all its works, the dataset's last: there are fewer, and they fill its
            # shelf.
            query = query.where(or_(Work.source != "dataset", col(Work.id).in_(select(Reading.work_id))))
        return query


@router.get("/works", response_model=list[WorkRead])
@limiter.limit("120/minute")
def list_works(
    request: Request,
    session: SessionDep,
    browse: Annotated[Browse, Depends()],
    languages: str = Languages,
    q: str | None = Query(None, min_length=2, max_length=200, description="a search: the best matches first"),
    slugs: str | None = Query(None, max_length=20000, description="these works, by their slugs: a,b,c (200 at most)"),
    curated: bool = Query(False, description="every work we chose and rated, unpaged"),
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200, description="how many: a page, or a search's matches"),
) -> list[WorkRead]:
    """List works, a page at a time.

    With q, search titles and author names in any language. With slugs, return those works. With
    curated, return every work we rated. Otherwise return a filtered, sorted page of all works.
    """
    if q:
        return works_read(session, find_works(session, q, limit), languages)
    if slugs is not None:
        wanted = list(dict.fromkeys(s for s in slugs.split(",") if s))[:200]
        return works_read(session, list(session.exec(select(Work).where(col(Work.slug).in_(wanted)))), languages)
    if curated:
        works = session.exec(select(Work).where(Work.is_curated).order_by(*SORTS["title"]))
        return works_read(session, list(works), languages)
    works = session.exec(browse.query().order_by(*SORTS[browse.sort]).offset(offset).limit(limit))
    return works_read(session, list(works), languages)


@router.get("/works/count", response_model=dict[str, int])
@limiter.limit("120/minute")
def count_works(request: Request, session: SessionDep, browse: Annotated[Browse, Depends()]) -> dict[str, int]:
    """Count the works in the full list with these filters."""
    return {"count": session.exec(select(func.count()).select_from(browse.query().subquery())).one()}


@router.post("/works/match", response_model=WorkMatches)
@limiter.limit("20/minute")
def match_works(
    request: Request, session: SessionDep, books: list[BookToMatch], languages: str = Languages
) -> WorkMatches:
    """Match books from another site's export (Goodreads, The StoryGraph) by ISBN, else by title and
    author. Returns one slug or null per book, in order, and those works.
    """
    if len(books) > 10000:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "That's more than 10,000 books.")
    found = match(session, [(b.title, b.author, b.isbn) for b in books])
    works = {w.id: w for w in session.exec(select(Work).where(col(Work.id).in_({i for i in found if i})))}
    return WorkMatches(
        slugs=[works[i].slug if i else None for i in found], works=works_read(session, list(works.values()), languages)
    )


# a real publication, not the work's cover picture (which has no ISBN or Open Library record)
PUBLISHED = or_(col(Edition.isbn).is_not(None), col(Edition.ol_edition).is_not(None))


@router.get("/works/{slug}/expressions", response_model=list[ExpressionRead])
def list_expressions(session: SessionDep, slug: str) -> list[ExpressionRead]:
    """List a work's languages, the original first, each with its title and edition count."""
    work = work_by_slug(session, slug)
    counts = dict(
        session.exec(
            select(Edition.expression_id, func.count())
            .join(Expression, Expression.id == Edition.expression_id)
            .where(Expression.work_id == work.id, PUBLISHED)
            .group_by(Edition.expression_id)
        ).all()
    )
    expressions = session.exec(
        select(Expression)
        .where(Expression.work_id == work.id)
        .order_by(col(Expression.is_original).desc(), Expression.language)
    )
    return [
        ExpressionRead(
            language=x.language, title=x.title, original=x.is_original, year=x.year, editions=counts.get(x.id, 0)
        )
        for x in expressions
    ]


@router.get("/works/{slug}/editions", response_model=list[EditionRead])
def list_editions(
    session: SessionDep,
    slug: str,
    language: str = Query(max_length=20, description='one of its languages: "nl"'),
    offset: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
) -> list[EditionRead]:
    """List a work's editions in one language, newest first, a page at a time."""
    work = work_by_slug(session, slug)
    editions = session.exec(
        select(Edition)
        .join(Expression, Expression.id == Edition.expression_id)
        .where(Expression.work_id == work.id, Expression.language == language, PUBLISHED)
        .order_by(col(Edition.year).desc().nulls_last(), Edition.id)
        .offset(offset)
        .limit(limit)
    )
    return [
        EditionRead(
            isbn=e.isbn,
            publisher=e.publisher,
            year=e.year,
            ol_edition=e.ol_edition,
        )
        for e in editions
    ]


@router.get("/works/search", response_model=list[OpenLibraryWork])
@limiter.limit("30/minute")
def search_open_library(request: Request, session: SessionDep, q: str = Query(min_length=3, max_length=200)):
    """Search Open Library, at most ten results, best match first. Works we already have, and their
    duplicates there, are left out.
    """
    try:
        docs = openlibrary.search(q)
    except openlibrary.Unavailable:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, "Open Library isn't answering. Try again in a moment.")
    ol_ids = {d["key"].rsplit("/", 1)[-1]: d for d in docs if d.get("key", "").startswith("/works/") and d.get("title")}
    have = set(session.exec(select(Work.ol_work).where(col(Work.ol_work).in_(list(ol_ids)))))
    have |= {ol for others in session.exec(select(Work.other_ol_works)) for ol in others if ol in ol_ids}
    have |= {
        ol for ol, d in ol_ids.items() if ol not in have and same_work(session, [d["title"]], d.get("author_name", []))
    }
    return [
        OpenLibraryWork(
            ol_work=ol_id,
            title=d["title"],
            author=(d.get("author_name") or [None])[0],
            year=d.get("first_publish_year"),
            cover=openlibrary.cover_url(d.get("cover_i")),
            editions=d.get("edition_count", 0),
        )
        for ol_id, d in ol_ids.items()
        if ol_id not in have
    ]


@router.post("/works/openlibrary/{ol_id}", response_model=WorkRead, status_code=status.HTTP_201_CREATED)
@limiter.limit("60/hour")
def add_from_open_library(
    request: Request,
    user: CurrentUser,
    session: SessionDep,
    background: BackgroundTasks,
    ol_id: str = Path(pattern=r"^OL\d+W$"),
    languages: str = Languages,
) -> WorkRead:
    """Add an Open Library work as a plain record, the first time a reader picks it. Picking it
    again, or a duplicate of a work we have, returns that work. It's completed in the background.
    """
    # new: no work of ours had it, and it isn't a duplicate of one either
    known = by_ol_work(session, ol_id)
    try:
        work = work_from_open_library(session, ol_id)
    except openlibrary.Unavailable:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, "Open Library isn't answering. Try again in a moment.")
    if work is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Open Library doesn't have that book.")
    added = known is None and work.ol_work == ol_id
    session.commit()
    session.refresh(work)
    if added:
        background.add_task(enrich_later, work.id)
    return works_read(session, [work], languages)[0]


@router.get("/tracks", response_model=list[TrackRead])
def list_tracks(session: SessionDep, languages: str = Languages) -> list[TrackRead]:
    """List our tracks in order, each in the first of the reader's languages it's translated into,
    else English.
    """
    tracks = list(session.exec(select(Track).where(col(Track.owner_id).is_(None)).order_by(Track.position)))
    wanted = [lang.strip().lower() for lang in languages.split(",") if lang.strip()][:10]
    return tracks_read(session, tracks, wanted)


@router.get("/readers", response_model=list[ReaderRead])
def list_readers(session: SessionDep) -> list[ReaderRead]:
    """List public profiles, newest first. A reader shows once they've confirmed their email."""
    users = list(session.exec(select(User).where(User.is_email_verified).order_by(col(User.created_at).desc())))
    return readers_read(session, users)


@router.get("/reflections", response_model=list[ReflectionRead])
def list_reflections(session: SessionDep) -> list[ReflectionRead]:
    """List published reflections, newest first."""
    reflections = session.exec(
        select(Reflection)
        .where(Reflection.status == "published")
        .order_by(col(Reflection.written_on).desc(), col(Reflection.created_at).desc())
    )
    return reflections_read(session, list(reflections))
