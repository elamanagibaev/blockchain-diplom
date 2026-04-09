"""Упрощённый workflow: один этап согласования — только декан (без кафедры/registrar/admin).

Revision ID: 0011_simplified_single_dean_workflow
Revises: 0010_pipeline_stage_fields
"""

from alembic import op
import sqlalchemy as sa

revision = "0011_simplified_single_dean_workflow"
down_revision = "0010_pipeline_stage_fields"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Сброс истории согласований и определений этапов (упрощённая модель «только декан»).
    conn = op.get_bind()
    conn.execute(sa.text("DELETE FROM approval_actions"))
    conn.execute(sa.text("DELETE FROM approval_stage_definitions"))
    conn.execute(
        sa.text(
            """
            INSERT INTO approval_stage_definitions (code, title, stage_order, allowed_roles, is_active)
            VALUES (
                'DEAN_REVIEW',
                'Деканат',
                1,
                '["dean"]'::jsonb,
                true
            )
            """
        )
    )


def downgrade() -> None:
    # Восстановление прежней двухэтапной схемы (как в 0008) — для отката миграции.
    conn = op.get_bind()
    conn.execute(sa.text("DELETE FROM approval_actions"))
    conn.execute(sa.text("DELETE FROM approval_stage_definitions"))
    conn.execute(
        sa.text(
            """
            INSERT INTO approval_stage_definitions (code, title, stage_order, allowed_roles, is_active) VALUES
            ('DEPARTMENT_REVIEW', 'Кафедра', 1, '["department","admin"]'::jsonb, true),
            ('DEAN_REGISTRAR_REVIEW', 'Деканат / Регистратор', 2, '["dean","registrar","admin"]'::jsonb, true)
            """
        )
    )
