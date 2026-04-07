"""Pipeline stage fields for 5-step diploma processing UI.

Revision ID: 0010_pipeline_stage_fields
Revises: 0009_document_events_nullable_document_id
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0010_pipeline_stage_fields"
down_revision = "0009_document_events_nullable_document_id"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "digital_objects",
        sa.Column("processing_stage", sa.Integer(), nullable=True),
    )
    op.add_column(
        "digital_objects",
        sa.Column(
            "stage_history",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'[]'::jsonb"),
            nullable=False,
        ),
    )
    op.add_column(
        "digital_objects",
        sa.Column("department_approved_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "digital_objects",
        sa.Column("deanery_approved_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "digital_objects",
        sa.Column(
            "ai_check_status",
            sa.String(20),
            server_default="skipped",
            nullable=False,
        ),
    )
    op.add_column(
        "digital_objects",
        sa.Column("student_wallet_address", sa.String(100), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("digital_objects", "student_wallet_address")
    op.drop_column("digital_objects", "ai_check_status")
    op.drop_column("digital_objects", "deanery_approved_at")
    op.drop_column("digital_objects", "department_approved_at")
    op.drop_column("digital_objects", "stage_history")
    op.drop_column("digital_objects", "processing_stage")
