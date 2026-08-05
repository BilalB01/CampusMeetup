"""add image_url to messages

Revision ID: 4d90a254f52d
Revises: be96e31aed97
Create Date: 2026-08-05 19:58:31.096130

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '4d90a254f52d'
down_revision: Union[str, None] = 'be96e31aed97'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column("messages", "content", existing_type=sa.Text(), nullable=True)
    op.add_column("messages", sa.Column("image_url", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("messages", "image_url")
    op.alter_column("messages", "content", existing_type=sa.Text(), nullable=False)
