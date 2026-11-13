"""Fill in what works are missing. Only missing data is fetched, so a finished run takes moments.

- titles: from Wikidata, for works with an item and at most two titles (it has dozens for most)
- editions: from Open Library, for works with none from there yet

At most one request per second to each service, with retries. A book that fails waits for the next
run. Runs in the background on every production start, before covers.

    python -m backend.commands.complete    fill in what's missing
    --limit N                          only the first N works of each
"""

import argparse
import http.client
import json
import time
import urllib.error
import urllib.parse
import urllib.request

from sqlmodel import Session, col, func, select

from backend.clients import openlibrary, wikidata
from backend.clients.openlibrary import USER_AGENT
from backend.db import engine
from backend.models import Edition, Expression, Work
from backend.services.editions import from_open_library, save_editions
from backend.services.enrich import ol_records
from backend.services.expressions import set_titles

SECONDS_BETWEEN = 1.0
_last = 0.0


def polite(request: urllib.request.Request) -> dict:
    """Fetch JSON at most once a second, retrying while a server is busy."""
    global _last
    for attempt in range(4):
        time.sleep(max(0.0, SECONDS_BETWEEN - (time.monotonic() - _last)))
        _last = time.monotonic()
        try:
            with urllib.request.urlopen(request, timeout=60) as response:
                return json.load(response)
        # a refused or dropped connection, a time-out, a cut-off answer or invalid JSON
        except (OSError, http.client.HTTPException, ValueError) as error:
            # what isn't there won't be there on a second try
            if attempt == 3 or (isinstance(error, urllib.error.HTTPError) and error.code in (400, 403, 404, 410)):
                raise
            asked = error.headers.get("Retry-After") if isinstance(error, urllib.error.HTTPError) else None
            wait = int(asked) if asked and asked.isdigit() else 10 * (attempt + 1)
            print(f"  … {error}, trying again in {wait}s")
            time.sleep(wait)
    raise AssertionError("unreachable")


def sparql(query: str) -> list[dict]:
    """Run a Wikidata query, sent as a form so long lists fit."""
    data = urllib.parse.urlencode({"query": query, "format": "json"}).encode()
    headers = {"User-Agent": USER_AGENT, "Accept": "application/sparql-results+json"}
    return polite(urllib.request.Request(wikidata.SPARQL, data=data, headers=headers))["results"]["bindings"]


def editions_of(ol_id: str) -> list[dict]:
    """Return all of a work's editions on Open Library, 1000 per request."""
    entries: list[dict] = []
    while True:
        params = urllib.parse.urlencode({"limit": 1000, "offset": len(entries)})
        url = f"{openlibrary.BASE}/works/{ol_id}/editions.json?{params}"
        page = polite(urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/json"}))
        entries += page.get("entries", [])
        if not page.get("links", {}).get("next") or not page.get("entries"):
            return entries


def save_titles(session: Session, works: list[Work]) -> int:
    """Set each work's original and titles from Wikidata. Return how many works had them. Commits."""
    found = wikidata.titles([w.wikidata for w in works if w.wikidata], run=sparql)
    for work in works:
        if entry := found.get(work.wikidata or ""):
            set_titles(session, work, entry["language"], entry["titles"])
    session.commit()
    return sum(1 for work in works if work.wikidata in found)


def without_titles(session: Session) -> list[Work]:
    """Return the works with a Wikidata item and at most two titles."""
    counts = (
        select(Expression.work_id)
        .where(col(Expression.title).is_not(None))
        .group_by(Expression.work_id)
        .having(func.count() > 2)
    )
    return list(
        session.exec(
            select(Work).where(col(Work.wikidata).is_not(None), col(Work.id).not_in(counts)).order_by(Work.slug)
        )
    )


def without_editions(session: Session) -> list[Work]:
    """Return the works on Open Library with no editions from there."""
    with_editions = (
        select(Expression.work_id)
        .join(Edition, col(Edition.expression_id) == Expression.id)
        .where(col(Edition.ol_edition).is_not(None))
    )
    return list(
        session.exec(
            select(Work).where(col(Work.ol_work).is_not(None), col(Work.id).not_in(with_editions)).order_by(Work.slug)
        )
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Fill in the titles and editions the works are missing.")
    parser.add_argument("--limit", type=int, help="only the first N works of each")
    args = parser.parse_args()

    with Session(engine, expire_on_commit=False) as session:
        works = without_titles(session)[: args.limit]
        if works:
            print(f"Asking Wikidata for the titles of {len(works)} books…")
            try:
                print(f"Wikidata has titles for {save_titles(session, works)} of them.")
            except Exception as error:  # noqa: BLE001 - whatever went wrong, the editions still come
                session.rollback()
                print(f"The titles failed ({error!r}); they wait for the next start.")

        works = without_editions(session)[: args.limit]
        if works:
            print(f"Asking Open Library for the editions of {len(works)} books…")
        missed = 0
        for i, work in enumerate(works, 1):
            # one at a time, so a failure doesn't stop the rest
            try:
                records = [from_open_library(e) for ol_id in ol_records(work) for e in editions_of(ol_id)]
                added = save_editions(session, work, records)
                session.commit()
                print(f"[{i}/{len(works)}] {work.slug}: {len(records)} editions, {added} new")
            except Exception as error:  # noqa: BLE001 - one book's trouble doesn't stop the others
                session.rollback()
                missed += 1
                print(f"[{i}/{len(works)}] {work.slug}: failed ({error!r}); left for the next start")
        if missed:
            print(f"{missed} books' editions wait for the next start.")


if __name__ == "__main__":
    main()
