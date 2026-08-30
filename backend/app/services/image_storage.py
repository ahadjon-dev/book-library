import io
import uuid
from pathlib import Path

from fastapi import UploadFile
from PIL import Image

from app.core.config import settings

ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_DIMENSION = (800, 1200)


class UnsupportedImageType(ValueError):
    pass


def optimize_and_save_image(content: bytes) -> str:
    """Optimize image by resizing and converting to high-efficiency WebP format."""
    try:
        image = Image.open(io.BytesIO(content))
        # Convert any color mode to RGB for consistent encoding
        if image.mode in ("RGBA", "LA", "P"):
            image = image.convert("RGB")

        # Resize if dimensions exceed max bounding box, maintaining aspect ratio
        image.thumbnail(MAX_DIMENSION, Image.Resampling.LANCZOS)

        filename = f"{uuid.uuid4().hex}.webp"
        covers_dir = Path(settings.uploads_dir) / "covers"
        covers_dir.mkdir(parents=True, exist_ok=True)
        file_path = covers_dir / filename

        output_buffer = io.BytesIO()
        image.save(output_buffer, format="WEBP", quality=85, method=6)
        file_path.write_bytes(output_buffer.getvalue())

        return f"covers/{filename}"
    except Exception as exc:
        raise UnsupportedImageType("Invalid or unprocessable image file") from exc


def save_cover_bytes(content: bytes, extension: str = ".webp") -> str:
    """Save cover bytes with optimization, falling back to raw save if needed."""
    try:
        return optimize_and_save_image(content)
    except UnsupportedImageType:
        # Fallback to direct write if Pillow encounters format issue
        filename = f"{uuid.uuid4().hex}{extension}"
        covers_dir = Path(settings.uploads_dir) / "covers"
        covers_dir.mkdir(parents=True, exist_ok=True)
        (covers_dir / filename).write_bytes(content)
        return f"covers/{filename}"


def save_cover_image(file: UploadFile, contents: bytes) -> str:
    if file.content_type not in ALLOWED_CONTENT_TYPES:
        raise UnsupportedImageType(f"Unsupported content type: {file.content_type}")

    return optimize_and_save_image(contents)
