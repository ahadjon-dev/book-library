from fastapi.testclient import TestClient


def test_lookups_empty_and_populated(
    client: TestClient,
    auth_headers: dict[str, str],
    auth_headers_user2: dict[str, str],
):
    # 1. User B has no books -> all lookups should be empty
    assert client.get("/authors", headers=auth_headers_user2).json() == []
    assert client.get("/tags", headers=auth_headers_user2).json() == []
    assert client.get("/shelves", headers=auth_headers_user2).json() == []
    assert client.get("/genres", headers=auth_headers_user2).json() == []

    # 2. User A creates books with authors, tags, shelves, genres
    client.post(
        "/books",
        headers=auth_headers,
        json={
            "title": "Lookup Test",
            "authors": ["Ada Lovelace", "Charles Babbage"],
            "genre": "Computing History",
            "shelf": "Pioneers",
            "tags": ["history", "math"],
        },
    )

    authors_a = client.get("/authors", headers=auth_headers).json()
    assert "Ada Lovelace" in authors_a
    assert "Charles Babbage" in authors_a

    tags_a = client.get("/tags", headers=auth_headers).json()
    assert "history" in tags_a
    assert "math" in tags_a

    shelves_a = client.get("/shelves", headers=auth_headers).json()
    assert "Pioneers" in shelves_a

    genres_a = client.get("/genres", headers=auth_headers).json()
    assert "Computing History" in genres_a
