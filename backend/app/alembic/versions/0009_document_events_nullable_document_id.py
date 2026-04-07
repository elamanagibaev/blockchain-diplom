"""Nullable document_id for verify events without matched document.

Revision ID: 0009_document_events_nullable_document_id
Revises: 0008_approval_workflow_stages_actions
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0009_document_events_nullable_document_id"
down_revision = "0008_approval_workflow_stages_actions"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column(
        "document_events",
        "document_id",
        existing_type=postgresql.UUID(as_uuid=True),
        nullable=True,
    )


def downgrade() -> None:
    op.execute(
        "DELETE FROM document_events WHERE document_id IS NULL"
    )
    op.alter_column(
        "document_events",
        "document_id",
        existing_type=postgresql.UUID(as_uuid=True),
        nullable=False,
    )
