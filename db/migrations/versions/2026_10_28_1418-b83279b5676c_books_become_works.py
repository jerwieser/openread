"""books become works

What readers call a book is, in the library standard, a work: Bonita Avenue in any language and any
print, as opposed to one of its translations or editions. The database says so now: books are works,
book_id is work_id, and every table, constraint, index and sequence named after books follows.

Revision ID: b83279b5676c
Revises: ab85719359db
Create Date: 2026-10-28 10:18:02.685261

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel


# revision identifiers, used by Alembic.
revision: str = 'b83279b5676c'
down_revision: Union[str, Sequence[str], None] = 'ab85719359db'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# table names, then the names inside constraint and index names, longest first so "books" doesn't
# eat "edition_books"
TABLES = [
    ("books", "works"),
    ("book_titles", "work_titles"),
    ("book_authors", "work_authors"),
    ("book_statuses", "work_statuses"),
    ("edition_books", "edition_works"),
]
# the tables with a book_id, by their names after the rename
WITH_ID = [
    "work_titles",
    "work_authors",
    "work_statuses",
    "edition_works",
    "translations",
    "track_stops",
    "track_skips",
    "reflections",
    "messages",
    "suggestions",
]
NAMES = [
    ("edition_books", "edition_works"),
    ("book_statuses", "work_statuses"),
    ("book_titles", "work_titles"),
    ("book_authors", "work_authors"),
    ("books", "works"),
    ("book_id", "work_id"),
]


def _rename(name: str, pairs: list[tuple[str, str]]) -> str:
    for old, new in pairs:
        name = name.replace(old, new)
    return name


def _rename_names(pairs: list[tuple[str, str]], marker: str) -> None:
    """Every constraint, index and sequence whose name has the marker in it, renamed by the pairs."""
    bind = op.get_bind()
    constraints = bind.execute(
        sa.text(
            "SELECT conrelid::regclass::text, conname FROM pg_constraint "
            "WHERE connamespace = 'public'::regnamespace AND conname LIKE :m"
        ),
        {"m": f"%{marker}%"},
    ).all()
    for table, name in constraints:
        if _rename(name, pairs) == name:
            continue
        op.execute(f'ALTER TABLE "{table}" RENAME CONSTRAINT "{name}" TO "{_rename(name, pairs)}"')
    # the indexes that aren't a constraint's (renaming a constraint renames its index)
    taken = {name for _, name in constraints}
    for (name,) in bind.execute(
        sa.text("SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND indexname LIKE :m"), {"m": f"%{marker}%"}
    ).all():
        if name not in taken and _rename(name, pairs) != name:
            op.execute(f'ALTER INDEX "{name}" RENAME TO "{_rename(name, pairs)}"')
    for (name,) in bind.execute(
        sa.text("SELECT sequencename FROM pg_sequences WHERE schemaname = 'public' AND sequencename LIKE :m"),
        {"m": f"%{marker}%"},
    ).all():
        if _rename(name, pairs) != name:
            op.execute(f'ALTER SEQUENCE "{name}" RENAME TO "{_rename(name, pairs)}"')


def upgrade() -> None:
    for old, new in TABLES:
        op.rename_table(old, new)
    for table in WITH_ID:
        op.alter_column(table, "book_id", new_column_name="work_id")
    _rename_names(NAMES, "book")


def downgrade() -> None:
    back = [(new, old) for old, new in NAMES]
    _rename_names(back, "work")
    for table in WITH_ID:
        op.alter_column(table, "work_id", new_column_name="book_id")
    for old, new in TABLES:
        op.rename_table(new, old)
