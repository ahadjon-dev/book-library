from datetime import date, timedelta
from fastapi.testclient import TestClient


def test_loans_full_lifecycle_and_filters(client: TestClient, auth_headers: dict[str, str]):
    # Create 2 books
    b1 = client.post("/books", headers=auth_headers, json={"title": "Loanable 1"}).json()
    b2 = client.post("/books", headers=auth_headers, json={"title": "Loanable 2"}).json()

    # 1. Create active on-time loan
    future_date = (date.today() + timedelta(days=14)).isoformat()
    l1 = client.post(
        "/loans",
        headers=auth_headers,
        json={"book_id": b1["id"], "borrower_name": "Dave", "due_date": future_date},
    ).json()

    # 2. Create overdue loan
    past_date = (date.today() - timedelta(days=3)).isoformat()
    l2 = client.post(
        "/loans",
        headers=auth_headers,
        json={"book_id": b2["id"], "borrower_name": "Eve", "due_date": past_date},
    ).json()

    # 3. Query active loans -> 2
    active_resp = client.get("/loans?status=active", headers=auth_headers)
    assert active_resp.status_code == 200
    assert len(active_resp.json()) == 2

    # 4. Partial update of loan details (PATCH /loans/{id})
    update_resp = client.patch(
        f"/loans/{l1['id']}",
        headers=auth_headers,
        json={"borrower_contact": "dave@example.com", "notes": "Renewed for 1 week"},
    )
    assert update_resp.status_code == 200
    assert update_resp.json()["borrower_contact"] == "dave@example.com"
    assert update_resp.json()["notes"] == "Renewed for 1 week"

    # 5. Return loan 2
    ret_resp = client.patch(f"/loans/{l2['id']}/return", headers=auth_headers)
    assert ret_resp.status_code == 200
    assert ret_resp.json()["is_returned"] is True

    # 6. Query returned loans -> 1
    returned_resp = client.get("/loans?status=returned", headers=auth_headers)
    assert returned_resp.status_code == 200
    assert len(returned_resp.json()) == 1
    assert returned_resp.json()[0]["id"] == l2["id"]

    # 7. Query all loans -> 2
    all_resp = client.get("/loans?status=all", headers=auth_headers)
    assert all_resp.status_code == 200
    assert len(all_resp.json()) == 2

    # 8. Error cases: non-existent loan (404)
    assert client.patch("/loans/99999/return", headers=auth_headers).status_code == 404
    assert client.patch("/loans/99999", headers=auth_headers, json={"borrower_name": "Ghost"}).status_code == 404
    assert client.delete("/loans/99999", headers=auth_headers).status_code == 404
