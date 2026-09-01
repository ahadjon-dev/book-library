import asyncio
import json

from app.services import isbn_lookup

ISBN = "9780997025491"

GOOGLE_FUZZY_RESPONSE = {
    "totalItems": 300,
    "items": [
        {
            "volumeInfo": {
                "title": "Wealth: From Zero to Hero",
                "authors": ["Adella Pasos"],
                "industryIdentifiers": [
                    {"type": "ISBN_13", "identifier": "9781648584855"}
                ],
            }
        }
    ],
}

GOOGLE_EXACT_RESPONSE = {
    "totalItems": 2,
    "items": [
        {
            "volumeInfo": {
                "title": "Wrong Fuzzy Hit",
                "industryIdentifiers": [
                    {"type": "ISBN_13", "identifier": "9781111111111"}
                ],
            }
        },
        {
            "volumeInfo": {
                "title": "The Real Book",
                "authors": ["Real Author"],
                "publishedDate": "2020-01-01",
                "industryIdentifiers": [
                    {"type": "ISBN_13", "identifier": ISBN}
                ],
            }
        },
    ],
}

OL_JUNK_RESPONSE = {
    f"ISBN:{ISBN}": {
        "title": "Historico Maggico Sepejos Del Lena",
        "publishers": [{"name": "expresta"}],
        "authors": [],
    }
}

INVENTAIRE_EDITION = {
    "entities": {
        f"isbn:{ISBN}": {
            "type": "edition",
            "labels": {"en": "Inventaire Book"},
            "claims": {
                "wdt:P1476": ["Inventaire Book"],
                "wdt:P577": ["2018"],
                "wdt:P629": ["wd:Q100"],
            },
        }
    }
}

INVENTAIRE_WORK = {
    "entities": {"wd:Q100": {"type": "work", "claims": {"wdt:P50": ["wd:Q200"]}}}
}

INVENTAIRE_AUTHOR = {
    "entities": {"wd:Q200": {"type": "human", "labels": {"en": "Inventaire Author"}}}
}


def _fake_get(responses: dict[str, object]):
    """Build a fake _async_get dispatching on URL (and Inventaire uris)."""

    async def fake(url: str, params: dict | None = None):
        if url == isbn_lookup.INVENTAIRE_API_URL:
            uris = (params or {}).get("uris", "")
            if uris.startswith("isbn:"):
                body = responses.get("inv_edition")
            elif uris.startswith("wd:Q100"):
                body = responses.get("inv_work")
            else:
                body = responses.get("inv_author")
        elif url == isbn_lookup.GOOGLE_BOOKS_API_URL:
            body = responses.get("google")
        elif url == isbn_lookup.OPEN_LIBRARY_BOOKS_URL:
            body = responses.get("openlibrary")
        else:
            body = None
        if body is None:
            return None
        return json.dumps(body).encode("utf-8")

    return fake


def test_google_fuzzy_fallback_is_rejected(monkeypatch):
    monkeypatch.setattr(isbn_lookup, "_async_get", _fake_get({"google": GOOGLE_FUZZY_RESPONSE}))
    result = asyncio.run(isbn_lookup._fetch_google_books(ISBN))
    assert result is None


def test_google_exact_identifier_is_accepted(monkeypatch):
    monkeypatch.setattr(isbn_lookup, "_async_get", _fake_get({"google": GOOGLE_EXACT_RESPONSE}))
    result = asyncio.run(isbn_lookup._fetch_google_books(ISBN))
    assert result is not None
    assert result["title"] == "The Real Book"
    assert result["authors"] == ["Real Author"]


def test_authorless_openlibrary_alone_is_rejected(monkeypatch):
    monkeypatch.setattr(
        isbn_lookup,
        "_async_get",
        _fake_get({"openlibrary": OL_JUNK_RESPONSE, "google": {"totalItems": 0}}),
    )
    result = asyncio.run(isbn_lookup.fetch_isbn_metadata(ISBN))
    assert result is None


def test_authorless_openlibrary_yields_to_verified_google(monkeypatch):
    monkeypatch.setattr(
        isbn_lookup,
        "_async_get",
        _fake_get({"openlibrary": OL_JUNK_RESPONSE, "google": GOOGLE_EXACT_RESPONSE}),
    )
    result = asyncio.run(isbn_lookup.fetch_isbn_metadata(ISBN))
    assert result is not None
    assert result["title"] == "The Real Book"
    assert result["authors"] == ["Real Author"]


def test_inventaire_fallback_when_both_sources_miss(monkeypatch):
    monkeypatch.setattr(
        isbn_lookup,
        "_async_get",
        _fake_get(
            {
                "google": {"totalItems": 0},
                "inv_edition": INVENTAIRE_EDITION,
                "inv_work": INVENTAIRE_WORK,
                "inv_author": INVENTAIRE_AUTHOR,
            }
        ),
    )
    result = asyncio.run(isbn_lookup.fetch_isbn_metadata(ISBN))
    assert result is not None
    assert result["title"] == "Inventaire Book"
    assert result["authors"] == ["Inventaire Author"]
    assert result["publication_year"] == 2018


GOOGLE_REUSED_ISBN_RESPONSE = {
    "totalItems": 3,
    "items": [
        {
            "volumeInfo": {
                "title": "Wealth: From Zero to Hero",
                "industryIdentifiers": [{"type": "ISBN_13", "identifier": ISBN}],
            }
        },
        {
            "volumeInfo": {
                "title": "Jacob in Canada",
                "industryIdentifiers": [{"type": "ISBN_13", "identifier": ISBN}],
            }
        },
    ],
}


def test_reused_isbn_with_conflicting_titles_is_rejected(monkeypatch):
    monkeypatch.setattr(
        isbn_lookup, "_async_get", _fake_get({"google": GOOGLE_REUSED_ISBN_RESPONSE})
    )
    result = asyncio.run(isbn_lookup._fetch_google_books(ISBN))
    assert result is None


def test_multiple_editions_same_title_still_accepted(monkeypatch):
    editions = {
        "totalItems": 2,
        "items": [
            {
                "volumeInfo": {
                    "title": "The Hobbit",
                    "authors": ["J.R.R. Tolkien"],
                    "industryIdentifiers": [{"type": "ISBN_13", "identifier": ISBN}],
                }
            },
            {
                "volumeInfo": {
                    "title": "The Hobbit, or, There and Back Again",
                    "industryIdentifiers": [{"type": "ISBN_13", "identifier": ISBN}],
                }
            },
        ],
    }
    monkeypatch.setattr(isbn_lookup, "_async_get", _fake_get({"google": editions}))
    result = asyncio.run(isbn_lookup._fetch_google_books(ISBN))
    assert result is not None
    assert result["title"] == "The Hobbit"
