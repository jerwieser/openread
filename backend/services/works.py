"""Adding Open Library works to OpenRead as plain records, and telling whether we already have a
work.
"""

import re
import unicodedata

from sqlalchemy import text
from sqlmodel import Session, col, or_, select

from backend.clients import openlibrary, wikidata
from backend.models import Author, AuthorName, Edition, Expression, Work, WorkAuthor
from backend.services.authors import set_authors
from backend.services.categories import from_subjects
from backend.services.expressions import UNDETERMINED, expression, set_cover, set_titles
from backend.services.languages import from_marc
from backend.services.search import escape_like
from backend.utils import now, slugify


def item_of(ol_id: str) -> str | None:
    """Return the Wikidata item of an Open Library work, from its own record, else from Wikidata.
    None if neither knows, or Wikidata doesn't answer.
    """
    try:
        return openlibrary.wikidata_of(ol_id) or wikidata.item_of_ol_work(ol_id)
    except openlibrary.Unavailable:
        return None


# Titles of the works by authors with these surnames (patterns: "tolstoy", "% tolstoy"), for
# same_work. Plain ILIKE, so it runs on any Postgres; the titles are compared in Python.
BY_SURNAME = text("""
SELECT x.work_id, x.title
FROM expressions x
WHERE x.title IS NOT NULL AND x.work_id IN (
    SELECT wa.work_id FROM work_authors wa
    WHERE wa.author_id IN (
        SELECT a.id FROM authors a WHERE a.name ILIKE ANY (CAST(:names AS text[]))
      UNION
        SELECT n.author_id FROM author_names n WHERE n.name ILIKE ANY (CAST(:names AS text[]))))
""")
ARTICLE = re.compile(r"^(the|a|an|de|het|een|le|la|les|l'|der|die|das|ein|eine|el|los|las|un|una|il|lo|gli|o|os|as)\s+")
# how alike two titles must be: spellings match ("Donkere kamer van Damocles", "De donkere kamer van
# Damokles": 0.79), a series' books don't (Harry Potter's: 0.45)
SAME_TITLE = 0.6


def _fold(value: str) -> str:
    """Remove case and accents: "Misérables" becomes "miserables"."""
    return "".join(c for c in unicodedata.normalize("NFKD", value.casefold()) if not unicodedata.combining(c))


def main_title(title: str) -> str:
    """Normalize a title: no case, accents, subtitle or leading article."""
    return ARTICLE.sub("", re.sub(r"\s*[:;(/].*$", "", _fold(title)))


def _trigrams(value: str) -> set[str]:
    """Return a text's trigrams, padding each word as pg_trgm does ("  tolstoy ")."""
    return {f"  {w} "[i : i + 3] for w in re.findall(r"\w+", value) for i in range(len(w) + 1)}


def similarity(a: str, b: str) -> float:
    """Return how alike two texts are, from 0 to 1, like pg_trgm's similarity()."""
    x, y = _trigrams(a), _trigrams(b)
    return len(x & y) / len(x | y) if x | y else 0.0


def by_ol_work(session: Session, ol_id: str) -> Work | None:
    """Return our work for this Open Library work or one of its duplicates."""
    return session.exec(
        select(Work).where(or_(Work.ol_work == ol_id, col(Work.other_ol_works).contains([ol_id])))
    ).first()


def same_work(session: Session, titles: list[str], authors: list[str], wikidata: str | None = None) -> Work | None:
    """Find the work we have with these titles and authors, or this Wikidata item, so the same book
    isn't added twice.
    """
    if wikidata:
        found = session.exec(select(Work).where(Work.wikidata == wikidata)).first()
        if found:
            return found
    titles, authors = [t for t in titles if t and t.strip()], [a for a in authors if a and a.strip()]
    if not titles or not authors:
        return None
    # each surname with and without accents, as a whole name and as a last word
    surnames = {s for a in authors for s in (a.split()[-1], _fold(a.split()[-1]))}
    names = [p for s in surnames for p in (escape_like(s), f"% {escape_like(s)}")]
    wanted = [main_title(t) for t in titles]
    best = max(
        (
            (similarity(main_title(row.title), w), row.work_id)
            for row in session.exec(BY_SURNAME.bindparams(names=names))
            for w in wanted
        ),
        default=None,
    )
    return session.get(Work, best[1]) if best and best[0] >= SAME_TITLE else None


def surname(name: str) -> str:
    """Return a name's last word without case or accents: "tolstoy"."""
    words = name.split()
    return _fold(words[-1]) if words else ""


def match(session: Session, books: list[tuple[str, str, str | None]]) -> list[int | None]:
    """Match books from an export (title, author, ISBN) to our works: by ISBN, else by the most
    similar title from an author of that surname. Return each book's id or None. Uses a few queries
    for all of them, since an export has thousands.
    """
    isbns = {openlibrary.isbn13(isbn) for _, _, isbn in books if isbn} - {None}
    by_isbn = dict(
        session.exec(
            select(Edition.isbn, Expression.work_id)
            .join(Expression, col(Expression.id) == Edition.expression_id)
            .where(col(Edition.isbn).in_(isbns))
        ).all()
    )
    # the authors of each surname the export has, then their works and the works' titles
    wanted = {surname(author) for _, author, _ in books} - {""}
    authors: dict[str, set[int]] = {}
    for author_id, name in [
        *session.exec(select(Author.id, Author.name)),
        *session.exec(select(AuthorName.author_id, AuthorName.name)),
    ]:
        if (last := surname(name)) in wanted:
            authors.setdefault(last, set()).add(author_id)
    works_of: dict[int, set[int]] = {}
    for work_id, author_id in session.exec(
        select(WorkAuthor.work_id, WorkAuthor.author_id).where(
            col(WorkAuthor.author_id).in_(set().union(*authors.values()))
        )
    ):
        works_of.setdefault(author_id, set()).add(work_id)
    titles: dict[int, set[str]] = {}
    for work_id, title in session.exec(
        select(Expression.work_id, Expression.title).where(
            col(Expression.work_id).in_(set().union(*works_of.values())), col(Expression.title).is_not(None)
        )
    ):
        titles.setdefault(work_id, set()).add(main_title(title))
    found: list[int | None] = []
    for title, author, isbn in books:
        work = by_isbn.get(openlibrary.isbn13(isbn)) if isbn else None
        if work is None:
            mine = main_title(title)
            candidates = {w for a in authors.get(surname(author), ()) for w in works_of.get(a, ())}
            best = max(((max(similarity(mine, t) for t in titles.get(w, {""})), w) for w in candidates), default=None)
            work = best[1] if best and best[0] >= SAME_TITLE else None
        found.append(work)
    return found


def _free_slug(session: Session, *candidates: str) -> str:
    """Return the first of these slugs no work has yet."""
    for slug in candidates:
        if slug and not session.exec(select(Work.id).where(Work.slug == slug)).first():
            return slug
    raise ValueError("no free slug")


def work_from_open_library(session: Session, ol_id: str) -> Work | None:
    """Return the work for this Open Library work ("OL450063W"), adding a plain record if we don't
    have it.

    Takes its authors, year, cover and Wikidata item, and from Wikidata its titles and authors'
    names. A duplicate of a work we have returns that work, remembered in other_ol_works. Editions
    come later, from the complete command.

    Returns None if Open Library doesn't have it, and raises openlibrary.Unavailable if it doesn't
    answer. Flushes, doesn't commit.
    """
    existing = by_ol_work(session, ol_id)
    if existing:
        return existing
    doc = openlibrary.work_record(ol_id)
    if not doc or not doc.get("title"):
        return None
    # its Wikidata item, for its titles in other languages
    qid = item_of(ol_id)
    try:
        known = wikidata.titles([qid]).get(qid, {}) if qid else {}
    except openlibrary.Unavailable:
        # better a work without its languages than none; the complete command adds them
        known = {}
    return add_work(session, ol_id, doc, qid, known)


def add_work(session: Session, ol_id: str, doc: dict, qid: str | None, known: dict) -> Work:
    """Add an Open Library work from what was looked up: its search record (doc), its Wikidata item
    and what Wikidata knows of it (known: wikidata.titles' entry). A duplicate of a work we have
    returns that work, remembered in other_ol_works. Asks no one, so a file of works looked up
    earlier can be added too (backend/commands/upload_works.py). Flushes, doesn't commit.
    """
    names = known.get("titles", {})
    ours = same_work(
        session,
        [doc["title"], *names.values()],
        [*doc.get("author_name", []), *(name for _, name in known.get("authors", []))],
        qid,
    )
    if ours:
        ours.other_ol_works = [*ours.other_ol_works, ol_id]
        session.add(ours)
        session.flush()
        return ours
    # slug from its English title if it has one ("Kafka on the Shore"), else Open Library's
    english = names.get("en") or doc["title"]
    # its authors as Wikidata names them in English ("Haruki Murakami"), else as Open Library does ("村上春樹")
    authors = known.get("authors") or [(None, name) for name in doc.get("author_name", [])]
    authors = [(item, name[:200]) for item, name in authors[:10]]
    # a title in another script ("海辺のカフカ") gives no slug, so use the work's id
    base = slugify(english)[:150]
    surname = slugify(authors[0][1].split()[-1]) if authors and authors[0][1].split() else ""
    candidates = [base, f"{base}-{surname}" if surname else "", f"{base}-{ol_id.lower()}"] if base else [ol_id.lower()]
    work = Work(
        slug=_free_slug(session, *candidates),
        year=doc.get("first_publish_year"),
        is_curated=False,
        source="openlibrary",
        ol_work=ol_id,
        wikidata=qid,
        categories=from_subjects(doc.get("subject", [])),
        identified_at=now(),
    )
    session.add(work)
    session.flush()
    if names:
        set_titles(session, work, known.get("language"), names)
    else:
        # in the language of Open Library's editions if they're all in one: probably a translation
        # ("De welwillenden"), so not the original, which enrich looks for
        languages = {from_marc(code) for code in doc.get("language", [])} - {None}
        expression(session, work, languages.pop() if len(languages) == 1 else UNDETERMINED).title = doc["title"][:500]
    set_cover(session, work, openlibrary.cover_url(doc.get("cover_i")))
    set_authors(session, work, [name for _, name in authors], {name: item for item, name in authors if item})
    session.flush()
    session.refresh(work)
    return work
