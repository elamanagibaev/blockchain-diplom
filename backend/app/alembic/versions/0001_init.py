from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0001_init"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("email", sa.String(255), nullable=False, unique=True),
        sa.Column("hashed_password", sa.String(255), nullable=False),
        sa.Column("full_name", sa.String(255), nullable=True),
        sa.Column("role", sa.String(50), nullable=False, server_default="user"),
        sa.Column("wallet_address", sa.String(100), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    op.create_table(
        "digital_objects",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("owner_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("file_name", sa.String(255), nullable=False),
        sa.Column("mime_type", sa.String(255), nullable=False),
        sa.Column("size_bytes", sa.Integer(), nullable=False),
        sa.Column("storage_key", sa.String(500), nullable=False),
        sa.Column("sha256_hash", sa.String(64), nullable=False),
        sa.Column("description", sa.String(1000), nullable=True),
        sa.Column("blockchain_object_id", sa.String(100), nullable=True),
        sa.Column("blockchain_tx_hash", sa.String(100), nullable=True),
        sa.Column("status", sa.String(50), nullable=False, server_default="REGISTERED"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_digital_objects_owner_id", "digital_objects", ["owner_id"])
    op.create_index("ix_digital_objects_sha256_hash", "digital_objects", ["sha256_hash"])

    op.create_table(
        "verification_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("digital_object_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("digital_objects.id")),
        sa.Column("requested_by_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id")),
        sa.Column("requested_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("sha256_hash", sa.String(64), nullable=False),
        sa.Column("is_verified", sa.Boolean(), nullable=False),
        sa.Column("blockchain_tx_hash", sa.String(100), nullable=True),
        sa.Column("notes", sa.String(1000), nullable=True),
    )
    op.create_index("ix_verification_logs_sha256_hash", "verification_logs", ["sha256_hash"])

    op.create_table(
        "action_history",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("digital_object_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("digital_objects.id"), nullable=False),
        sa.Column("action_type", sa.String(50), nullable=False),
        sa.Column("performed_by_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id")),
        sa.Column("performed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("details", sa.String(2000), nullable=True),
        sa.Column("blockchain_tx_hash", sa.String(100), nullable=True),
    )
    op.create_index("ix_action_history_digital_object_id", "action_history", ["digital_object_id"])


def downgrade() -> None:
    op.drop_index("ix_action_history_digital_object_id", table_name="action_history")
    op.drop_table("action_history")

    op.drop_index("ix_verification_logs_sha256_hash", table_name="verification_logs")
    op.drop_table("verification_logs")

    op.drop_index("ix_digital_objects_sha256_hash", table_name="digital_objects")
    op.drop_index("ix_digital_objects_owner_id", table_name="digital_objects")
    op.drop_table("digital_objects")

    op.drop_index("ix_users_email", table_name="users")
    op.drop_table("users")

