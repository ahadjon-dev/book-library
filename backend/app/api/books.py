import io
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, UploadFile, status
from openpyxl import Workbook
from openpyxl.styles import Font
from sqlalchemy import func, or_
from sqlalchemy.orm import Query as ORMQuery, Session, selectinload

from app.api.deps import get_current_user
from app.core.limiter import limiter
from app.db.session import get_db
from app.models.author import Author
from app.models.book import Book
from app.models.shelf import Shelf
from app.models.tag import Tag
from app.models.user import User
from app.models.user_book_status import ReadStatus, UserBookStatus
from app.schemas.book import (
    BookCreate,
    BookListOut,
    BookOut,
    BookUpdate,
    IsbnLookupMatch,
    IsbnLookupResult,
    MemberStatusOut,
    StatusCounts,
    StatusUpdate,
)
from app.schemas.import_export import ImportSummary
from app.schemas.recommendation import RecommendNextRequest, RecommendNextResponse
from app.schemas.shelf_scanner import BulkAddRequest, BulkAddResponse, ShelfScanResult
from app.services.book_presenter import load_statuses, to_book_out
from app.services.csv_importer import import_books_from_csv
from app.services.image_storage import UnsupportedImageType, save_cover_bytes, save_cover_image
from app.services.isbn_lookup import download_cover_bytes, fetch_isbn_metadata, parse_metadata
from app.services.isbn_utils import both_forms, is_valid, normalize
from app.services.lookup_service import get_or_create_shelf, resolve_authors, resolve_tags
from app.services.recommendation_engine import recommend_next_books
from app.services.shelf_scanner import scan_shelf_image

router = APIRouter(prefix="/books", tags=["books"])

MAX_COVER_BYTES = 10 * 1024 * 1024

_to_book_out = to_book_out
_load_statuses = load_statuses


def _apply_relations(db: Session, book: Book, payload: BookCreate | BookUpdate, library_id: int) -> None:
    if payload.authors is not None:
        book.authors = resolve_authors(db, payload.authors)
    if payload.tags is not None:
        book.tags = resolve_tags(db, payload.tags, library_id)
    if payload.shelf is not None:
        book.shelf = get_or_create_shelf(db, payload.shelf, library_id) if payload.shelf.strip() else None


def _apply_common_filters(
    query: ORMQuery,
    *,
    genre: str | None,
    shelf: str | None,
    author: str | None,
    tag: str | None,
    year_min: int | None,
    year_max: int | None,
    search: str | None,
    owned: bool | None = None,
) -> ORMQuery:
    if owned is not None:
        query = query.filter(Book.owned == owned)
    if genre:
        query = query.filter(Book.genre == genre)
    if shelf:
        query = query.filter(Book.shelf.has(Shelf.name == shelf))
    if author:
        query = query.filter(Book.authors.any(Author.name == author))
    if tag:
        query = query.filter(Book.tags.any(Tag.name == tag))
    if year_min is not None:
        query = query.filter(Book.publication_year >= year_min)
    if year_max is not None:
        query = query.filter(Book.publication_year <= year_max)
    if search:
        search_terms = [t.strip() for t in search.strip().split() if t.strip()]
        for term in search_terms:
            like = f"%{term}%"
            query = query.filter(
                or_(
                    Book.title.ilike(like),
                    Book.subtitle.ilike(like),
                    Book.isbn.ilike(like),
                    Book.publisher.ilike(like),
                    Book.description.ilike(like),
                    Book.authors.any(Author.name.ilike(like)),
                    Book.tags.any(Tag.name.ilike(like)),
                )
            )
    return query


def _filter_by_status(query: ORMQuery, db: Session, user_id: int, status_filter: ReadStatus) -> ORMQuery:
    if status_filter == ReadStatus.unread:
        non_unread_book_ids = db.query(UserBookStatus.book_id).filter(
            UserBookStatus.user_id == user_id, UserBookStatus.status != ReadStatus.unread
        )
        return query.filter(~Book.id.in_(non_unread_book_ids))

    my_status_book_ids = db.query(UserBookStatus.book_id).filter(
        UserBookStatus.user_id == user_id, UserBookStatus.status == status_filter
    )
    return query.filter(Book.id.in_(my_status_book_ids))


def _status_breakdown(db: Session, user_id: int, matching_ids: list[int]) -> StatusCounts:
    total = len(matching_ids)
    if total == 0:
        return StatusCounts(total=0, unread=0, reading=0, finished=0, abandoned=0)

    rows = (
        db.query(UserBookStatus.status, func.count())
        .filter(UserBookStatus.user_id == user_id, UserBookStatus.book_id.in_(matching_ids))
        .group_by(UserBookStatus.status)
        .all()
    )
    counts = {s: 0 for s in ReadStatus}
    for status_value, count in rows:
        counts[status_value] = count

    explicit_total = sum(counts.values())
    counts[ReadStatus.unread] += total - explicit_total

    return StatusCounts(
        total=total,
        unread=counts[ReadStatus.unread],
        reading=counts[ReadStatus.reading],
        finished=counts[ReadStatus.finished],
        abandoned=counts[ReadStatus.abandoned],
    )


@router.get("", response_model=BookListOut)
def list_books(
    search: str | None = Query(default=None),
    genre: str | None = Query(default=None),
    tag: str | None = Query(default=None),
    author: str | None = Query(default=None),
    shelf: str | None = Query(default=None),
    status_filter: ReadStatus | None = Query(default=None, alias="status"),
    year_min: int | None = Query(default=None),
    year_max: int | None = Query(default=None),
    owned: bool | None = Query(default=True),
    limit: int = Query(default=50, le=1000),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> BookListOut:
    base_query = _apply_common_filters(
        db.query(Book).filter(Book.library_id == current_user.library_id),
        genre=genre,
        shelf=shelf,
        author=author,
        tag=tag,
        year_min=year_min,
        year_max=year_max,
        search=search,
        owned=owned,
    )
    matching_ids = [book_id for (book_id,) in base_query.with_entities(Book.id).all()]
    status_counts = _status_breakdown(db, current_user.id, matching_ids)

    query = (
        db.query(Book)
        .options(
            selectinload(Book.authors),
            selectinload(Book.tags),
            selectinload(Book.shelf),
            selectinload(Book.added_by),
        )
        .filter(Book.library_id == current_user.library_id)
    )
    query = _apply_common_filters(
        query,
        genre=genre,
        shelf=shelf,
        author=author,
        tag=tag,
        year_min=year_min,
        year_max=year_max,
        search=search,
        owned=owned,
    )
    if status_filter is not None:
        query = _filter_by_status(query, db, current_user.id, status_filter)

    query = query.order_by(Book.id.desc())

    total = query.count()
    books = query.offset(offset).limit(limit).all()

    status_by_book_id = _load_statuses(db, current_user.id, [b.id for b in books])
    items = [_to_book_out(b, status_by_book_id) for b in books]

    return BookListOut(items=items, total=total, limit=limit, offset=offset, status_counts=status_counts)


@router.post("", response_model=BookOut, status_code=status.HTTP_201_CREATED)
async def create_book(
    payload: BookCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> BookOut:
    book = Book(
        library_id=current_user.library_id,
        added_by_user_id=current_user.id,
        title=payload.title.strip(),
        subtitle=payload.subtitle.strip() if payload.subtitle else None,
        isbn=payload.isbn.strip() if payload.isbn else None,
        publisher=payload.publisher.strip() if payload.publisher else None,
        publication_year=payload.publication_year,
        language=payload.language.strip() if payload.language else None,
        page_count=payload.page_count,
        description=payload.description.strip() if payload.description else None,
        genre=payload.genre.strip() if payload.genre else None,
        owned=payload.owned,
        purchase_date=payload.purchase_date,
        purchase_price=payload.purchase_price,
    )
    db.add(book)
    _apply_relations(db, book, payload, current_user.library_id)

    if payload.cover_url:
        image_bytes = await download_cover_bytes(payload.cover_url)
        if image_bytes:
            book.cover_image_path = save_cover_bytes(image_bytes, ".webp")

    db.commit()
    db.refresh(book)
    return _to_book_out(book, {})


@router.get("/lookup", response_model=IsbnLookupResult)
async def lookup_isbn(
    isbn: str = Query(..., min_length=8, max_length=20),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> IsbnLookupResult:
    clean_isbn = normalize(isbn)

    if not is_valid(clean_isbn):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Invalid ISBN checksum or length. Please check the digits.",
        )

    # Check for duplicate in current user's library using all equivalent forms (ISBN-10 & 13)
    equivalent_isbns = both_forms(clean_isbn)
    existing = (
        db.query(Book)
        .filter(Book.isbn.in_(equivalent_isbns), Book.library_id == current_user.library_id)
        .first()
    )
    already_in_library = IsbnLookupMatch(id=existing.id, owned=existing.owned) if existing else None

    raw = await fetch_isbn_metadata(clean_isbn)
    if raw is None:
        return IsbnLookupResult(found=False, already_in_library=already_in_library)

    parsed = parse_metadata(raw)

    if already_in_library is None and parsed["title"]:
        title_match = (
            db.query(Book)
            .filter(func.lower(Book.title) == parsed["title"].strip().lower(), Book.library_id == current_user.library_id)
            .first()
        )
        if title_match and (
            not parsed["authors"]
            or any(a.name.lower() in [x.lower() for x in parsed["authors"]] for a in title_match.authors)
        ):
            already_in_library = IsbnLookupMatch(id=title_match.id, owned=title_match.owned)

    return IsbnLookupResult(found=True, already_in_library=already_in_library, **parsed)


EXPORT_HEADERS = [
    "Title", "Subtitle", "Authors", "ISBN", "Publisher", "Year", "Language",
    "Pages", "Genre", "Tags", "Shelf", "Owned", "Status", "Rating",
    "Purchase Date", "Purchase Price", "Notes",
]


@router.get("/export")
def export_books(
    search: str | None = Query(default=None),
    genre: str | None = Query(default=None),
    tag: str | None = Query(default=None),
    author: str | None = Query(default=None),
    shelf: str | None = Query(default=None),
    status_filter: ReadStatus | None = Query(default=None, alias="status"),
    year_min: int | None = Query(default=None),
    year_max: int | None = Query(default=None),
    owned: bool | None = Query(default=True),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Response:
    query = (
        db.query(Book)
        .options(
            selectinload(Book.authors),
            selectinload(Book.tags),
            selectinload(Book.shelf),
            selectinload(Book.added_by),
        )
        .filter(Book.library_id == current_user.library_id)
    )
    query = _apply_common_filters(
        query,
        genre=genre,
        shelf=shelf,
        author=author,
        tag=tag,
        year_min=year_min,
        year_max=year_max,
        search=search,
        owned=owned,
    )
    if status_filter is not None:
        query = _filter_by_status(query, db, current_user.id, status_filter)

    books = query.order_by(Book.id.desc()).all()
    status_by_book_id = _load_statuses(db, current_user.id, [b.id for b in books])

    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "Library"
    sheet.append(EXPORT_HEADERS)
    for cell in sheet[1]:
        cell.font = Font(bold=True)

    for book in books:
        my_status = status_by_book_id.get(book.id)
        sheet.append(
            [
                book.title,
                book.subtitle or "",
                ", ".join(a.name for a in book.authors),
                book.isbn or "",
                book.publisher or "",
                book.publication_year or "",
                book.language or "",
                book.page_count or "",
                book.genre or "",
                ", ".join(t.name for t in book.tags),
                book.shelf.name if book.shelf else "",
                "Yes" if book.owned else "No",
                my_status.status.value if my_status else "unread",
                my_status.rating if my_status else "",
                book.purchase_date.isoformat() if book.purchase_date else "",
                float(book.purchase_price) if book.purchase_price is not None else "",
                my_status.notes if my_status else "",
            ]
        )

    for column_cells in sheet.columns:
        values = [str(cell.value) for cell in column_cells if cell.value is not None]
        width = max((len(v) for v in values), default=10)
        sheet.column_dimensions[column_cells[0].column_letter].width = min(max(width + 2, 10), 40)

    buffer = io.BytesIO()
    workbook.save(buffer)

    filename = f"library-export-{date.today().isoformat()}.xlsx"
    return Response(
        content=buffer.getvalue(),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/import", response_model=ImportSummary)
@limiter.limit("5/minute")
async def import_books(
    request: Request,
    file: UploadFile,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ImportSummary:
    contents = await file.read()
    return import_books_from_csv(contents, db, current_user)


@router.post("/scan-shelf", response_model=ShelfScanResult)
@limiter.limit("10/minute")
async def scan_shelf(
    request: Request,
    file: UploadFile,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ShelfScanResult:
    if file.content_type not in ("image/jpeg", "image/png", "image/webp", "image/jpg"):
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Only JPEG, PNG, and WEBP image files are supported.",
        )
    image_bytes = await file.read()
    if len(image_bytes) > 10 * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Image size exceeds maximum allowed limit (10MB).",
        )
    return await scan_shelf_image(image_bytes, db, current_user.library_id)


@router.post("/bulk-add", response_model=BulkAddResponse)
async def bulk_add_books(
    payload: BulkAddRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> BulkAddResponse:
    if len(payload.books) > 100:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot bulk-add more than 100 books in a single request.",
        )

    # 1. Concurrently fetch all valid remote covers
    cover_tasks = [
        download_cover_bytes(item.cover_url) if item.cover_url else asyncio.sleep(0, result=None)
        for item in payload.books
    ]
    downloaded_covers = await asyncio.gather(*cover_tasks, return_exceptions=True)

    added_books: list[Book] = []
    for idx, item in enumerate(payload.books):
        book = Book(
            library_id=current_user.library_id,
            added_by_user_id=current_user.id,
            title=item.title,
            subtitle=item.subtitle,
            isbn=item.isbn,
            publisher=item.publisher,
            publication_year=item.publication_year,
            language=item.language,
            page_count=item.page_count,
            description=item.description,
            genre=item.genre,
            owned=item.owned,
            purchase_date=item.purchase_date,
            purchase_price=item.purchase_price,
        )
        db.add(book)
        _apply_relations(db, book, item, current_user.library_id)

        # Attach pre-downloaded cover if valid
        raw_img = downloaded_covers[idx] if idx < len(downloaded_covers) else None
        if isinstance(raw_img, bytes) and raw_img:
            try:
                book.cover_image_path = save_cover_bytes(raw_img, ".webp")
            except Exception:
                pass

        added_books.append(book)

    db.commit()
    for b in added_books:
        db.refresh(b)

    return BulkAddResponse(
        added_count=len(added_books),
        books=[to_book_out(b, {}) for b in added_books],
    )


@router.post("/recommend-next", response_model=RecommendNextResponse)
@limiter.limit("20/minute")
def recommend_next(
    request: Request,
    payload: RecommendNextRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> RecommendNextResponse:
    return recommend_next_books(db, current_user, payload)


@router.get("/{book_id}", response_model=BookOut)
def get_book(
    book_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> BookOut:
    book = db.query(Book).filter(Book.id == book_id, Book.library_id == current_user.library_id).first()
    if book is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Book not found")
    status_by_book_id = _load_statuses(db, current_user.id, [book.id])
    out = _to_book_out(book, status_by_book_id)
    out.member_statuses = _member_statuses(db, current_user.library_id, book.id)
    return out


def _member_statuses(db: Session, library_id: int, book_id: int) -> list[MemberStatusOut]:
    rows = (
        db.query(User, UserBookStatus)
        .outerjoin(
            UserBookStatus,
            (UserBookStatus.user_id == User.id) & (UserBookStatus.book_id == book_id),
        )
        .filter(User.library_id == library_id)
        .order_by(User.id)
        .all()
    )
    return [
        MemberStatusOut(
            user_id=user.id,
            display_name=user.display_name,
            status=user_status.status if user_status else ReadStatus.unread,
            rating=user_status.rating if user_status else None,
        )
        for user, user_status in rows
    ]


@router.patch("/{book_id}", response_model=BookOut)
async def update_book(
    book_id: int,
    payload: BookUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> BookOut:
    book = db.query(Book).filter(Book.id == book_id, Book.library_id == current_user.library_id).first()
    if book is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Book not found")

    data = payload.model_dump(exclude_unset=True, exclude={"authors", "tags", "shelf", "cover_url"})
    for field, value in data.items():
        if isinstance(value, str):
            value = value.strip() or None
        setattr(book, field, value)
    _apply_relations(db, book, payload, current_user.library_id)

    if payload.cover_url:
        image_bytes = await download_cover_bytes(payload.cover_url)
        if image_bytes:
            book.cover_image_path = save_cover_bytes(image_bytes, ".webp")

    db.commit()
    db.refresh(book)
    status_by_book_id = _load_statuses(db, current_user.id, [book.id])
    return _to_book_out(book, status_by_book_id)


@router.delete("/{book_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_book(
    book_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    book = db.query(Book).filter(Book.id == book_id, Book.library_id == current_user.library_id).first()
    if book is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Book not found")
    db.delete(book)
    db.commit()


@router.post("/{book_id}/cover", response_model=BookOut)
async def upload_cover(
    book_id: int,
    file: UploadFile,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> BookOut:
    book = db.query(Book).filter(Book.id == book_id, Book.library_id == current_user.library_id).first()
    if book is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Book not found")

    contents = await file.read()
    if len(contents) > MAX_COVER_BYTES:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="Cover image too large")

    try:
        relative_path = save_cover_image(file, contents)
    except UnsupportedImageType as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    book.cover_image_path = relative_path
    db.commit()
    db.refresh(book)
    status_by_book_id = _load_statuses(db, current_user.id, [book.id])
    return _to_book_out(book, status_by_book_id)


@router.patch("/{book_id}/status", response_model=BookOut)
def update_my_status(
    book_id: int,
    payload: StatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> BookOut:
    book = db.query(Book).filter(Book.id == book_id, Book.library_id == current_user.library_id).first()
    if book is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Book not found")

    my_status = (
        db.query(UserBookStatus)
        .filter(UserBookStatus.user_id == current_user.id, UserBookStatus.book_id == book_id)
        .first()
    )
    if my_status is None:
        my_status = UserBookStatus(user_id=current_user.id, book_id=book_id)
        db.add(my_status)

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(my_status, field, value)

    db.commit()
    status_by_book_id = _load_statuses(db, current_user.id, [book.id])
    return _to_book_out(book, status_by_book_id)
