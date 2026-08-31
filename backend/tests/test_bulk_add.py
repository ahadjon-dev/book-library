from fastapi.testclient import TestClient


def test_bulk_add_books(client: TestClient, auth_headers: dict[str, str]):
    """Regression: bulk-add crashed with NameError because asyncio was not imported."""
    payload = {
        "books": [
            {"title": "ФОТИМА РОЗИЯЛЛОҲУ АНҲО", "authors": ["НУРДАН ДАМЛА"], "isbn": None},
            {"title": "تيسير السيرة النبوية", "authors": ["حسان عبد القادر سيد يوسف"]},
            {"title": "Anna Karenina", "authors": ["Лев Толстой", "Lew Nikolajewitsch Tolstoi"]},
            {"title": "ODAM BO'LISH QIYIN", "authors": ["O'LMAS UMARBEKOV"]},
        ]
    }
    resp = client.post("/books/bulk-add", headers=auth_headers, json=payload)
    assert resp.status_code == 200
    body = resp.json()
    assert body["added_count"] == 4
    titles = {b["title"] for b in body["books"]}
    assert "Anna Karenina" in titles
    assert "ФОТИМА РОЗИЯЛЛОҲУ АНҲО" in titles

    # The books landed in the library
    listing = client.get("/books", headers=auth_headers).json()
    assert listing["total"] == 4


def test_bulk_add_rejects_oversized_batch(client: TestClient, auth_headers: dict[str, str]):
    payload = {"books": [{"title": f"Book {i}"} for i in range(101)]}
    resp = client.post("/books/bulk-add", headers=auth_headers, json=payload)
    assert resp.status_code == 400
