from pydantic import BaseModel
from app.schemas.book import BookCreate, BookOut


class ShelfScanItem(BaseModel):
    detected_title: str
    detected_author: str | None = None
    confidence: float = 0.9
    matched: bool = True
    title: str
    authors: list[str] = []
    isbn: str | None = None
    publisher: str | None = None
    publication_year: int | None = None
    page_count: int | None = None
    genre: str | None = None
    cover_url: str | None = None
    already_in_library: bool = False
    existing_book_id: int | None = None


class ShelfScanResult(BaseModel):
    detected_count: int
    matched_count: int
    items: list[ShelfScanItem]


class BulkAddRequest(BaseModel):
    books: list[BookCreate]


class BulkAddResponse(BaseModel):
    added_count: int
    books: list[BookOut]
