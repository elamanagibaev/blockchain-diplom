"""Add storage_backend to digital_objects for MinIO migration flow

Revision ID: 0005_storage_backend
Revises: 0004_blockchain_events
Create Date: 2026-03-12

"""
from alembic import op
import sqlalchemy as sa

revision = "0005_storage_backend"
down_revision = "0004_blockchain_events"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "digital_objects",
        sa.Column("storage_backend", sa.String(20), nullable=False, server_default="local"),
    )


def downgrade() -> None:
    op.drop_column("digital_objects", "storage_backend")
