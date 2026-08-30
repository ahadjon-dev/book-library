from sqlalchemy.orm import Session

from app.models.author import Author
from app.models.shelf import Shelf
from app.models.tag import Tag


def get_or_create_author(db: Session, name: str) -> Author:
    clean_name = name.strip()
    author = db.query(Author).filter(Author.name == clean_name).first()
    if author is None:
        author = Author(name=clean_name)
        db.add(author)
        db.flush()
    return author


def get_or_create_tag(db: Session, name: str, user_id: int) -> Tag:
    clean_name = name.strip()
    tag = db.query(Tag).filter(Tag.name == clean_name, Tag.user_id == user_id).first()
    if tag is None:
        tag = Tag(name=clean_name, user_id=user_id)
        db.add(tag)
        db.flush()
    return tag


def get_or_create_shelf(db: Session, name: str, user_id: int) -> Shelf:
    clean_name = name.strip()
    shelf = db.query(Shelf).filter(Shelf.name == clean_name, Shelf.user_id == user_id).first()
    if shelf is None:
        shelf = Shelf(name=clean_name, user_id=user_id)
        db.add(shelf)
        db.flush()
    return shelf


def resolve_authors(db: Session, names: list[str]) -> list[Author]:
    return [get_or_create_author(db, name) for name in names if name and name.strip()]


def resolve_tags(db: Session, names: list[str], user_id: int) -> list[Tag]:
    return [get_or_create_tag(db, name, user_id) for name in names if name and name.strip()]
