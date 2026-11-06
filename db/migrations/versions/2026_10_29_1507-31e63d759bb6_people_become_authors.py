"""people become authors

The only people OpenRead keeps are the authors of its works, so the table says so: people are
authors, person_names author_names, and person_id is author_id, in work_authors and author_names.
Every constraint, index and sequence named after them follows. (reflections.author_id, the reader
who wrote a reflection, was called that already and stays as it is.)

Revision ID: 31e63d759bb6
Revises: ff1e8d5425a9
Create Date: 2026-10-29 11:07:53.999782

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel


# revision identifiers, used by Alembic.
revision: str = '31e63d759bb6'
down_revision: Union[str, Sequence[str], None] = 'ff1e8d5425a9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


TABLES = [("people", "authors"), ("person_names", "author_names")]
# the columns, by their tables' new names
COLUMNS = [("work_authors", "person_id", "author_id"), ("author_names", "person_id", "author_id")]
# by the tables' new names: (table, old name, new name)
CONSTRAINTS = [
    ("authors", "pk_people", "pk_authors"),
    ("authors", "uq_people_wikidata", "uq_authors_wikidata"),
    ("work_authors", "fk_work_authors_person_id_people", "fk_work_authors_author_id_authors"),
    ("author_names", "pk_person_names", "pk_author_names"),
    ("author_names", "fk_person_names_person_id_people", "fk_author_names_author_id_authors"),
]
INDEXES = [
    ("ix_people_name", "ix_authors_name"),
    ("ix_people_slug", "ix_authors_slug"),
    ("ix_work_authors_person_id", "ix_work_authors_author_id"),
]
SEQUENCES = [("people_id_seq", "authors_id_seq")]


def upgrade() -> None:
    for old, new in TABLES:
        op.rename_table(old, new)
    for table, old, new in COLUMNS:
        op.alter_column(table, old, new_column_name=new)
    for table, old, new in CONSTRAINTS:
        op.execute(f'ALTER TABLE "{table}" RENAME CONSTRAINT "{old}" TO "{new}"')
    for old, new in INDEXES:
        op.execute(f'ALTER INDEX "{old}" RENAME TO "{new}"')
    for old, new in SEQUENCES:
        op.execute(f'ALTER SEQUENCE "{old}" RENAME TO "{new}"')


def downgrade() -> None:
    for old, new in SEQUENCES:
        op.execute(f'ALTER SEQUENCE "{new}" RENAME TO "{old}"')
    for old, new in INDEXES:
        op.execute(f'ALTER INDEX "{new}" RENAME TO "{old}"')
    for table, old, new in CONSTRAINTS:
        op.execute(f'ALTER TABLE "{table}" RENAME CONSTRAINT "{new}" TO "{old}"')
    for table, old, new in COLUMNS:
        op.alter_column(table, new, new_column_name=old)
    for old, new in TABLES:
        op.rename_table(new, old)
