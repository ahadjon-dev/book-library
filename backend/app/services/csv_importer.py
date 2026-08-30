import csv
import io
import re
from datetime import date, datetime
from typing import Any

from sqlalchemy.orm import Session

from app.models.book import Book
from app.models.user import User
from app.models.user_book_status import ReadStatus, UserBookStatus
from app.schemas.import_export import ImportSummary
from app.services.lookup_service import get_or_create_shelf, resolve_authors, resolve_tags


def _clean_isbn(raw: str | None) -> str | None:
    if not raw:
        return None
    # Strip quotes, equals signs (Goodreads puts ="978..."), dashes, spaces
    cleaned = re.sub(r'[^0-9X]', '', raw.strip())
    return cleaned if len(cleaned) in (10, 13) else None


def _parse_date(raw: str | None) -> date | None:
    if not raw or not raw.strip():
        return None
    cleaned = raw.strip()
    for fmt in ("%Y-%m-%d", "%Y/%m/%d", "%m/%d/%Y", "%d/%m/%Y", "%Y-%m", "%Y"):
        try:
            return datetime.strptime(cleaned, fmt).date()
        except ValueError:
            continue
    return None


def _parse_int(raw: Any) -> int | None:
    if raw is None or raw == "":
        return None
    try:
        return int(float(str(raw).strip()))
    except (ValueError, TypeError):
        return None


def _parse_float(raw: Any) -> float | None:
    if raw is None or raw == "":
        return None
    try:
        # Strip currency symbols
        cleaned = re.sub(r'[^\d.]', '', str(raw).strip())
        return float(cleaned) if cleaned else None
    except (ValueError, TypeError):
        return None


def _map_status(raw: str | None) -> ReadStatus:
    if not raw:
        return ReadStatus.unread
    val = raw.strip().lower()
    if val in ("read", "finished", "done", "completed"):
        return ReadStatus.finished
    if val in ("currently-reading", "currently reading", "reading", "in-progress"):
        return ReadStatus.reading
    if val in ("to-read", "to read", "unread", "want to read"):
        return ReadStatus.unread
    if val in ("abandoned", "did not finish", "dnf"):
        return ReadStatus.abandoned
    return ReadStatus.unread


def import_books_from_csv(file_content: bytes, db: Session, user: User) -> ImportSummary:
    text = file_content.decode("utf-8-sig", errors="replace")
    reader = csv.DictReader(io.StringIO(text))

    if reader.fieldnames is None:
        return ImportSummary(total_rows=0, imported=0, skipped=0, errors=["Empty or invalid CSV file"])

    total_rows = 0
    imported = 0
    skipped = 0
    errors: list[str] = []

    for row_idx, row in enumerate(reader, start=2):
        total_rows += 1
        # Detect Goodreads vs standard columns
        title = (row.get("Title") or row.get("title") or "").strip()
        if not title:
            skipped += 1
            continue

        subtitle = (row.get("Subtitle") or row.get("subtitle") or "").strip() or None

        # Authors
        authors_raw = (
            row.get("Authors")
            or row.get("Author")
            or row.get("author")
            or row.get("authors")
            or ""
        ).strip()
        additional_authors = (row.get("Additional Authors") or "").strip()
        if additional_authors:
            authors_raw = f"{authors_raw}, {additional_authors}"
        author_names = [a.strip() for a in re.split(r'[,;]', authors_raw) if a.strip()]

        # ISBN
        raw_isbn = row.get("ISBN13") or row.get("ISBN") or row.get("isbn")
        isbn = _clean_isbn(raw_isbn)

        publisher = (row.get("Publisher") or row.get("publisher") or "").strip() or None
        year = _parse_int(
            row.get("Year")
            or row.get("Year Published")
            or row.get("Original Publication Year")
            or row.get("publication_year")
        )
        language = (row.get("Language") or row.get("language") or "English").strip() or None
        pages = _parse_int(row.get("Pages") or row.get("Number of Pages") or row.get("page_count"))
        genre = (row.get("Genre") or row.get("genre") or "").strip() or None

        # Tags & Bookshelves
        tags_raw = (
            row.get("Tags")
            or row.get("Bookshelves")
            or row.get("tags")
            or ""
        ).strip()
        tag_names = [t.strip() for t in re.split(r'[,;]', tags_raw) if t.strip()]

        shelf_name = (row.get("Shelf") or row.get("shelf") or "").strip() or None

        # Owned
        owned_raw = (row.get("Owned") or row.get("owned") or "").strip().lower()
        owned = owned_raw not in ("no", "false", "0")

        # Status & Rating
        status_raw = (
            row.get("Status")
            or row.get("Exclusive Shelf")
            or row.get("status")
            or ""
        ).strip()
        status_enum = _map_status(status_raw)

        rating_val = _parse_int(row.get("Rating") or row.get("My Rating") or row.get("rating"))
        if rating_val is not None:
            # Goodreads is 1-5, map 1-5 to 2-10 if desired, or keep directly
            if rating_val > 10:
                rating_val = 10
            elif rating_val < 1:
                rating_val = None

        finished_at = _parse_date(row.get("Date Read") or row.get("finished_at"))
        purchase_date = _parse_date(row.get("Purchase Date") or row.get("purchase_date") or row.get("Date Added"))
        purchase_price = _parse_float(row.get("Purchase Price") or row.get("purchase_price"))
        notes = (row.get("Notes") or row.get("My Review") or row.get("notes") or "").strip() or None

        # Check existing book by ISBN or exact Title
        existing_book = None
        if isbn:
            existing_book = db.query(Book).filter(Book.isbn == isbn).first()
        if existing_book is None:
            existing_book = db.query(Book).filter(Book.title.ilike(title)).first()

        try:
            if existing_book is None:
                book = Book(
                    title=title,
                    subtitle=subtitle,
                    isbn=isbn,
                    publisher=publisher,
                    publication_year=year,
                    language=language,
                    page_count=pages,
                    genre=genre,
                    owned=owned,
                    purchase_date=purchase_date,
                    purchase_price=purchase_price,
                )
                if shelf_name:
                    book.shelf = get_or_create_shelf(db, shelf_name)
                if author_names:
                    book.authors = resolve_authors(db, author_names)
                if tag_names:
                    book.tags = resolve_tags(db, tag_names)
                db.add(book)
                db.flush()
            else:
                book = existing_book

            # Link User Reading Status
            user_status = (
                db.query(UserBookStatus)
                .filter(UserBookStatus.user_id == user.id, UserBookStatus.book_id == book.id)
                .first()
            )
            if user_status is None:
                user_status = UserBookStatus(
                    user_id=user.id,
                    book_id=book.id,
                    status=status_enum,
                    rating=rating_val,
                    finished_at=finished_at,
                    notes=notes,
                )
                db.add(user_status)
            else:
                if status_enum != ReadStatus.unread:
                    user_status.status = status_enum
                if rating_val is not None:
                    user_status.rating = rating_val
                if finished_at is not None:
                    user_status.finished_at = finished_at
                if notes:
                    user_status.notes = notes

            imported += 1
        except Exception as exc:
            errors.append(f"Row {row_idx} ({title}): {str(exc)}")

    db.commit()
    return ImportSummary(
        total_rows=total_rows,
        imported=imported,
        skipped=skipped,
        errors=errors[:20],  # Return up to 20 errors
    )
