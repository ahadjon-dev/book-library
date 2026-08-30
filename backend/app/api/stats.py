from datetime import date, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import func
import sqlalchemy as sa
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.author import Author
from app.models.book import Book, book_authors
from app.models.user import User
from app.models.user_book_status import ReadStatus, UserBookStatus
from app.schemas.book import StatusCounts
from app.schemas.stats import (
    DecadeCount,
    GenreCount,
    ReadingAverages,
    ReadingPeriodCounts,
    StatsOut,
)

router = APIRouter(tags=["stats"])

DAYS_PER_MONTH = 30.44
DAYS_PER_YEAR = 365.25


def _period_counts(dated_entries: list[tuple[date, int]], start: date) -> ReadingPeriodCounts:
    matching = [pages for finished_at, pages in dated_entries if finished_at >= start]
    return ReadingPeriodCounts(books=len(matching), pages=sum(matching))


@router.get("/stats", response_model=StatsOut)
def get_stats(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> StatsOut:
    # 1. Total books & pages & average publication year via SQL aggregation
    summary = (
        db.query(
            func.count(Book.id).label("total_books"),
            func.coalesce(func.sum(Book.page_count), 0).label("total_pages"),
            func.avg(Book.publication_year).label("avg_year"),
        )
        .filter(Book.user_id == current_user.id)
        .first()
    )

    total_books = summary.total_books if summary else 0
    total_pages = int(summary.total_pages) if summary else 0
    avg_year = round(float(summary.avg_year)) if summary and summary.avg_year is not None else None

    # 2. Status counts (direct SQL aggregation per user)
    status_rows = (
        db.query(UserBookStatus.status, func.count(UserBookStatus.id))
        .filter(UserBookStatus.user_id == current_user.id)
        .group_by(UserBookStatus.status)
        .all()
    )
    counts = {s: 0 for s in ReadStatus}
    for status_val, count in status_rows:
        counts[status_val] = count

    explicit_total = sum(counts.values())
    counts[ReadStatus.unread] += max(total_books - explicit_total, 0)
    status_counts = StatusCounts(
        total=total_books,
        unread=counts[ReadStatus.unread],
        reading=counts[ReadStatus.reading],
        finished=counts[ReadStatus.finished],
        abandoned=counts[ReadStatus.abandoned],
    )

    # 3. Genre breakdown (direct SQL GROUP BY)
    genre_rows = (
        db.query(Book.genre, func.count(Book.id))
        .filter(Book.genre.is_not(None), Book.user_id == current_user.id)
        .group_by(Book.genre)
        .order_by(func.count(Book.id).desc())
        .all()
    )
    genre_counts = [GenreCount(genre=g, count=c) for g, c in genre_rows]
    most_common_genre = genre_rows[0][0] if genre_rows else None

    # 4. Most common author (direct SQL JOIN & GROUP BY)
    most_common_author_row = (
        db.query(Author.name, func.count(book_authors.c.book_id))
        .join(book_authors, book_authors.c.author_id == Author.id)
        .join(Book, Book.id == book_authors.c.book_id)
        .filter(Book.user_id == current_user.id)
        .group_by(Author.name)
        .order_by(func.count(book_authors.c.book_id).desc())
        .first()
    )
    most_common_author = most_common_author_row[0] if most_common_author_row else None

    # 5. Decade counts (direct SQL GROUP BY on calculated decade)
    decade_expr = (func.floor(Book.publication_year / 10.0) * 10).cast(sa.Integer)
    decade_rows = (
        db.query(decade_expr, func.count(Book.id))
        .filter(Book.publication_year.is_not(None), Book.user_id == current_user.id)
        .group_by(decade_expr)
        .order_by(decade_expr)
        .all()
    )
    decade_counts = [DecadeCount(decade=f"{d}s", count=c) for d, c in decade_rows]

    # 6. Finished books reading pace & time-based statistics
    finished_rows = (
        db.query(UserBookStatus.finished_at, Book.page_count)
        .join(Book, Book.id == UserBookStatus.book_id)
        .filter(
            UserBookStatus.user_id == current_user.id,
            Book.user_id == current_user.id,
            UserBookStatus.status == ReadStatus.finished,
        )
        .all()
    )
    pages_read_total = sum(page_count or 0 for _, page_count in finished_rows)
    dated_entries = [(finished_at, page_count or 0) for finished_at, page_count in finished_rows if finished_at]

    today = date.today()
    reading_this_week = _period_counts(dated_entries, today - timedelta(days=today.weekday()))
    reading_this_month = _period_counts(dated_entries, today.replace(day=1))
    reading_this_year = _period_counts(dated_entries, today.replace(month=1, day=1))

    reading_averages = None
    if dated_entries:
        first_finish = min(finished_at for finished_at, _ in dated_entries)
        days_tracked = max((today - first_finish).days + 1, 1)
        books_per_day = len(dated_entries) / days_tracked
        pages_per_day = sum(pages for _, pages in dated_entries) / days_tracked
        reading_averages = ReadingAverages(
            books_per_day=books_per_day,
            books_per_week=books_per_day * 7,
            books_per_month=books_per_day * DAYS_PER_MONTH,
            books_per_year=books_per_day * DAYS_PER_YEAR,
            pages_per_day=pages_per_day,
            pages_per_week=pages_per_day * 7,
            pages_per_month=pages_per_day * DAYS_PER_MONTH,
            pages_per_year=pages_per_day * DAYS_PER_YEAR,
        )

    return StatsOut(
        total_books=total_books,
        status_counts=status_counts,
        total_pages=total_pages,
        avg_publication_year=avg_year,
        most_common_author=most_common_author,
        most_common_genre=most_common_genre,
        genre_counts=genre_counts,
        decade_counts=decade_counts,
        pages_read_total=pages_read_total,
        reading_this_week=reading_this_week,
        reading_this_month=reading_this_month,
        reading_this_year=reading_this_year,
        reading_averages=reading_averages,
    )
