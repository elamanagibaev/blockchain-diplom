from typing import BinaryIO
import uuid

from minio import Minio
from minio.error import S3Error

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
        # Retry bucket creation (MinIO may not be ready at startup)
        for attempt in range(5):
            try:
                if not self.client.bucket_exists(settings.MINIO_BUCKET_NAME):
                    self.client.make_bucket(settings.MINIO_BUCKET_NAME)
                break
            except Exception as e:
                if attempt == 4:
                    raise RuntimeError(f"MinIO bucket init failed: {e}") from e
                import time
                time.sleep(2 ** attempt)

    def put_with_key(self, storage_key: str, file_obj: BinaryIO) -> None:
        """Put file to MinIO with specific key (used when migrating from local after blockchain registration)."""
        file_obj.seek(0, 2)
        size = file_obj.tell()
        file_obj.seek(0)
        self.client.put_object(
            bucket_name=settings.MINIO_BUCKET_NAME,
            object_name=storage_key,
            data=file_obj,
            length=size,
        )
        file_obj.seek(0)

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

    def get_stream(self, storage_key: str):
        try:
            response = self.client.get_object(settings.MINIO_BUCKET_NAME, storage_key)
        except S3Error as e:
            if e.code == "NoSuchKey":
                raise FileNotFoundError(f"Object not found: {storage_key}") from e
            raise
        try:
            for chunk in response.stream(32 * 1024):
                yield chunk
        finally:
            response.close()
