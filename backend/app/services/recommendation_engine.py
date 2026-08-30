import re
from sqlalchemy.orm import Session, selectinload

from app.models.book import Book
from app.models.user import User
from app.models.user_book_status import ReadStatus
from app.schemas.recommendation import (
    RecommendationItem,
    RecommendNextRequest,
    RecommendNextResponse,
)
from app.services.book_presenter import load_statuses, to_book_out

MOOD_KEYWORDS = {
    "thriller": ["thriller", "mystery", "crime", "suspense", "action", "detective"],
    "sci-fi": ["sci-fi", "science fiction", "space", "future", "dystopian", "ai"],
    "philosophy": ["philosophy", "stoic", "ethics", "wisdom", "mind", "meaning"],
    "psychology": ["psychology", "behavior", "habits", "thinking", "brain"],
    "tech": ["technology", "programming", "software", "code", "architecture", "data"],
    "fantasy": ["fantasy", "magic", "epic", "dragon", "quest", "mythology"],
    "short": ["short", "quick", "weekend", "novella", "light"],
    "business": ["business", "money", "investing", "management", "leadership"],
    "classic": ["classic", "literature", "historical", "masterpiece"],
}


def recommend_next_books(
    db: Session,
    current_user: User,
    req: RecommendNextRequest,
) -> RecommendNextResponse:
    # 1. Query all unread books for user
    all_books = (
        db.query(Book)
        .options(selectinload(Book.authors), selectinload(Book.tags), selectinload(Book.shelf))
        .filter(Book.owned.is_(True))
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

    # 2. Filter candidates based on hard criteria (e.g. max_pages)
    candidates = unread_books
    if req.max_pages:
        candidates = [b for b in candidates if b.page_count and b.page_count <= req.max_pages]
        if not candidates:
            # Fallback if filter is too strict
            candidates = unread_books

    # 3. Score candidate books based on mood, genre, tags, and description
    user_query = f"{req.mood or ''} {req.preferred_genre or ''} {req.custom_prompt or ''}".lower()
    query_tokens = set(re.findall(r'\w+', user_query))

    scored_items: list[tuple[float, Book, str, list[str]]] = []

    for book in candidates:
        score = 50.0  # Base score
        matched_tags: list[str] = []

        # Content text for keyword matching
        book_text = f"{book.title} {book.genre or ''} {' '.join(t.name for t in book.tags)} {book.description or ''}".lower()

        # Check mood categories
        for mood_key, keywords in MOOD_KEYWORDS.items():
            if any(k in user_query for k in keywords) or mood_key in user_query:
                if any(k in book_text for k in keywords) or (book.genre and mood_key in book.genre.lower()):
                    score += 25.0
                    matched_tags.append(mood_key.title())

        # Page count constraint matching
        if "short" in query_tokens or "weekend" in query_tokens:
            if book.page_count and book.page_count <= 250:
                score += 20.0
                matched_tags.append("Short Read")
        elif "long" in query_tokens or "epic" in query_tokens:
            if book.page_count and book.page_count >= 500:
                score += 15.0
                matched_tags.append("Epic")

        # Preferred genre match
        if req.preferred_genre and book.genre and req.preferred_genre.lower() in book.genre.lower():
            score += 30.0
            matched_tags.append(book.genre)

        # Direct token overlaps
        for token in query_tokens:
            if len(token) > 3 and token in book_text:
                score += 10.0

        # Build dynamic explanation
        page_str = f"{book.page_count} pages" if book.page_count else "compact read"
        authors_str = f"by {', '.join(a.name for a in book.authors)}" if book.authors else ""
        if matched_tags:
            reason = f"Matches your interest in {', '.join(set(matched_tags))}. At {page_str} {authors_str}, this is a great match."
        else:
            reason = f"A highly rated {book.genre or 'book'} from your shelf ({page_str}) {authors_str}."

        score = min(score, 98.0)
        scored_items.append((score, book, reason, list(set(matched_tags))))

    # Sort descending by score
    scored_items.sort(key=lambda x: x[0], reverse=True)
    top_3 = scored_items[:3]

    recommendations = [
        RecommendationItem(
            book=to_book_out(book, statuses),
            match_score=int(score),
            reason=reason,
            mood_tags=tags,
        )
        for score, book, reason, tags in top_3
    ]

    criteria_summary = req.mood or req.preferred_genre or req.custom_prompt or "Curated for your shelf"

    return RecommendNextResponse(
        recommendations=recommendations,
        unread_pool_size=len(unread_books),
        criteria_summary=criteria_summary,
    )
