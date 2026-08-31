from datetime import datetime

from sqlalchemy import Boolean, DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Library(Base):
    """A household library shared by one or more users."""

    __tablename__ = "libraries"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    invite_code: Mapped[str | None] = mapped_column(String(32), unique=True, index=True)
    share_slug: Mapped[str | None] = mapped_column(String(100), unique=True, index=True)
    is_public_shelf: Mapped[bool] = mapped_column(Boolean, server_default="false", default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    members: Mapped[list["User"]] = relationship(back_populates="library")  # noqa: F821
    books: Mapped[list["Book"]] = relationship(  # noqa: F821
        back_populates="library", cascade="all, delete-orphan"
    )
