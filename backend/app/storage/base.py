from abc import ABC, abstractmethod
from typing import BinaryIO, Iterator


class StorageBackend(ABC):
    @abstractmethod
    def save(self, file_obj: BinaryIO, filename: str) -> str:
        raise NotImplementedError

    @abstractmethod
    def get_url(self, storage_key: str) -> str:
        raise NotImplementedError

    @abstractmethod
    def get_stream(self, storage_key: str) -> Iterator[bytes]:
        """Stream file content. Used for authenticated download through backend."""
        raise NotImplementedError

