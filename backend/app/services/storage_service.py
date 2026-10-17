
import os
import shutil
from pathlib import Path

from app.core.config import settings

# Store uploaded files inside the backend folder.
STORAGE_DIR = Path(__file__).resolve().parents[2] / "uploads"


def ensure_storage():
    STORAGE_DIR.mkdir(parents=True, exist_ok=True)


def upload(path: str, key: str, content_type: str):
    """
    Save an uploaded file in local storage and return its storage key.
    The content_type argument is retained for compatibility.
    """
    ensure_storage()

    # Prevent path traversal outside the storage directory.
    safe_key = Path(key)
    if safe_key.is_absolute() or ".." in safe_key.parts:
        raise ValueError("Invalid storage key")

    destination = (STORAGE_DIR / safe_key).resolve()
    if not destination.is_relative_to(STORAGE_DIR.resolve()):
        raise ValueError("Invalid storage key")

    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(path, destination)

    return key
