"""simpler works and editions

A work is stored as the original now: its title in the language it was written in ("Война и мир"),
its titles in other languages in work_titles (our English one included), and its authors' names in
other languages in person_names (new). Editions are only what finds a work from an import or a scan:
an ISBN, its language and its work. Translations, their translators and the editions without an
ISBN, found only for them, go.

Revision ID: ff1e8d5425a9
Revises: b83279b5676c
Create Date: 2026-10-29 10:26:20.302044

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel


# revision identifiers, used by Alembic.
revision: str = 'ff1e8d5425a9'
down_revision: Union[str, Sequence[str], None] = 'b83279b5676c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "person_names",
        sa.Column("person_id", sa.Integer(), nullable=False),
        sa.Column("language", sqlmodel.sql.sqltypes.AutoString(length=20), nullable=False),
        sa.Column("name", sqlmodel.sql.sqltypes.AutoString(length=200), nullable=False),
        sa.ForeignKeyConstraint(["person_id"], ["people.id"], name=op.f("fk_person_names_person_id_people"), ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("person_id", "language", name=op.f("pk_person_names")),
    )

    # Titles: our English title (the work's title so far) becomes its English one, the original (its
    # title in its own language) the work's, and leaves work_titles. An English work keeps ours; a work
    # whose language isn't known keeps the title it has.
    op.execute(
        "INSERT INTO work_titles (work_id, language, title) SELECT id, 'en', title FROM works "
        "WHERE language IS NOT NULL AND language <> 'en' "
        "ON CONFLICT (work_id, language) DO UPDATE SET title = EXCLUDED.title"
    )
    op.execute(
        "UPDATE works SET title = LEFT(t.title, 300) FROM work_titles t "
        "WHERE t.work_id = works.id AND t.language = works.language AND works.language <> 'en'"
    )
    op.execute("DELETE FROM work_titles t USING works w WHERE t.work_id = w.id AND t.language = w.language")

    # Editions: an ISBN and its work (an omnibus's, the first of them) and language
    op.execute(
        "CREATE TEMPORARY TABLE isbns AS SELECT DISTINCT ON (e.isbn) e.isbn, ew.work_id, e.language "
        "FROM editions e JOIN edition_works ew ON ew.edition_id = e.id WHERE e.isbn IS NOT NULL ORDER BY e.isbn, ew.work_id"
    )
    op.drop_table("edition_works")
    op.drop_table("translation_translators")
    op.drop_table("translations")
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
    op.execute("INSERT INTO editions (isbn, work_id, language) SELECT isbn, work_id, language FROM isbns")
    op.execute("DROP TABLE isbns")

    # the translators: people who wrote none of our works
    op.execute("DELETE FROM people p WHERE NOT EXISTS (SELECT 1 FROM work_authors a WHERE a.person_id = p.id)")


def downgrade() -> None:
    # the tables as they were; translations and their translators aren't brought back (python -m
    # api.identify --editions found them)
    op.execute("CREATE TEMPORARY TABLE isbns AS SELECT isbn, work_id, language FROM editions")
    op.drop_index(op.f("ix_editions_work_id"), table_name="editions")
    op.drop_table("editions")
    op.create_table(
        "editions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("isbn", sqlmodel.sql.sqltypes.AutoString(length=13), nullable=True),
        sa.Column("ol_edition", sqlmodel.sql.sqltypes.AutoString(length=20), nullable=True),
        sa.Column("title", sqlmodel.sql.sqltypes.AutoString(length=500), nullable=True),
        sa.Column("language", sqlmodel.sql.sqltypes.AutoString(length=20), nullable=True),
        sa.Column("publisher", sqlmodel.sql.sqltypes.AutoString(length=300), nullable=True),
        sa.Column("year", sa.Integer(), nullable=True),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_editions")),
        sa.UniqueConstraint("isbn", name=op.f("uq_editions_isbn")),
        sa.UniqueConstraint("ol_edition", name=op.f("uq_editions_ol_edition")),
    )
    op.create_table(
        "translations",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("work_id", sa.Integer(), nullable=False),
        sa.Column("key", sqlmodel.sql.sqltypes.AutoString(length=300), nullable=False),
        sa.Column("language", sqlmodel.sql.sqltypes.AutoString(length=20), nullable=False),
        sa.Column("title", sqlmodel.sql.sqltypes.AutoString(length=500), nullable=True),
        sa.Column("year", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(["work_id"], ["works.id"], name=op.f("fk_translations_work_id_works"), ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_translations")),
        sa.UniqueConstraint("work_id", "key", name="uq_translations_work_id_key"),
    )
    op.create_index(op.f("ix_translations_work_id"), "translations", ["work_id"], unique=False)
    op.create_table(
        "edition_works",
        sa.Column("edition_id", sa.Integer(), nullable=False),
        sa.Column("work_id", sa.Integer(), nullable=False),
        sa.Column("translation_id", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(["work_id"], ["works.id"], name=op.f("fk_edition_works_work_id_works"), ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["edition_id"], ["editions.id"], name=op.f("fk_edition_works_edition_id_editions"), ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["translation_id"], ["translations.id"], name=op.f("fk_edition_works_translation_id_translations"), ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("edition_id", "work_id", name=op.f("pk_edition_works")),
    )
    op.create_index(op.f("ix_edition_works_work_id"), "edition_works", ["work_id"], unique=False)
    op.create_index(op.f("ix_edition_works_translation_id"), "edition_works", ["translation_id"], unique=False)
    op.create_table(
        "translation_translators",
        sa.Column("translation_id", sa.Integer(), nullable=False),
        sa.Column("person_id", sa.Integer(), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(
            ["person_id"], ["people.id"], name=op.f("fk_translation_translators_person_id_people"), ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["translation_id"], ["translations.id"], name=op.f("fk_translation_translators_translation_id_translations"), ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("translation_id", "person_id", name=op.f("pk_translation_translators")),
    )
    op.create_index(
        op.f("ix_translation_translators_person_id"), "translation_translators", ["person_id"], unique=False
    )
    op.execute("INSERT INTO editions (isbn, language) SELECT isbn, language FROM isbns")
    op.execute(
        "INSERT INTO edition_works (edition_id, work_id) SELECT e.id, i.work_id FROM editions e JOIN isbns i ON i.isbn = e.isbn"
    )
    op.execute("DROP TABLE isbns")

    # titles: the original back among the titles, the English one the work's
    op.execute(
        "INSERT INTO work_titles (work_id, language, title) SELECT id, language, title FROM works "
        "WHERE language IS NOT NULL AND language <> 'en' ON CONFLICT DO NOTHING"
    )
    op.execute(
        "UPDATE works SET title = LEFT(t.title, 300) FROM work_titles t "
        "WHERE t.work_id = works.id AND t.language = 'en' AND works.language IS NOT NULL AND works.language <> 'en'"
    )
    op.drop_table("person_names")
