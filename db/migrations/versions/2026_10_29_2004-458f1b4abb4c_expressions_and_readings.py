"""expressions and readings

Works, expressions and editions, after the library standard: a work is what its author made (who wrote
it, when it first came out); an expression is one text of it in one language, with its own title (the
original is one, marked so); an edition is one publication of an expression, with its ISBN, publisher,
year and cover. Titles, languages and covers move off works: the original title and language to the
work's original expression (or, while the original isn't known, our title to its English one), the
titles in other languages (work_titles) to expressions of their own, each edition to the expression
of its language (an edition whose language isn't known can't be placed, and goes), and the cover to
an edition of the original. A reader's status for a work becomes their reading of it, which can name
the edition, when they started and finished and how far they are; and readers get a site language and
reading languages.

Revision ID: 458f1b4abb4c
Revises: fb23335da654
Create Date: 2026-10-29 16:04:31.011739

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = '458f1b4abb4c'
down_revision: Union[str, Sequence[str], None] = 'fb23335da654'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("site_language", sqlmodel.sql.sqltypes.AutoString(length=20), server_default="en", nullable=False),
    )
    op.add_column(
        "users",
        sa.Column("reading_languages", postgresql.ARRAY(sa.String(length=100)), server_default="{}", nullable=False),
    )

    op.create_table(
        "expressions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("work_id", sa.Integer(), nullable=False),
        sa.Column("language", sqlmodel.sql.sqltypes.AutoString(length=20), nullable=False),
        sa.Column("title", sqlmodel.sql.sqltypes.AutoString(length=500), nullable=True),
        sa.Column("is_original", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("translator", sqlmodel.sql.sqltypes.AutoString(length=300), nullable=True),
        sa.Column("first_published", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["work_id"], ["works.id"], name=op.f("fk_expressions_work_id_works"), ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_expressions")),
        sa.UniqueConstraint(
            "work_id", "language", "translator", name="uq_expressions_work_language_translator",
            postgresql_nulls_not_distinct=True,
        ),
    )
    op.create_index(op.f("ix_expressions_work_id"), "expressions", ["work_id"], unique=False)
    op.create_index("uq_expressions_original", "expressions", ["work_id"], unique=True, postgresql_where=sa.text("is_original"))

    # the originals; for a work whose original isn't known, our title as its English expression
    op.execute(
        "INSERT INTO expressions (work_id, language, title, is_original, first_published) "
        "SELECT id, language, title, true, year FROM works WHERE language IS NOT NULL"
    )
    op.execute("INSERT INTO expressions (work_id, language, title) SELECT id, 'en', title FROM works WHERE language IS NULL")
    # its titles in other languages, each an expression of its own
    op.execute(
        "INSERT INTO expressions (work_id, language, title) SELECT work_id, language, title FROM work_titles "
        "ON CONFLICT ON CONSTRAINT uq_expressions_work_language_translator DO NOTHING"
    )

    # editions: each under the expression of its work and language, one made for a language with no
    # title known; one whose language isn't known can't be placed
    op.execute("CREATE TEMPORARY TABLE old_editions AS SELECT isbn, work_id, language FROM editions WHERE language IS NOT NULL")
    op.execute(
        "INSERT INTO expressions (work_id, language) SELECT DISTINCT work_id, language FROM old_editions "
        "ON CONFLICT ON CONSTRAINT uq_expressions_work_language_translator DO NOTHING"
    )
    op.drop_index(op.f("ix_editions_work_id"), table_name="editions")
    op.drop_table("editions")
    op.create_table(
        "editions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("expression_id", sa.Integer(), nullable=False),
        sa.Column("isbn", sqlmodel.sql.sqltypes.AutoString(length=13), nullable=True),
        sa.Column("ol_edition", sqlmodel.sql.sqltypes.AutoString(length=20), nullable=True),
        sa.Column("publisher", sqlmodel.sql.sqltypes.AutoString(length=300), nullable=True),
        sa.Column("year", sa.Integer(), nullable=True),
        sa.Column("cover", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(
            ["expression_id"], ["expressions.id"], name=op.f("fk_editions_expression_id_expressions"), ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_editions")),
        sa.UniqueConstraint("isbn", name=op.f("uq_editions_isbn")),
        sa.UniqueConstraint("ol_edition", name=op.f("uq_editions_ol_edition")),
    )
    op.create_index(op.f("ix_editions_expression_id"), "editions", ["expression_id"], unique=False)
    op.execute(
        "INSERT INTO editions (expression_id, isbn) SELECT x.id, o.isbn FROM old_editions o "
        "JOIN expressions x ON x.work_id = o.work_id AND x.language = o.language AND x.translator IS NULL"
    )
    op.execute("DROP TABLE old_editions")
    # each cover, an edition of the original (or of the English expression, while the original isn't known)
    op.execute(
        "INSERT INTO editions (expression_id, cover) SELECT x.id, w.cover FROM works w "
        "JOIN expressions x ON x.work_id = w.id AND (x.is_original OR (w.language IS NULL AND x.language = 'en' AND x.translator IS NULL)) "
        "WHERE w.cover IS NOT NULL"
    )

    op.drop_table("work_titles")
    op.drop_column("works", "title")
    op.drop_column("works", "language")
    op.drop_column("works", "cover")

    # a reader's status becomes their reading
    op.rename_table("work_statuses", "readings")
    op.execute("ALTER TABLE readings RENAME CONSTRAINT pk_work_statuses TO pk_readings")
    op.execute("ALTER TABLE readings RENAME CONSTRAINT fk_work_statuses_user_id_users TO fk_readings_user_id_users")
    op.execute("ALTER TABLE readings RENAME CONSTRAINT fk_work_statuses_work_id_works TO fk_readings_work_id_works")
    op.add_column("readings", sa.Column("edition_id", sa.Integer(), nullable=True))
    op.add_column("readings", sa.Column("started_on", sa.Date(), nullable=True))
    op.add_column("readings", sa.Column("finished_on", sa.Date(), nullable=True))
    op.add_column("readings", sa.Column("progress", sa.Integer(), nullable=True))
    op.create_foreign_key(
        op.f("fk_readings_edition_id_editions"), "readings", "editions", ["edition_id"], ["id"], ondelete="SET NULL"
    )
    op.create_index(op.f("ix_readings_edition_id"), "readings", ["edition_id"], unique=False)
    op.create_check_constraint(op.f("ck_readings_progress_percent"), "readings", "progress BETWEEN 0 AND 100")


def downgrade() -> None:
    op.drop_constraint(op.f("ck_readings_progress_percent"), "readings", type_="check")
    op.drop_index(op.f("ix_readings_edition_id"), table_name="readings")
    op.drop_constraint(op.f("fk_readings_edition_id_editions"), "readings", type_="foreignkey")
    op.drop_column("readings", "progress")
    op.drop_column("readings", "finished_on")
    op.drop_column("readings", "started_on")
    op.drop_column("readings", "edition_id")
    op.execute("ALTER TABLE readings RENAME CONSTRAINT pk_readings TO pk_work_statuses")
    op.execute("ALTER TABLE readings RENAME CONSTRAINT fk_readings_user_id_users TO fk_work_statuses_user_id_users")
    op.execute("ALTER TABLE readings RENAME CONSTRAINT fk_readings_work_id_works TO fk_work_statuses_work_id_works")
    op.rename_table("readings", "work_statuses")

    # works' titles, languages and covers back from their expressions and editions
    op.add_column("works", sa.Column("title", sa.VARCHAR(length=300), nullable=True))
    op.add_column("works", sa.Column("language", sa.VARCHAR(length=20), nullable=True))
    op.add_column("works", sa.Column("cover", sa.TEXT(), nullable=True))
    op.execute(
        "UPDATE works SET title = LEFT(x.title, 300), language = x.language FROM expressions x "
        "WHERE x.work_id = works.id AND x.is_original"
    )
    op.execute(
        "UPDATE works SET title = LEFT(x.title, 300) FROM expressions x "
        "WHERE works.title IS NULL AND x.work_id = works.id AND x.language = 'en' AND x.translator IS NULL"
    )
    op.execute("UPDATE works SET title = slug WHERE title IS NULL")
    op.alter_column("works", "title", nullable=False)
    op.execute(
        "UPDATE works SET cover = e.cover FROM editions e JOIN expressions x ON x.id = e.expression_id "
        "WHERE x.work_id = works.id AND e.cover IS NOT NULL AND e.isbn IS NULL"
    )
    op.create_table(
        "work_titles",
        sa.Column("work_id", sa.Integer(), nullable=False),
        sa.Column("language", sqlmodel.sql.sqltypes.AutoString(length=20), nullable=False),
        sa.Column("title", sqlmodel.sql.sqltypes.AutoString(length=500), nullable=False),
        sa.ForeignKeyConstraint(["work_id"], ["works.id"], name=op.f("fk_work_titles_work_id_works"), ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("work_id", "language", name=op.f("pk_work_titles")),
    )
    op.execute(
        "INSERT INTO work_titles (work_id, language, title) SELECT x.work_id, x.language, x.title FROM expressions x "
        "JOIN works w ON w.id = x.work_id WHERE NOT x.is_original AND x.title IS NOT NULL AND x.translator IS NULL "
        "AND x.language IS DISTINCT FROM w.language AND NOT (w.language IS NULL AND x.language = 'en')"
    )

    op.execute(
        "CREATE TEMPORARY TABLE new_editions AS SELECT e.isbn, x.work_id, x.language FROM editions e "
        "JOIN expressions x ON x.id = e.expression_id WHERE e.isbn IS NOT NULL"
    )
    op.drop_index(op.f("ix_editions_expression_id"), table_name="editions")
    op.drop_table("editions")
    op.create_table(
        "editions",
        sa.Column("isbn", sqlmodel.sql.sqltypes.AutoString(length=13), nullable=False),
        sa.Column("work_id", sa.Integer(), nullable=False),
        sa.Column("language", sqlmodel.sql.sqltypes.AutoString(length=20), nullable=True),
        sa.ForeignKeyConstraint(["work_id"], ["works.id"], name=op.f("fk_editions_work_id_works"), ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("isbn", name=op.f("pk_editions")),
    )
    op.create_index(op.f("ix_editions_work_id"), "editions", ["work_id"], unique=False)
    op.execute("INSERT INTO editions (isbn, work_id, language) SELECT isbn, work_id, language FROM new_editions")
    op.execute("DROP TABLE new_editions")

    op.drop_index("uq_expressions_original", table_name="expressions")
    op.drop_index(op.f("ix_expressions_work_id"), table_name="expressions")
    op.drop_table("expressions")
    op.drop_column("users", "reading_languages")
    op.drop_column("users", "site_language")
