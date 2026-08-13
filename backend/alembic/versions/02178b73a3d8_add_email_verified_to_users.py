"""add email_verified to users

Revision ID: 02178b73a3d8
Revises: 0bb7e3dcd5b8
Create Date: 2026-08-13 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "02178b73a3d8"
down_revision = "0bb7e3dcd5b8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # server_default="true": bestaande gebruikers loggen al succesvol in
    # sinds voor dit veld bestond, dus die worden retroactief als bevestigd
    # beschouwd. Enkel nieuwe wachtwoord-registraties starten op False.
    op.add_column(
        "users", sa.Column("email_verified", sa.Boolean(), nullable=False, server_default="true")
    )


def downgrade() -> None:
    op.drop_column("users", "email_verified")
