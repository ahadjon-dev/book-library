from fastapi.testclient import TestClient


def test_create_and_get_book(client: TestClient, auth_headers: dict[str, str]):
    # 1. Create a book
    payload = {
        "title": "Designing Data-Intensive Applications",
        "authors": ["Martin Kleppmann"],
        "tags": ["databases", "distributed-systems"],
        "shelf": "Shelf D1",
        "genre": "Technology",
        "publication_year": 2017,
        "page_count": 616,
        "owned": True,
    }
    create_resp = client.post("/books", headers=auth_headers, json=payload)
    assert create_resp.status_code == 201
    book_data = create_resp.json()
    assert book_data["title"] == "Designing Data-Intensive Applications"
    assert "Martin Kleppmann" in book_data["authors"]
    assert "databases" in book_data["tags"]
    book_id = book_data["id"]

    # 2. Get the book
    get_resp = client.get(f"/books/{book_id}", headers=auth_headers)
    assert get_resp.status_code == 200
    assert get_resp.json()["id"] == book_id

    # 3. Update book status to reading
    status_resp = client.patch(
        f"/books/{book_id}/status",
        headers=auth_headers,
        json={"status": "reading", "notes": "Halfway through chapter 3"},
    )
    assert status_resp.status_code == 200
    assert status_resp.json()["my_status"]["status"] == "reading"

    # 4. Search for the book
    search_resp = client.get("/books?search=Martin+Data", headers=auth_headers)
    assert search_resp.status_code == 200
    assert search_resp.json()["total"] == 1

    # 5. Delete the book
    del_resp = client.delete(f"/books/{book_id}", headers=auth_headers)
    assert del_resp.status_code == 204

    # 6. Verify 404 on deleted book
    assert client.get(f"/books/{book_id}", headers=auth_headers).status_code == 404
