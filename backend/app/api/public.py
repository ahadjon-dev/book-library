import re

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session, selectinload

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.author import Author
from app.models.book import Book
from app.models.library import Library
from app.models.tag import Tag
from app.models.user import ROLE_OWNER, User
from app.models.user_book_status import ReadStatus, UserBookStatus
from app.schemas.public import PublicBookOut, PublicLibraryResponse, ShareLinkConfig

router = APIRouter(prefix="/public", tags=["public"])

# Highest status wins when members disagree
_STATUS_PRECEDENCE = [ReadStatus.finished, ReadStatus.reading, ReadStatus.abandoned, ReadStatus.unread]


class UpdateShareLinkRequest(BaseModel):
    share_slug: str | None = None
    is_public_shelf: bool = True


def _aggregate_statuses(rows: list[UserBookStatus]) -> tuple[str, int | None]:
    """Combine every member's status on one book into one public status and rating."""
    statuses = {r.status for r in rows}
    combined = ReadStatus.unread
    for candidate in _STATUS_PRECEDENCE:
        if candidate in statuses:
            combined = candidate
            break
    ratings = [r.rating for r in rows if r.rating is not None]
    return combined.value, max(ratings) if ratings else None


@router.get("/library/{slug_or_id}", response_model=PublicLibraryResponse)
def get_public_library(
    slug_or_id: str,
    genre: str | None = Query(default=None),
    tag: str | None = Query(default=None),
    author: str | None = Query(default=None),
    status_filter: ReadStatus | None = Query(default=None, alias="status"),
    min_rating: int | None = Query(default=None, ge=1, le=10),
    limit: int = Query(default=100, le=500),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
) -> PublicLibraryResponse:
    # 1. Find the library by share_slug or numeric id
    library = None
    if slug_or_id.isdigit():
        library = db.get(Library, int(slug_or_id))
    if library is None:
        library = (
            db.query(Library).filter(func.lower(Library.share_slug) == slug_or_id.lower()).first()
        )

    if library is None or not library.is_public_shelf:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Public library not found or private",
        )

    # 2. Query books
    query = (
        db.query(Book)
        .options(selectinload(Book.authors), selectinload(Book.tags), selectinload(Book.shelf))
        .filter(Book.owned.is_(True), Book.library_id == library.id)
    )

    if genre:
        query = query.filter(Book.genre == genre)
    if author:
        query = query.filter(Book.authors.any(Author.name == author))
    if tag:
        query = query.filter(Book.tags.any(Tag.name == tag))

    books = query.order_by(Book.id.desc()).all()

    # 3. Load every member's statuses and aggregate them per book
    status_rows = (
        db.query(UserBookStatus)
        .join(User, User.id == UserBookStatus.user_id)
        .filter(User.library_id == library.id)
        .all()
    )
    statuses_by_book: dict[int, list[UserBookStatus]] = {}
    for row in status_rows:
        statuses_by_book.setdefault(row.book_id, []).append(row)

    public_items: list[PublicBookOut] = []
    for b in books:
        rows = statuses_by_book.get(b.id, [])
        current_status, rating = _aggregate_statuses(rows)

        # Filter by status or min_rating if requested
        if status_filter and current_status != status_filter.value:
            continue
        if min_rating is not None and (rating is None or rating < min_rating):
            continue

        public_items.append(
            PublicBookOut(
                id=b.id,
                title=b.title,
                subtitle=b.subtitle,
                authors=[a.name for a in b.authors],
                genre=b.genre,
                publication_year=b.publication_year,
                page_count=b.page_count,
                cover_image_path=b.cover_image_path,
                shelf=b.shelf.name if b.shelf else None,
                tags=[t.name for t in b.tags],
                status=current_status,
                rating=rating,
            )
        )

    paginated_items = public_items[offset : offset + limit]

    return PublicLibraryResponse(
        owner_name=library.name,
        total_books=len(public_items),
        books=paginated_items,
    )


def _to_share_config(library: Library) -> ShareLinkConfig:
    slug = library.share_slug or str(library.id)
    return ShareLinkConfig(
        share_slug=library.share_slug,
        is_public_shelf=library.is_public_shelf,
        share_url=f"/share/{slug}",
    )


@router.get("/my-share-link", response_model=ShareLinkConfig)
def get_my_share_link(current_user: User = Depends(get_current_user)) -> ShareLinkConfig:
    return _to_share_config(current_user.library)


@router.post("/my-share-link", response_model=ShareLinkConfig)
def update_my_share_link(
    payload: UpdateShareLinkRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ShareLinkConfig:
    if current_user.role != ROLE_OWNER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the library owner can change the share link",
        )

    library = current_user.library
    if payload.share_slug is not None:
        clean_slug = re.sub(r'[^a-zA-Z0-9-_]', '', payload.share_slug.strip().lower())
        if clean_slug:
            # Check if slug is taken by another library
            existing = (
                db.query(Library)
                .filter(Library.share_slug == clean_slug, Library.id != library.id)
                .first()
            )
            if existing:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="This share link slug is already taken.",
                )
            library.share_slug = clean_slug
        else:
            library.share_slug = None

    library.is_public_shelf = payload.is_public_shelf
    db.commit()
    db.refresh(library)
    return _to_share_config(library)
