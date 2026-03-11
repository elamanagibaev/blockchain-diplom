"""Add wallet encrypted key, user updated_at; document extensions for patent registry

Revision ID: 0002
Revises: 0001_init
Create Date: 2026-03-12

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0002_wallet_and_document_ext"
down_revision = "0001_init"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Users: custodial wallet support
    op.add_column("users", sa.Column("wallet_encrypted_private_key", sa.Text(), nullable=True))
    op.add_column("users", sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True))

    # Digital objects: patent/document registry extensions
    op.add_column("digital_objects", sa.Column("owner_wallet_address", sa.String(100), nullable=True))
    op.add_column("digital_objects", sa.Column("title", sa.String(255), nullable=True))
    op.add_column("digital_objects", sa.Column("document_type", sa.String(50), nullable=True))
    op.add_column("digital_objects", sa.Column("visibility", sa.String(20), nullable=False, server_default="public"))
    op.add_column("digital_objects", sa.Column("blockchain_registered_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("digital_objects", "blockchain_registered_at")
    op.drop_column("digital_objects", "visibility")
    op.drop_column("digital_objects", "document_type")
    op.drop_column("digital_objects", "title")
    op.drop_column("digital_objects", "owner_wallet_address")
    op.drop_column("users", "updated_at")
    op.drop_column("users", "wallet_encrypted_private_key")
