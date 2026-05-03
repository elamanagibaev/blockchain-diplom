"""Make university code five digits.

Revision ID: 0015_university_code_5_digits
Revises: 0014_university_codes_students_and_grades
"""

from alembic import op
import sqlalchemy as sa

revision = "0015_university_code_5_digits"
down_revision = "0014_university_codes_students_and_grades"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        sa.text(
            """
            UPDATE universities
            SET registration_code = LPAD(id::text, 5, '0')
            WHERE registration_code !~ '^[0-9]{5}$'
            """
        )
    )
    op.create_check_constraint(
        "ck_universities_registration_code_5_digits",
        "universities",
        "registration_code ~ '^[0-9]{5}$'",
    )


def downgrade() -> None:
    op.drop_constraint("ck_universities_registration_code_5_digits", "universities", type_="check")
