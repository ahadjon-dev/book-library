from fastapi.testclient import TestClient


def test_recommendations_edge_cases(client: TestClient, auth_headers: dict[str, str]):
    # 1. No books at all -> returns 0 unread pool
    resp = client.post("/books/recommend-next", headers=auth_headers, json={"mood": "epic fantasy"})
    assert resp.status_code == 200
    assert resp.json()["unread_pool_size"] == 0
    assert len(resp.json()["recommendations"]) == 0

    # 2. Add long epic book (>500 pages) and philosophy book
    client.post(
        "/books",
        headers=auth_headers,
        json={"title": "The Way of Kings", "authors": ["Brandon Sanderson"], "genre": "Fantasy", "page_count": 1007, "tags": ["epic", "magic"]},
    )
    client.post(
        "/books",
        headers=auth_headers,
        json={"title": "Meditations", "authors": ["Marcus Aurelius"], "genre": "Philosophy", "page_count": 180, "tags": ["stoic", "wisdom"]},
    )

    # 3. Query long epic read
    epic_resp = client.post(
        "/books/recommend-next",
        headers=auth_headers,
        json={"mood": "long epic fantasy"},
    )
    assert epic_resp.status_code == 200
    assert epic_resp.json()["unread_pool_size"] == 2
    assert epic_resp.json()["recommendations"][0]["book"]["title"] == "The Way of Kings"

    # 4. Query philosophy mood with max_pages filter fallback
    philo_resp = client.post(
        "/books/recommend-next",
        headers=auth_headers,
        json={"mood": "stoic philosophy", "max_pages": 50},  # Stricter than 180 -> should fallback to candidates
    )
    assert philo_resp.status_code == 200
    assert philo_resp.json()["recommendations"][0]["book"]["title"] == "Meditations"


def test_isbn_lookup_matching_and_fallback(client: TestClient, auth_headers: dict[str, str]):
    # 1. Add book with specific ISBN
    client.post(
        "/books",
        headers=auth_headers,
        json={"title": "The Pragmatic Programmer", "authors": ["Andy Hunt", "Dave Thomas"], "isbn": "9780201616224"},
    )

    # 2. Lookup with exact ISBN containing hyphens
    lookup_resp = client.get("/books/lookup?isbn=978-0-201-61622-4", headers=auth_headers)
    assert lookup_resp.status_code == 200
    data = lookup_resp.json()
    assert data["already_in_library"] is not None
    assert data["already_in_library"]["owned"] is True
