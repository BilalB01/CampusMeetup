"""add notify_activity_updates and fix notification activity fk

Revision ID: 287fa028f0e5
Revises: 58823aed314d
Create Date: 2026-08-10 21:53:13.110421

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '287fa028f0e5'
down_revision: Union[str, None] = '58823aed314d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("notify_activity_updates", sa.Boolean(), nullable=False, server_default="true"),
    )
    op.drop_constraint("notifications_activity_id_fkey", "notifications", type_="foreignkey")
    op.create_foreign_key(
        "notifications_activity_id_fkey",
        "notifications",
        "activities",
        ["activity_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("notifications_activity_id_fkey", "notifications", type_="foreignkey")
    op.create_foreign_key(
        "notifications_activity_id_fkey",
        "notifications",
        "activities",
        ["activity_id"],
        ["id"],
    )
    op.drop_column("users", "notify_activity_updates")
