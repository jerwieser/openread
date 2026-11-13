"""Find and copy book covers. Each book has one cover, not one per edition or language.

1. Find covers for books without one: from Open Library (the record with the most editions that
   has a cover), else Wikimedia Commons. Skips dataset books no reader has used: there are tens of
   thousands, which would take days on every start.
2. Copy each cover to our storage. The site shows the source until the copy exists.

One book or picture per second. Only JPEG, PNG, WebP or GIF up to 5 MB is kept. Whatever fails waits
for the next run. Runs in the background on every production start, after complete.

    python -m backend.commands.covers    look for the missing covers, then copy them (make covers)
    --limit N                        only the first N of each
    --again                          copy them all again, replacing ours (a source that changed)
"""

import argparse
import http.client
import time
import urllib.error
import urllib.request

from sqlmodel import Session, col, or_, select

from backend.clients import openlibrary, wikidata
from backend.clients.openlibrary import USER_AGENT
from backend.clients.storage import delete_upload, picture_type, store_picture
from backend.db import engine
from backend.models import Edition, Expression, Work
from backend.services.enrich import ol_records
from backend.services.expressions import PICTURE, set_cover

MAX_BYTES = 5 * 1024 * 1024
SECONDS_BETWEEN = 1.0


def fetch_picture(url: str) -> tuple[bytes, str] | None:
    """Return the picture at this URL and its type ("jpg", "png", "webp", "gif"), or None if we
    don't keep it. Retries while a server is busy.
    """
    for attempt in range(4):
        try:
            request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
            with urllib.request.urlopen(request, timeout=30) as response:
                data = response.read(MAX_BYTES + 1)
            if len(data) > MAX_BYTES:
                return None
            extension = picture_type(data) or ("gif" if data.startswith((b"GIF87a", b"GIF89a")) else None)
            return (data, extension) if extension else None
        except urllib.error.HTTPError as error:
            if error.code not in (429, 503) or attempt == 3:
                return None
            asked = error.headers.get("Retry-After")
            time.sleep(int(asked) if asked and asked.isdigit() else 10 * (attempt + 1))
        # a refused or dropped connection, a time-out or a cut-off answer
        except (OSError, http.client.HTTPException):
            if attempt == 3:
                return None
            time.sleep(10 * (attempt + 1))
    return None


def pictured():
    """Return the ids of the works that have a cover."""
    return select(Expression.work_id).join(Edition, col(Edition.expression_id) == Expression.id).where(PICTURE)


def picture_of(work: Work) -> str | None:
    """Find a cover: Open Library's record with the most editions that has one, else Wikidata."""
    covered = [r for r in (openlibrary.work_record(i) for i in ol_records(work)) if r and r.get("cover_i")]
    if covered:
        return openlibrary.cover_url(max(covered, key=lambda r: r.get("edition_count", 0))["cover_i"])
    return wikidata.cover_of(work.wikidata) if work.wikidata else None


def find_missing(session: Session, limit: int | None) -> None:
    """Find a cover for each book without one."""
    # skip the dataset's works no reader has used (see above)
    used = or_(Work.source != "dataset", col(Work.ol_work).is_not(None))
    works = list(session.exec(select(Work).where(col(Work.id).not_in(pictured()), used).order_by(Work.slug)))[:limit]
    if not works:
        return
    print(f"Looking for covers for the {len(works)} books without one…")
    found = 0
    for i, work in enumerate(works, 1):
        try:
            if picture := picture_of(work):
                set_cover(session, work, picture)
                session.commit()
                found += 1
                print(f"[{i}/{len(works)}] {work.slug}: {picture}")
            else:
                print(f"[{i}/{len(works)}] {work.slug}: no cover anywhere")
        except Exception as error:  # noqa: BLE001 - one book's trouble doesn't stop the others
            session.rollback()
            print(f"[{i}/{len(works)}] {work.slug}: failed ({error!r}); left for the next run")
        time.sleep(SECONDS_BETWEEN)
    print(f"Found covers for {found} of the {len(works)} books.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Find the books' missing covers, and keep them on our own storage.")
    parser.add_argument("--limit", type=int, help="only the first N of each")
    parser.add_argument("--again", action="store_true", help="copy them all again, replacing ours")
    args = parser.parse_args()

    with Session(engine, expire_on_commit=False) as session:
        find_missing(session, args.limit)

        # every cover we have no copy of (or all of them, with --again)
        editions = list(
            session.exec(
                select(Edition, Work.slug)
                .join(Expression, col(Expression.id) == Edition.expression_id)
                .join(Work, col(Work.id) == Expression.work_id)
                .where(PICTURE, or_(col(Edition.cover).is_(None), args.again))
                .order_by(Edition.id)
            )
        )[: args.limit]
        minutes = max(1, round(len(editions) * SECONDS_BETWEEN / 60))
        print(f"Copying {len(editions)} covers to our storage, one a second (about {minutes} min)…")
        kept = failed = 0
        last = 0.0
        for i, (edition, slug) in enumerate(editions, 1):
            time.sleep(max(0.0, SECONDS_BETWEEN - (time.monotonic() - last)))
            last = time.monotonic()
            which = f"[{i}/{len(editions)}] {slug}"
            picture = fetch_picture(edition.cover_source)
            if picture is None:
                failed += 1
                print(f"{which}: not kept, {edition.cover_source}")
                continue
            old = edition.cover
            edition.cover = store_picture(*picture, folder="book_covers")
            session.add(edition)
            session.commit()
            delete_upload(old)
            kept += 1
            print(f"{which}: kept")
        print(f"Kept {kept} covers; {failed} couldn't be fetched or weren't a picture we keep.")


if __name__ == "__main__":
    main()
