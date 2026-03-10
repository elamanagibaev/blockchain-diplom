import os
import uuid
from typing import BinaryIO

from app.core.config import get_settings
from app.storage.base import StorageBackend

settings = get_settings()


class LocalStorageBackend(StorageBackend):
    def __init__(self) -> None:
        self.base_path = settings.FILE_STORAGE_PATH
        os.makedirs(self.base_path, exist_ok=True)

    def save(self, file_obj: BinaryIO, filename: str) -> str:
        ext = os.path.splitext(filename)[1]
        key = f"{uuid.uuid4()}{ext}"
        path = os.path.join(self.base_path, key)
        with open(path, "wb") as out:
            for chunk in iter(lambda: file_obj.read(8192), b""):
                out.write(chunk)
        file_obj.seek(0)
        return key

    def get_url(self, storage_key: str) -> str:
        return f"file://{os.path.join(self.base_path, storage_key)}"

