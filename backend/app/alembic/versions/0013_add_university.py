"""Add universities table and user.university_id.

Revision ID: 0013_add_university
Revises: 0012_add_uploaded_by_owner_split
"""

from alembic import op
import sqlalchemy as sa

revision = "0013_add_university"
down_revision = "0012_add_uploaded_by_owner_split"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "universities",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("short_name", sa.String(length=50), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
    )
    op.add_column("users", sa.Column("university_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "fk_users_university_id_universities",
        "users",
        "universities",
        ["university_id"],
        ["id"],
    )

    universities = sa.table(
        "universities",
        sa.column("id", sa.Integer),
        sa.column("name", sa.String),
        sa.column("short_name", sa.String),
        sa.column("is_active", sa.Boolean),
    )
    op.bulk_insert(
        universities,
        [
            {"name": "КазНУ им. аль-Фараби", "short_name": None, "is_active": True},
            {"name": "КБТУ", "short_name": None, "is_active": True},
            {"name": "АлТУ", "short_name": None, "is_active": True},
            {"name": "ЕНУ им. Гумилёва", "short_name": None, "is_active": True},
            {"name": "КазНТУ им. Сатпаева", "short_name": None, "is_active": True},
        ],
    )


def downgrade() -> None:
    op.drop_constraint("fk_users_university_id_universities", "users", type_="foreignkey")
    op.drop_column("users", "university_id")
    op.drop_table("universities")
