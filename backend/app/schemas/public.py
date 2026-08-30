from pydantic import BaseModel


class PublicBookOut(BaseModel):
    id: int
    title: str
    subtitle: str | None = None
    authors: list[str] = []
    genre: str | None = None
    publication_year: int | None = None
    page_count: int | None = None
    cover_image_path: str | None = None
    shelf: str | None = None
    tags: list[str] = []
    status: str = "unread"
    rating: int | None = None


class PublicLibraryResponse(BaseModel):
    owner_name: str
    total_books: int
    books: list[PublicBookOut]


class ShareLinkConfig(BaseModel):
    share_slug: str | None
    is_public_shelf: bool
    share_url: str
