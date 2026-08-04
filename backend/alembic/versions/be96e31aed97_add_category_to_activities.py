"""add category to activities

Revision ID: be96e31aed97
Revises: c0e197b219f3
Create Date: 2026-08-04 22:16:24.272120

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'be96e31aed97'
down_revision: Union[str, None] = 'c0e197b219f3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # NOT NULL-kolom op een tabel die al rijen kan bevatten: tijdelijk een
    # server_default, nadien terug verwijderen zodat nieuwe rijen verplicht
    # een categorie moeten meegeven
    op.add_column(
        "activities",
        sa.Column("category", sa.String(length=50), nullable=False, server_default="Overige"),
    )
    op.alter_column("activities", "category", server_default=None)
    op.create_index(op.f("ix_activities_category"), "activities", ["category"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_activities_category"), table_name="activities")
    op.drop_column("activities", "category")
