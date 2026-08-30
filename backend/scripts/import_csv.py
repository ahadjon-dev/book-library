"""Bulk-import books from a CSV file. Run once to bootstrap your existing collection.

Usage:
    python -m scripts.import_csv path/to/books.csv

Expected columns (header row required, extra/missing columns are fine):
    title, subtitle, authors, isbn, publisher, publication_year, language,
    page_count, description, genre, tags, shelf, purchase_date, purchase_price

`authors` and `tags` are semicolon-separated (e.g. "J.R.R. Tolkien;Christopher Tolkien").
Rows whose title + author set already exist in the library are skipped and reported,
so you can safely re-run this script on an updated export.
"""
import csv
import sys
from datetime import date, datetime
from decimal import Decimal, InvalidOperation

from app.db.session import SessionLocal
from app.models.author import Author
from app.models.book import Book
from app.models.shelf import Shelf
from app.models.tag import Tag


def _split(value: str | None) -> list[str]:
    if not value:
        return []
    return [part.strip() for part in value.split(";") if part.strip()]


def _get_or_create(db, model, name: str):
    obj = db.query(model).filter(model.name == name).first()
    if obj is None:
        obj = model(name=name)
        db.add(obj)
        db.flush()
    return obj


def _parse_int(value: str | None) -> int | None:
    return int(value) if value and value.strip() else None


def _parse_date(value: str | None) -> date | None:
    if not value or not value.strip():
        return None
    return datetime.strptime(value.strip(), "%Y-%m-%d").date()


def _parse_price(value: str | None) -> Decimal | None:
    if not value or not value.strip():
        return None
    try:
        return Decimal(value.strip())
    except InvalidOperation:
        return None


def _existing_titles_by_authors(db) -> set[tuple[str, frozenset[str]]]:
    books = db.query(Book).all()
    return {(b.title.strip().lower(), frozenset(a.name.strip().lower() for a in b.authors)) for b in books}


def import_csv(path: str) -> None:
    db = SessionLocal()
    created = 0
    skipped_duplicates = 0
    skipped_missing_title = 0

    try:
        seen = _existing_titles_by_authors(db)

        with open(path, newline="", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                title = (row.get("title") or "").strip()
                if not title:
                    skipped_missing_title += 1
                    continue

                author_names = _split(row.get("authors"))
                key = (title.lower(), frozenset(a.lower() for a in author_names))
                if key in seen:
                    skipped_duplicates += 1
                    continue

                book = Book(
                    title=title,
                    subtitle=(row.get("subtitle") or "").strip() or None,
                    isbn=(row.get("isbn") or "").strip() or None,
                    publisher=(row.get("publisher") or "").strip() or None,
                    publication_year=_parse_int(row.get("publication_year")),
                    language=(row.get("language") or "").strip() or None,
                    page_count=_parse_int(row.get("page_count")),
                    description=(row.get("description") or "").strip() or None,
                    genre=(row.get("genre") or "").strip() or None,
                    purchase_date=_parse_date(row.get("purchase_date")),
                    purchase_price=_parse_price(row.get("purchase_price")),
                )
                db.add(book)
                book.authors = [_get_or_create(db, Author, name) for name in author_names]
                book.tags = [_get_or_create(db, Tag, name) for name in _split(row.get("tags"))]

                shelf_name = (row.get("shelf") or "").strip()
                if shelf_name:
                    book.shelf = _get_or_create(db, Shelf, shelf_name)

                seen.add(key)
                created += 1

        db.commit()
    finally:
        db.close()

    print(f"imported: {created}")
    print(f"skipped (duplicate title+authors): {skipped_duplicates}")
    print(f"skipped (missing title): {skipped_missing_title}")


def main() -> None:
    if len(sys.argv) != 2:
        print(__doc__)
        sys.exit(1)
    import_csv(sys.argv[1])


if __name__ == "__main__":
    main()
