"""messages from openread

A message without a sender is from OpenRead itself, like the welcome message.

Revision ID: e72b4f1c8a05
Revises: c41d7e2a9b36
Create Date: 2026-11-05 06:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'e72b4f1c8a05'
down_revision: Union[str, Sequence[str], None] = 'c41d7e2a9b36'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column('messages', 'sender_id', nullable=True)


def downgrade() -> None:
    op.execute("DELETE FROM messages WHERE sender_id IS NULL")
    op.alter_column('messages', 'sender_id', nullable=False)
