"""encrypt existing message image_url

Revision ID: 855f39d56436
Revises: 02178b73a3d8
Create Date: 2026-08-15 20:38:06.999317

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

from app.crypto import decrypt_text, encrypt_text


# revision identifiers, used by Alembic.
revision: str = '855f39d56436'
down_revision: Union[str, None] = '02178b73a3d8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Zelfde aanpak als 6864f5ea45e8 (content versleutelen): eerst het kolomtype
# gelijktrekken met EncryptedText (impl=Text), dan de bestaande platte-tekst
# paden overschrijven met hun versleutelde vorm via rechtstreekse SQL -- de
# ORM zou image_url via de TypeDecorator al proberen te ontsleutelen bij het
# lezen, wat hier nog platte tekst is, geen geldig Fernet-token
def upgrade() -> None:
    op.alter_column("messages", "image_url", existing_type=sa.String(), type_=sa.Text())
    conn = op.get_bind()
    rows = conn.execute(sa.text("SELECT id, image_url FROM messages WHERE image_url IS NOT NULL")).fetchall()
    for row in rows:
        conn.execute(
            sa.text("UPDATE messages SET image_url = :image_url WHERE id = :id"),
            {"image_url": encrypt_text(row.image_url), "id": row.id},
        )


def downgrade() -> None:
    conn = op.get_bind()
    rows = conn.execute(sa.text("SELECT id, image_url FROM messages WHERE image_url IS NOT NULL")).fetchall()
    for row in rows:
        conn.execute(
            sa.text("UPDATE messages SET image_url = :image_url WHERE id = :id"),
            {"image_url": decrypt_text(row.image_url), "id": row.id},
        )
    op.alter_column("messages", "image_url", existing_type=sa.Text(), type_=sa.String())
