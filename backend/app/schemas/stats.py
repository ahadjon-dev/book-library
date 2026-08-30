from pydantic import BaseModel

from app.schemas.book import StatusCounts


class GenreCount(BaseModel):
    genre: str
    count: int


class DecadeCount(BaseModel):
    decade: str
    count: int


class ReadingPeriodCounts(BaseModel):
    books: int
    pages: int


class ReadingAverages(BaseModel):
    books_per_day: float
    books_per_week: float
    books_per_month: float
    books_per_year: float
    pages_per_day: float
    pages_per_week: float
    pages_per_month: float
    pages_per_year: float


class StatsOut(BaseModel):
    total_books: int
    status_counts: StatusCounts
    total_pages: int
    avg_publication_year: int | None
    most_common_author: str | None
    most_common_genre: str | None
    genre_counts: list[GenreCount]
    decade_counts: list[DecadeCount]
    pages_read_total: int
    reading_this_week: ReadingPeriodCounts
    reading_this_month: ReadingPeriodCounts
    reading_this_year: ReadingPeriodCounts
    reading_averages: ReadingAverages | None
