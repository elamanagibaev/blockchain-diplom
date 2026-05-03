from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class DepartmentStudentCreate(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=255)
    enrollment_year: int
    major: str = Field(..., min_length=2, max_length=255)
    password: str | None = Field(None, min_length=8, max_length=128, description="Оставьте пустым для автогенерации")


class DepartmentStudentRead(BaseModel):
    id: UUID
    full_name: str | None
    email: str
    role: str
    university_id: int | None
    enrollment_year: int | None
    major: str | None
    created_at: datetime


class DepartmentStudentCreateResponse(BaseModel):
    student: DepartmentStudentRead
    generated_password: str


class StudentProgressRead(BaseModel):
    current_course: int
    graduated: bool
    created_at: datetime


class StudentGradeRead(BaseModel):
    id: UUID
    student_id: UUID
    subject: str
    course_year: int
    grade: int | None
    locked: bool
    created_at: datetime
    updated_at: datetime


class DepartmentStudentGradesRead(BaseModel):
    student: DepartmentStudentRead
    progress: StudentProgressRead
    grades: list[StudentGradeRead]


class GradeUpdateRequest(BaseModel):
    grade: int = Field(..., ge=0, le=100)


class GradeUpdateResponse(BaseModel):
    grade: StudentGradeRead
    progress: StudentProgressRead


class StudentPromoteResponse(BaseModel):
    student_id: UUID
    previous_course: int
    current_course: int
    graduated: bool


class StudentGraduateResponse(BaseModel):
    student_id: UUID
    graduated: bool
    diploma_id: UUID
    diploma_status: str
