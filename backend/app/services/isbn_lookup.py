import json
import re
import time
import urllib.error
import urllib.parse
import urllib.request

OPEN_LIBRARY_BOOKS_URL = "https://openlibrary.org/api/books"
HEADERS = {"User-Agent": "personal-library-app/1.0 (personal use)"}
MAX_ATTEMPTS = 3


def _get_with_retries(url: str) -> bytes | None:
    req = urllib.request.Request(url, headers=HEADERS)
    for attempt in range(MAX_ATTEMPTS):
        try:
            with urllib.request.urlopen(req, timeout=8) as resp:
                return resp.read()
        except (urllib.error.URLError, TimeoutError):
            if attempt < MAX_ATTEMPTS - 1:
                time.sleep(0.5)
    return None


def fetch_isbn_metadata(isbn: str) -> dict | None:
    params = {"bibkeys": f"ISBN:{isbn}", "format": "json", "jscmd": "data"}
    url = OPEN_LIBRARY_BOOKS_URL + "?" + urllib.parse.urlencode(params)
    raw = _get_with_retries(url)
    if raw is None:
        return None
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return None
    return data.get(f"ISBN:{isbn}")


def parse_metadata(raw: dict) -> dict:
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


def download_cover_bytes(url: str) -> bytes | None:
    data = _get_with_retries(url)
    # Open Library serves a tiny placeholder image when there's no real cover.
    if data is None or len(data) < 2000:
        return None
    return data
