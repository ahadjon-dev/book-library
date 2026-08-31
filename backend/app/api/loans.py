from datetime import date
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, selectinload

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.book import Book
from app.models.book_loan import BookLoan
from app.models.user import User
from app.schemas.loan import LoanCreate, LoanOut, LoanUpdate

router = APIRouter(prefix="/loans", tags=["loans"])


def _to_loan_out(loan: BookLoan) -> LoanOut:
    today = date.today()
    is_returned = loan.returned_at is not None
    is_overdue = (
        not is_returned
        and loan.due_date is not None
        and loan.due_date < today
    )
    return LoanOut(
        id=loan.id,
        created_by=loan.created_by.display_name if loan.created_by else None,
        book_id=loan.book_id,
        book_title=loan.book.title if loan.book else "Unknown Book",
        borrower_name=loan.borrower_name,
        borrower_contact=loan.borrower_contact,
        loan_date=loan.loan_date,
        due_date=loan.due_date,
        returned_at=loan.returned_at,
        is_returned=is_returned,
        is_overdue=is_overdue,
        notes=loan.notes,
        created_at=loan.created_at,
    )


@router.get("", response_model=list[LoanOut])
def list_loans(
    status_filter: Literal["all", "active", "returned"] = Query(default="active", alias="status"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[LoanOut]:
    query = (
        db.query(BookLoan)
        .options(selectinload(BookLoan.book), selectinload(BookLoan.created_by))
        .filter(BookLoan.library_id == current_user.library_id)
    )

    if status_filter == "active":
        query = query.filter(BookLoan.returned_at.is_(None))
    elif status_filter == "returned":
        query = query.filter(BookLoan.returned_at.is_not(None))

    loans = query.order_by(BookLoan.id.desc()).all()
    return [_to_loan_out(loan) for loan in loans]


@router.post("", response_model=LoanOut, status_code=status.HTTP_201_CREATED)
def create_loan(
    payload: LoanCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> LoanOut:
    book = db.query(Book).filter(Book.id == payload.book_id, Book.library_id == current_user.library_id).first()
    if book is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Book not found")

    loan = BookLoan(
        library_id=current_user.library_id,
        created_by_user_id=current_user.id,
        book_id=payload.book_id,
        borrower_name=payload.borrower_name.strip(),
        borrower_contact=payload.borrower_contact.strip() if payload.borrower_contact else None,
        loan_date=payload.loan_date or date.today(),
        due_date=payload.due_date,
        notes=payload.notes.strip() if payload.notes else None,
    )
    db.add(loan)
    db.commit()
    db.refresh(loan)
    return _to_loan_out(loan)


@router.patch("/{loan_id}/return", response_model=LoanOut)
def return_loan(
    loan_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> LoanOut:
    loan = (
        db.query(BookLoan)
        .options(selectinload(BookLoan.book), selectinload(BookLoan.created_by))
        .filter(BookLoan.id == loan_id, BookLoan.library_id == current_user.library_id)
        .first()
    )
    if loan is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Loan record not found")

    loan.returned_at = date.today()
    db.commit()
    db.refresh(loan)
    return _to_loan_out(loan)


@router.patch("/{loan_id}", response_model=LoanOut)
def update_loan(
    loan_id: int,
    payload: LoanUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> LoanOut:
    loan = (
        db.query(BookLoan)
        .options(selectinload(BookLoan.book), selectinload(BookLoan.created_by))
        .filter(BookLoan.id == loan_id, BookLoan.library_id == current_user.library_id)
        .first()
    )
    if loan is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Loan record not found")

    for field, val in payload.model_dump(exclude_unset=True).items():
        setattr(loan, field, val)

    db.commit()
    db.refresh(loan)
    return _to_loan_out(loan)


@router.delete("/{loan_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_loan(
    loan_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    loan = (
        db.query(BookLoan)
        .filter(BookLoan.id == loan_id, BookLoan.library_id == current_user.library_id)
        .first()
    )
    if loan is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Loan record not found")

    db.delete(loan)
    db.commit()
