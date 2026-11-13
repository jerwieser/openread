"""List an author's books on Open Library, and save them to data/ to add to a database later
(backend/commands/upload_works.py). Never touches a database itself.

Finds the author by name (the best match, the others named as alternatives) or by their Open Library
key, then all their works, most editions first, 100 per request.

With --save it also looks up each work's Wikidata item and its titles in other languages, as adding a
book from Open Library on the site does, in a couple of requests for all of them, and writes it all to
data/openlibrary/<author>-<key>.json. Nothing goes into a database: that's upload_works. The upload then needs neither Open Library nor Wikidata, and
adds exactly what the file says, so look it over first.

    uv run python -m backend.commands.author_books "Theodoor Kars"    a table of their works
    uv run python -m backend.commands.author_books OL52989A           the same, by key
    --save                                                        also save them for the upload

Or make author-books author="Theodoor Kars" save=1. Listing works with plain python3 too; saving needs
the project's packages (uv run).
"""

import argparse
import json
import re
import sys
from datetime import UTC, datetime
from pathlib import Path

from backend.clients.openlibrary import BASE, SEARCH_FIELDS, Unavailable, get_json
from backend.utils import slugify

PAGE = 100
DATA = Path("data/openlibrary")
# the file's format, checked by the upload
FORMAT = "openread-openlibrary-works/1"


def find_author(name_or_key: str) -> dict | None:
    """Return the Open Library author by key ("OL52989A") or the best match for a name, with the
    other matches under "others".
    """
    if re.fullmatch(r"OL\d+A", name_or_key):
        record = get_json(f"{BASE}/authors/{name_or_key}.json")
        return {"key": name_or_key, "name": record.get("name", name_or_key), "others": []}
    docs = get_json(f"{BASE}/search/authors.json", {"q": name_or_key, "limit": 10}).get("docs", [])
    if not docs:
        return None
    # the one with the most works when several have the name, as Open Library often has duplicates
    docs.sort(key=lambda d: d.get("work_count", 0), reverse=True)
    best, *others = docs
    return {**best, "others": others}


def works_by(author_key: str) -> list[dict]:
    """Return the search records of all of an author's works, most editions first, with their
    subjects (for our categories).
    """
    works: list[dict] = []
    while True:
        params = {
            "q": f"author_key:{author_key}",
            "fields": f"{SEARCH_FIELDS},subject",
            "sort": "editions",
            "limit": PAGE,
            "offset": len(works),
        }
        page = get_json(f"{BASE}/search.json", params, timeout=20)
        docs = page.get("docs", [])
        works += docs
        if not docs or len(works) >= page.get("numFound", 0):
            return works


def ol_id(doc: dict) -> str:
    return doc["key"].removeprefix("/works/")


def with_wikidata(docs: list[dict]) -> list[dict]:
    """Return each work as the upload adds it: its Open Library record, its Wikidata item and what
    Wikidata knows of it, as backend.services.works.work_from_open_library looks them up, but for all of
    them at once. (The site also checks the work's own Open Library record for an item, one request
    per work; Wikidata knows nearly all of those.) Stops if Wikidata doesn't answer, rather than save
    the works without what it knows.
    """
    # here, not at the top: it needs the project's packages, which listing doesn't
    from backend.clients import wikidata

    # a query for a hundred works takes longer than the site's few seconds
    def run(text: str) -> list[dict]:
        return wikidata.query(text, timeout=60)

    print(f"Looking up {len(docs)} works on Wikidata…", file=sys.stderr)
    items = wikidata.items_of_ol_works([ol_id(doc) for doc in docs], run)
    known = wikidata.titles(sorted(set(items.values())), run) if items else {}
    print(f"{len(items)} of them are on Wikidata.", file=sys.stderr)
    return [
        {
            "ol_work": ol_id(doc),
            "record": doc,
            "wikidata": items.get(ol_id(doc)),
            "known": known.get(items[ol_id(doc)], {}) if ol_id(doc) in items else {},
        }
        for doc in docs
    ]


def save(author: dict, docs: list[dict]) -> Path:
    """Write the works to data/openlibrary/<author>-<key>.json and return its path."""
    DATA.mkdir(parents=True, exist_ok=True)
    path = DATA / f"{slugify(author['name']) or 'author'}-{author['key']}.json"
    content = {
        "format": FORMAT,
        "saved_at": datetime.now(UTC).isoformat(timespec="seconds"),
        "author": {"key": author["key"], "name": author["name"]},
        "works": with_wikidata(docs),
    }
    path.write_text(json.dumps(content, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return path


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("author", help='a name ("Theodoor Kars") or an Open Library key (OL52989A)')
    parser.add_argument("--save", action="store_true", help=f"also save them to {DATA}/ for upload_works")
    args = parser.parse_args()

    try:
        author = find_author(args.author)
        if not author:
            print(f"No author on Open Library matches {args.author!r}.", file=sys.stderr)
            return 1
        docs = works_by(author["key"])
    except Unavailable as error:
        print(f"Open Library didn't answer: {error}", file=sys.stderr)
        return 1

    print(f"{author['name']} ({author['key']}): {len(docs)} works\n")
    for doc in docs:
        year = doc.get("first_publish_year") or "    "
        languages = ",".join(doc.get("language", [])) or "-"
        print(f"  {ol_id(doc):<12} {year}  {doc.get('edition_count', 0):>3} ed.  {languages:<8}  {doc.get('title')}")
    for other in author["others"]:
        print(f"\nAlso matching: {other.get('name')} ({other['key']}), {other.get('work_count', 0)} works", end="")
    if author["others"]:
        print("\nPass a key instead of the name to list one of those.")

    if args.save:
        try:
            import sqlmodel  # noqa: F401 (the Wikidata lookups need the project's packages)
        except ImportError:
            print("\nNot saved: saving needs the project's packages. Run it with uv run, or make author-books save=1.")
            return 1
        print(file=sys.stderr)
        try:
            path = save(author, [doc for doc in docs if doc.get("title")])
        except Unavailable as error:
            print(f"Not saved: Wikidata didn't answer ({error}). Try again in a moment.", file=sys.stderr)
            return 1
        print(f"\nSaved to {path}. Add them with: make upload-works files={path} env=local")
    else:
        print("\nNot saved. Add --save (with make: save=1) to save them for upload-works.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
