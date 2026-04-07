"""Drop action_history and audit_logs (no longer used).

Revision ID: 0006_drop_action_history_and_audit_logs
Revises: 0005_storage_backend
Create Date: 2026-03-22

"""

from alembic import op

revision = "0006_drop_action_history_and_audit_logs"
down_revision = "0005_storage_backend"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Alembic по умолчанию создаёт version_num VARCHAR(32); длинные revision id (>32 символов)
    # дают StringDataRightTruncation при UPDATE после этой миграции — расширяем колонку первым шагом.
    op.execute(
        "ALTER TABLE alembic_version ALTER COLUMN version_num TYPE VARCHAR(128)"
    )
    op.execute("DROP TABLE IF EXISTS action_history CASCADE")
    op.execute("DROP TABLE IF EXISTS audit_logs CASCADE")


def downgrade() -> None:
    # Intentionally empty: tables are dropped permanently; restore from backup if needed.
    pass
