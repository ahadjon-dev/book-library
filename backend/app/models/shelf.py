from sqlalchemy import ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Shelf(Base):
    __tablename__ = "shelves"
    __table_args__ = (UniqueConstraint("user_id", "name", name="uq_shelves_user_name"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(100), index=True)

    books: Mapped[list["Book"]] = relationship(back_populates="shelf")  # noqa: F821
    user: Mapped["User"] = relationship()  # noqa: F821
