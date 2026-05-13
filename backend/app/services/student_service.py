from __future__ import annotations

import re
import os
import secrets
import string
import uuid
from datetime import datetime, timezone
from io import BytesIO
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.constants.document_events import DocumentEventAction
from app.constants.lifecycle import LifecycleStatus
from app.constants.student_curriculum import COURSE_SUBJECTS
from app.core.config import get_settings
from app.core.security import get_password_hash
from app.models.digital_object import DigitalObject
from app.models.document_event import DocumentEvent
from app.models.blockchain_event import BlockchainEvent
from app.models.student_grade import StudentGrade
from app.models.student_progress import StudentProgress
from app.models.user import User
from app.services.blockchain_service import BlockchainService
from app.services.auth_service import ensure_user_wallet
from app.services.document_event_service import DocumentEventService
from app.services.file_service import FileService
from app.services.diploma_template_service import DiplomaTemplateService
from app.storage.local_storage import LocalStorageBackend
from app.utils.hashing import sha256_file
from app.utils.wallet import encrypt_private_key, generate_evm_wallet

settings = get_settings()



class StudentService:
    def __init__(self, db: Session) -> None:
        self.db = db

    @staticmethod
    def diploma_display_title(student: User) -> str:
        full_name = (student.full_name or "Выпускник").strip() or "Выпускник"
        year = student.enrollment_year or "—"
        major = (student.major or "—").strip() or "—"
        return f"{full_name} {year} год {major}".strip()

    def _assert_department(self, user: User) -> None:
        if user.role != "department":
            raise HTTPException(status_code=403, detail="Доступно только роли department")
        if not user.university_id:
            raise HTTPException(status_code=400, detail="У кафедры не указан университет")

    def _assert_department_or_admin(self, user: User) -> None:
        if user.role not in ("department", "admin"):
            raise HTTPException(status_code=403, detail="Доступно только кафедре или администратору")
        if user.role == "department" and not user.university_id:
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
        if department_user.role != "admin" and student.university_id != department_user.university_id:
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
            .filter(User.role == "student", User.university_id == department_user.university_id, User.is_active.is_(True))
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

    def _build_diploma_pdf(self, student: User, university_name: str, grades: list[StudentGrade], verify_url: str | None = None, progress: StudentProgress | None = None, document_id: UUID | None = None) -> bytes:
        doc_uuid = document_id or uuid.uuid4()
        effective_verify_url = verify_url or f"{settings.PUBLIC_VERIFY_BASE_URL.rstrip('/')}/verify/doc/{doc_uuid}"
        return DiplomaTemplateService().build_diploma_pdf(
            student=student,
            grades=grades,
            document_id=doc_uuid,
            verify_url=effective_verify_url,
            progress=progress,
        )

    def _diploma_for_student(self, student: User) -> DigitalObject | None:
        return (
            self.db.query(DigitalObject)
            .filter(
                DigitalObject.owner_id == student.id,
                DigitalObject.file_name == f"diploma_{student.id}.pdf",
            )
            .order_by(DigitalObject.created_at.desc())
            .first()
        )

    def _current_diploma_pdf_bytes(self, student: User, diploma: DigitalObject) -> bytes:
        grades = (
            self.db.query(StudentGrade)
            .filter(StudentGrade.student_id == student.id)
            .order_by(StudentGrade.course_year.asc(), StudentGrade.subject.asc())
            .all()
        )
        progress = self.db.query(StudentProgress).filter(StudentProgress.student_id == student.id).first()
        verify_url = f"{settings.PUBLIC_VERIFY_BASE_URL.rstrip('/')}/verify/doc/{diploma.id}"
        return DiplomaTemplateService().build_diploma_pdf(
            student=student,
            grades=grades,
            document_id=diploma.id,
            verify_url=verify_url,
            progress=progress,
            generated_at=diploma.created_at,
        )

    def _current_diploma_hash(self, student: User, diploma: DigitalObject) -> str:
        pdf_bytes = self._current_diploma_pdf_bytes(student, diploma)
        return sha256_file(BytesIO(pdf_bytes))

    def _registered_original_metadata(self, diploma: DigitalObject) -> dict[str, str | int | None]:
        latest = (
            self.db.query(DocumentEvent)
            .filter(DocumentEvent.document_id == diploma.id, DocumentEvent.action == DocumentEventAction.VERIFY_FAILED.value)
            .order_by(DocumentEvent.timestamp.desc())
            .first()
        )
        meta = latest.event_metadata if latest and isinstance(latest.event_metadata, dict) else {}
        if meta.get("registered_original_storage_key"):
            return {
                "registered_original_storage_key": meta.get("registered_original_storage_key"),
                "registered_original_storage_backend": meta.get("registered_original_storage_backend") or "local",
                "registered_original_file_name": meta.get("registered_original_file_name") or diploma.file_name,
                "registered_original_mime_type": meta.get("registered_original_mime_type") or diploma.mime_type,
                "registered_original_size_bytes": meta.get("registered_original_size_bytes") or diploma.size_bytes,
                "registered_original_hash": meta.get("registered_original_hash") or meta.get("registered_hash") or diploma.sha256_hash,
            }
        return {
            "registered_original_storage_key": diploma.storage_key,
            "registered_original_storage_backend": diploma.storage_backend,
            "registered_original_file_name": diploma.file_name,
            "registered_original_mime_type": diploma.mime_type,
            "registered_original_size_bytes": diploma.size_bytes,
            "registered_original_hash": diploma.sha256_hash,
        }

    def diploma_integrity_for_student(self, department_user: User, student_id: UUID) -> dict[str, str | UUID | None]:
        self._assert_department_or_admin(department_user)
        student = self._student_query(department_user, student_id)
        diploma = self._diploma_for_student(student)
        if not diploma or not diploma.blockchain_tx_hash:
            return {
                "diploma_id": diploma.id if diploma else None,
                "integrity_status": "NOT_REGISTERED",
                "registered_hash": diploma.sha256_hash if diploma else None,
                "current_hash": None,
            }
        current_hash = self._current_diploma_hash(student, diploma)
        chain_object = BlockchainService(self.db).get_object(str(diploma.blockchain_object_id or diploma.id))
        registered_hash = (chain_object or {}).get("file_hash")
        if not registered_hash:
            original_meta = self._registered_original_metadata(diploma)
            registered_hash = str(original_meta.get("registered_original_hash") or diploma.sha256_hash)
        return {
            "diploma_id": diploma.id,
            "integrity_status": "OK" if current_hash == registered_hash else "MISMATCH",
            "registered_hash": registered_hash,
            "current_hash": current_hash,
        }

    def demo_change_registered_grade(
        self,
        department_user: User,
        student_id: UUID,
        grade_id: UUID,
        grade_value: int,
    ) -> tuple[StudentGrade, dict[str, str | UUID | None]]:
        self._assert_department_or_admin(department_user)
        department_user = ensure_user_wallet(department_user, self.db)
        student = self._student_query(department_user, student_id)
        grade = (
            self.db.query(StudentGrade)
            .filter(StudentGrade.id == grade_id, StudentGrade.student_id == student.id)
            .first()
        )
        if not grade:
            raise HTTPException(status_code=404, detail="Оценка не найдена")
        if grade_value < 0 or grade_value > 100:
            raise HTTPException(status_code=422, detail="Оценка должна быть от 0 до 100")

        diploma = self._diploma_for_student(student)
        if not diploma or not diploma.blockchain_tx_hash:
            raise HTTPException(
                status_code=400,
                detail="Демо-изменение доступно только после регистрации диплома в блокчейне",
            )

        old_value = grade.grade
        grade.grade = grade_value
        self.db.add(grade)
        self.db.flush()

        current_pdf_bytes = self._current_diploma_pdf_bytes(student, diploma)
        current_hash = sha256_file(BytesIO(current_pdf_bytes))
        object_id = str(diploma.blockchain_object_id or diploma.id)
        chain_object = BlockchainService(self.db).get_object(object_id)
        registered_hash = (chain_object or {}).get("file_hash") or diploma.sha256_hash
        original_meta = self._registered_original_metadata(diploma)
        if current_hash != diploma.sha256_hash:
            existing = (
                self.db.query(DigitalObject)
                .filter(DigitalObject.sha256_hash == current_hash, DigitalObject.id != diploma.id)
                .first()
            )
            if existing:
                raise HTTPException(status_code=400, detail="Документ с такой текущей версией уже существует")
            storage = LocalStorageBackend()
            diploma.storage_key = storage.save(BytesIO(current_pdf_bytes), diploma.file_name)
            diploma.storage_backend = "local"
            diploma.size_bytes = len(current_pdf_bytes)
            diploma.sha256_hash = current_hash
            self.db.add(diploma)
            self.db.flush()
        integrity = {
            "diploma_id": diploma.id,
            "integrity_status": "OK" if current_hash == registered_hash else "MISMATCH",
            "registered_hash": registered_hash,
            "current_hash": current_hash,
        }
        trust_chain_tx_hash = None
        if integrity["integrity_status"] == "MISMATCH":
            details = (
                "Цепочка доверия нарушена: хэш текущей версии диплома не совпадает с хэшем, "
                "зарегистрированным в блокчейне; "
                f"дисциплина={grade.subject}; старая_оценка={old_value}; новая_оценка={grade.grade}; "
                f"хэш_в_блокчейне={registered_hash}; текущий_хэш={current_hash}"
            )
            trust_chain_tx_hash = BlockchainService(self.db).append_action(
                object_id=object_id,
                action_type="TRUST_CHAIN_BROKEN",
                actor_wallet=department_user.wallet_address,
                details=details,
            )
            self.db.add(
                BlockchainEvent(
                    action_type="TRUST_CHAIN_BROKEN",
                    document_id=diploma.id,
                    tx_hash=trust_chain_tx_hash,
                    from_wallet=department_user.wallet_address,
                    to_wallet=diploma.owner_wallet_address,
                    initiator_user_id=department_user.id,
                )
            )
        DocumentEventService(self.db).record(
            document_id=diploma.id,
            user_id=department_user.id,
            action=DocumentEventAction.VERIFY_FAILED.value if integrity["integrity_status"] == "MISMATCH" else DocumentEventAction.VERIFY_SUCCESS.value,
            metadata={
                "method": "demo_data_change",
                "subject": grade.subject,
                "course_year": grade.course_year,
                "old_grade": old_value,
                "new_grade": grade.grade,
                "registered_hash": registered_hash,
                "current_hash": current_hash,
                **original_meta,
                "integrity_status": integrity["integrity_status"],
                "trust_chain_status": "BROKEN" if integrity["integrity_status"] == "MISMATCH" else "OK",
                "trust_chain_tx_hash": trust_chain_tx_hash,
                "blockchain_object_id": object_id,
            },
        )
        self.db.commit()
        self.db.refresh(grade)
        return grade, integrity

    def _create_digital_object_from_pdf(self, department_user: User, student: User, pdf_bytes: bytes, obj_id: UUID | None = None) -> DigitalObject:
        file_name = f"diploma_{student.id}.pdf"
        display_title = self.diploma_display_title(student)
        sha = sha256_file(BytesIO(pdf_bytes))
        existing = self.db.query(DigitalObject).filter(DigitalObject.sha256_hash == sha).first()
        if existing:
            # Идемпотентность повторной выдачи: если это тот же студент и автогенерированный диплом,
            # используем существующую запись вместо ошибки.
            if existing.owner_id == student.id and existing.file_name == file_name:
                existing.title = display_title
                existing.description = display_title
                self.db.add(existing)
                self.db.commit()
                self.db.refresh(existing)
                return existing
            raise HTTPException(status_code=400, detail="Диплом с таким хэшем уже существует")

        storage = LocalStorageBackend()
        storage_key = storage.save(BytesIO(pdf_bytes), file_name)
        doc_id = obj_id or uuid.uuid4()
        obj = DigitalObject(
            id=doc_id,
            owner_id=student.id,
            uploaded_by_id=department_user.id,
            file_name=file_name,
            title=display_title,
            mime_type="application/pdf",
            size_bytes=len(pdf_bytes),
            storage_key=storage_key,
            storage_backend="local",
            sha256_hash=sha,
            description=display_title,
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
        existing_diploma = (
            self.db.query(DigitalObject)
            .filter(
                DigitalObject.owner_id == student.id,
                DigitalObject.file_name == f"diploma_{student.id}.pdf",
            )
            .order_by(DigitalObject.created_at.desc())
            .first()
        )
        if existing_diploma:
            title = self.diploma_display_title(student)
            if existing_diploma.title != title or existing_diploma.description == "Автоматически сгенерированный диплом":
                existing_diploma.title = title
                existing_diploma.description = title
                self.db.add(existing_diploma)
                self.db.commit()
                self.db.refresh(existing_diploma)
            return progress, existing_diploma
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

        university_name = student.university.name if student.university else "Университет"
        all_grades = (
            self.db.query(StudentGrade)
            .filter(StudentGrade.student_id == student.id)
            .order_by(StudentGrade.course_year.asc(), StudentGrade.subject.asc())
            .all()
        )
        diploma_id = uuid.uuid4()
        verify_url = f"{settings.PUBLIC_VERIFY_BASE_URL.rstrip('/')}/verify/doc/{diploma_id}"
        pdf_bytes = self._build_diploma_pdf(
            student,
            university_name,
            all_grades,
            verify_url=verify_url,
            progress=progress,
            document_id=diploma_id,
        )
        diploma = self._create_digital_object_from_pdf(department_user, student, pdf_bytes, obj_id=diploma_id)
        if diploma.status in (LifecycleStatus.FROZEN.value, LifecycleStatus.REJECTED.value):
            diploma = FileService(self.db).submit_for_registration(department_user, diploma.id)
        self._append_chain_action(
            action_type="DIPLOMA_ISSUED",
            actor=department_user,
            details=f"{student.full_name}; diploma_id={diploma.id}",
            object_id=student.id,
        )
        for g in fourth_year_grades:
            g.locked = True
            self.db.add(g)
        progress.graduated = True
        self.db.add(progress)
        self.db.commit()
        self.db.refresh(progress)
        return progress, diploma
