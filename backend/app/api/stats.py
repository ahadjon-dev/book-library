from collections import Counter
from datetime import date, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session, selectinload

from app.api.books import _status_breakdown
from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.book import Book
from app.models.user import User
from app.models.user_book_status import ReadStatus, UserBookStatus
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
    books = db.query(Book).options(selectinload(Book.authors)).all()

    status_counts = _status_breakdown(db, current_user.id, [b.id for b in books])

    pages = [b.page_count for b in books if b.page_count]
    years = [b.publication_year for b in books if b.publication_year]
    genre_counter = Counter(b.genre for b in books if b.genre)
    author_counter = Counter(a.name for b in books for a in b.authors)
    decade_counter = Counter(f"{(y // 10) * 10}s" for y in years)

    finished_rows = (
        db.query(UserBookStatus.finished_at, Book.page_count)
        .join(Book, Book.id == UserBookStatus.book_id)
        .filter(UserBookStatus.user_id == current_user.id, UserBookStatus.status == ReadStatus.finished)
        .all()
    )
    pages_read_total = sum(page_count or 0 for _, page_count in finished_rows)

    # Rate calculations (period counts and averages) only use entries with a
    # known finished_at — an undated "finished" book can't be placed in a
    # week/month/year bucket or contribute to a time-based pace.
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
        total_books=len(books),
        status_counts=status_counts,
        total_pages=sum(pages),
        avg_publication_year=round(sum(years) / len(years)) if years else None,
        most_common_author=author_counter.most_common(1)[0][0] if author_counter else None,
        most_common_genre=genre_counter.most_common(1)[0][0] if genre_counter else None,
        genre_counts=[GenreCount(genre=g, count=c) for g, c in genre_counter.most_common()],
        decade_counts=[
            DecadeCount(decade=d, count=c)
            for d, c in sorted(decade_counter.items(), key=lambda kv: int(kv[0][:-1]))
        ],
        pages_read_total=pages_read_total,
        reading_this_week=reading_this_week,
        reading_this_month=reading_this_month,
        reading_this_year=reading_this_year,
        reading_averages=reading_averages,
    )
