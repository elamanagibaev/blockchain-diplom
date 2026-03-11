from fastapi import APIRouter, Depends, File, UploadFile
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.user import User
from app.schemas.verification import FileVerificationResult
from app.services.verification_service import VerificationService
from app.utils.sanitizer import sanitize_hash

router = APIRouter(prefix="/verify", tags=["verification"])


@router.post("/file", response_model=FileVerificationResult)
async def verify_file(
    upload_file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    sha, obj = VerificationService(db).verify_uploaded_file(current_user, upload_file)
    if not obj:
        return FileVerificationResult(
            is_verified=False,
            digital_object_id=None,
            registered_at=None,
            owner_id=None,
            file_name=None,
            description=None,
            transaction_hash=None,
            integrity_status="NOT_FOUND",
        )
    return FileVerificationResult(
        is_verified=True,
        digital_object_id=obj.id,
        registered_at=obj.created_at,
        owner_id=obj.owner_id,
        file_name=obj.file_name,
        description=obj.description,
        transaction_hash=obj.blockchain_tx_hash,
        integrity_status="OK",
    )


@router.get("/hash/{sha256}", response_model=FileVerificationResult)
def verify_hash(
    sha256: str,
    db: Session = Depends(get_db),
):
    # Sanitize hash input
    sha256 = sanitize_hash(sha256)
    if len(sha256) != 64:
        return FileVerificationResult(
            is_verified=False,
            digital_object_id=None,
            registered_at=None,
            owner_id=None,
            file_name=None,
            description=None,
            transaction_hash=None,
            integrity_status="INVALID_HASH",
        )
    
    obj = VerificationService(db).verify_by_hash(sha256)
    if not obj:
        return FileVerificationResult(
            is_verified=False,
            digital_object_id=None,
            registered_at=None,
            owner_id=None,
            file_name=None,
            description=None,
            transaction_hash=None,
            integrity_status="NOT_FOUND",
        )
    return FileVerificationResult(
        is_verified=True,
        digital_object_id=obj.id,
        registered_at=obj.created_at,
        owner_id=obj.owner_id,
        file_name=obj.file_name,
        description=obj.description,
        transaction_hash=obj.blockchain_tx_hash,
        integrity_status="OK",
    )

