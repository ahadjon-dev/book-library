from fastapi.testclient import TestClient


def test_cross_script_search_and_filter(client: TestClient, auth_headers: dict[str, str]):
    # Add a book in Cyrillic Uzbek
    resp = client.post(
        "/books",
        json={
            "title": "Саодат асри",
            "subtitle": "Қисса",
            "authors": ["Аҳмад Лутфий Қозончи"],
            "genre": "Тарихий",
            "shelf": "Асосий",
            "tags": ["ислом", "тарих"],
            "publication_year": 2019,
            "page_count": 560,
            "owned": True,
        },
        headers=auth_headers,
    )
    assert resp.status_code == 201
    book_id = resp.json()["id"]

    # 1. Search in Latin: "saodat"
    search_resp = client.get("/books?search=saodat", headers=auth_headers)
    assert search_resp.status_code == 200
    items = search_resp.json()["items"]
    assert any(b["id"] == book_id for b in items)

    # 2. Search in Latin: "Ahmad Lutfiy"
    author_search_resp = client.get("/books?search=Ahmad+Lutfiy", headers=auth_headers)
    assert author_search_resp.status_code == 200
    items = author_search_resp.json()["items"]
    assert any(b["id"] == book_id for b in items)

    # 3. Filter by author in Latin
    filter_author_resp = client.get("/books?author=Ahmad+Lutfiy+Qozonchi", headers=auth_headers)
    assert filter_author_resp.status_code == 200
    items = filter_author_resp.json()["items"]
    assert any(b["id"] == book_id for b in items)


def test_bulk_add_with_convert_to_latin(client: TestClient, auth_headers: dict[str, str]):
    payload = {
        "books": [
            {
                "title": "Руҳий тарбия",
                "authors": ["Шайх Муҳаммад Содиқ Муҳаммад Юсуф"],
                "genre": "Тарбия",
                "shelf": "Жавон 1",
                "tags": ["руҳият"],
                "publication_year": 2018,
                "owned": True,
            }
        ],
        "convert_to_latin": True,
    }
    resp = client.post("/books/bulk-add", json=payload, headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["added_count"] == 1
    added_book = data["books"][0]
    assert added_book["title"] == "Ruhiy tarbiya"
    assert "Shayx Muhammad Sodiq Muhammad Yusuf" in added_book["authors"]


def test_transliterate_library_endpoint(client: TestClient, auth_headers: dict[str, str]):
    # Add Cyrillic book
    resp = client.post(
        "/books",
        json={
            "title": "Кифоя",
            "authors": ["Шайх Муҳаммад Содиқ"],
            "genre": "Фиқҳ",
            "shelf": "Дин",
            "tags": ["фиқҳ"],
            "owned": True,
        },
        headers=auth_headers,
    )
    assert resp.status_code == 201
    book_id = resp.json()["id"]

    # Convert library to Latin
    t_resp = client.post("/books/transliterate-library?target_script=latn", headers=auth_headers)
    assert t_resp.status_code == 200
    t_data = t_resp.json()
    assert t_data["converted_books_count"] >= 1

    # Verify book is now in Latin
    get_resp = client.get(f"/books/{book_id}", headers=auth_headers)
    assert get_resp.status_code == 200
    book = get_resp.json()
    assert book["title"] == "Kifoya"
    assert "Shayx Muhammad Sodiq" in book["authors"]
    assert book["genre"] == "Fiqh"
    assert book["shelf"] == "Din"
