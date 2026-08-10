"""add share_location to users

Revision ID: 58823aed314d
Revises: 141a9562e5c2
Create Date: 2026-08-10 16:32:25.258405

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '58823aed314d'
down_revision: Union[str, None] = '141a9562e5c2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("share_location", sa.Boolean(), nullable=False, server_default="true"),
    )


def downgrade() -> None:
    op.drop_column("users", "share_location")
