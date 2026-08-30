from datetime import date, timedelta
from fastapi.testclient import TestClient


def test_book_loans_lifecycle(client: TestClient, auth_headers: dict[str, str]):
    # 1. Create a book to loan
    book_resp = client.post(
        "/books",
        headers=auth_headers,
        json={"title": "The Pragmatic Programmer", "authors": ["Andy Hunt"], "genre": "Tech"},
    )
    assert book_resp.status_code == 201
    book_id = book_resp.json()["id"]

    # 2. Create a loan (due in past to test overdue calculation)
    past_due = (date.today() - timedelta(days=5)).isoformat()
    loan_resp = client.post(
        "/loans",
        headers=auth_headers,
        json={
            "book_id": book_id,
            "borrower_name": "Alice Johnson",
            "borrower_contact": "alice@example.com",
            "due_date": past_due,
            "notes": "Borrowed for study group",
        },
    )
    assert loan_resp.status_code == 201
    loan_data = loan_resp.json()
    loan_id = loan_data["id"]
    assert loan_data["borrower_name"] == "Alice Johnson"
    assert loan_data["is_returned"] is False
    assert loan_data["is_overdue"] is True

    # 3. List active loans
    list_resp = client.get("/loans?status=active", headers=auth_headers)
    assert list_resp.status_code == 200
    assert len(list_resp.json()) == 1

    # 4. Mark loan as returned
    return_resp = client.patch(f"/loans/{loan_id}/return", headers=auth_headers)
    assert return_resp.status_code == 200
    assert return_resp.json()["is_returned"] is True
    assert return_resp.json()["is_overdue"] is False

    # 5. List active loans should now be 0
    active_resp = client.get("/loans?status=active", headers=auth_headers)
    assert len(active_resp.json()) == 0

    # 6. Delete loan
    del_resp = client.delete(f"/loans/{loan_id}", headers=auth_headers)
    assert del_resp.status_code == 204
