"""drop specialties

Only the sample readers had any, and readers can't set them.

Revision ID: b83f6d1e4c27
Revises: e72b4f1c8a05
Create Date: 2026-11-05 07:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'b83f6d1e4c27'
down_revision: Union[str, Sequence[str], None] = 'e72b4f1c8a05'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_column('users', 'specialties')


def downgrade() -> None:
    op.add_column('users', sa.Column('specialties', postgresql.ARRAY(sa.String(length=100)), server_default='{}', nullable=False))
