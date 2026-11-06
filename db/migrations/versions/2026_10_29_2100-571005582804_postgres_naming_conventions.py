"""postgres naming conventions

Columns named the way Postgres schemas usually are: no reserved word (track_stops.window, which
needed quoting), no type's name (text), a link named after what it points to or the role it plays
(reflections.author_id pointed to users, not authors: now user_id; messages' from_id and to_id are
sender_id and recipient_id), booleans that say is_ (is_curated, is_year_approximate,
is_email_verified), and one name for one meaning (expressions.first_published is year, like works'
and editions'). Only names change; constraints and indexes named after the old columns follow.

Revision ID: 571005582804
Revises: 7ca1dbcfa2f1
Create Date: 2026-10-29 19:00:46.460656

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel


# revision identifiers, used by Alembic.
revision: str = '571005582804'
down_revision: Union[str, Sequence[str], None] = '7ca1dbcfa2f1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# (table, old column, new column)
COLUMNS = [
    ("track_stops", "window", "canon_window"),
    ("reflections", "text", "body"),
    ("messages", "text", "body"),
    ("reflections", "author_id", "user_id"),
    ("messages", "from_id", "sender_id"),
    ("messages", "to_id", "recipient_id"),
    ("works", "curated", "is_curated"),
    ("works", "approximate", "is_year_approximate"),
    ("users", "email_verified", "is_email_verified"),
    ("expressions", "first_published", "year"),
]
# (table, old constraint, new constraint)
CONSTRAINTS = [
    ("reflections", "fk_reflections_author_id_users", "fk_reflections_user_id_users"),
    ("messages", "fk_messages_from_id_users", "fk_messages_sender_id_users"),
    ("messages", "fk_messages_to_id_users", "fk_messages_recipient_id_users"),
]
INDEXES = [
    ("ix_reflections_author_id", "ix_reflections_user_id"),
    ("ix_messages_from_id", "ix_messages_sender_id"),
    ("ix_messages_to_id", "ix_messages_recipient_id"),
]


def upgrade() -> None:
    for table, old, new in COLUMNS:
        op.alter_column(table, old, new_column_name=new)
    for table, old, new in CONSTRAINTS:
        op.execute(f'ALTER TABLE "{table}" RENAME CONSTRAINT "{old}" TO "{new}"')
    for old, new in INDEXES:
        op.execute(f'ALTER INDEX "{old}" RENAME TO "{new}"')


def downgrade() -> None:
    for old, new in INDEXES:
        op.execute(f'ALTER INDEX "{new}" RENAME TO "{old}"')
    for table, old, new in CONSTRAINTS:
        op.execute(f'ALTER TABLE "{table}" RENAME CONSTRAINT "{new}" TO "{old}"')
    for table, old, new in COLUMNS:
        op.alter_column(table, new, new_column_name=old)
