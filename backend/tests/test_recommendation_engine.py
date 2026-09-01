import asyncio

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.user import User
from app.schemas.recommendation import RecommendNextRequest
from app.services import book_enrichment, recommendation_engine


def _add_book(client: TestClient, headers: dict[str, str], **fields) -> dict:
    resp = client.post("/books", headers=headers, json=fields)
    assert resp.status_code == 201
    return resp.json()


def test_substring_false_match_regression(
    client: TestClient, auth_headers: dict[str, str], db_session: Session
):
    """DDIA's description contains 'transactions'. The old engine matched
    the query word 'action' inside it and returned an 85% match."""
    _add_book(
        client,
        auth_headers,
        title="Designing Data-Intensive Applications",
        genre="Technology",
        page_count=616,
        description="A deep dive into storage engines, distributed consensus, transactions, and stream processing.",
    )

    resp = client.post(
        "/books/recommend-next",
        headers=auth_headers,
        json={"custom_prompt": "horror comedy with action"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["unread_pool_size"] == 1
    assert data["recommendations"] == []


def test_fallback_genre_word_match(client: TestClient, auth_headers: dict[str, str]):
    _add_book(client, auth_headers, title="The Silent Patient", genre="Thriller", page_count=336)
    _add_book(client, auth_headers, title="Animal Farm", genre="Classics", page_count=112)

    resp = client.post(
        "/books/recommend-next", headers=auth_headers, json={"mood": "fast-paced thriller"}
    )
    data = resp.json()
    assert len(data["recommendations"]) == 1
    assert data["recommendations"][0]["book"]["title"] == "The Silent Patient"


def _user(db_session: Session) -> User:
    return db_session.query(User).filter(User.email == "test@example.com").first()


def test_semantic_ranking_with_threshold(
    client: TestClient, auth_headers: dict[str, str], db_session: Session, monkeypatch
):
    horror = _add_book(client, auth_headers, title="Kitob A", genre="Fiction")
    tech = _add_book(client, auth_headers, title="Kitob B", genre="Technology")

    from app.models.book import Book

    db_session.query(Book).filter(Book.id == horror["id"]).first().embedding = [1.0, 0.0]
    db_session.query(Book).filter(Book.id == tech["id"]).first().embedding = [0.0, 1.0]
    db_session.commit()

    async def fake_embed_query(text: str):
        return [0.9, 0.1]

    monkeypatch.setattr(settings, "gemini_api_key", "fake-key")
    monkeypatch.setattr(book_enrichment, "embed_query", fake_embed_query)

    result = asyncio.run(
        recommendation_engine.recommend_next_books(
            db_session, _user(db_session), RecommendNextRequest(custom_prompt="qo'rqinchli komediya")
        )
    )
    # Kitob A: cosine ~0.99 -> recommended. Kitob B: ~0.11 -> below the floor.
    assert len(result.recommendations) == 1
    assert result.recommendations[0].book.title == "Kitob A"
    assert result.recommendations[0].match_score >= 90


def test_semantic_lazy_embeds_missing_books(
    client: TestClient, auth_headers: dict[str, str], db_session: Session, monkeypatch
):
    book = _add_book(client, auth_headers, title="Yangi Kitob", genre="Fiction")

    async def fake_embed_texts(texts):
        return [[1.0, 0.0] for _ in texts]

    async def fake_embed_query(text: str):
        return [1.0, 0.0]

    monkeypatch.setattr(settings, "gemini_api_key", "fake-key")
    monkeypatch.setattr(book_enrichment, "embed_texts", fake_embed_texts)
    monkeypatch.setattr(book_enrichment, "embed_query", fake_embed_query)

    result = asyncio.run(
        recommendation_engine.recommend_next_books(
            db_session, _user(db_session), RecommendNextRequest(custom_prompt="fiction adventure")
        )
    )
    assert len(result.recommendations) == 1

    from app.models.book import Book

    stored = db_session.query(Book).filter(Book.id == book["id"]).first()
    assert stored.embedding == [1.0, 0.0]


def test_semantic_api_failure_falls_back_to_words(
    client: TestClient, auth_headers: dict[str, str], db_session: Session, monkeypatch
):
    _add_book(client, auth_headers, title="Dune", genre="Fantasy")

    async def broken(*args, **kwargs):
        return None

    monkeypatch.setattr(settings, "gemini_api_key", "fake-key")
    monkeypatch.setattr(book_enrichment, "embed_texts", broken)
    monkeypatch.setattr(book_enrichment, "embed_query", broken)

    result = asyncio.run(
        recommendation_engine.recommend_next_books(
            db_session, _user(db_session), RecommendNextRequest(preferred_genre="fantasy")
        )
    )
    assert len(result.recommendations) == 1
    assert result.recommendations[0].book.title == "Dune"


def test_create_book_stores_enrichment(
    client: TestClient, auth_headers: dict[str, str], monkeypatch
):
    async def fake_tags(text: str):
        return ["dark", "fast-paced", "qorqinchli"]

    async def fake_embed_texts(texts):
        return [[0.1, 0.2, 0.3]]

    monkeypatch.setattr(settings, "gemini_api_key", "fake-key")
    monkeypatch.setattr(book_enrichment, "generate_mood_tags", fake_tags)
    monkeypatch.setattr(book_enrichment, "embed_texts", fake_embed_texts)

    created = _add_book(client, auth_headers, title="Mehrobdan Chayon", genre="Classics")
    assert created["mood_tags"] == ["dark", "fast-paced", "qorqinchli"]

    detail = client.get(f"/books/{created['id']}", headers=auth_headers).json()
    assert detail["mood_tags"] == ["dark", "fast-paced", "qorqinchli"]
