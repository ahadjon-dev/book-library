from pydantic import BaseModel, Field


class GoalCreateOrUpdate(BaseModel):
    year: int = Field(..., ge=1900, le=2100)
    target_books: int = Field(..., ge=1, le=1000)


class GoalOut(BaseModel):
    year: int
    target_books: int
    books_read: int
    pages_read: int
    percentage_complete: float
    books_remaining: int
    pace_status: str  # "completed", "ahead", "on_track", "behind"
    expected_books_by_now: float
