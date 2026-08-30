from datetime import date
from fastapi.testclient import TestClient


def test_goals_all_pace_conditions(client: TestClient, auth_headers: dict[str, str]):
    # 1. Past Year Goal (e.g. 2024): expected_books = target_books
    client.post("/goals", headers=auth_headers, json={"year": 2024, "target_books": 10})
    resp = client.get("/goals/2024", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["expected_books_by_now"] == 10.0
    assert resp.json()["pace_status"] == "behind"  # 0 read vs 10 expected

    # 2. Future Year Goal (e.g. 2030): expected_books = 0.0
    client.post("/goals", headers=auth_headers, json={"year": 2030, "target_books": 15})
    resp = client.get("/goals/2030", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["expected_books_by_now"] == 0.0
    assert resp.json()["pace_status"] == "on_track"  # 0 read vs 0 expected

    # 3. Current Year Goal completion
    current_year = date.today().year
    client.post("/goals", headers=auth_headers, json={"year": current_year, "target_books": 2})

    # Add 2 finished books in current year
    b1 = client.post("/books", headers=auth_headers, json={"title": "Goal Book 1", "page_count": 150}).json()
    b2 = client.post("/books", headers=auth_headers, json={"title": "Goal Book 2", "page_count": 250}).json()

    client.patch(f"/books/{b1['id']}/status", headers=auth_headers, json={"status": "finished", "finished_at": f"{current_year}-02-01"})
    client.patch(f"/books/{b2['id']}/status", headers=auth_headers, json={"status": "finished", "finished_at": f"{current_year}-03-01"})

    resp = client.get(f"/goals/{current_year}", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["books_read"] == 2
    assert data["pages_read"] == 400
    assert data["books_remaining"] == 0
    assert data["percentage_complete"] == 100.0
    assert data["pace_status"] == "completed"
