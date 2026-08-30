from datetime import date, datetime

from pydantic import BaseModel, Field


class LoanCreate(BaseModel):
    book_id: int
    borrower_name: str = Field(..., min_length=1, max_length=255)
    borrower_contact: str | None = Field(default=None, max_length=255)
    loan_date: date | None = None
    due_date: date | None = None
    notes: str | None = None


class LoanUpdate(BaseModel):
    borrower_name: str | None = Field(default=None, min_length=1, max_length=255)
    borrower_contact: str | None = None
    due_date: date | None = None
    notes: str | None = None


class LoanOut(BaseModel):
    id: int
    user_id: int
    book_id: int
    book_title: str
    borrower_name: str
    borrower_contact: str | None
    loan_date: date
    due_date: date | None
    returned_at: date | None
    is_returned: bool
    is_overdue: bool
    notes: str | None
    created_at: datetime

    model_config = {"from_attributes": True}
