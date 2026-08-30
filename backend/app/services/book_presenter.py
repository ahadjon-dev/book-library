from sqlalchemy.orm import Session

from app.models.book import Book
from app.models.user_book_status import UserBookStatus
from app.schemas.book import BookOut


def load_statuses(db: Session, user_id: int, book_ids: list[int]) -> dict[int, UserBookStatus]:
    if not book_ids:
        return {}
    rows = (
        db.query(UserBookStatus)
        .filter(UserBookStatus.user_id == user_id, UserBookStatus.book_id.in_(book_ids))
        .all()
    )
    return {row.book_id: row for row in rows}


def to_book_out(book: Book, status_by_book_id: dict[int, UserBookStatus]) -> BookOut:
    my_status = status_by_book_id.get(book.id)
    return BookOut(
        id=book.id,
        title=book.title,
        subtitle=book.subtitle,
        isbn=book.isbn,
        publisher=book.publisher,
        publication_year=book.publication_year,
        language=book.language,
        page_count=book.page_count,
        cover_image_path=book.cover_image_path,
        description=book.description,
        genre=book.genre,
        owned=book.owned,
        shelf=book.shelf.name if book.shelf else None,
        purchase_date=book.purchase_date,
        purchase_price=float(book.purchase_price) if book.purchase_price is not None else None,
        authors=[a.name for a in book.authors],
        tags=[t.name for t in book.tags],
        my_status=my_status,
        created_at=book.created_at,
        updated_at=book.updated_at,
    )
