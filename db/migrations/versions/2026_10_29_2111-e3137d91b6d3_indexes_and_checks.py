"""indexes and checks

The database guards itself, so what a script or import writes holds too: an index on every link the
site looks things up by (Postgres doesn't index foreign keys by itself), a check on every column with
a fixed set of values and on every language code, and one account per email address whatever its
capitals. Readers' profile languages become codes ("English" is "en"), like every other language.

Revision ID: e3137d91b6d3
Revises: 571005582804
Create Date: 2026-10-29 19:11:31.841172

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel


# revision identifiers, used by Alembic.
revision: str = 'e3137d91b6d3'
down_revision: Union[str, Sequence[str], None] = '571005582804'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# (table, constraint, condition), as api/models has them
CHECKS = [
    ("author_names", "ck_author_names_language", "language ~ '^[a-z]{2,3}(-[a-z0-9]{2,8})*$'"),
    ("expressions", "ck_expressions_language", "language ~ '^[a-z]{2,3}(-[a-z0-9]{2,8})*$'"),
    ("readings", "ck_readings_status", "status IN ('want', 'reading', 'paused', 'finished', 'stopped')"),
    ("reflections", "ck_reflections_status", "status IN ('draft', 'published')"),
    ("suggestions", "ck_suggestions_difficulty", "difficulty IN ('approachable', 'challenging', 'demanding')"),
    ("suggestions", "ck_suggestions_status", "status IN ('pending', 'approved', 'rejected')"),
    ("track_follows", "ck_track_follows_state", "state IN ('saved', 'following', 'paused', 'completed')"),
    ("track_skips", "ck_track_skips_reason", "reason IN ('know-it', 'no-copy', 'not-useful')"),
    ("users", "ck_users_role", "role IN ('admin', 'member')"),
    ("users", "ck_users_languages", "array_to_string(languages, ',') ~ '^([a-z]{2,3}(-[a-z0-9]{2,8})*(,|$))*$'"),
    (
        "users",
        "ck_users_reading_languages",
        "array_to_string(reading_languages, ',') ~ '^([a-z]{2,3}(-[a-z0-9]{2,8})*(,|$))*$'",
    ),
    ("users", "ck_users_site_language", "site_language ~ '^[a-z]{2,3}(-[a-z0-9]{2,8})*$'"),
    ("works", "ck_works_difficulty", "difficulty IN ('approachable', 'challenging', 'demanding')"),
    ("works", "ck_works_source", "source IN ('catalogue', 'suggestion', 'openlibrary')"),
]
# (table, column), each indexed
INDEXES = [
    ("readings", "work_id"),
    ("reflections", "work_id"),
    ("suggestions", "work_id"),
    ("track_follows", "track_id"),
    ("track_skips", "track_id"),
    ("track_skips", "work_id"),
    ("track_stops", "work_id"),
]
# the profile languages there were, as codes
LANGUAGES = {
    "Arabic": "ar", "Dutch": "nl", "English": "en", "French": "fr", "German": "de", "Japanese": "ja",
    "Mandarin": "zh", "Polish": "pl", "Spanish": "es", "Swedish": "sv", "Tamil": "ta", "Yoruba": "yo",
}  # fmt: skip


def _languages(pairs: dict[str, str]) -> str:
    """SQL turning each of users.languages by these pairs, leaving out what isn't one of them."""
    cases = " ".join(f"WHEN '{old}' THEN '{new}'" for old, new in pairs.items())
    return (
        f"UPDATE users SET languages = ARRAY(SELECT CASE l {cases} END FROM unnest(languages) l "
        f"WHERE l IN ({', '.join(repr(old) for old in pairs)}))"
    )


def upgrade() -> None:
    op.execute(_languages(LANGUAGES))
    # no reason given is no reason, not an empty one
    op.execute("UPDATE track_skips SET reason = NULL WHERE reason = ''")
    for table, name, condition in CHECKS:
        # (op.f: the name is final; the naming convention would add its prefix again)
        op.create_check_constraint(op.f(name), table, condition)
    for table, column in INDEXES:
        op.create_index(op.f(f"ix_{table}_{column}"), table, [column], unique=False)
    op.create_index("uq_users_lower_email", "users", [sa.literal_column("lower(email)")], unique=True)


def downgrade() -> None:
    op.drop_index("uq_users_lower_email", table_name="users")
    for table, column in INDEXES:
        op.drop_index(op.f(f"ix_{table}_{column}"), table_name=table)
    for table, name, _ in CHECKS:
        op.drop_constraint(op.f(name), table, type_="check")
    op.execute(_languages({code: name for name, code in LANGUAGES.items()}))
