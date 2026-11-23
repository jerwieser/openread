"""books the reader owns

A mark apart from the reading status: the reader can own a book they are reading, have finished, or
have not put on a shelf at all.

Revision ID: a1c4e8b07d22
Revises: b83f6d1e4c27
Create Date: 2026-11-23 23:10:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1c4e8b07d22'
down_revision: Union[str, Sequence[str], None] = 'b83f6d1e4c27'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'owned_works',
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('work_id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], name=op.f('fk_owned_works_user_id_users'), ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['work_id'], ['works.id'], name=op.f('fk_owned_works_work_id_works'), ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('user_id', 'work_id', name=op.f('pk_owned_works')),
    )
    op.create_index(op.f('ix_owned_works_work_id'), 'owned_works', ['work_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_owned_works_work_id'), table_name='owned_works')
    op.drop_table('owned_works')
