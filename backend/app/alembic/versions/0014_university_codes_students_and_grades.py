"""Add university codes, student profile and grades.

Revision ID: 0014_university_codes_students_and_grades
Revises: 0013_add_university
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0014_university_codes_students_and_grades"
down_revision = "0013_add_university"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("universities", sa.Column("registration_code", sa.String(length=64), nullable=True))
    op.execute(
        sa.text(
            """
            UPDATE universities
            SET registration_code = 'UNI-' || id::text
            WHERE registration_code IS NULL
            """
        )
    )
    op.alter_column("universities", "registration_code", nullable=False)
    op.create_unique_constraint("uq_universities_registration_code", "universities", ["registration_code"])

    op.add_column("users", sa.Column("enrollment_year", sa.Integer(), nullable=True))
    op.add_column("users", sa.Column("major", sa.String(length=255), nullable=True))

    op.create_table(
        "student_progress",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("student_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("current_course", sa.Integer(), server_default=sa.text("1"), nullable=False),
        sa.Column("graduated", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["student_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("student_id", name="uq_student_progress_student_id"),
        sa.CheckConstraint("current_course >= 1 AND current_course <= 4", name="ck_student_progress_current_course"),
    )

    op.create_table(
        "student_grades",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("student_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("subject", sa.String(length=255), nullable=False),
        sa.Column("course_year", sa.Integer(), nullable=False),
        sa.Column("grade", sa.Integer(), nullable=True),
        sa.Column("locked", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["student_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.CheckConstraint("course_year >= 1 AND course_year <= 4", name="ck_student_grades_course_year"),
        sa.CheckConstraint("grade IS NULL OR (grade >= 0 AND grade <= 100)", name="ck_student_grades_grade"),
    )
    op.create_index(op.f("ix_student_grades_student_id"), "student_grades", ["student_id"], unique=False)
    op.create_unique_constraint(
        "uq_student_grades_student_subject_course",
        "student_grades",
        ["student_id", "subject", "course_year"],
    )


def downgrade() -> None:
    op.drop_constraint("uq_student_grades_student_subject_course", "student_grades", type_="unique")
    op.drop_index(op.f("ix_student_grades_student_id"), table_name="student_grades")
    op.drop_table("student_grades")
    op.drop_table("student_progress")
    op.drop_column("users", "major")
    op.drop_column("users", "enrollment_year")
    op.drop_constraint("uq_universities_registration_code", "universities", type_="unique")
    op.drop_column("universities", "registration_code")
