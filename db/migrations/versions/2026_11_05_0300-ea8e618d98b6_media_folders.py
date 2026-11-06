"""media folders

All pictures live in the media container now, in one folder per kind: user_profiles, book_covers
and track_covers. Our tracks' pictures come from the static container, so their names lose the
leading slash: "/tracks/art.svg" becomes "track_covers/art.svg".

Revision ID: ea8e618d98b6
Revises: ff2c19140019
Create Date: 2026-11-05 03:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'ea8e618d98b6'
down_revision: Union[str, Sequence[str], None] = 'ff2c19140019'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("UPDATE tracks SET image = 'track_covers/' || substr(image, 9) WHERE image LIKE '/tracks/%'")
    op.execute("UPDATE tracks SET image = 'track_covers/' || substr(image, 8) WHERE image LIKE 'tracks/%'")
    op.execute("UPDATE users SET photo = 'user_profiles/' || substr(photo, 8) WHERE photo LIKE 'photos/%'")
    op.execute("UPDATE editions SET cover = 'book_covers/' || substr(cover, 8) WHERE cover LIKE 'covers/%'")


def downgrade() -> None:
    # only ours are SVGs: readers can't upload them
    op.execute("UPDATE tracks SET image = '/tracks/' || substr(image, 14) WHERE image LIKE 'track\\_covers/%.svg'")
    op.execute("UPDATE tracks SET image = 'tracks/' || substr(image, 14) WHERE image LIKE 'track\\_covers/%'")
    op.execute("UPDATE users SET photo = 'photos/' || substr(photo, 15) WHERE photo LIKE 'user\\_profiles/%'")
    op.execute("UPDATE editions SET cover = 'covers/' || substr(cover, 13) WHERE cover LIKE 'book\\_covers/%'")
