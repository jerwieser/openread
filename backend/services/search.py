"""Search the catalogue by title or author name in any language, matches at the start first.

Plain SQL without Postgres extensions, so it runs on any Postgres. Accents and spelling count, but
other languages often have the other spelling: "miserables" finds "Los miserables", and "tolstoi"
finds "Leo Tolstoi".
"""

from sqlalchemy import text
from sqlmodel import Session, col, select

from api.models import Work

# each piece of text a work can be found by
SEARCH = text("""
WITH found AS (
    SELECT x.work_id, x.title AS words
    FROM expressions x
    WHERE x.title ILIKE :within
  UNION ALL
    SELECT wa.work_id, a.name
    FROM authors a JOIN work_authors wa ON wa.author_id = a.id
    WHERE a.name ILIKE :within
  UNION ALL
    SELECT wa.work_id, n.name
    FROM author_names n JOIN work_authors wa ON wa.author_id = n.author_id
    WHERE n.name ILIKE :within
)
SELECT work_id, max(CASE WHEN words ILIKE :start THEN 2 ELSE 1 END) AS score
FROM found
GROUP BY work_id
ORDER BY score DESC, work_id
LIMIT :limit
""")


def escape_like(value: str) -> str:
    """Escape a value for a LIKE pattern."""
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def find_works(session: Session, query: str, limit: int = 50) -> list[Work]:
    """Return the works found by this search, best match first."""
    words = query.strip()
    if not words:
        return []
    rows = session.exec(
        SEARCH.bindparams(start=f"{escape_like(words)}%", within=f"%{escape_like(words)}%", limit=limit)
    ).all()
    order = [row.work_id for row in rows]
    works = {w.id: w for w in session.exec(select(Work).where(col(Work.id).in_(order)))}
    return [works[i] for i in order if i in works]
