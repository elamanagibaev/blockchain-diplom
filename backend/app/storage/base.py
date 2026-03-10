from abc import ABC, abstractmethod
from typing import BinaryIO


class StorageBackend(ABC):
    @abstractmethod
    def save(self, file_obj: BinaryIO, filename: str) -> str:
        raise NotImplementedError

    @abstractmethod
    def get_url(self, storage_key: str) -> str:
        raise NotImplementedError

