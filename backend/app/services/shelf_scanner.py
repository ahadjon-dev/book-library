import asyncio
import difflib
import json
import re
from typing import Any

from fastapi import HTTPException, status
import httpx
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.book import Book
from app.schemas.shelf_scanner import ShelfScanItem, ShelfScanResult
from app.services.isbn_utils import both_forms, normalize
from app.services.vision import DetectedSpine, extract_spines

OPEN_LIBRARY_SEARCH_URL = "https://openlibrary.org/search.json"
GOOGLE_BOOKS_API_URL = "https://www.googleapis.com/books/v1/volumes"
HEADERS = {"User-Agent": "personal-library-app/2.0 (shelf-scanner)"}
TIMEOUT_SECONDS = 6.0


def _similarity(s1: str, s2: str) -> float:
    return difflib.SequenceMatcher(None, s1.strip().lower(), s2.strip().lower()).ratio()


async def _search_open_library(title: str, author: str | None) -> dict[str, Any] | None:
    params: dict[str, Any] = {"title": title, "limit": 3}
    if author:
        params["author"] = author

    try:
        async with httpx.AsyncClient(timeout=TIMEOUT_SECONDS) as client:
            resp = await client.get(OPEN_LIBRARY_SEARCH_URL, params=params, headers=HEADERS)
            if resp.status_code == 200:
                docs = resp.json().get("docs", [])
                for doc in docs:
                    doc_title = doc.get("title", "")
                    sim = _similarity(title, doc_title)
                    if sim >= 0.55:
                        authors = doc.get("author_name")[:2] if doc.get("author_name") else []
                        isbns = doc.get("isbn") or []
                        isbn = isbns[0] if isbns else None
                        cover_url = None
                        if doc.get("cover_i"):
                            cover_url = f"https://covers.openlibrary.org/b/id/{doc.get('cover_i')}-L.jpg"
                        elif isbn:
                            cover_url = f"https://covers.openlibrary.org/b/isbn/{isbn}-L.jpg"

                        year = int(doc.get("first_publish_year")) if doc.get("first_publish_year") else None
                        page_count = int(doc.get("number_of_pages_median")) if doc.get("number_of_pages_median") else None
                        publishers = doc.get("publisher") or []
                        publisher = publishers[0] if publishers else None
                        subjects = doc.get("subject") or []
                        genre = subjects[0].title() if subjects else None

                        return {
                            "matched_title": doc_title,
                            "authors": authors,
                            "isbn": isbn,
                            "publisher": publisher,
                            "publication_year": year,
                            "page_count": page_count,
                            "genre": genre,
                            "cover_url": cover_url,
                            "score": sim,
                        }
    except Exception:
        pass
    return None


async def _search_google_books(title: str, author: str | None) -> dict[str, Any] | None:
    q = f'intitle:"{title}"'
    if author:
        q += f' inauthor:"{author}"'
    params: dict[str, Any] = {"q": q, "maxResults": 3}
    if settings.google_books_api_key:
        params["key"] = settings.google_books_api_key

    try:
        async with httpx.AsyncClient(timeout=TIMEOUT_SECONDS) as client:
            resp = await client.get(GOOGLE_BOOKS_API_URL, params=params, headers=HEADERS)
            if resp.status_code == 200:
                items = resp.json().get("items", [])
                for item in items:
                    vol = item.get("volumeInfo", {})
                    vol_title = vol.get("title", "")
                    sim = _similarity(title, vol_title)
                    if sim >= 0.55:
                        authors = vol.get("authors", [])
                        industry_ids = vol.get("industryIdentifiers", [])
                        isbn = None
                        for i_id in industry_ids:
                            if i_id.get("type") in ("ISBN_13", "ISBN_10"):
                                isbn = i_id.get("identifier")
                                break

                        pub_date = vol.get("publishedDate") or ""
                        year_match = re.search(r"(\d{4})", pub_date)
                        year = int(year_match.group(1)) if year_match else None
                        categories = vol.get("categories", [])
                        genre = categories[0] if categories else None

                        image_links = vol.get("imageLinks") or {}
                        cover_url = image_links.get("extraLarge") or image_links.get("large") or image_links.get("medium") or image_links.get("thumbnail")
                        if cover_url:
                            cover_url = cover_url.replace("http://", "https://").replace("&edge=curl", "")

                        return {
                            "matched_title": vol_title,
                            "authors": authors,
                            "isbn": isbn,
                            "publisher": vol.get("publisher"),
                            "publication_year": year,
                            "page_count": vol.get("pageCount"),
                            "genre": genre,
                            "cover_url": cover_url,
                            "score": sim,
                        }
    except Exception:
        pass
    return None


async def _match_single_spine(
    spine: DetectedSpine,
    db_books: list[tuple[int, str, str | None]],
) -> ShelfScanItem:
    # 1. Run metadata enrichment from Open Library and Google Books
    ol_match, gb_match = await asyncio.gather(
        _search_open_library(spine.title, spine.author),
        _search_google_books(spine.title, spine.author),
        return_exceptions=True,
    )

    best_match = None
    ol_val = ol_match if isinstance(ol_match, dict) else None
    gb_val = gb_match if isinstance(gb_match, dict) else None

    if ol_val and gb_val:
        best_match = ol_val if ol_val.get("score", 0) >= gb_val.get("score", 0) else gb_val
    else:
        best_match = ol_val or gb_val

    is_matched = best_match is not None

    # Title & authors: if matched, use clean metadata; otherwise keep original OCR detection
    final_title = best_match["matched_title"] if is_matched else spine.title
    final_authors = best_match["authors"] if is_matched and best_match["authors"] else ([spine.author] if spine.author else [])
    final_isbn = best_match.get("isbn") if is_matched else None
    final_publisher = best_match.get("publisher") if is_matched else None
    final_year = best_match.get("publication_year") if is_matched else None
    final_page_count = best_match.get("page_count") if is_matched else None
    final_genre = best_match.get("genre") if is_matched else None
    final_cover = best_match.get("cover_url") if is_matched else None

    # 2. Duplicate detection in user's library
    already_in_library = False
    existing_id = None

    norm_target_title = final_title.strip().lower()
    target_isbns = set(both_forms(final_isbn)) if final_isbn else set()

    for b_id, b_title, b_isbn in db_books:
        # Check by ISBN
        if b_isbn and target_isbns:
            b_isbns = set(both_forms(b_isbn))
            if target_isbns.intersection(b_isbns):
                already_in_library = True
                existing_id = b_id
                break
        # Check by title similarity
        if _similarity(b_title, norm_target_title) >= 0.85:
            already_in_library = True
            existing_id = b_id
            break

    return ShelfScanItem(
        detected_title=spine.title,
        detected_author=spine.author,
        confidence=spine.confidence,
        matched=is_matched,
        title=final_title,
        authors=final_authors,
        isbn=final_isbn,
        publisher=final_publisher,
        publication_year=final_year,
        page_count=final_page_count,
        genre=final_genre,
        cover_url=final_cover,
        already_in_library=already_in_library,
        existing_book_id=existing_id,
    )


async def scan_shelf_image(image_bytes: bytes, db: Session, library_id: int | None = None) -> ShelfScanResult:
    """Main pipeline: Gemini Vision OCR -> Multi-source Metadata Enrichment -> Library Duplicate Check."""
    try:
        detected_spines = await extract_spines(image_bytes)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI Shelf Scanner is not configured. Please set GEMINI_API_KEY.",
        ) from e
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Vision AI service failed: {str(e)}",
        ) from e

    if not detected_spines:
        return ShelfScanResult(detected_count=0, matched_count=0, items=[])

    # Load the library's existing books for duplicate checking
    query = db.query(Book.id, Book.title, Book.isbn)
    if library_id is not None:
        query = query.filter(Book.library_id == library_id)
    db_books = query.all()

    # Match all detected spines concurrently
    tasks = [_match_single_spine(spine, db_books) for spine in detected_spines]
    matched_items = await asyncio.gather(*tasks)

    matched_count = sum(1 for item in matched_items if item.matched)

    return ShelfScanResult(
        detected_count=len(detected_spines),
        matched_count=matched_count,
        items=list(matched_items),
    )

