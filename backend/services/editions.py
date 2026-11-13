"""Saving a work's editions from Open Library's records, under the expression in their language. An
edition without a known language isn't kept. An ISBN printed in an omnibus stays with the first work
that has it.
"""

import re

from sqlmodel import Session, col, or_, select

from api.clients.openlibrary import isbn13
from api.models import Edition, Work
from api.services.expressions import expression
from api.services.languages import from_marc

YEAR = re.compile(r"\b(1[4-9]\d\d|20\d\d)\b")


def from_open_library(entry: dict) -> dict:
    """Return what we keep of an Open Library edition record: { ol_edition, isbn, language,
    publisher, year }. Only one language: a bilingual edition is in neither.
    """
    codes = [lang["key"].rsplit("/", 1)[-1] for lang in entry.get("languages", [])]
    isbns = [i for i in (isbn13(v) for v in entry.get("isbn_13", []) + entry.get("isbn_10", [])) if i]
    year = YEAR.search(entry.get("publish_date", ""))
    return {
        "ol_edition": entry["key"].rsplit("/", 1)[-1],
        "isbn": isbns[0] if isbns else None,
        "language": from_marc(codes[0]) if len(codes) == 1 else None,
        "publisher": ((entry.get("publishers") or [""])[0] or "")[:300] or None,
        "year": int(year.group()) if year else None,
    }


def save_editions(session: Session, work: Work, records: list[dict]) -> int:
    """Save these editions of the work under their expressions, keeping what's known. Return how
    many are new.
    """
    placed = [r for r in records if r["language"]]
    keys = [r["ol_edition"] for r in placed]
    isbns = [r["isbn"] for r in placed if r["isbn"]]
    have: dict[str, Edition] = {}
    for start in range(0, max(len(keys), len(isbns)), 2000):
        for edition in session.exec(
            select(Edition).where(
                or_(
                    col(Edition.ol_edition).in_(keys[start : start + 2000]),
                    col(Edition.isbn).in_(isbns[start : start + 2000]),
                )
            )
        ):
            for key in (edition.ol_edition, edition.isbn):
                if key:
                    have[key] = edition
    expressions = {}
    added = 0
    for record in placed:
        edition = have.get(record["ol_edition"]) or have.get(record["isbn"] or "")
        if edition is None:
            if record["language"] not in expressions:
                expressions[record["language"]] = expression(session, work, record["language"])
            edition = Edition(expression_id=expressions[record["language"]].id)
            added += 1
        for field in ("ol_edition", "isbn", "publisher", "year"):
            value = record[field]
            # take Open Library's data, but don't erase what we know; an ISBN stays with the edition
            # that has it
            if value is not None and not (field == "isbn" and value in have and have[value] is not edition):
                setattr(edition, field, value)
        session.add(edition)
        for key in (record["ol_edition"], record["isbn"]):
            if key:
                have[key] = edition
    session.flush()
    return added
