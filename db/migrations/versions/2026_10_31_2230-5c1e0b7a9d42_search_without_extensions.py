"""search without extensions

Searching the catalogue is plain ILIKE now (api/search.py), and telling whether a work is one we have
compares titles in Python (api/works.py, same_work), so OpenRead runs on a Postgres that doesn't allow
extensions, like a shared Azure server. Drops what 8d3a1e99ca06 used to set up for searching: the
search indexes, f_unaccent and the pg_trgm and unaccent extensions. Databases made since have none of
them, so each goes only if it's there.

Revision ID: 5c1e0b7a9d42
Revises: 3289c28c2db3
Create Date: 2026-10-31 22:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '5c1e0b7a9d42'
down_revision: Union[str, Sequence[str], None] = '3289c28c2db3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.execute("DROP INDEX IF EXISTS ix_expressions_title_search")
    op.execute("DROP INDEX IF EXISTS ix_authors_name_search")
    op.execute("DROP INDEX IF EXISTS ix_author_names_name_search")
    op.execute("DROP FUNCTION IF EXISTS f_unaccent(text)")
    # only one that's there: Azure refuses any statement naming an extension it doesn't allow, even
    # DROP EXTENSION IF EXISTS
    for name in ("unaccent", "pg_trgm"):
        if op.get_bind().execute(sa.text("SELECT 1 FROM pg_extension WHERE extname = :name"), {"name": name}).first():
            op.execute(f"DROP EXTENSION {name}")


def downgrade() -> None:
    """Downgrade schema: nothing to put back; search doesn't use them any more."""
