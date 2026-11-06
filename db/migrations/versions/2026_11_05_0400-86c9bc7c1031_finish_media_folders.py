"""finish media folders

ea8e618d98b6 was rewritten after it had already run on production, so production kept the old
folder names in the database while the files moved. This applies the renames there. Anywhere
ea8e618d98b6 ran in full, it changes nothing.

Revision ID: 86c9bc7c1031
Revises: ea8e618d98b6
Create Date: 2026-11-05 04:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = '86c9bc7c1031'
down_revision: Union[str, Sequence[str], None] = 'ea8e618d98b6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("UPDATE tracks SET image = 'track_covers/' || substr(image, 8) WHERE image LIKE 'tracks/%'")
    op.execute("UPDATE users SET photo = 'user_profiles/' || substr(photo, 8) WHERE photo LIKE 'photos/%'")
    op.execute("UPDATE editions SET cover = 'book_covers/' || substr(cover, 8) WHERE cover LIKE 'covers/%'")


def downgrade() -> None:
    # nothing to undo: the files stay in the new folders
    pass
