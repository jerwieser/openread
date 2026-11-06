"""other open library works

Open Library has duplicates of works ("De donkere kamer van Damokles" and "Donkere kamer van
Damocles", by the same author): a work's others (works.other_ol_works), so the one a reader picks is
known as ours too, and isn't added a second time.

Revision ID: 3289c28c2db3
Revises: 8d3a1e99ca06
Create Date: 2026-10-30 04:05:31.938572

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '3289c28c2db3'
down_revision: Union[str, Sequence[str], None] = '8d3a1e99ca06'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        "works",
        sa.Column("other_ol_works", postgresql.ARRAY(sa.String(length=100)), server_default="{}", nullable=False),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("works", "other_ol_works")
