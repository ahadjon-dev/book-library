from fastapi.testclient import TestClient


def test_public_library_advanced_filters_and_slugs(
    client: TestClient,
    auth_headers: dict[str, str],
    auth_headers_user2: dict[str, str],
):
    # Setup books for User A
    b1 = client.post(
        "/books",
        headers=auth_headers,
        json={"title": "Cosmos", "authors": ["Carl Sagan"], "genre": "Science", "tags": ["astronomy"], "owned": True},
    ).json()
    b2 = client.post(
        "/books",
        headers=auth_headers,
        json={"title": "Contact", "authors": ["Carl Sagan"], "genre": "Sci-Fi", "tags": ["aliens"], "owned": True},
    ).json()
    b3 = client.post(
        "/books",
        headers=auth_headers,
        json={"title": "Unowned Wishlist Book", "authors": ["Carl Sagan"], "genre": "Science", "owned": False},
    ).json()

    # User A statuses
    client.patch(f"/books/{b1['id']}/status", headers=auth_headers, json={"status": "finished", "rating": 10})
    client.patch(f"/books/{b2['id']}/status", headers=auth_headers, json={"status": "reading", "rating": 6})

    # Set slug for User A
    client.post(
        "/public/my-share-link",
        headers=auth_headers,
        json={"share_slug": "carl-sagan-fan", "is_public_shelf": True},
    )

    # 1. Access by slug
    resp = client.get("/public/library/carl-sagan-fan")
    assert resp.status_code == 200
    # Wishlist books are excluded from public library
    assert resp.json()["total_books"] == 2

    # 2. Filter by genre
    resp_genre = client.get("/public/library/carl-sagan-fan?genre=Science")
    assert resp_genre.status_code == 200
    assert resp_genre.json()["total_books"] == 1
    assert resp_genre.json()["books"][0]["title"] == "Cosmos"

    # 3. Filter by author
    resp_author = client.get("/public/library/carl-sagan-fan?author=Carl+Sagan")
    assert resp_author.status_code == 200
    assert resp_author.json()["total_books"] == 2

    # 4. Filter by tag
    resp_tag = client.get("/public/library/carl-sagan-fan?tag=astronomy")
    assert resp_tag.status_code == 200
    assert resp_tag.json()["total_books"] == 1

    # 5. Filter by status (finished vs reading)
    resp_status = client.get("/public/library/carl-sagan-fan?status=finished")
    assert resp_status.status_code == 200
    assert resp_status.json()["total_books"] == 1
    assert resp_status.json()["books"][0]["title"] == "Cosmos"

    # 6. Filter by min_rating (e.g. min_rating=8)
    resp_rating = client.get("/public/library/carl-sagan-fan?min_rating=8")
    assert resp_rating.status_code == 200
    assert resp_rating.json()["total_books"] == 1
    assert resp_rating.json()["books"][0]["title"] == "Cosmos"

    # 7. User B attempts to take User A's slug -> 400 Bad Request
    taken_resp = client.post(
        "/public/my-share-link",
        headers=auth_headers_user2,
        json={"share_slug": "carl-sagan-fan", "is_public_shelf": True},
    )
    assert taken_resp.status_code == 400
    assert "already taken" in taken_resp.json()["detail"]

    # 8. User A resets slug to None (empty string)
    reset_resp = client.post(
        "/public/my-share-link",
        headers=auth_headers,
        json={"share_slug": "", "is_public_shelf": True},
    )
    assert reset_resp.status_code == 200
    assert reset_resp.json()["share_slug"] is None
