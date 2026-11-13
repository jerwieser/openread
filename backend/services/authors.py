"""Finding authors, linking them to works, and their names in other languages."""

import re

from sqlmodel import Session, delete, func, select

from backend.models import Author, Work, WorkAuthor
from backend.utils import slugify


def byline(names: list[str]) -> str:
    """Format authors on one line: "Leo Tolstoy", "A, B and C", or "Anonymous" if nobody is named.
    The FE has its own version, in the reader's language.
    """
    if len(names) > 1:
        return " and ".join([", ".join(names[:-1]), names[-1]])
    return names[0] if names else "Anonymous"


def split_names(text: str) -> list[str]:
    """Split a line of names, as suggestions write them: "Betje Wolff & Aagje Deken"."""
    parts = (part.strip(" ,") for part in re.split(r"\s+(?:and|&)\s+|\s*;\s*", text.strip()))
    return [part[:200] for part in parts if part]


def author(session: Session, name: str, wikidata: str | None = None) -> Author:
    """Return the author with this Wikidata item, else this name (ignoring case), creating one if
    needed.
    """
    found = session.exec(select(Author).where(Author.wikidata == wikidata)).first() if wikidata else None
    found = found or session.exec(select(Author).where(func.lower(Author.name) == name.lower())).first()
    if found:
        if wikidata and not found.wikidata:
            found.wikidata = wikidata
            session.add(found)
        return found
    base = slugify(name)[:180] or "someone"
    slug, n = base, 1
    while session.exec(select(Author.id).where(Author.slug == slug)).first():
        n += 1
        slug = f"{base}-{n}"
    made = Author(slug=slug, name=name, wikidata=wikidata)
    session.add(made)
    session.flush()
    return made


def set_authors(session: Session, work: Work, names: list[str], items: dict[str, str] | None = None) -> None:
    """Set who wrote the work, in this order, replacing the current authors. items maps names to
    Wikidata items, where known.
    """
    if [p.name for p in work.authors] == names:
        return
    session.exec(delete(WorkAuthor).where(WorkAuthor.work_id == work.id))
    ids = list(dict.fromkeys(author(session, name, (items or {}).get(name)).id for name in names))
    session.add_all(WorkAuthor(work_id=work.id, author_id=aid, position=i) for i, aid in enumerate(ids))
    session.flush()
    session.expire(work, ["authors"])
