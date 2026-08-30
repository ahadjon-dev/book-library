import uuid
from pathlib import Path

from fastapi import UploadFile

from app.core.config import settings

ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp"}
EXTENSION_BY_CONTENT_TYPE = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}


class UnsupportedImageType(ValueError):
    pass


def save_cover_bytes(content: bytes, extension: str = ".jpg") -> str:
    filename = f"{uuid.uuid4().hex}{extension}"
    covers_dir = Path(settings.uploads_dir) / "covers"
    covers_dir.mkdir(parents=True, exist_ok=True)
    (covers_dir / filename).write_bytes(content)
    return f"covers/{filename}"


def save_cover_image(file: UploadFile, contents: bytes) -> str:
    if file.content_type not in ALLOWED_CONTENT_TYPES:
        raise UnsupportedImageType(f"Unsupported content type: {file.content_type}")

    return save_cover_bytes(contents, EXTENSION_BY_CONTENT_TYPE[file.content_type])
