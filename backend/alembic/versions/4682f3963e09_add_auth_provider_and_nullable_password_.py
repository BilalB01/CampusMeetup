"""add auth_provider and nullable password to users

Revision ID: 4682f3963e09
Revises: 4d90a254f52d
Create Date: 2026-08-07 17:25:04.566106

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '4682f3963e09'
down_revision: Union[str, None] = '4d90a254f52d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column("users", "hashed_password", existing_type=sa.String(), nullable=True)
    op.add_column(
        "users",
        sa.Column("auth_provider", sa.String(length=20), nullable=False, server_default="password"),
    )


def downgrade() -> None:
    op.drop_column("users", "auth_provider")
    op.alter_column("users", "hashed_password", existing_type=sa.String(), nullable=False)
