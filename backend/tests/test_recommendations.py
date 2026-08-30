from fastapi.testclient import TestClient


def test_recommend_next_from_unread_shelf(client: TestClient, auth_headers: dict[str, str]):
    # 1. Add 1 finished book and 2 unread books
    b1 = client.post(
        "/books",
        headers=auth_headers,
        json={"title": "1984", "authors": ["George Orwell"], "genre": "Classics", "page_count": 328},
    ).json()
    client.patch(
        f"/books/{b1['id']}/status",
        headers=auth_headers,
        json={"status": "finished"},
    )

    client.post(
        "/books",
        headers=auth_headers,
        json={"title": "The Silent Patient", "authors": ["Alex Michaelides"], "genre": "Thriller", "page_count": 336},
    )
    client.post(
        "/books",
        headers=auth_headers,
        json={"title": "Animal Farm", "authors": ["George Orwell"], "genre": "Classics", "page_count": 112},
    )

    # 2. Ask for a short weekend read (<250 pages)
    rec_resp = client.post(
        "/books/recommend-next",
        headers=auth_headers,
        json={"mood": "short weekend read", "max_pages": 200},
    )
    assert rec_resp.status_code == 200
    rec_data = rec_resp.json()
    assert rec_data["unread_pool_size"] == 2
    assert len(rec_data["recommendations"]) > 0
    # Top recommendation should be Animal Farm (112 pages)
    top_book = rec_data["recommendations"][0]["book"]
    assert top_book["title"] == "Animal Farm"
    # Never recommend finished books
    rec_titles = [r["book"]["title"] for r in rec_data["recommendations"]]
    assert "1984" not in rec_titles

    # 3. Ask for a thriller
    thriller_resp = client.post(
        "/books/recommend-next",
        headers=auth_headers,
        json={"mood": "fast-paced thriller"},
    )
    assert thriller_resp.status_code == 200
    thriller_top = thriller_resp.json()["recommendations"][0]["book"]
    assert thriller_top["title"] == "The Silent Patient"
