from fastapi import APIRouter

router = APIRouter(tags=["health"])


@router.get("/health")
def health():
    return {
        "status": "ok",
        "project": "MediChain Records",
        "version": "1.0.0",
        "description": "Защищённая платформа для хранения и верификации медицинских документов",
    }

