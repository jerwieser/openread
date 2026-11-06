"""covers on our own storage

An edition's cover is a copy we keep on our own storage, like readers' photos (editions.cover, its
name there), and where it comes from (editions.cover_source, a Wikimedia Commons or Open Library
address): to credit it and to fetch it again. The addresses so far are the sources; the copies are
made by python -m api.covers.

Revision ID: d688e96479bc
Revises: 9469fe7d592f
Create Date: 2026-10-29 16:25:23.983258

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel


# revision identifiers, used by Alembic.
revision: str = 'd688e96479bc'
down_revision: Union[str, Sequence[str], None] = '9469fe7d592f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column("editions", "cover", new_column_name="cover_source")
    op.add_column("editions", sa.Column("cover", sqlmodel.sql.sqltypes.AutoString(length=200), nullable=True))


def downgrade() -> None:
    # the copies stay in storage; only where they come from is kept
    op.drop_column("editions", "cover")
    op.alter_column("editions", "cover_source", new_column_name="cover")
