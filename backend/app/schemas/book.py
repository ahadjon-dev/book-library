from datetime import date, datetime

from pydantic import BaseModel, Field

from app.models.user_book_status import ReadStatus


class BookBase(BaseModel):
    title: str
    subtitle: str | None = None
    isbn: str | None = None
    publisher: str | None = None
    publication_year: int | None = None
    language: str | None = None
    page_count: int | None = None
    description: str | None = None
    genre: str | None = None
    owned: bool = True
    purchase_date: date | None = None
    purchase_price: float | None = None
    authors: list[str] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)
    shelf: str | None = None


class BookCreate(BookBase):
    # external cover image URL from ISBN lookup, fetched and stored on create
    cover_url: str | None = None


class BookUpdate(BaseModel):
    title: str | None = None
    subtitle: str | None = None
    isbn: str | None = None
    publisher: str | None = None
    publication_year: int | None = None
    language: str | None = None
    page_count: int | None = None
    description: str | None = None
    genre: str | None = None
    owned: bool | None = None
    purchase_date: date | None = None
    purchase_price: float | None = None
    authors: list[str] | None = None
    tags: list[str] | None = None
    shelf: str | None = None
    # external cover image URL from ISBN lookup, fetched and stored if provided
    cover_url: str | None = None


class MyStatus(BaseModel):
    status: ReadStatus
    rating: int | None = None
    notes: str | None = None
    started_at: date | None = None
    finished_at: date | None = None

    model_config = {"from_attributes": True}


class MemberStatusOut(BaseModel):
    user_id: int
    display_name: str
    status: ReadStatus
    rating: int | None = None


class BookOut(BaseModel):
    id: int
    title: str
    subtitle: str | None
    isbn: str | None
    publisher: str | None
    publication_year: int | None
    language: str | None
    page_count: int | None
    cover_image_path: str | None
    description: str | None
    genre: str | None
    owned: bool
    shelf: str | None = None
    purchase_date: date | None
    purchase_price: float | None
    authors: list[str]
    tags: list[str]
    my_status: MyStatus | None = None
    added_by: str | None = None
    # Every library member's status; filled on the book detail endpoint only
    member_statuses: list[MemberStatusOut] | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class StatusCounts(BaseModel):
    total: int
    unread: int
    reading: int
    finished: int
    abandoned: int


class BookListOut(BaseModel):
    items: list[BookOut]
    total: int
    limit: int
    offset: int
    status_counts: StatusCounts


class StatusUpdate(BaseModel):
    status: ReadStatus | None = None
    rating: int | None = Field(default=None, ge=1, le=10)
    notes: str | None = None
    started_at: date | None = None
    finished_at: date | None = None


class IsbnLookupMatch(BaseModel):
    id: int
    owned: bool


class IsbnLookupResult(BaseModel):
    found: bool
    title: str | None = None
    subtitle: str | None = None
    authors: list[str] = Field(default_factory=list)
    publisher: str | None = None
    publication_year: int | None = None
    page_count: int | None = None
    cover_url: str | None = None
    already_in_library: IsbnLookupMatch | None = None
