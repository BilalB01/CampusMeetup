"""add last_read_at to participations

Revision ID: 84faa2a5cc43
Revises: 4682f3963e09
Create Date: 2026-08-09 20:57:01.518396

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '84faa2a5cc43'
down_revision: Union[str, None] = '4682f3963e09'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "participations",
        sa.Column("last_read_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("participations", "last_read_at")
