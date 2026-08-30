from fastapi.testclient import TestClient


def test_book_isolation_between_users(
    client: TestClient,
    auth_headers: dict[str, str],
    auth_headers_user2: dict[str, str],
):
    # 1. User A creates a book
    create_resp = client.post(
        "/books",
        headers=auth_headers,
        json={
            "title": "User A Private Book",
            "authors": ["Author A"],
            "genre": "Security",
            "page_count": 250,
            "shelf": "Secret Shelf",
            "tags": ["confidential"],
        },
    )
    assert create_resp.status_code == 201
    book_a_id = create_resp.json()["id"]

    # 2. User B lists books -> should see 0 books
    list_b_resp = client.get("/books", headers=auth_headers_user2)
    assert list_b_resp.status_code == 200
    assert list_b_resp.json()["total"] == 0
    assert len(list_b_resp.json()["items"]) == 0

    # 3. User B tries to GET User A's book by ID -> 404
    get_b_resp = client.get(f"/books/{book_a_id}", headers=auth_headers_user2)
    assert get_b_resp.status_code == 404

    # 4. User B tries to PATCH User A's book -> 404
    patch_b_resp = client.patch(
        f"/books/{book_a_id}",
        headers=auth_headers_user2,
        json={"title": "Hacked Title"},
    )
    assert patch_b_resp.status_code == 404

    # 5. User B tries to DELETE User A's book -> 404
    del_b_resp = client.delete(f"/books/{book_a_id}", headers=auth_headers_user2)
    assert del_b_resp.status_code == 404

    # 6. Verify User A's book is untouched
    get_a_resp = client.get(f"/books/{book_a_id}", headers=auth_headers)
    assert get_a_resp.status_code == 200
    assert get_a_resp.json()["title"] == "User A Private Book"


def test_independent_shelves_and_tags(
    client: TestClient,
    auth_headers: dict[str, str],
    auth_headers_user2: dict[str, str],
):
    # Both User A and User B can have a shelf called "Favorites"
    res_a = client.post(
        "/books",
        headers=auth_headers,
        json={"title": "Book 1", "shelf": "Favorites", "tags": ["must-read"]},
    )
    assert res_a.status_code == 201

    res_b = client.post(
        "/books",
        headers=auth_headers_user2,
        json={"title": "Book 2", "shelf": "Favorites", "tags": ["must-read"]},
    )
    assert res_b.status_code == 201

    # Lookups for User A should show their shelves/tags
    shelves_a = client.get("/shelves", headers=auth_headers).json()
    assert "Favorites" in shelves_a

    tags_a = client.get("/tags", headers=auth_headers).json()
    assert "must-read" in tags_a


def test_stats_isolation(
    client: TestClient,
    auth_headers: dict[str, str],
    auth_headers_user2: dict[str, str],
):
    # User A creates 3 books
    for i in range(3):
        client.post(
            "/books",
            headers=auth_headers,
            json={"title": f"Book A{i}", "page_count": 100, "genre": "History"},
        )

    # User B creates 1 book
    client.post(
        "/books",
        headers=auth_headers_user2,
        json={"title": "Book B1", "page_count": 500, "genre": "Fiction"},
    )

    stats_a = client.get("/stats", headers=auth_headers).json()
    assert stats_a["total_books"] == 3
    assert stats_a["total_pages"] == 300
    assert stats_a["most_common_genre"] == "History"

    stats_b = client.get("/stats", headers=auth_headers_user2).json()
    assert stats_b["total_books"] == 1
    assert stats_b["total_pages"] == 500
    assert stats_b["most_common_genre"] == "Fiction"


def test_loan_cannot_target_other_users_book(
    client: TestClient,
    auth_headers: dict[str, str],
    auth_headers_user2: dict[str, str],
):
    # User A creates a book
    book_a = client.post(
        "/books",
        headers=auth_headers,
        json={"title": "Target Book"},
    ).json()

    # User B attempts to lend User A's book
    loan_resp = client.post(
        "/loans",
        headers=auth_headers_user2,
        json={"book_id": book_a["id"], "borrower_name": "Bob"},
    )
    assert loan_resp.status_code == 404
