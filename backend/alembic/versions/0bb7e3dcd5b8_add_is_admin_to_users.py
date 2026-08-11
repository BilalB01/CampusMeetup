"""add is admin to users

Revision ID: 0bb7e3dcd5b8
Revises: 5b4f13bbc554
Create Date: 2026-08-11 13:13:17.176385

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0bb7e3dcd5b8'
down_revision: Union[str, None] = '5b4f13bbc554'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # server_default="false": bestaande rijen krijgen is_admin=False i.p.v.
    # een fout op deze NOT NULL-kolom
    op.add_column(
        "users",
        sa.Column("is_admin", sa.Boolean(), nullable=False, server_default="false"),
    )


def downgrade() -> None:
    op.drop_column("users", "is_admin")
