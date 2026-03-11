"""Add audit_logs table and unique constraint on sha256_hash

Revision ID: 0003
Revises: 0002_wallet_and_document_ext
Create Date: 2026-03-12

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0003_audit_log_and_unique_hash"
down_revision = "0002_wallet_and_document_ext"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    # Remove duplicate sha256_hash rows (keep earliest created per hash) before adding unique constraint
    # IDs of duplicates to remove: not the one we keep per hash (keep min created_at, then min id)
    conn.execute(sa.text("""
        UPDATE verification_logs SET digital_object_id = NULL
        WHERE digital_object_id IN (
            SELECT a.id FROM digital_objects a
            INNER JOIN digital_objects b ON a.sha256_hash = b.sha256_hash
              AND (a.created_at > b.created_at OR (a.created_at = b.created_at AND a.id > b.id))
        )
    """))
    conn.execute(sa.text("""
        DELETE FROM action_history
        WHERE digital_object_id IN (
            SELECT a.id FROM digital_objects a
            INNER JOIN digital_objects b ON a.sha256_hash = b.sha256_hash
              AND (a.created_at > b.created_at OR (a.created_at = b.created_at AND a.id > b.id))
        )
    """))
    conn.execute(sa.text("""
        DELETE FROM digital_objects a
        USING digital_objects b
        WHERE a.sha256_hash = b.sha256_hash
          AND (a.created_at > b.created_at OR (a.created_at = b.created_at AND a.id > b.id))
    """))

    op.create_table(
        "audit_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("action_type", sa.String(80), nullable=False, index=True),
        sa.Column("performed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("actor_user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True, index=True),
        sa.Column("actor_wallet_address", sa.String(100), nullable=True),
        sa.Column("target_document_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("digital_objects.id"), nullable=True, index=True),
        sa.Column("from_wallet", sa.String(100), nullable=True),
        sa.Column("to_wallet", sa.String(100), nullable=True),
        sa.Column("status", sa.String(30), nullable=False, server_default="success"),
        sa.Column("details", sa.String(2000), nullable=True),
    )

    # Unique constraint on sha256_hash — один файл не может быть зарегистрирован дважды.
    # Если в БД есть дубликаты по hash, миграция упадёт; выполните очистку вручную.
    op.create_unique_constraint("uq_digital_objects_sha256_hash", "digital_objects", ["sha256_hash"])


def downgrade() -> None:
    op.drop_constraint("uq_digital_objects_sha256_hash", "digital_objects", type_="unique")
    op.drop_table("audit_logs")
