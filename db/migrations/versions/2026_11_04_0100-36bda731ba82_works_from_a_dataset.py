"""works from a dataset

Works can come from a dataset of books too (api/dataset.py): source 'dataset', besides our catalogue,
readers' suggestions and Open Library.

Revision ID: 36bda731ba82
Revises: 5c1e0b7a9d42
Create Date: 2026-11-04 01:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = '36bda731ba82'
down_revision: Union[str, Sequence[str], None] = '5c1e0b7a9d42'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # (op.f: the name is final; the naming convention would add its prefix again)
    op.drop_constraint(op.f("ck_works_source"), "works", type_="check")
    op.create_check_constraint(
        op.f("ck_works_source"), "works", "source IN ('catalogue', 'suggestion', 'openlibrary', 'dataset')"
    )


def downgrade() -> None:
    """Downgrade schema: the dataset's works go first."""
    op.execute("DELETE FROM works WHERE source = 'dataset'")
    op.drop_constraint(op.f("ck_works_source"), "works", type_="check")
    op.create_check_constraint(op.f("ck_works_source"), "works", "source IN ('catalogue', 'suggestion', 'openlibrary')")
