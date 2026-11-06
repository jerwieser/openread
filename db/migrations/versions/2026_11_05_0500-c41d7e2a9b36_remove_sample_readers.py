"""remove sample readers

OpenRead is for real readers now. Deleting the samples also removes what hangs off them through
the foreign keys: their reading, their reflections and every message to or from them. The people
can't be brought back by a downgrade, only the column.

Revision ID: c41d7e2a9b36
Revises: 86c9bc7c1031
Create Date: 2026-11-05 05:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c41d7e2a9b36'
down_revision: Union[str, Sequence[str], None] = '86c9bc7c1031'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("DELETE FROM users WHERE is_sample")
    op.drop_column('users', 'is_sample')


def downgrade() -> None:
    op.add_column('users', sa.Column('is_sample', sa.Boolean(), server_default='false', nullable=False))
