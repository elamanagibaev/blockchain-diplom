"""Add blockchain_events table for global blockchain journal

Revision ID: 0004_blockchain_events
Revises: 0003_audit_log_and_unique_hash
Create Date: 2026-03-12

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0004_blockchain_events"
down_revision = "0003_audit_log_and_unique_hash"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "blockchain_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("action_type", sa.String(30), nullable=False, index=True),
        sa.Column("document_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("digital_objects.id"), nullable=False, index=True),
        sa.Column("timestamp", sa.DateTime(timezone=True), nullable=False),
        sa.Column("tx_hash", sa.String(100), nullable=False, index=True),
        sa.Column("from_wallet", sa.String(100), nullable=True),
        sa.Column("to_wallet", sa.String(100), nullable=True),
        sa.Column("initiator_user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True, index=True),
    )


def downgrade() -> None:
    op.drop_table("blockchain_events")
