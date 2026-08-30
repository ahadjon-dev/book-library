import re
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session, selectinload

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.author import Author
from app.models.book import Book
from app.models.tag import Tag
from app.models.user import User
from app.models.user_book_status import ReadStatus, UserBookStatus
from app.schemas.public import PublicBookOut, PublicLibraryResponse, ShareLinkConfig

router = APIRouter(prefix="/public", tags=["public"])


class UpdateShareLinkRequest(BaseModel):
    share_slug: str | None = None
    is_public_shelf: bool = True


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
    # 1. Find user by share_slug or numeric user_id
    user = None
    if slug_or_id.isdigit():
        user = db.get(User, int(slug_or_id))
    if user is None:
        user = db.query(User).filter(func.lower(User.share_slug) == slug_or_id.lower()).first()

    if user is None or not user.is_public_shelf:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Public library not found or private",
        )

    # 2. Query books
    query = (
        db.query(Book)
        .options(selectinload(Book.authors), selectinload(Book.tags), selectinload(Book.shelf))
        .filter(Book.owned.is_(True))
    )

    if genre:
        query = query.filter(Book.genre == genre)
    if author:
        query = query.filter(Book.authors.any(Author.name == author))
    if tag:
        query = query.filter(Book.tags.any(Tag.name == tag))

    books = query.order_by(Book.id.desc()).all()

    # 3. Load public user statuses
    statuses = {
        s.book_id: s
        for s in db.query(UserBookStatus).filter(UserBookStatus.user_id == user.id).all()
    }

    public_items: list[PublicBookOut] = []
    for b in books:
        st = statuses.get(b.id)
        current_status = st.status.value if st else "unread"
        rating = st.rating if st else None

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
        owner_name=user.display_name,
        total_books=len(public_items),
        books=paginated_items,
    )


@router.get("/my-share-link", response_model=ShareLinkConfig)
def get_my_share_link(current_user: User = Depends(get_current_user)) -> ShareLinkConfig:
    slug = current_user.share_slug or f"u{current_user.id}"
    return ShareLinkConfig(
        share_slug=current_user.share_slug,
        is_public_shelf=current_user.is_public_shelf,
        share_url=f"/share/{slug}",
    )


@router.post("/my-share-link", response_model=ShareLinkConfig)
def update_my_share_link(
    payload: UpdateShareLinkRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ShareLinkConfig:
    if payload.share_slug is not None:
        clean_slug = re.sub(r'[^a-zA-Z0-9-_]', '', payload.share_slug.strip().lower())
        if clean_slug:
            # Check if slug is taken by another user
            existing = (
                db.query(User)
                .filter(User.share_slug == clean_slug, User.id != current_user.id)
                .first()
            )
            if existing:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="This share link slug is already taken.",
                )
            current_user.share_slug = clean_slug
        else:
            current_user.share_slug = None

    current_user.is_public_shelf = payload.is_public_shelf
    db.commit()
    db.refresh(current_user)

    slug = current_user.share_slug or f"u{current_user.id}"
    return ShareLinkConfig(
        share_slug=current_user.share_slug,
        is_public_shelf=current_user.is_public_shelf,
        share_url=f"/share/{slug}",
    )
