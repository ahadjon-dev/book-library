from datetime import date

from fastapi import APIRouter, Depends, status
from sqlalchemy import extract, func
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.book import Book
from app.models.reading_goal import ReadingGoal
from app.models.user import User
from app.models.user_book_status import ReadStatus, UserBookStatus
from app.schemas.goal import GoalCreateOrUpdate, GoalOut

router = APIRouter(prefix="/goals", tags=["goals"])


def _calculate_goal_progress(goal: ReadingGoal, db: Session, user: User) -> GoalOut:
    target_year = goal.year
    today = date.today()

    # Query books finished in the target year
    finished_rows = (
        db.query(UserBookStatus.id, Book.page_count)
        .join(Book, Book.id == UserBookStatus.book_id)
        .filter(
            UserBookStatus.user_id == user.id,
            Book.library_id == user.library_id,
            UserBookStatus.status == ReadStatus.finished,
            extract("year", UserBookStatus.finished_at) == target_year,
        )
        .all()
    )

    books_read = len(finished_rows)
    pages_read = sum(p or 0 for _, p in finished_rows)
    percentage = round((books_read / goal.target_books) * 100.0, 1) if goal.target_books > 0 else 100.0
    books_remaining = max(goal.target_books - books_read, 0)

    # Calculate pace
    if today.year == target_year:
        day_of_year = today.timetuple().tm_yday
        fraction_of_year = day_of_year / 365.25
        expected_books = round(goal.target_books * fraction_of_year, 1)
    elif today.year > target_year:
        expected_books = float(goal.target_books)
    else:
        expected_books = 0.0

    if books_read >= goal.target_books:
        pace_status = "completed"
    elif books_read >= expected_books + 0.5:
        pace_status = "ahead"
    elif books_read >= expected_books - 1.5:
        pace_status = "on_track"
    else:
        pace_status = "behind"

    return GoalOut(
        year=goal.year,
        target_books=goal.target_books,
        books_read=books_read,
        pages_read=pages_read,
        percentage_complete=percentage,
        books_remaining=books_remaining,
        pace_status=pace_status,
        expected_books_by_now=expected_books,
    )


@router.get("/{year}", response_model=GoalOut)
def get_reading_goal(
    year: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> GoalOut:
    goal = (
        db.query(ReadingGoal)
        .filter(ReadingGoal.user_id == current_user.id, ReadingGoal.year == year)
        .first()
    )
    if goal is None:
        # Default goal if not explicitly set yet
        goal = ReadingGoal(user_id=current_user.id, year=year, target_books=25)

    return _calculate_goal_progress(goal, db, current_user)


@router.post("", response_model=GoalOut, status_code=status.HTTP_200_OK)
def set_reading_goal(
    payload: GoalCreateOrUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> GoalOut:
    goal = (
        db.query(ReadingGoal)
        .filter(ReadingGoal.user_id == current_user.id, ReadingGoal.year == payload.year)
        .first()
    )
    if goal is None:
        goal = ReadingGoal(
            user_id=current_user.id,
            year=payload.year,
            target_books=payload.target_books,
        )
        db.add(goal)
    else:
        goal.target_books = payload.target_books

    db.commit()
    db.refresh(goal)
    return _calculate_goal_progress(goal, db, current_user)
