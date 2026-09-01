"""Recommend unread books from the household shelf.

Two tiers:
- Semantic (GEMINI_API_KEY set): embed the query, cosine-rank against
  per-book embeddings stored at creation. Missing embeddings are
  batch-filled lazily. Books below a similarity floor are not returned.
- Fallback (no key or API failure): whole-word matching over title,
  genre, tags, and mood tags. A book with zero real matches is never
  returned. No base score, no fabricated percentages.
"""
import math
import re

from sqlalchemy.orm import Session, selectinload

from app.core.config import settings
from app.models.book import Book
from app.models.user import User
from app.models.user_book_status import ReadStatus
from app.schemas.recommendation import (
    RecommendationItem,
    RecommendNextRequest,
    RecommendNextResponse,
)
from app.services import book_enrichment
from app.services.book_presenter import load_statuses, to_book_out

SHORT_WORDS = {"short", "quick", "weekend", "novella", "qisqa"}
LONG_WORDS = {"long", "epic", "uzun"}
TAG_BOOST = 0.03
MAX_TAG_BOOST = 0.09


def _tokens(text: str) -> set[str]:
    return {t for t in re.findall(r"\w+", text.lower()) if len(t) > 3}


def _cosine(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    norm = math.sqrt(sum(x * x for x in a)) * math.sqrt(sum(y * y for y in b))
    return dot / norm if norm else 0.0


def _word_fields(book: Book) -> dict[str, set[str]]:
    return {
        "title": _tokens(book.title or ""),
        "genre": _tokens(book.genre or ""),
        "tags": _tokens(" ".join(t.name for t in book.tags)),
        "mood_tags": _tokens(" ".join(book.mood_tags or [])),
        "description": _tokens(book.description or ""),
    }


def _page_bonus(book: Book, query_tokens: set[str]) -> tuple[int, str | None]:
    if query_tokens & SHORT_WORDS and book.page_count and book.page_count <= 250:
        return 15, "Short Read"
    if query_tokens & LONG_WORDS and book.page_count and book.page_count >= 500:
        return 15, "Epic"
    return 0, None


def _reason(book: Book, matched: list[str]) -> str:
    page_str = f"{book.page_count} pages" if book.page_count else "unknown length"
    authors_str = f" by {', '.join(a.name for a in book.authors)}" if book.authors else ""
    if matched:
        return f"Matches {', '.join(sorted(set(matched)))}. {page_str}{authors_str}."
    return f"Close match to your request. {page_str}{authors_str}."


def _fallback_rank(
    candidates: list[Book], query_tokens: set[str], preferred_genre: str | None
) -> list[tuple[int, Book, list[str]]]:
    """Whole-word scoring. Zero matches means the book is not recommended."""
    ranked = []
    for book in candidates:
        fields = _word_fields(book)
        score = 0
        matched: list[str] = []

        weights = {"title": 25, "genre": 25, "mood_tags": 25, "tags": 15, "description": 10}
        for field, words in fields.items():
            hits = query_tokens & words
            if hits:
                score += weights[field]
                matched.extend(sorted(hits))

        if preferred_genre and book.genre and _tokens(preferred_genre) & fields["genre"]:
            score += 25
            matched.append(book.genre)

        bonus, bonus_tag = _page_bonus(book, query_tokens)
        score += bonus
        if bonus_tag:
            matched.append(bonus_tag)

        if score > 0:
            ranked.append((min(score, 90), book, matched))

    ranked.sort(key=lambda x: x[0], reverse=True)
    return ranked


async def _semantic_rank(
    db: Session,
    candidates: list[Book],
    query_text: str,
    query_tokens: set[str],
) -> list[tuple[int, Book, list[str]]] | None:
    """Cosine ranking against stored embeddings. None means the API failed."""
    # Cap lazy embedding per request; the rest fill in on later requests
    missing = [b for b in candidates if not b.embedding][:75]
    if missing:
        texts = [
            book_enrichment.book_text(
                b.title, [a.name for a in b.authors], b.genre,
                [t.name for t in b.tags], b.description,
            )
            for b in missing
        ]
        vectors = await book_enrichment.embed_texts(texts)
        if vectors is not None:
            for book, vector in zip(missing, vectors):
                if vector:
                    book.embedding = vector
            db.commit()

    query_vector = await book_enrichment.embed_query(query_text)
    if query_vector is None:
        return None

    ranked = []
    for book in candidates:
        if not book.embedding:
            continue
        similarity = _cosine(query_vector, book.embedding)

        # Small boost for literal word hits in mood tags or genre
        fields = _word_fields(book)
        hits = query_tokens & (fields["mood_tags"] | fields["genre"])
        similarity += min(len(hits) * TAG_BOOST, MAX_TAG_BOOST)
        matched = sorted(hits)

        bonus, bonus_tag = _page_bonus(book, query_tokens)
        similarity += bonus / 300.0
        if bonus_tag:
            matched.append(bonus_tag)

        if similarity >= settings.recommendation_min_similarity:
            ranked.append((min(int(round(similarity * 100)), 99), book, matched))

    ranked.sort(key=lambda x: x[0], reverse=True)
    return ranked


async def recommend_next_books(
    db: Session,
    current_user: User,
    req: RecommendNextRequest,
) -> RecommendNextResponse:
    all_books = (
        db.query(Book)
        .options(selectinload(Book.authors), selectinload(Book.tags), selectinload(Book.shelf))
        .filter(Book.owned.is_(True), Book.library_id == current_user.library_id)
        .all()
    )

    statuses = load_statuses(db, current_user.id, [b.id for b in all_books])
    unread_books = [
        b for b in all_books
        if statuses.get(b.id) is None or statuses[b.id].status == ReadStatus.unread
    ]

    if not unread_books:
        return RecommendNextResponse(
            recommendations=[],
            unread_pool_size=0,
            criteria_summary="No unread books found on your shelf!",
        )

    candidates = unread_books
    if req.max_pages:
        candidates = [b for b in candidates if b.page_count and b.page_count <= req.max_pages]
        if not candidates:
            candidates = unread_books

    query_text = " ".join(
        part for part in (req.mood, req.preferred_genre, req.custom_prompt) if part
    ).strip()
    query_tokens = _tokens(query_text)

    ranked = None
    if settings.gemini_api_key and query_text:
        ranked = await _semantic_rank(db, candidates, query_text, query_tokens)
    if ranked is None:
        ranked = _fallback_rank(candidates, query_tokens, req.preferred_genre)

    criteria_summary = query_text or "Curated for your shelf"
    if not ranked:
        return RecommendNextResponse(
            recommendations=[],
            unread_pool_size=len(unread_books),
            criteria_summary=criteria_summary,
        )

    recommendations = [
        RecommendationItem(
            book=to_book_out(book, statuses),
            match_score=score,
            reason=_reason(book, matched),
            mood_tags=(matched or (book.mood_tags or []))[:4],
        )
        for score, book, matched in ranked[:3]
    ]

    return RecommendNextResponse(
        recommendations=recommendations,
        unread_pool_size=len(unread_books),
        criteria_summary=criteria_summary,
    )
