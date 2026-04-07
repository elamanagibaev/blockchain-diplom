"""Approval workflow: stage definitions and actions.

Revision ID: 0008_approval_workflow_stages_actions
Revises: 0007_document_events_lifecycle_statuses
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0008_approval_workflow_stages_actions"
down_revision = "0007_document_events_lifecycle_statuses"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "approval_stage_definitions",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("code", sa.String(length=50), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("stage_order", sa.Integer(), nullable=False),
        sa.Column("allowed_roles", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.UniqueConstraint("code", name="uq_approval_stage_definitions_code"),
        sa.UniqueConstraint("stage_order", name="uq_approval_stage_definitions_stage_order"),
    )
    op.create_index("ix_approval_stage_definitions_code", "approval_stage_definitions", ["code"])
    op.create_index("ix_approval_stage_definitions_stage_order", "approval_stage_definitions", ["stage_order"])

    op.create_table(
        "approval_actions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("document_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("digital_objects.id", ondelete="CASCADE"), nullable=False),
        sa.Column("stage_definition_id", sa.Integer(), sa.ForeignKey("approval_stage_definitions.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("actor_user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("action", sa.String(length=20), nullable=False),
        sa.Column("comment", sa.String(length=1000), nullable=True),
        sa.Column("metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_approval_actions_document_id", "approval_actions", ["document_id"])
    op.create_index("ix_approval_actions_stage_definition_id", "approval_actions", ["stage_definition_id"])
    op.create_index("ix_approval_actions_actor_user_id", "approval_actions", ["actor_user_id"])
    op.create_index("ix_approval_actions_action", "approval_actions", ["action"])

    op.execute(
        """
        INSERT INTO approval_stage_definitions (code, title, stage_order, allowed_roles, is_active)
        VALUES
            ('DEPARTMENT_REVIEW', 'Кафедра', 1, '["department","admin"]'::jsonb, true),
            ('DEAN_REGISTRAR_REVIEW', 'Деканат / Регистратор', 2, '["dean","registrar","admin"]'::jsonb, true)
        ON CONFLICT (code) DO NOTHING;
        """
    )


def downgrade() -> None:
    op.drop_index("ix_approval_actions_action", table_name="approval_actions")
    op.drop_index("ix_approval_actions_actor_user_id", table_name="approval_actions")
    op.drop_index("ix_approval_actions_stage_definition_id", table_name="approval_actions")
    op.drop_index("ix_approval_actions_document_id", table_name="approval_actions")
    op.drop_table("approval_actions")

    op.drop_index("ix_approval_stage_definitions_stage_order", table_name="approval_stage_definitions")
    op.drop_index("ix_approval_stage_definitions_code", table_name="approval_stage_definitions")
    op.drop_table("approval_stage_definitions")
