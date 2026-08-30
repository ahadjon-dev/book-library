from fastapi.testclient import TestClient


def test_stats_endpoint(client: TestClient, auth_headers: dict[str, str]):
    # Add books across genres
    client.post(
        "/books",
        headers=auth_headers,
        json={"title": "Book A", "authors": ["Author 1"], "genre": "Sci-Fi", "page_count": 200, "publication_year": 1995},
    )
    b2 = client.post(
        "/books",
        headers=auth_headers,
        json={"title": "Book B", "authors": ["Author 1"], "genre": "Sci-Fi", "page_count": 300, "publication_year": 1999},
    ).json()

    # Mark Book B as finished
    client.patch(
        f"/books/{b2['id']}/status",
        headers=auth_headers,
        json={"status": "finished", "finished_at": "2026-06-10"},
    )

    stats_resp = client.get("/stats", headers=auth_headers)
    assert stats_resp.status_code == 200
    stats = stats_resp.json()
    assert stats["total_books"] == 2
    assert stats["total_pages"] == 500
    assert stats["most_common_genre"] == "Sci-Fi"
    assert stats["status_counts"]["finished"] == 1
    assert stats["status_counts"]["unread"] == 1
