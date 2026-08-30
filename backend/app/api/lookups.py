from fastapi import APIRouter, Depends
from sqlalchemy import distinct
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.author import Author
from app.models.book import Book
from app.models.shelf import Shelf
from app.models.tag import Tag
from app.models.user import User

router = APIRouter(tags=["lookups"])


@router.get("/authors", response_model=list[str])
def list_authors(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> list[str]:
    rows = (
        db.query(distinct(Author.name))
        .join(Book.authors)
        .filter(Book.user_id == current_user.id)
        .order_by(Author.name)
        .all()
    )
    return [name for (name,) in rows]


@router.get("/tags", response_model=list[str])
def list_tags(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> list[str]:
    return [name for (name,) in db.query(Tag.name).filter(Tag.user_id == current_user.id).order_by(Tag.name).all()]


@router.get("/shelves", response_model=list[str])
def list_shelves(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> list[str]:
    return [name for (name,) in db.query(Shelf.name).filter(Shelf.user_id == current_user.id).order_by(Shelf.name).all()]


@router.get("/genres", response_model=list[str])
def list_genres(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> list[str]:
    rows = (
        db.query(distinct(Book.genre))
        .filter(Book.genre.is_not(None), Book.user_id == current_user.id)
        .order_by(Book.genre)
        .all()
    )
    return [name for (name,) in rows]
