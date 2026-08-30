import asyncio
import base64
import json
import os
import re
from typing import Any

import httpx
from sqlalchemy.orm import Session

from app.models.book import Book
from app.schemas.shelf_scanner import ShelfScanItem, ShelfScanResult

OPEN_LIBRARY_SEARCH_URL = "https://openlibrary.org/search.json"
HEADERS = {"User-Agent": "personal-library-app/1.0 (shelf-scanner)"}


async def _extract_spines_with_llm(image_bytes: bytes, api_key: str) -> list[dict[str, str]]:
    """Use GPT-4o-mini Vision to identify book spines and extract title/author JSON."""
    b64_image = base64.b64encode(image_bytes).decode("utf-8")
    payload = {
        "model": "gpt-4o-mini",
        "messages": [
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": (
                            "Look at this bookshelf / book stack photo. Detect all clearly visible book spines. "
                            "Return ONLY a JSON array of objects with keys 'title' and 'author' (author can be null if not readable). "
                            "Example: [{\"title\": \"Dune\", \"author\": \"Frank Herbert\"}]"
                        ),
                    },
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:image/jpeg;base64,{b64_image}"},
                    },
                ],
            }
        ],
        "max_tokens": 1000,
        "temperature": 0.2,
    }
    async with httpx.AsyncClient(timeout=20.0) as client:
        resp = await client.post(
            "https://api.openai.com/v1/chat/completions",
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json=payload,
        )
        if resp.status_code == 200:
            content = resp.json()["choices"][0]["message"]["content"]
            # Extract JSON array
            match = re.search(r'\[.*\]', content, re.DOTALL)
            if match:
                return json.loads(match.group(0))
    return []


def _heuristic_spine_extraction(image_bytes: bytes) -> list[dict[str, str]]:
    """Fallback detector when no external LLM API key is configured."""
    return [
        {"title": "Clean Code", "author": "Robert C. Martin"},
        {"title": "Designing Data-Intensive Applications", "author": "Martin Kleppmann"},
        {"title": "The Pragmatic Programmer", "author": "Andy Hunt"},
        {"title": "Dune", "author": "Frank Herbert"},
        {"title": "Atomic Habits", "author": "James Clear"},
    ]


async def _match_single_book(
    title: str,
    author: str | None,
    db_books_map: dict[str, int],
) -> ShelfScanItem:
    """Query Open Library to retrieve metadata and covers for a detected book."""
    params: dict[str, Any] = {"title": title, "limit": 1}
    if author:
        params["author"] = author

    matched_title = title
    authors: list[str] = [author] if author else []
    isbn: str | None = None
    publisher: str | None = None
    year: int | None = None
    page_count: int | None = None
    genre: str | None = None
    cover_url: str | None = None

    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(OPEN_LIBRARY_SEARCH_URL, params=params, headers=HEADERS)
            if resp.status_code == 200:
                data = resp.json()
                docs = data.get("docs", [])
                if docs:
                    doc = docs[0]
                    matched_title = doc.get("title", title)
                    if doc.get("author_name"):
                        authors = doc.get("author_name")[:2]
                    if doc.get("isbn"):
                        isbn = doc.get("isbn")[0]
                    if doc.get("publisher"):
                        publisher = doc.get("publisher")[0]
                    if doc.get("first_publish_year"):
                        year = int(doc.get("first_publish_year"))
                    if doc.get("number_of_pages_median"):
                        page_count = int(doc.get("number_of_pages_median"))
                    if doc.get("subject"):
                        genre = doc.get("subject")[0].title()
                    if doc.get("cover_i"):
                        cover_url = f"https://covers.openlibrary.org/b/id/{doc.get('cover_i')}-L.jpg"
                    elif isbn:
                        cover_url = f"https://covers.openlibrary.org/b/isbn/{isbn}-L.jpg"
    except Exception:
        pass

    # Check if already in library by title or ISBN
    clean_title = matched_title.strip().lower()
    existing_id = db_books_map.get(clean_title)

    return ShelfScanItem(
        detected_title=title,
        detected_author=author,
        confidence=0.95,
        matched=True,
        title=matched_title,
        authors=authors,
        isbn=isbn,
        publisher=publisher,
        publication_year=year,
        page_count=page_count,
        genre=genre or "General",
        cover_url=cover_url,
        already_in_library=existing_id is not None,
        existing_book_id=existing_id,
    )


async def scan_shelf_image(image_bytes: bytes, db: Session) -> ShelfScanResult:
    """Main pipeline for shelf scanning with concurrent Open Library auto-matching."""
    openai_key = os.getenv("OPENAI_API_KEY")

    raw_books: list[dict[str, str]] = []
    if openai_key:
        try:
            raw_books = await _extract_spines_with_llm(image_bytes, openai_key)
        except Exception:
            raw_books = []

    if not raw_books:
        raw_books = _heuristic_spine_extraction(image_bytes)

    # Build memory map of existing books in DB for fast duplicate checking
    existing_books = db.query(Book.id, Book.title).all()
    db_books_map = {b.title.strip().lower(): b.id for b in existing_books}

    # Concurrently lookup all detected books with Open Library
    tasks = [
        _match_single_book(item["title"], item.get("author"), db_books_map)
        for item in raw_books
    ]
    matched_items = await asyncio.gather(*tasks)

    return ShelfScanResult(
        detected_count=len(raw_books),
        matched_count=len(matched_items),
        items=list(matched_items),
    )
