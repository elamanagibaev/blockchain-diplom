from functools import lru_cache
from typing import List, Optional

from pydantic_settings import BaseSettings
from pydantic import AnyUrl


class Settings(BaseSettings):
    PROJECT_NAME: str = "Blockchain File Registry"
    API_V1_STR: str = "/api"
    BACKEND_CORS_ORIGINS: List[str] = ["http://localhost:5173"]

    SECRET_KEY: str = "CHANGE_ME"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 4
    ALGORITHM: str = "HS256"

    POSTGRES_SERVER: str = "db"
    POSTGRES_USER: str = "app"
    POSTGRES_PASSWORD: str = "app"
    POSTGRES_DB: str = "file_registry"

    FILE_STORAGE_BACKEND: str = "local"
    FILE_STORAGE_PATH: str = "/data/files"
    MINIO_ENDPOINT: Optional[str] = None
    MINIO_ACCESS_KEY: Optional[str] = None
    MINIO_SECRET_KEY: Optional[str] = None
    MINIO_BUCKET_NAME: Optional[str] = None
    MINIO_SECURE: bool = False

    WEB3_PROVIDER_URL: Optional[AnyUrl] = None
    CONTRACT_ADDRESS: Optional[str] = None
    CONTRACT_ADDRESS_FILE: str = "/shared/contract_address.txt"
    CONTRACT_ABI_FILE: str = "/shared/FileRegistry.abi.json"
    CONTRACT_OWNER_PRIVATE_KEY: Optional[str] = None
    CONTRACT_OWNER_ADDRESS: Optional[str] = None
    CHAIN_ID: int = 31337

    # Публичный URL фронтенда для ссылок verify / QR (без завершающего слэша)
    PUBLIC_VERIFY_BASE_URL: str = "http://localhost:5173"

    RATE_LIMIT_REQUESTS: int = 100
    RATE_LIMIT_WINDOW_SECONDS: int = 60

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache
def get_settings() -> Settings:
    return Settings()

