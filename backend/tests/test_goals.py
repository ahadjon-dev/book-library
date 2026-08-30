from fastapi.testclient import TestClient


def test_reading_goals_and_pace(client: TestClient, auth_headers: dict[str, str]):
    # 1. Check default goal for 2026
    goal_resp = client.get("/goals/2026", headers=auth_headers)
    assert goal_resp.status_code == 200
    data = goal_resp.json()
    assert data["year"] == 2026
    assert data["target_books"] == 25
    assert data["books_read"] == 0

    # 2. Update goal to 12 books
    update_resp = client.post(
        "/goals",
        headers=auth_headers,
        json={"year": 2026, "target_books": 12},
    )
    assert update_resp.status_code == 200
    assert update_resp.json()["target_books"] == 12

    # 3. Create a finished book in 2026
    book_resp = client.post(
        "/books",
        headers=auth_headers,
        json={"title": "Atomic Habits", "authors": ["James Clear"], "page_count": 300},
    )
    book_id = book_resp.json()["id"]

    client.patch(
        f"/books/{book_id}/status",
        headers=auth_headers,
        json={"status": "finished", "finished_at": "2026-05-15"},
    )

    # 4. Check goal progress after finished book
    progress_resp = client.get("/goals/2026", headers=auth_headers)
    assert progress_resp.status_code == 200
    progress_data = progress_resp.json()
    assert progress_data["books_read"] == 1
    assert progress_data["pages_read"] == 300
    assert progress_data["percentage_complete"] == round(1 / 12 * 100, 1)
