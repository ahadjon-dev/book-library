import io
from fastapi.testclient import TestClient
from PIL import Image


def _create_mock_image_bytes(fmt="PNG", size=(100, 150), color="blue") -> bytes:
    img = Image.new("RGB", size, color=color)
    buf = io.BytesIO()
    img.save(buf, format=fmt)
    return buf.getvalue()


def test_books_filtering_and_search_combinations(client: TestClient, auth_headers: dict[str, str]):
    # Setup a rich collection of books
    books_data = [
        {
            "title": "Clean Code: A Handbook of Agile Software Craftsmanship",
            "authors": ["Robert C. Martin"],
            "genre": "Technology",
            "shelf": "Shelf A",
            "tags": ["software", "clean-architecture", "agile"],
            "publication_year": 2008,
            "page_count": 464,
            "owned": True,
            "purchase_date": "2023-01-15",
            "purchase_price": 35.50,
        },
        {
            "title": "The Clean Coder: A Code of Conduct for Professional Programmers",
            "authors": ["Robert C. Martin"],
            "genre": "Technology",
            "shelf": "Shelf A",
            "tags": ["career", "agile"],
            "publication_year": 2011,
            "page_count": 256,
            "owned": True,
            "purchase_date": "2023-02-10",
            "purchase_price": 28.00,
        },
        {
            "title": "Dune",
            "authors": ["Frank Herbert"],
            "genre": "Sci-Fi",
            "shelf": "Shelf B",
            "tags": ["epic", "classic"],
            "publication_year": 1965,
            "page_count": 412,
            "owned": True,
        },
        {
            "title": "Foundation",
            "authors": ["Isaac Asimov"],
            "genre": "Sci-Fi",
            "shelf": "Shelf B",
            "tags": ["classic", "space"],
            "publication_year": 1951,
            "page_count": 255,
            "owned": False,  # Wishlist
        },
    ]

    created_ids = []
    for b in books_data:
        res = client.post("/books", headers=auth_headers, json=b)
        assert res.status_code == 201
        created_ids.append(res.json()["id"])

    # Mark statuses
    # Book 0: finished, rating 9
    client.patch(f"/books/{created_ids[0]}/status", headers=auth_headers, json={"status": "finished", "rating": 9})
    # Book 1: reading
    client.patch(f"/books/{created_ids[1]}/status", headers=auth_headers, json={"status": "reading"})

    # 1. Test Genre Filter
    resp = client.get("/books?genre=Technology", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["total"] == 2

    # 2. Test Shelf Filter
    resp = client.get("/books?shelf=Shelf+B", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["total"] == 1  # Only owned by default (Dune)

    # 3. Test Author Filter
    resp = client.get("/books?author=Robert+C.+Martin", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["total"] == 2

    # 4. Test Tag Filter
    resp = client.get("/books?tag=agile", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["total"] == 2

    # 5. Test Year Range Filter
    resp = client.get("/books?year_min=2000&year_max=2010", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["total"] == 1
    assert resp.json()["items"][0]["title"].startswith("Clean Code")

    # 6. Test Multi-word Search (e.g. "Martin Handbook")
    resp = client.get("/books?search=Martin+Handbook", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["total"] == 1

    # 7. Test Search by Tag (e.g. "clean-architecture")
    resp = client.get("/books?search=clean-architecture", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["total"] == 1

    # 8. Test Wishlist (owned=False)
    resp = client.get("/books?owned=false", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["total"] == 1
    assert resp.json()["items"][0]["title"] == "Foundation"

    # 9. Test Status Filtering:
    # unread
    resp = client.get("/books?status=unread", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["total"] == 1
    assert resp.json()["items"][0]["title"] == "Dune"

    # reading
    resp = client.get("/books?status=reading", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["total"] == 1
    assert resp.json()["items"][0]["title"] == "The Clean Coder: A Code of Conduct for Professional Programmers"

    # finished
    resp = client.get("/books?status=finished", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["total"] == 1
    assert resp.json()["items"][0]["title"].startswith("Clean Code")

    # 10. Test Pagination
    resp = client.get("/books?limit=1&offset=1", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["limit"] == 1
    assert resp.json()["offset"] == 1
    assert len(resp.json()["items"]) == 1


def test_books_update_and_empty_relations(client: TestClient, auth_headers: dict[str, str]):
    # Create initial book
    res = client.post(
        "/books",
        headers=auth_headers,
        json={
            "title": "Refactoring",
            "authors": ["Martin Fowler"],
            "shelf": "Shelf A",
            "tags": ["code-quality"],
        },
    )
    assert res.status_code == 201
    book_id = res.json()["id"]

    # Partial update: modify title, clear shelf, replace tags
    patch_res = client.patch(
        f"/books/{book_id}",
        headers=auth_headers,
        json={
            "subtitle": "Improving the Design of Existing Code",
            "shelf": "",  # Clears shelf
            "tags": ["refactoring", "patterns"],
            "page_count": 448,
        },
    )
    assert patch_res.status_code == 200
    updated = patch_res.json()
    assert updated["subtitle"] == "Improving the Design of Existing Code"
    assert updated["shelf"] is None
    assert "refactoring" in updated["tags"]
    assert "code-quality" not in updated["tags"]


def test_excel_export_endpoint(client: TestClient, auth_headers: dict[str, str]):
    # Add a book
    client.post(
        "/books",
        headers=auth_headers,
        json={"title": "Exportable Book", "authors": ["Exporter"], "genre": "Tools", "page_count": 100},
    )

    # 1. Export all
    resp = client.get("/books/export", headers=auth_headers)
    assert resp.status_code == 200
    assert "application/vnd.openxmlformats" in resp.headers["content-type"]
    assert len(resp.content) > 100

    # 2. Export with filter
    resp_filtered = client.get("/books/export?genre=Tools&status=unread", headers=auth_headers)
    assert resp_filtered.status_code == 200
    assert len(resp_filtered.content) > 100


def test_cover_upload_endpoint(client: TestClient, auth_headers: dict[str, str]):
    # Create a book
    b = client.post("/books", headers=auth_headers, json={"title": "Cover Book"}).json()
    book_id = b["id"]

    # 1. Upload valid PNG image
    img_bytes = _create_mock_image_bytes("PNG")
    files = {"file": ("cover.png", io.BytesIO(img_bytes), "image/png")}
    up_resp = client.post(f"/books/{book_id}/cover", headers=auth_headers, files=files)
    assert up_resp.status_code == 200
    assert up_resp.json()["cover_image_path"] is not None

    # 2. Upload invalid mime type / plain text
    bad_files = {"file": ("corrupt.txt", io.BytesIO(b"this is not an image"), "text/plain")}
    bad_resp = client.post(f"/books/{book_id}/cover", headers=auth_headers, files=bad_files)
    assert bad_resp.status_code == 400

    # 3. Upload oversized image (> 10MB)
    huge_bytes = b"0" * (11 * 1024 * 1024)
    huge_files = {"file": ("huge.png", io.BytesIO(huge_bytes), "image/png")}
    huge_resp = client.post(f"/books/{book_id}/cover", headers=auth_headers, files=huge_files)
    assert huge_resp.status_code == 413

    # 4. Upload to non-existent book (404)
    up_404 = client.post("/books/999999/cover", headers=auth_headers, files={"file": ("cover.png", io.BytesIO(img_bytes), "image/png")})
    assert up_404.status_code == 404


def test_malformed_and_edge_case_payloads(client: TestClient, auth_headers: dict[str, str]):
    # 1. Missing required title
    resp = client.post("/books", headers=auth_headers, json={"authors": ["Unknown"]})
    assert resp.status_code == 422

    # 2. Null or whitespace-only inputs
    resp = client.post(
        "/books",
        headers=auth_headers,
        json={
            "title": "   Book with spaces   ",
            "authors": ["  Author A  ", ""],
            "tags": ["  tag1  ", ""],
            "shelf": "   ",
        },
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["title"] == "Book with spaces"
    assert data["shelf"] is None

    # 3. Invalid rating in status update (e.g. rating > 10 or < 1)
    b_id = data["id"]
    bad_rating = client.patch(f"/books/{b_id}/status", headers=auth_headers, json={"rating": 15})
    assert bad_rating.status_code == 422

    # 4. Non-existent book patch (404)
    assert client.patch("/books/999999/status", headers=auth_headers, json={"status": "reading"}).status_code == 404
