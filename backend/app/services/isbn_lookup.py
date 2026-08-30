import asyncio
import json
import re
from typing import Any

import httpx

OPEN_LIBRARY_BOOKS_URL = "https://openlibrary.org/api/books"
HEADERS = {"User-Agent": "personal-library-app/1.0 (personal use)"}
MAX_ATTEMPTS = 3
TIMEOUT_SECONDS = 6.0


async def _async_get_with_retries(url: str, params: dict[str, str] | None = None) -> bytes | None:
    async with httpx.AsyncClient(timeout=TIMEOUT_SECONDS, follow_redirects=True) as client:
        for attempt in range(MAX_ATTEMPTS):
            try:
                resp = await client.get(url, params=params, headers=HEADERS)
                if resp.status_code == 200:
                    return resp.content
            except (httpx.RequestError, httpx.TimeoutException):
                if attempt < MAX_ATTEMPTS - 1:
                    await asyncio.sleep(0.4)
    return None


async def fetch_isbn_metadata(isbn: str) -> dict[str, Any] | None:
    params = {"bibkeys": f"ISBN:{isbn}", "format": "json", "jscmd": "data"}
    raw_bytes = await _async_get_with_retries(OPEN_LIBRARY_BOOKS_URL, params=params)
    if not raw_bytes:
        return None
    try:
        data = json.loads(raw_bytes.decode("utf-8"))
        return data.get(f"ISBN:{isbn}")
    except (json.JSONDecodeError, UnicodeDecodeError):
        return None


def parse_metadata(raw: dict[str, Any]) -> dict[str, Any]:
    authors = [a["name"] for a in raw.get("authors", []) if a.get("name")]
    publishers = raw.get("publishers", [])
    publish_date = raw.get("publish_date") or ""
    year_match = re.search(r"(\d{4})", publish_date)
    cover = raw.get("cover") or {}

    return {
        "title": raw.get("title"),
        "subtitle": raw.get("subtitle"),
        "authors": authors,
        "publisher": publishers[0]["name"] if publishers else None,
        "publication_year": int(year_match.group(1)) if year_match else None,
        "page_count": raw.get("number_of_pages"),
        "cover_url": cover.get("large") or cover.get("medium") or cover.get("small"),
    }


async def download_cover_bytes(url: str) -> bytes | None:
    data = await _async_get_with_retries(url)
    # Open Library serves a tiny placeholder image (< 2000 bytes) when there's no real cover.
    if data is None or len(data) < 2000:
        return None
    return data
