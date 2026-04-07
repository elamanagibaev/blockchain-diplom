"""Document events journal + lifecycle status values.

Revision ID: 0007_document_events_lifecycle_statuses
Revises: 0006_drop_action_history_and_audit_logs
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0007_document_events_lifecycle_statuses"
down_revision = "0006_drop_action_history_and_audit_logs"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "document_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("document_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("digital_objects.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("action", sa.String(30), nullable=False),
        sa.Column("timestamp", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )
    op.create_index("ix_document_events_document_id", "document_events", ["document_id"])
    op.create_index("ix_document_events_user_id", "document_events", ["user_id"])
    op.create_index("ix_document_events_action", "document_events", ["action"])

    # Миграция значений status → новый жизненный цикл
    op.execute(
        """
        UPDATE digital_objects SET status = 'FROZEN' WHERE status = 'UPLOADED';
        UPDATE digital_objects SET status = 'UNDER_REVIEW' WHERE status = 'PENDING_APPROVAL';
        UPDATE digital_objects SET status = 'FROZEN' WHERE status = 'REGISTERED' AND blockchain_tx_hash IS NULL;
        """
    )


def downgrade() -> None:
    op.execute(
        """
        UPDATE digital_objects SET status = 'UPLOADED' WHERE status = 'FROZEN' AND blockchain_tx_hash IS NULL;
        UPDATE digital_objects SET status = 'PENDING_APPROVAL' WHERE status = 'UNDER_REVIEW';
        """
    )
    op.drop_index("ix_document_events_action", table_name="document_events")
    op.drop_index("ix_document_events_user_id", table_name="document_events")
    op.drop_index("ix_document_events_document_id", table_name="document_events")
    op.drop_table("document_events")
