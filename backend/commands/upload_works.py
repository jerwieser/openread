"""Add the works saved by author_books --save (data/openlibrary/*.json) to a database: the local one
or production's, by its env file (envs/.env.local or envs/.env.prod).

Each work is added as a reader adding it from Open Library would add it (backend.services.works.add_work),
from what the file says: no Open Library or Wikidata requests. A work we already have is skipped, and
a duplicate of one (the same titles and author, or Wikidata item) is remembered on that work, so
running it again changes nothing. Each work is committed on its own, so a run that stops halfway
keeps what it added.

Editions and covers come afterwards, from the complete and covers commands: production runs them on
every start, locally run make complete and make covers.

    uv run python -m backend.commands.upload_works FILE... --env local     add them to the local database
    --env prod                                                  production's (asks first)
    --dry-run                                                   show what would happen, change nothing
    --yes                                                       don't ask before writing to production
"""

import argparse
import json
import os
import sys
from pathlib import Path

from dotenv import dotenv_values

ENV_FILES = {"local": Path("envs/.env.local"), "prod": Path("envs/.env.prod")}
FORMAT = "openread-openlibrary-works/1"


def use_env(name: str) -> None:
    """Point the settings at this environment's file. Its values go into the process's environment,
    which the settings read before envs/.env.local, so this has to happen before backend.db is imported.
    """
    path = ENV_FILES[name]
    if not path.exists():
        sys.exit(f"{path} doesn't exist: copy {path}.example and fill it in.")
    os.environ.update({key: value for key, value in dotenv_values(path).items() if value is not None})


def read(path: Path) -> dict:
    content = json.loads(path.read_text(encoding="utf-8"))
    if content.get("format") != FORMAT:
        sys.exit(f"{path} isn't a file from author_books --save ({FORMAT}).")
    return content


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("files", nargs="+", type=Path, help="files saved by author_books --save")
    parser.add_argument("--env", choices=sorted(ENV_FILES), required=True, help="which database: its env file")
    parser.add_argument("--dry-run", action="store_true", help="show what would happen, change nothing")
    parser.add_argument("--yes", action="store_true", help="don't ask before writing to production")
    args = parser.parse_args()

    files = [(path, read(path)) for path in args.files]
    use_env(args.env)

    # only now: the engine is made from the settings when it's imported
    from sqlmodel import Session

    from backend.config import get_settings
    from backend.db import engine
    from backend.services.works import add_work, by_ol_work

    settings = get_settings()
    total = sum(len(content["works"]) for _, content in files)
    where = f"{settings.postgres_db} on {settings.postgres_host} ({settings.environment})"
    print(f"{'Trying' if args.dry_run else 'Adding'} {total} works to {where}\n")
    asks = settings.is_production and not args.dry_run and not args.yes
    if asks and input("This writes to the production database. Go ahead? [y/N] ").strip().lower() != "y":
        print("Nothing added.")
        return 1

    counts = {"added": 0, "had": 0, "duplicate": 0}
    with Session(engine) as session:
        for path, content in files:
            print(f"{path} ({content['author']['name']}):")
            for entry in content["works"]:
                ol_id, record = entry["ol_work"], entry["record"]
                if (existing := by_ol_work(session, ol_id)) is not None:
                    counts["had"] += 1
                    print(f"  had        {ol_id:<12} {existing.slug}")
                    continue
                work = add_work(session, ol_id, record, entry.get("wikidata"), entry.get("known") or {})
                if work.ol_work == ol_id:
                    counts["added"] += 1
                    print(f"  added      {ol_id:<12} {work.slug}")
                else:
                    counts["duplicate"] += 1
                    print(f"  duplicate  {ol_id:<12} of {work.slug} ({work.ol_work})")
                if not args.dry_run:
                    session.commit()
        if args.dry_run:
            session.rollback()

    done = "would be" if args.dry_run else "were"
    print(
        f"\n{counts['added']} {done} added, {counts['duplicate']} {done} duplicates of works we have, "
        f"{counts['had']} we had already."
    )
    if counts["added"] and not args.dry_run and not settings.is_production:
        print("Their editions and covers: make complete, then make covers.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
