"""Backfill mood tags and embeddings for books created before AI enrichment.

Usage (inside the backend container or with DATABASE_URL set):
    python -m scripts.backfill_enrichment [--limit N] [--skip-tags]

Embeddings go in batches of 100 per API call. Mood tags need one
call per book, paced to respect the Gemini free tier.
"""
import argparse
import asyncio

from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.db.session import SessionLocal
from app.models.book import Book
from app.services import book_enrichment

TAGS_PAUSE_SECONDS = 1.0


def _text(book: Book) -> str:
    return book_enrichment.book_text(
        book.title,
        [a.name for a in book.authors],
        book.genre,
        [t.name for t in book.tags],
        book.description,
    )


async def backfill(limit: int, skip_tags: bool) -> None:
    if not settings.gemini_api_key:
        print("GEMINI_API_KEY is not set. Nothing to do.")
        return

    db = SessionLocal()
    try:
        base = db.query(Book).options(selectinload(Book.authors), selectinload(Book.tags))

        missing_embedding = base.filter(Book.embedding.is_(None)).limit(limit).all()
        print(f"Books missing embedding: {len(missing_embedding)}")
        if missing_embedding:
            vectors = await book_enrichment.embed_texts(
                [_text(b) for b in missing_embedding], pace_seconds=20.0
            )
            filled = 0
            for book, vector in zip(missing_embedding, vectors or []):
                if vector:
                    book.embedding = vector
                    filled += 1
            db.commit()
            print(f"Embeddings stored: {filled} of {len(missing_embedding)}")
            if filled < len(missing_embedding):
                print("Rate limit reached. Run the script again later for the rest.")

        if skip_tags:
            return

        missing_tags = base.filter(Book.mood_tags.is_(None)).limit(limit).all()
        print(f"Books missing mood tags: {len(missing_tags)}")
        for idx, book in enumerate(missing_tags, start=1):
            tags = await book_enrichment.generate_mood_tags(_text(book))
            if tags:
                book.mood_tags = tags
                db.commit()
            if idx % 10 == 0:
                print(f"  tagged {idx}/{len(missing_tags)}")
            await asyncio.sleep(TAGS_PAUSE_SECONDS)
        print("Done.")
    finally:
        db.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=500)
    parser.add_argument("--skip-tags", action="store_true")
    args = parser.parse_args()
    asyncio.run(backfill(args.limit, args.skip_tags))
