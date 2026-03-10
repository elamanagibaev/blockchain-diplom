import hashlib
from typing import BinaryIO


def sha256_file(file_obj: BinaryIO) -> str:
    sha256 = hashlib.sha256()
    for chunk in iter(lambda: file_obj.read(8192), b""):
        sha256.update(chunk)
    file_obj.seek(0)
    return sha256.hexdigest()

