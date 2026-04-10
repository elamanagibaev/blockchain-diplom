"""Split uploader and owner for digital objects.

Revision ID: 0012_add_uploaded_by_owner_split
Revises: 0011_simplified_single_dean_workflow
"""

from alembic import op
import sqlalchemy as sa

revision = "0012_add_uploaded_by_owner_split"
down_revision = "0011_simplified_single_dean_workflow"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("digital_objects", sa.Column("uploaded_by_id", sa.UUID(), nullable=True))
    op.create_index(
        op.f("ix_digital_objects_uploaded_by_id"),
        "digital_objects",
        ["uploaded_by_id"],
        unique=False,
    )
    op.create_foreign_key(
        "fk_digital_objects_uploaded_by_id_users",
        "digital_objects",
        "users",
        ["uploaded_by_id"],
        ["id"],
    )
    op.execute(
        sa.text(
            """
            UPDATE digital_objects
            SET uploaded_by_id = owner_id
            WHERE uploaded_by_id IS NULL
            """
        )
    )


def downgrade() -> None:
    op.drop_constraint("fk_digital_objects_uploaded_by_id_users", "digital_objects", type_="foreignkey")
    op.drop_index(op.f("ix_digital_objects_uploaded_by_id"), table_name="digital_objects")
    op.drop_column("digital_objects", "uploaded_by_id")
