from typing import BinaryIO
import uuid

from minio import Minio

from app.core.config import get_settings
from app.storage.base import StorageBackend

settings = get_settings()


class MinioStorageBackend(StorageBackend):
    def __init__(self) -> None:
        if not all(
            [
                settings.MINIO_ENDPOINT,
                settings.MINIO_ACCESS_KEY,
                settings.MINIO_SECRET_KEY,
                settings.MINIO_BUCKET_NAME,
            ]
        ):
            raise RuntimeError("MinIO is not configured.")
        self.client = Minio(
            settings.MINIO_ENDPOINT,
            access_key=settings.MINIO_ACCESS_KEY,
            secret_key=settings.MINIO_SECRET_KEY,
            secure=settings.MINIO_SECURE,
        )
        if not self.client.bucket_exists(settings.MINIO_BUCKET_NAME):
            self.client.make_bucket(settings.MINIO_BUCKET_NAME)

    def save(self, file_obj: BinaryIO, filename: str) -> str:
        ext = filename.split(".")[-1] if "." in filename else ""
        key = f"{uuid.uuid4()}.{ext}" if ext else str(uuid.uuid4())
        file_obj.seek(0)
        self.client.put_object(
            bucket_name=settings.MINIO_BUCKET_NAME,
            object_name=key,
            data=file_obj,
            length=-1,
            part_size=10 * 1024 * 1024,
        )
        file_obj.seek(0)
        return key

    def get_url(self, storage_key: str) -> str:
        return self.client.presigned_get_object(settings.MINIO_BUCKET_NAME, storage_key)

