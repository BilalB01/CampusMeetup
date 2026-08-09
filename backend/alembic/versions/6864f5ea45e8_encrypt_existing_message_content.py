"""encrypt existing message content

Revision ID: 6864f5ea45e8
Revises: 84faa2a5cc43
Create Date: 2026-08-09 21:16:47.403818

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

from app.crypto import decrypt_text, encrypt_text


# revision identifiers, used by Alembic.
revision: str = '6864f5ea45e8'
down_revision: Union[str, None] = '84faa2a5cc43'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Pure datamigratie, geen schemawijziging: content stond tot nu toe in platte
# tekst (Message.content is een gewone Text-kolom geworden nadat de
# EncryptedText-TypeDecorator werd toegevoegd in app/models.py). Rechtstreekse
# SQL i.p.v. de ORM, want de ORM zou content via die decorator al proberen te
# ontsleutelen bij het lezen — wat hier nog platte tekst is, geen geldig token.
def upgrade() -> None:
    conn = op.get_bind()
    rows = conn.execute(sa.text("SELECT id, content FROM messages WHERE content IS NOT NULL")).fetchall()
    for row in rows:
        conn.execute(
            sa.text("UPDATE messages SET content = :content WHERE id = :id"),
            {"content": encrypt_text(row.content), "id": row.id},
        )


def downgrade() -> None:
    conn = op.get_bind()
    rows = conn.execute(sa.text("SELECT id, content FROM messages WHERE content IS NOT NULL")).fetchall()
    for row in rows:
        conn.execute(
            sa.text("UPDATE messages SET content = :content WHERE id = :id"),
            {"content": decrypt_text(row.content), "id": row.id},
        )
