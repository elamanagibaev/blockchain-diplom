from fastapi import APIRouter

from app.core.config import get_settings

router = APIRouter(tags=["health"])


@router.get("/health")
def health():
    settings = get_settings()
    return {
        "status": "ok",
        "project": "BlockProof",
        "version": "1.0.0",
        "description": "Защищённая платформа для хранения и верификации медицинских документов",
        "storage_backend": settings.FILE_STORAGE_BACKEND,
    }

