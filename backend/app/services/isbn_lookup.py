import asyncio
import difflib
import json
import re
from typing import Any

import httpx

from app.core.config import settings
from app.services.isbn_utils import both_forms, normalize

OPEN_LIBRARY_BOOKS_URL = "https://openlibrary.org/api/books"
GOOGLE_BOOKS_API_URL = "https://www.googleapis.com/books/v1/volumes"
HEADERS = {"User-Agent": "personal-library-app/2.0 (isbn-lookup)"}
TIMEOUT_SECONDS = 6.0
MAX_ATTEMPTS = 2


async def _async_get(url: str, params: dict[str, str] | None = None) -> bytes | None:
    async with httpx.AsyncClient(timeout=TIMEOUT_SECONDS, follow_redirects=True) as client:
        for attempt in range(MAX_ATTEMPTS):
            try:
                resp = await client.get(url, params=params, headers=HEADERS)
                if resp.status_code == 200:
                    return resp.content
            except (httpx.RequestError, httpx.TimeoutException):
                if attempt < MAX_ATTEMPTS - 1:
                    await asyncio.sleep(0.3)
    return None


async def _fetch_openlibrary_single(isbn: str) -> dict[str, Any] | None:
    params = {"bibkeys": f"ISBN:{isbn}", "format": "json", "jscmd": "data"}
    raw_bytes = await _async_get(OPEN_LIBRARY_BOOKS_URL, params=params)
    if not raw_bytes:
        return None
    try:
        data = json.loads(raw_bytes.decode("utf-8"))
        book_data = data.get(f"ISBN:{isbn}")
        if not book_data:
            return None
        authors = [a["name"] for a in book_data.get("authors", []) if a.get("name")]
        publishers = book_data.get("publishers", [])
        publish_date = book_data.get("publish_date") or ""
        year_match = re.search(r"(\d{4})", publish_date)
        cover = book_data.get("cover") or {}

        return {
            "title": book_data.get("title"),
            "subtitle": book_data.get("subtitle"),
            "authors": authors,
            "publisher": publishers[0]["name"] if publishers else None,
            "publication_year": int(year_match.group(1)) if year_match else None,
            "page_count": book_data.get("number_of_pages"),
            "cover_url": cover.get("large") or cover.get("medium") or cover.get("small"),
            "genre": None,
        }
    except Exception:
        return None


async def _fetch_openlibrary(isbn: str) -> dict[str, Any] | None:
    for code in both_forms(isbn):
        res = await _fetch_openlibrary_single(code)
        if res and res.get("title"):
            return res
    return None


async def _fetch_google_books_single(isbn: str) -> dict[str, Any] | None:
    params: dict[str, str] = {"q": f"isbn:{isbn}"}
    if settings.google_books_api_key:
        params["key"] = settings.google_books_api_key

    raw_bytes = await _async_get(GOOGLE_BOOKS_API_URL, params=params)
    if not raw_bytes:
        return None
    try:
        data = json.loads(raw_bytes.decode("utf-8"))
        items = data.get("items", [])
        if not items:
            return None
        # q=isbn:X falls back to fuzzy full-text search when Google has no
        # exact match. Accept only volumes that carry the requested ISBN.
        wanted = set(both_forms(isbn))
        matching = []
        for item in items:
            candidate = item.get("volumeInfo", {})
            identifiers = {
                normalize(ident.get("identifier"))
                for ident in candidate.get("industryIdentifiers", [])
            }
            if identifiers & wanted:
                matching.append(candidate)
        if not matching:
            return None
        # Self-publishers reuse ISBNs. When clearly different books claim the
        # same ISBN, the number identifies nothing; report a miss instead.
        first_title = (matching[0].get("title") or "").lower()
        for other in matching[1:]:
            other_title = (other.get("title") or "").lower()
            if first_title.startswith(other_title) or other_title.startswith(first_title):
                continue  # edition variants like "X" vs "X, or, Y"
            if difflib.SequenceMatcher(None, first_title, other_title).ratio() < 0.5:
                return None
        vol = matching[0]
        title = vol.get("title")
        if not title:
            return None

        authors = vol.get("authors", [])
        publisher = vol.get("publisher")
        pub_date = vol.get("publishedDate") or ""
        year_match = re.search(r"(\d{4})", pub_date)
        page_count = vol.get("pageCount")
        categories = vol.get("categories", [])
        genre = categories[0] if categories else None

        image_links = vol.get("imageLinks") or {}
        cover_url = image_links.get("extraLarge") or image_links.get("large") or image_links.get("medium") or image_links.get("thumbnail")
        if cover_url:
            # Force HTTPS and remove edge curl artifacts
            cover_url = cover_url.replace("http://", "https://").replace("&edge=curl", "")

        return {
            "title": title,
            "subtitle": vol.get("subtitle"),
            "authors": authors,
            "publisher": publisher,
            "publication_year": int(year_match.group(1)) if year_match else None,
            "page_count": page_count,
            "cover_url": cover_url,
            "genre": genre,
        }
    except Exception:
        return None


async def _fetch_google_books(isbn: str) -> dict[str, Any] | None:
    for code in both_forms(isbn):
        res = await _fetch_google_books_single(code)
        if res and res.get("title"):
            return res
    return None



INVENTAIRE_API_URL = "https://inventaire.io/api/entities"


def _inventaire_label(entity: dict[str, Any]) -> str | None:
    labels = entity.get("labels") or {}
    return labels.get("en") or next(iter(labels.values()), None)


async def _inventaire_entities(uris: list[str]) -> dict[str, Any]:
    raw = await _async_get(INVENTAIRE_API_URL, params={"action": "by-uris", "uris": "|".join(uris)})
    if not raw:
        return {}
    try:
        return json.loads(raw.decode("utf-8")).get("entities", {})
    except Exception:
        return {}


async def _fetch_inventaire(isbn: str) -> dict[str, Any] | None:
    """Fallback source: Inventaire (Wikidata-backed, CC0, multilingual)."""
    try:
        editions = await _inventaire_entities([f"isbn:{code}" for code in both_forms(isbn)])
        edition = next(iter(editions.values()), None)
        if not edition:
            return None
        claims = edition.get("claims") or {}

        title = (claims.get("wdt:P1476") or [None])[0] or _inventaire_label(edition)
        if not title:
            return None

        pub_date = (claims.get("wdt:P577") or [""])[0] or ""
        year_match = re.search(r"(\d{4})", str(pub_date))
        pages = (claims.get("wdt:P1104") or [None])[0]

        cover_url = None
        image = edition.get("image") or {}
        if image.get("url"):
            cover_url = f"https://inventaire.io{image['url']}"

        # Authors live on the work entity: edition -> work (P629) -> authors (P50)
        authors: list[str] = []
        work_uris = claims.get("wdt:P629") or []
        if work_uris:
            works = await _inventaire_entities(work_uris[:1])
            work = next(iter(works.values()), None)
            author_uris = ((work or {}).get("claims") or {}).get("wdt:P50") or []
            if author_uris:
                author_entities = await _inventaire_entities(author_uris[:3])
                authors = [
                    name for name in (_inventaire_label(e) for e in author_entities.values()) if name
                ]

        return {
            "title": title,
            "subtitle": None,
            "authors": authors,
            "publisher": None,
            "publication_year": int(year_match.group(1)) if year_match else None,
            "page_count": int(pages) if pages else None,
            "cover_url": cover_url,
            "genre": None,
        }
    except Exception:
        return None


async def fetch_isbn_metadata(isbn: str) -> dict[str, Any] | None:
    clean_isbn = normalize(isbn)
    if not clean_isbn:
        return None

    # Fetch concurrently from both Open Library and Google Books
    ol_task = asyncio.create_task(_fetch_openlibrary(clean_isbn))
    gb_task = asyncio.create_task(_fetch_google_books(clean_isbn))

    ol_res, gb_res = await asyncio.gather(ol_task, gb_task, return_exceptions=True)

    ol_data = ol_res if isinstance(ol_res, dict) else None
    gb_data = gb_res if isinstance(gb_res, dict) else None

    # Open Library has spam records with a title but no authors. Reject one
    # unless Google independently verified the same ISBN.
    if ol_data and not ol_data.get("authors") and not gb_data:
        ol_data = None

    if not ol_data and not gb_data:
        inv_data = await _fetch_inventaire(clean_isbn)
        if not inv_data:
            return None
        return inv_data

    # Merge strategy: prefer the source that knows the authors; fill gaps
    # with the other. Open Library wins ties (better covers).
    if ol_data and gb_data and not ol_data.get("authors"):
        primary, secondary = gb_data, ol_data
    else:
        primary = ol_data or {}
        secondary = gb_data or {}

    merged = {
        "title": primary.get("title") or secondary.get("title"),
        "subtitle": primary.get("subtitle") or secondary.get("subtitle"),
        "authors": primary.get("authors") or secondary.get("authors") or [],
        "publisher": primary.get("publisher") or secondary.get("publisher"),
        "publication_year": primary.get("publication_year") or secondary.get("publication_year"),
        "page_count": primary.get("page_count") or secondary.get("page_count"),
        "cover_url": primary.get("cover_url") or secondary.get("cover_url"),
        "genre": primary.get("genre") or secondary.get("genre"),
    }
    return merged


def parse_metadata(raw: dict[str, Any]) -> dict[str, Any]:
    # Raw is already normalized and parsed by fetch_isbn_metadata
    return {
        "title": raw.get("title"),
        "subtitle": raw.get("subtitle"),
        "authors": raw.get("authors", []),
        "publisher": raw.get("publisher"),
        "publication_year": raw.get("publication_year"),
        "page_count": raw.get("page_count"),
        "cover_url": raw.get("cover_url"),
        "genre": raw.get("genre"),
    }


ALLOWED_COVER_HOSTS = {
    "covers.openlibrary.org",
    "books.google.com",
    "books.googleusercontent.com",
    "inventaire.io",
}


async def download_cover_bytes(url: str) -> bytes | None:
    if not url:
        return None
    try:
        from urllib.parse import urlparse
        parsed = urlparse(url)
        if parsed.scheme not in ("http", "https"):
            return None
        if parsed.netloc.lower() not in ALLOWED_COVER_HOSTS:
            return None
    except Exception:
        return None

    data = await _async_get(url)
    if data is None or len(data) < 1500:
        return None
    return data
