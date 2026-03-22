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
    op.execute("DROP TABLE IF EXISTS action_history CASCADE")
    op.execute("DROP TABLE IF EXISTS audit_logs CASCADE")


def downgrade() -> None:
    # Intentionally empty: tables are dropped permanently; restore from backup if needed.
    pass
