"""Completing a work: its titles in other languages, its Open Library records and their editions.

A reader often picks a translation's record ("De welwillenden" for Littell's novel), and Open
Library has duplicates of many works, sometimes a small one without covers next to the main one. So:

1. Find its Wikidata item, if it has none, unless another of our works has it. Take its original
   and titles from there, keeping the title the reader knows.
2. Find its other Open Library records, by two searches and through its authors' works. The one
   with the most editions becomes ol_work, the others its duplicates.
3. Save the editions of all its records, under their languages.

A record another of our works has stays with that work.
"""

import difflib
import re
import unicodedata

from sqlmodel import Session, col, select

from api.clients import openlibrary, wikidata
from api.db import engine
from api.models import AuthorName, Edition, Expression, Work
from api.services.categories import from_subjects
from api.services.editions import from_open_library, save_editions
from api.services.expressions import UNDETERMINED, set_titles, shown_title, titles_of
from api.services.languages import from_marc
from api.services.works import item_of

# how alike titles must be (difflib's ratio, on main titles)
SAME_TITLE = 0.85


def main_title(title: str) -> str:
    """Normalize a title: no case, accents, punctuation, subtitle or leading article."""
    plain = "".join(c for c in unicodedata.normalize("NFKD", title) if not unicodedata.combining(c)).lower()
    plain = re.split(r"\s*[:;(/]", plain)[0]
    plain = re.sub(r"^(the|a|an|de|het|een|le|la|les|l'|der|die|das|el|los|las|il|lo)\s+", "", plain.strip())
    return re.sub(r"[\W_]+", " ", plain).strip()


def surname(name: str) -> str:
    parts = "".join(c for c in unicodedata.normalize("NFKD", name) if not unicodedata.combining(c)).split()
    return parts[-1].lower() if parts else ""


def same_name(name: str, surnames: set[str]) -> bool:
    """Check whether a name on a record is one of the authors', by surname. Allows other spellings
    ("Fiódor Dostoievski", "Fyodor Dostoevsky": 0.86) but not other people ("Auster", "Austen":
    0.83).
    """
    mine = surname(name)
    return bool(mine) and any(difflib.SequenceMatcher(None, mine, s).ratio() >= SAME_TITLE for s in surnames)


def alike(title: str, titles: set[str]) -> bool:
    """Check whether a title is one of these, comparing main titles."""
    mine = main_title(title)
    return bool(mine) and any(difflib.SequenceMatcher(None, mine, t).ratio() >= SAME_TITLE for t in titles)


def ol_records(work: Work) -> list[str]:
    return [i for i in [work.ol_work, *work.other_ol_works] if i]


def taken_records(session: Session, work: Work) -> set[str]:
    """Return the Open Library records our other works have."""
    return {i for other in session.exec(select(Work).where(Work.id != work.id)) for i in ol_records(other)}


def searched(session: Session, work: Work) -> list[str]:
    """Return the Open Library works two searches find, and the others with one of its titles.

    - title and first author as one search: finds classics under their original title
      ("Cien años de soledad", "Идиот")
    - title by first author: Open Library matches any name it knows ("Natsume Sōseki", "夏目漱石")

    Both cover all of an author's records: Open Library has several for many authors ("Geert Mak"
    twice), and a work's main record is often under another one.
    """
    if not work.authors:
        return []
    entry = titles_of(session, [work.id])[work.id]
    titles = {main_title(t) for t in entry["titles"].values()} - {""}
    title, author = entry["titles"].get("en") or shown_title(entry), work.authors[0].name
    names = [a.name for a in work.authors] + list(
        session.exec(select(AuthorName.name).where(col(AuthorName.author_id).in_([a.id for a in work.authors])))
    )
    surnames = {surname(n) for n in names} - {""}
    theirs = [
        d
        for d in openlibrary.search(f"{title} {author}", limit=20)
        if any(same_name(n, surnames) for n in d.get("author_name", []))
    ]
    by = openlibrary.search_by(title, author)
    found = [
        d["key"].rsplit("/", 1)[-1]
        for docs in (theirs, by)
        for d in [*docs[:1], *(d for d in docs if alike(d.get("title", ""), titles))]
    ]
    return list(dict.fromkeys(found))


def records_of(session: Session, work: Work, ol_ids: list[str]) -> list[str]:
    """Return its other Open Library records: its authors' works there with one of its titles."""
    titles = {main_title(t) for t in titles_of(session, [work.id])[work.id]["titles"].values()} - {""}
    authors = {key for ol_id in ol_ids for key in (openlibrary.work_record(ol_id) or {}).get("author_key", [])}
    return [
        doc["key"].rsplit("/", 1)[-1]
        for key in sorted(authors)[:3]
        for doc in openlibrary.works_of(key)
        if alike(doc.get("title", ""), titles)
    ]


def place_undetermined(session: Session, work: Work) -> None:
    """Give its undetermined expression the language of its Open Library editions, if they're all in
    one and it has no title in that language yet.
    """
    found = session.exec(
        select(Expression).where(Expression.work_id == work.id, Expression.language == UNDETERMINED)
    ).first()
    if not found or not work.ol_work:
        return
    record = openlibrary.work_record(work.ol_work) or {}
    languages = {from_marc(code) for code in record.get("language", [])} - {None}
    if len(languages) != 1:
        return
    language = languages.pop()
    if not session.exec(
        select(Expression.id).where(Expression.work_id == work.id, Expression.language == language)
    ).first():
        found.language = language
        session.add(found)
        session.flush()


def fold_undetermined(session: Session, work: Work) -> None:
    """Merge its undetermined expression, with its editions, into the expression with the same
    title.
    """
    found = session.exec(
        select(Expression).where(Expression.work_id == work.id, Expression.language == UNDETERMINED)
    ).first()
    if not found or not found.title:
        return
    same = session.exec(
        select(Expression).where(
            Expression.work_id == work.id, Expression.language != UNDETERMINED, Expression.title == found.title
        )
    ).first()
    if same is None:
        return
    for edition in session.exec(select(Edition).where(Edition.expression_id == found.id)):
        edition.expression_id = same.id
        session.add(edition)
    session.flush()
    session.delete(found)
    session.flush()


def find_item(session: Session, work: Work) -> str | None:
    """Find its Wikidata item if it has none, unless another of our works has it, and take its
    titles from there, keeping the ones it has. Flushes.
    """
    if work.wikidata:
        return None
    for ol_id in ol_records(work):
        item = item_of(ol_id)
        if item and not session.exec(select(Work.id).where(Work.wikidata == item)).first():
            work.wikidata = item
            session.add(work)
            known = wikidata.titles([item]).get(item, {})
            if known.get("titles"):
                set_titles(session, work, known.get("language"), known["titles"], keep=True)
                fold_undetermined(session, work)
            session.flush()
            return item
    return None


def enrich(session: Session, work: Work) -> str:
    """Complete the work and return what it did, in a line. Commits."""
    done = []
    place_undetermined(session, work)
    if item := find_item(session, work):
        done.append(f"Wikidata {item}")
    taken = taken_records(session, work)
    have = ol_records(work)
    found = [i for i in dict.fromkeys(searched(session, work)) if i not in have and i not in taken]
    found += [
        i for i in records_of(session, work, [*have, *found]) if i not in have and i not in taken and i not in found
    ]
    # skip records Open Library no longer has (merged or deleted)
    known = {i: openlibrary.work_record(i) for i in [*have, *found]}
    ol_ids = [*have, *(i for i in found if known[i])]
    if ol_ids:
        work.ol_work = max(ol_ids, key=lambda i: (known[i] or {}).get("edition_count", 0))
        work.other_ol_works = [i for i in ol_ids if i != work.ol_work]
        # the year, for a dataset work without one, and its categories, if it has none
        if work.year is None:
            work.year = (known[work.ol_work] or {}).get("first_publish_year")
        if not work.categories:
            work.categories = from_subjects((known[work.ol_work] or {}).get("subject", []))
        session.add(work)
        session.flush()
        # try for an item again: a main record names it more often than a small one
        if item := find_item(session, work):
            done.append(f"Wikidata {item}")
    records = [from_open_library(entry) for ol_id in ol_ids for entry in openlibrary.editions(ol_id)]
    done.append(f"{len(ol_ids)} records on Open Library, {save_editions(session, work, records)} new editions")
    session.commit()
    return "; ".join(done)


def enrich_later(work_id: int) -> None:
    """Run enrich as a background task. If Open Library or Wikidata doesn't answer, the work is left
    for the enrich command.
    """
    with Session(engine) as session:
        work = session.get(Work, work_id)
        if work is None:
            return
        try:
            enrich(session, work)
        except openlibrary.Unavailable:
            session.rollback()
