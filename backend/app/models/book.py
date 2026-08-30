from datetime import date, datetime

from sqlalchemy import Boolean, Column, Date, DateTime, ForeignKey, Numeric, String, Table, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

book_authors = Table(
    "book_authors",
    Base.metadata,
    Column("book_id", ForeignKey("books.id", ondelete="CASCADE"), primary_key=True),
    Column("author_id", ForeignKey("authors.id", ondelete="CASCADE"), primary_key=True),
)

book_tags = Table(
    "book_tags",
    Base.metadata,
    Column("book_id", ForeignKey("books.id", ondelete="CASCADE"), primary_key=True),
    Column("tag_id", ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True),
)


class Book(Base):
    __tablename__ = "books"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(500), index=True)
    subtitle: Mapped[str | None] = mapped_column(String(500))
    isbn: Mapped[str | None] = mapped_column(String(20), index=True)
    publisher: Mapped[str | None] = mapped_column(String(255))
    publication_year: Mapped[int | None] = mapped_column(index=True)
    language: Mapped[str | None] = mapped_column(String(50))
    page_count: Mapped[int | None] = mapped_column(index=True)
    cover_image_path: Mapped[str | None] = mapped_column(String(500))
    description: Mapped[str | None] = mapped_column(Text)
    genre: Mapped[str | None] = mapped_column(String(100), index=True)
    owned: Mapped[bool] = mapped_column(Boolean, server_default="true", index=True)
    shelf_id: Mapped[int | None] = mapped_column(ForeignKey("shelves.id", ondelete="SET NULL"))
    purchase_date: Mapped[date | None] = mapped_column(Date, index=True)
    purchase_price: Mapped[float | None] = mapped_column(Numeric(10, 2))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    authors: Mapped[list["Author"]] = relationship(secondary=book_authors, back_populates="books")  # noqa: F821
    tags: Mapped[list["Tag"]] = relationship(secondary=book_tags, back_populates="books")  # noqa: F821
    shelf: Mapped["Shelf | None"] = relationship(back_populates="books")  # noqa: F821
    statuses: Mapped[list["UserBookStatus"]] = relationship(  # noqa: F821
        back_populates="book", cascade="all, delete-orphan"
    )
