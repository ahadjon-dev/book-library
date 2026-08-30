import io
from fastapi.testclient import TestClient


def test_csv_import_native_format(client: TestClient, auth_headers: dict[str, str]):
    csv_content = """Title,Authors,ISBN,Genre,Status,Rating
Clean Code,Robert C. Martin,9780132350884,Technology,finished,9
The Hobbit,J.R.R. Tolkien,9780547928227,Fantasy,reading,8
"""
    files = {"file": ("books.csv", io.BytesIO(csv_content.encode("utf-8")), "text/csv")}
    resp = client.post("/books/import", headers=auth_headers, files=files)
    assert resp.status_code == 200
    data = resp.json()
    assert data["total_rows"] == 2
    assert data["imported"] == 2
    assert data["skipped"] == 0
    assert len(data["errors"]) == 0

    # Verify books created in DB
    books_resp = client.get("/books", headers=auth_headers)
    assert books_resp.status_code == 200
    assert books_resp.json()["total"] == 2


def test_csv_import_goodreads_format(client: TestClient, auth_headers: dict[str, str]):
    goodreads_csv = """Book Id,Title,Author,ISBN13,My Rating,Exclusive Shelf,Date Read
1001,Dune,Frank Herbert,="9780441172719",5,read,2026-03-01
1002,Hyperion,Dan Simmons,="9780553283686",4,currently-reading,
"""
    files = {"file": ("goodreads_export.csv", io.BytesIO(goodreads_csv.encode("utf-8")), "text/csv")}
    resp = client.post("/books/import", headers=auth_headers, files=files)
    assert resp.status_code == 200
    data = resp.json()
    assert data["total_rows"] == 2
    assert data["imported"] == 2

    # Verify Dune status is finished and Hyperion is reading
    dune_resp = client.get("/books?search=Dune", headers=auth_headers)
    assert dune_resp.json()["items"][0]["my_status"]["status"] == "finished"
