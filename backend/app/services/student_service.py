from __future__ import annotations

import re
import os
import secrets
import string
from datetime import datetime, timezone
from io import BytesIO
from uuid import UUID

from fastapi import HTTPException, status
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet
from sqlalchemy.orm import Session, joinedload

from app.constants.document_events import DocumentEventAction
from app.constants.lifecycle import LifecycleStatus
from app.constants.student_curriculum import COURSE_SUBJECTS
from app.core.config import get_settings
from app.core.security import get_password_hash
from app.models.digital_object import DigitalObject
from app.models.student_grade import StudentGrade
from app.models.student_progress import StudentProgress
from app.models.user import User
from app.services.blockchain_service import BlockchainService
from app.services.document_event_service import DocumentEventService
from app.services.file_service import FileService
from app.storage.local_storage import LocalStorageBackend
from app.utils.hashing import sha256_file
from app.utils.wallet import encrypt_private_key, generate_evm_wallet

settings = get_settings()


class StudentService:
    def __init__(self, db: Session) -> None:
        self.db = db

    def _assert_department(self, user: User) -> None:
        if user.role != "department":
            raise HTTPException(status_code=403, detail="Доступно только роли department")
        if not user.university_id:
            raise HTTPException(status_code=400, detail="У кафедры не указан университет")

    def _transliterate_to_latin(self, text: str) -> str:
        mapping = {
            "а": "a", "б": "b", "в": "v", "г": "g", "д": "d", "е": "e", "ё": "e", "ж": "zh",
            "з": "z", "и": "i", "й": "i", "к": "k", "л": "l", "м": "m", "н": "n", "о": "o",
            "п": "p", "р": "r", "с": "s", "т": "t", "у": "u", "ф": "f", "х": "kh", "ц": "ts",
            "ч": "ch", "ш": "sh", "щ": "shch", "ы": "y", "э": "e", "ю": "yu", "я": "ya",
        }
        result = []
        for ch in text.lower():
            if ch in mapping:
                result.append(mapping[ch])
            elif ch.isascii() and ch.isalnum():
                result.append(ch)
        return "".join(result)

    def _email_domain(self, department_user: User) -> str:
        if not department_user.email or "@" not in department_user.email:
            return "students.local"
        _, domain = department_user.email.split("@", 1)
        domain = domain.strip().lower()
        return domain or "students.local"

    def _make_student_email(self, full_name: str, department_user: User) -> str:
        tokens = re.split(r"\s+", full_name.strip())
        surname = tokens[0] if tokens else "student"
        name = tokens[1] if len(tokens) > 1 else "student"
        local = f"{self._transliterate_to_latin(surname)}.{self._transliterate_to_latin(name)}".strip(".")
        local = re.sub(r"[^a-z0-9.]", "", local)[:64] or "student"
        domain = self._email_domain(department_user)
        email = f"{local}@{domain}"
        suffix = 1
        while self.db.query(User).filter(User.email == email).first():
            email = f"{local}{suffix}@{domain}"
            suffix += 1
        return email

    def _generate_password(self, length: int = 16) -> str:
        alphabet = string.ascii_letters + string.digits + "!@#$%^&*"
        while True:
            pwd = "".join(secrets.choice(alphabet) for _ in range(length))
            if any(c.isupper() for c in pwd) and any(c.islower() for c in pwd) and any(c.isdigit() for c in pwd):
                return pwd

    def _append_chain_action(self, action_type: str, actor: User, details: str, object_id: str | UUID | None = None) -> None:
        if not actor.wallet_address:
            return
        try:
            BlockchainService(self.db).append_action(
                object_id=str(object_id or actor.id),
                action_type=action_type,
                actor_wallet=actor.wallet_address,
                details=details,
            )
        except Exception:
            # Не блокируем основной учебный процесс при временной недоступности блокчейна.
            return

    def _student_query(self, department_user: User, student_id: UUID) -> User:
        student = (
            self.db.query(User)
            .options(joinedload(User.university))
            .filter(User.id == student_id, User.role == "student")
            .first()
        )
        if not student:
            raise HTTPException(status_code=404, detail="Студент не найден")
        if student.university_id != department_user.university_id:
            raise HTTPException(status_code=403, detail="Студент другого университета")
        return student

    def _progress_for_student(self, student_id: UUID) -> StudentProgress:
        progress = self.db.query(StudentProgress).filter(StudentProgress.student_id == student_id).first()
        if not progress:
            raise HTTPException(status_code=404, detail="Прогресс студента не найден")
        return progress

    def get_progress(self, department_user: User, student_id: UUID) -> StudentProgress:
        self._assert_department(department_user)
        student = self._student_query(department_user, student_id)
        return self._progress_for_student(student.id)

    def _create_default_grades(self, student_id: UUID) -> None:
        for course_year, subjects in COURSE_SUBJECTS.items():
            for subject in subjects:
                self.db.add(StudentGrade(student_id=student_id, subject=subject, course_year=course_year, grade=None, locked=False))

    def _validate_password(self, password: str) -> None:
        if len(password) < 8:
            raise HTTPException(status_code=422, detail="Пароль должен быть не менее 8 символов")
        if not any(c.isupper() for c in password):
            raise HTTPException(status_code=422, detail="Пароль должен содержать хотя бы одну заглавную букву")
        if not any(c.islower() for c in password):
            raise HTTPException(status_code=422, detail="Пароль должен содержать хотя бы одну строчную букву")
        if not any(c.isdigit() for c in password):
            raise HTTPException(status_code=422, detail="Пароль должен содержать хотя бы одну цифру")

    def create_student(
        self,
        department_user: User,
        full_name: str,
        enrollment_year: int,
        major: str,
        password: str | None = None,
    ) -> tuple[User, str]:
        self._assert_department(department_user)
        if enrollment_year < 1900 or enrollment_year > datetime.now().year + 1:
            raise HTTPException(status_code=422, detail="Некорректный год поступления")

        if password:
            self._validate_password(password)
        else:
            password = self._generate_password()

        student_wallet, pk_hex = generate_evm_wallet()
        encrypted_pk = encrypt_private_key(pk_hex, settings.SECRET_KEY)
        student = User(
            email=self._make_student_email(full_name, department_user),
            full_name=full_name.strip(),
            hashed_password=get_password_hash(password),
            role="student",
            is_active=True,
            university_id=department_user.university_id,
            enrollment_year=enrollment_year,
            major=major.strip(),
            wallet_address=student_wallet,
            wallet_encrypted_private_key=encrypted_pk,
        )
        self.db.add(student)
        self.db.flush()

        self.db.add(StudentProgress(student_id=student.id, current_course=1, graduated=False))
        self._create_default_grades(student.id)
        self.db.commit()
        self.db.refresh(student)

        self._append_chain_action(
            action_type="STUDENT_ENROLLED",
            actor=department_user,
            details=f"{student.full_name}; {student.major}",
            object_id=student.id,
        )
        return student, password

    def list_students(self, department_user: User) -> list[User]:
        self._assert_department(department_user)
        return (
            self.db.query(User)
            .filter(User.role == "student", User.university_id == department_user.university_id)
            .order_by(User.created_at.desc())
            .all()
        )

    def list_students_with_grades(self, department_user: User) -> list[tuple[User, StudentProgress, list[StudentGrade]]]:
        students = self.list_students(department_user)
        result: list[tuple[User, StudentProgress, list[StudentGrade]]] = []
        for student in students:
            progress = self._progress_for_student(student.id)
            grades = (
                self.db.query(StudentGrade)
                .filter(StudentGrade.student_id == student.id)
                .order_by(StudentGrade.course_year.asc(), StudentGrade.subject.asc())
                .all()
            )
            result.append((student, progress, grades))
        return result

    def update_grade(self, department_user: User, student_id: UUID, grade_id: UUID, grade_value: int) -> tuple[StudentGrade, StudentProgress]:
        self._assert_department(department_user)
        student = self._student_query(department_user, student_id)
        progress = self._progress_for_student(student.id)
        grade = (
            self.db.query(StudentGrade)
            .filter(StudentGrade.id == grade_id, StudentGrade.student_id == student.id)
            .first()
        )
        if not grade:
            raise HTTPException(status_code=404, detail="Оценка не найдена")
        if grade.locked:
            raise HTTPException(status_code=400, detail="Оценка заблокирована")
        if grade.course_year != progress.current_course:
            raise HTTPException(status_code=400, detail="Можно выставлять оценки только за текущий курс")
        if grade_value < 0 or grade_value > 100:
            raise HTTPException(status_code=422, detail="Оценка должна быть от 0 до 100")

        grade.grade = grade_value
        self.db.add(grade)
        self.db.commit()
        self.db.refresh(grade)

        self._append_chain_action(
            action_type="GRADE_SET",
            actor=department_user,
            details=f"{grade.subject}; курс {grade.course_year}; оценка {grade.grade}",
            object_id=student.id,
        )
        return grade, progress

    def promote_student(self, department_user: User, student_id: UUID) -> StudentProgress:
        self._assert_department(department_user)
        student = self._student_query(department_user, student_id)
        progress = self._progress_for_student(student.id)
        if progress.current_course >= 4:
            raise HTTPException(status_code=400, detail="Студент уже на 4 курсе")

        current_grades = (
            self.db.query(StudentGrade)
            .filter(StudentGrade.student_id == student.id, StudentGrade.course_year == progress.current_course)
            .all()
        )
        if any(g.grade is None for g in current_grades):
            raise HTTPException(status_code=400, detail="Сначала заполните все оценки текущего курса")

        now_year = datetime.now().year
        min_year = (student.enrollment_year or now_year) + progress.current_course - 1
        if now_year <= min_year:
            raise HTTPException(status_code=400, detail="Нельзя перевести студента раньше завершения учебного года")

        prev_course = progress.current_course
        for g in current_grades:
            g.locked = True
            self.db.add(g)
        progress.current_course += 1
        self.db.add(progress)
        self.db.commit()
        self.db.refresh(progress)

        self._append_chain_action(
            action_type="COURSE_PROMOTED",
            actor=department_user,
            details=f"с {prev_course} на {progress.current_course}",
            object_id=student.id,
        )
        return progress

    def _find_cyrillic_font(self) -> str | None:
        candidates = [
            "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
            "/usr/share/fonts/truetype/freefont/FreeSans.ttf",
            "C:/Windows/Fonts/DejaVuSans.ttf",
            "C:/Windows/Fonts/Arial.ttf",
        ]
        for path in candidates:
            if os.path.exists(path):
                return path
        return None

    def _build_diploma_pdf(self, student: User, university_name: str, grades: list[StudentGrade]) -> bytes:
        buffer = BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=A4, leftMargin=20 * mm, rightMargin=20 * mm, topMargin=20 * mm, bottomMargin=20 * mm)
        styles = getSampleStyleSheet()
        font_path = self._find_cyrillic_font()
        if font_path is not None:
            try:
                pdfmetrics.registerFont(TTFont("DejaVuSans", font_path))
                bold_font_path = font_path.replace("DejaVuSans.ttf", "DejaVuSans-Bold.ttf")
                if os.path.exists(bold_font_path):
                    pdfmetrics.registerFont(TTFont("DejaVuSans-Bold", bold_font_path))
                for key in ("Normal",):
                    styles[key].fontName = "DejaVuSans"
                for key in ("Heading1", "Heading2"):
                    styles[key].fontName = "DejaVuSans-Bold"
            except Exception:
                pass

        story = [
            Paragraph("ДИПЛОМ", styles["Heading1"]),
            Spacer(1, 8),
            Paragraph(f"Университет: {university_name}", styles["Normal"]),
            Paragraph(f"ФИО: {student.full_name or '-'}", styles["Normal"]),
            Paragraph(f"Специальность: {student.major or '-'}", styles["Normal"]),
            Paragraph(f"Год поступления: {student.enrollment_year or '-'}", styles["Normal"]),
            Paragraph(f"Год окончания: {datetime.now().year}", styles["Normal"]),
            Spacer(1, 12),
            Paragraph("Итоговые оценки", styles["Heading2"]),
            Spacer(1, 6),
        ]

        table_rows = [["Предмет", "Оценка"]]
        for course in sorted(COURSE_SUBJECTS.keys()):
            course_grades = [g for g in grades if g.course_year == course]
            for g in sorted(course_grades, key=lambda x: x.subject):
                table_rows.append([f"{g.subject} (курс {g.course_year})", str(g.grade if g.grade is not None else "-")])

        table = Table(table_rows, colWidths=[130 * mm, 30 * mm])
        table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.lightgrey),
                    ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                    ("ALIGN", (1, 1), (1, -1), "CENTER"),
                    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ]
            )
        )
        story.append(table)
        doc.build(story)
        return buffer.getvalue()

    def _create_digital_object_from_pdf(self, department_user: User, student: User, pdf_bytes: bytes) -> DigitalObject:
        file_name = f"diploma_{student.id}.pdf"
        sha = sha256_file(BytesIO(pdf_bytes))
        existing = self.db.query(DigitalObject).filter(DigitalObject.sha256_hash == sha).first()
        if existing:
            raise HTTPException(status_code=400, detail="Диплом с таким хэшем уже существует")

        storage = LocalStorageBackend()
        storage_key = storage.save(BytesIO(pdf_bytes), file_name)
        obj = DigitalObject(
            owner_id=student.id,
            uploaded_by_id=department_user.id,
            file_name=file_name,
            title=f"Диплом {student.full_name or ''}".strip(),
            mime_type="application/pdf",
            size_bytes=len(pdf_bytes),
            storage_key=storage_key,
            storage_backend="local",
            sha256_hash=sha,
            description="Автоматически сгенерированный диплом",
            document_type="document",
            owner_wallet_address=student.wallet_address,
            visibility="public",
            student_wallet_address=student.wallet_address,
            status=LifecycleStatus.FROZEN.value,
        )
        self.db.add(obj)
        self.db.flush()
        DocumentEventService(self.db).record(
            document_id=obj.id,
            user_id=department_user.id,
            action=DocumentEventAction.UPLOAD.value,
            metadata={"generated": True, "file_name": file_name, "size_bytes": len(pdf_bytes)},
        )
        DocumentEventService(self.db).record(
            document_id=obj.id,
            user_id=department_user.id,
            action=DocumentEventAction.FREEZE.value,
            metadata={"sha256_hash": sha, "generated": True},
        )
        self.db.commit()
        self.db.refresh(obj)
        return obj

    def graduate_student(self, department_user: User, student_id: UUID) -> tuple[StudentProgress, DigitalObject]:
        self._assert_department(department_user)
        student = self._student_query(department_user, student_id)
        progress = self._progress_for_student(student.id)
        if progress.graduated:
            raise HTTPException(status_code=400, detail="Студент уже выпускник")
        if progress.current_course != 4:
            raise HTTPException(status_code=400, detail="Выпуск возможен только на 4 курсе")

        fourth_year_grades = (
            self.db.query(StudentGrade)
            .filter(StudentGrade.student_id == student.id, StudentGrade.course_year == 4)
            .all()
        )
        if any(g.grade is None for g in fourth_year_grades):
            raise HTTPException(status_code=400, detail="Сначала заполните все оценки 4 курса")

        for g in fourth_year_grades:
            g.locked = True
            self.db.add(g)
        progress.graduated = True
        self.db.add(progress)
        self.db.commit()
        self.db.refresh(progress)

        university_name = student.university.name if student.university else "Университет"
        all_grades = (
            self.db.query(StudentGrade)
            .filter(StudentGrade.student_id == student.id)
            .order_by(StudentGrade.course_year.asc(), StudentGrade.subject.asc())
            .all()
        )
        pdf_bytes = self._build_diploma_pdf(student, university_name, all_grades)
        diploma = self._create_digital_object_from_pdf(department_user, student, pdf_bytes)
        diploma = FileService(self.db).submit_for_registration(department_user, diploma.id)
        self._append_chain_action(
            action_type="DIPLOMA_ISSUED",
            actor=department_user,
            details=f"{student.full_name}; diploma_id={diploma.id}",
            object_id=student.id,
        )
        return progress, diploma
