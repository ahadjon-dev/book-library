import enum
from datetime import date, datetime

from sqlalchemy import CheckConstraint, Date, DateTime, Enum, ForeignKey, Index, Integer, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class ReadStatus(str, enum.Enum):
    unread = "unread"
    reading = "reading"
    finished = "finished"
    abandoned = "abandoned"


class UserBookStatus(Base):
    __tablename__ = "user_book_status"
    __table_args__ = (
        UniqueConstraint("user_id", "book_id", name="uq_user_book"),
        CheckConstraint("rating IS NULL OR (rating BETWEEN 1 AND 10)", name="ck_rating_range"),
        Index("ix_user_book_status_user_status", "user_id", "status"),
        Index("ix_user_book_status_user_finished", "user_id", "finished_at"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    book_id: Mapped[int] = mapped_column(ForeignKey("books.id", ondelete="CASCADE"), index=True)
    status: Mapped[ReadStatus] = mapped_column(
        Enum(ReadStatus, name="read_status"), default=ReadStatus.unread
    )
    rating: Mapped[int | None] = mapped_column(Integer)
    notes: Mapped[str | None] = mapped_column(Text)
    started_at: Mapped[date | None] = mapped_column(Date)
    finished_at: Mapped[date | None] = mapped_column(Date)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    book: Mapped["Book"] = relationship(back_populates="statuses")  # noqa: F821
    user: Mapped["User"] = relationship()  # noqa: F821
