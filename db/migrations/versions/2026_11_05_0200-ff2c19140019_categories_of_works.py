"""categories of works

The kinds of book a work is, of a small set of ours ("classics", "history": api/categories.py), for
the books page's shelves, with an index to find a category's works among tens of thousands. Filled by
python -m api.categories and api/dataset.py.

Revision ID: ff2c19140019
Revises: 5a9951e18ee7
Create Date: 2026-11-05 02:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'ff2c19140019'
down_revision: Union[str, Sequence[str], None] = '5a9951e18ee7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        "works", sa.Column("categories", postgresql.ARRAY(sa.String(length=100)), server_default="{}", nullable=False)
    )
    op.create_index("ix_works_categories", "works", ["categories"], unique=False, postgresql_using="gin")


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index("ix_works_categories", table_name="works", postgresql_using="gin")
    op.drop_column("works", "categories")
