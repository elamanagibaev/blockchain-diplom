from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from uuid import UUID

from app.api.deps import get_current_user, get_db
from app.models.user import User
from app.schemas.department import (
    DepartmentStudentCreate,
    DepartmentStudentCreateResponse,
    DepartmentStudentGradesRead,
    DepartmentStudentRead,
    GradeUpdateRequest,
    GradeUpdateResponse,
    StudentGraduateResponse,
    StudentGradeRead,
    StudentProgressRead,
    StudentPromoteResponse,
)
from app.services.student_service import StudentService

router = APIRouter(prefix="/department", tags=["department"])


def _student_read(user: User) -> DepartmentStudentRead:
    return DepartmentStudentRead(
        id=user.id,
        full_name=user.full_name,
        email=user.email,
        role=user.role,
        university_id=user.university_id,
        enrollment_year=user.enrollment_year,
        major=user.major,
        created_at=user.created_at,
    )


@router.post("/students", response_model=DepartmentStudentCreateResponse)
def create_student(
    body: DepartmentStudentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    student, generated_password = StudentService(db).create_student(
        department_user=current_user,
        full_name=body.full_name,
        enrollment_year=body.enrollment_year,
        major=body.major,
        password=body.password,
    )
    return DepartmentStudentCreateResponse(student=_student_read(student), generated_password=generated_password)


@router.get("/students", response_model=list[DepartmentStudentRead])
def list_students(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    students = StudentService(db).list_students(current_user)
    return [_student_read(s) for s in students]


@router.get("/students/grades", response_model=list[DepartmentStudentGradesRead])
def list_students_grades(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rows = StudentService(db).list_students_with_grades(current_user)
    return [
        DepartmentStudentGradesRead(
            student=_student_read(student),
            progress=StudentProgressRead(
                current_course=progress.current_course,
                graduated=progress.graduated,
                created_at=progress.created_at,
            ),
            grades=[
                StudentGradeRead(
                    id=g.id,
                    student_id=g.student_id,
                    subject=g.subject,
                    course_year=g.course_year,
                    grade=g.grade,
                    locked=g.locked,
                    created_at=g.created_at,
                    updated_at=g.updated_at,
                )
                for g in grades
            ],
        )
        for student, progress, grades in rows
    ]


@router.put("/students/{student_id}/grades/{grade_id}", response_model=GradeUpdateResponse)
def update_grade(
    student_id: UUID,
    grade_id: UUID,
    body: GradeUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    grade, progress = StudentService(db).update_grade(current_user, student_id, grade_id, body.grade)
    return GradeUpdateResponse(
        grade=StudentGradeRead(
            id=grade.id,
            student_id=grade.student_id,
            subject=grade.subject,
            course_year=grade.course_year,
            grade=grade.grade,
            locked=grade.locked,
            created_at=grade.created_at,
            updated_at=grade.updated_at,
        ),
        progress=StudentProgressRead(
            current_course=progress.current_course,
            graduated=progress.graduated,
            created_at=progress.created_at,
        ),
    )


@router.post("/students/{student_id}/promote", response_model=StudentPromoteResponse)
def promote_student(
    student_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = StudentService(db)
    before = service.get_progress(current_user, student_id).current_course
    progress = service.promote_student(current_user, student_id)
    return StudentPromoteResponse(
        student_id=student_id,
        previous_course=before,
        current_course=progress.current_course,
        graduated=progress.graduated,
    )


@router.post("/students/{student_id}/graduate", response_model=StudentGraduateResponse)
def graduate_student(
    student_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    progress, diploma = StudentService(db).graduate_student(current_user, student_id)
    return StudentGraduateResponse(
        student_id=student_id,
        graduated=progress.graduated,
        diploma_id=diploma.id,
        diploma_status=diploma.status,
    )
