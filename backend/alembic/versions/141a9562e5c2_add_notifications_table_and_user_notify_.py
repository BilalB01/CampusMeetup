"""add notifications table and user notify preferences

Revision ID: 141a9562e5c2
Revises: 6864f5ea45e8
Create Date: 2026-08-09 22:14:03.301568

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '141a9562e5c2'
down_revision: Union[str, None] = '6864f5ea45e8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "notifications",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("activity_id", sa.Integer(), sa.ForeignKey("activities.id"), nullable=True),
        sa.Column("type", sa.String(length=30), nullable=False),
        sa.Column("text", sa.String(), nullable=False),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(op.f("ix_notifications_id"), "notifications", ["id"])

    op.add_column(
        "users",
        sa.Column("notify_new_participant", sa.Boolean(), nullable=False, server_default="true"),
    )
    op.add_column(
        "users",
        sa.Column("notify_chat_messages", sa.Boolean(), nullable=False, server_default="true"),
    )
    op.add_column(
        "users",
        sa.Column("notify_reminder", sa.Boolean(), nullable=False, server_default="true"),
    )


def downgrade() -> None:
    op.drop_column("users", "notify_reminder")
    op.drop_column("users", "notify_chat_messages")
    op.drop_column("users", "notify_new_participant")
    op.drop_index(op.f("ix_notifications_id"), table_name="notifications")
    op.drop_table("notifications")
