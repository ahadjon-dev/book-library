from fastapi.testclient import TestClient


def test_public_shareable_shelf(client: TestClient, auth_headers: dict[str, str]):
    # 1. Add books with rating and private notes
    b1 = client.post(
        "/books",
        headers=auth_headers,
        json={"title": "Mastery", "authors": ["Robert Greene"], "genre": "Non-Fiction", "purchase_price": 25.0},
    ).json()

    client.patch(
        f"/books/{b1['id']}/status",
        headers=auth_headers,
        json={"status": "finished", "rating": 9, "notes": "Private confidential note"},
    )

    # 2. Get my share link
    link_resp = client.get("/public/my-share-link", headers=auth_headers)
    assert link_resp.status_code == 200
    assert link_resp.json()["is_public_shelf"] is True

    # 3. Update custom slug
    update_resp = client.post(
        "/public/my-share-link",
        headers=auth_headers,
        json={"share_slug": "ahadjon-favorites", "is_public_shelf": True},
    )
    assert update_resp.status_code == 200
    assert update_resp.json()["share_slug"] == "ahadjon-favorites"

    # 4. Access public library without authentication (unauthenticated client call)
    public_resp = client.get("/public/library/ahadjon-favorites")
    assert public_resp.status_code == 200
    pub_data = public_resp.json()
    assert pub_data["owner_name"] == "Test User"
    assert pub_data["total_books"] == 1
    book_item = pub_data["books"][0]
    assert book_item["title"] == "Mastery"
    assert book_item["rating"] == 9
    # Verify private user data is NOT leaked
    assert "notes" not in book_item
    assert "purchase_price" not in book_item

    # 5. Toggle public shelf off
    client.post(
        "/public/my-share-link",
        headers=auth_headers,
        json={"share_slug": "ahadjon-favorites", "is_public_shelf": False},
    )
    # Public view should now return 404
    assert client.get("/public/library/ahadjon-favorites").status_code == 404
