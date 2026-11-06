"""one cover per work

A work has one cover, its cover picture (an edition that's no publication: no ISBN, no Open Library
edition; api.expressions.set_cover), not one for each edition or language. A work without one whose
editions have covers gets the one the site showed for it as its cover picture: the first of its
original's editions without an ISBN, else of its original's, else of any. That edition hands over our
copy of it, if we have one. The editions' other covers, and our copies of them, go when python -m
api.covers runs next (it deletes files, which a migration doesn't).

Revision ID: 5a9951e18ee7
Revises: 36bda731ba82
Create Date: 2026-11-05 01:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = '5a9951e18ee7'
down_revision: Union[str, Sequence[str], None] = '36bda731ba82'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.execute("""
        CREATE TEMPORARY TABLE handed_over ON COMMIT DROP AS
        SELECT DISTINCT ON (x.work_id) e.id, e.expression_id, e.cover, e.cover_source
        FROM editions e JOIN expressions x ON x.id = e.expression_id
        WHERE e.cover_source IS NOT NULL
          AND x.work_id NOT IN (
            SELECT x2.work_id FROM editions e2 JOIN expressions x2 ON x2.id = e2.expression_id
            WHERE e2.isbn IS NULL AND e2.ol_edition IS NULL AND e2.cover_source IS NOT NULL)
        ORDER BY x.work_id, e.isbn IS NOT NULL, NOT x.is_original, e.id
    """)
    op.execute("INSERT INTO editions (expression_id, cover, cover_source) SELECT expression_id, cover, cover_source FROM handed_over")
    op.execute("UPDATE editions SET cover = NULL WHERE id IN (SELECT id FROM handed_over)")


def downgrade() -> None:
    """Downgrade schema: nothing to undo; the editions' covers are gone once python -m api.covers ran."""
