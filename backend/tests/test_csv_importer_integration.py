import io
from fastapi.testclient import TestClient


def test_csv_importer_malformed_and_edge_cases(client: TestClient, auth_headers: dict[str, str]):
    # 1. Empty CSV
    empty_files = {"file": ("empty.csv", io.BytesIO(b""), "text/csv")}
    resp = client.post("/books/import", headers=auth_headers, files=empty_files)
    assert resp.status_code == 200
    assert resp.json()["total_rows"] == 0
    assert len(resp.json()["errors"]) > 0

    # 2. Rich CSV with dirty data, currency symbols, semi-colons, various date formats, abandoned status
    dirty_csv = """Title,Authors,ISBN,Genre,Status,Rating,Date Read,Purchase Price,Purchase Date,Notes
"The Mythical Man-Month",Fred Brooks; W.H. Gates,978-0201835953,Technology,abandoned,7,2025/12/31,$34.99,2025-01-15,"Classic essays on software"
"Clean Architecture",Robert C. Martin,0134494164,Technology,in-progress,8,invalid-date,25.00,05/10/2024,
"",Unknown Author,1234567890,General,unread,,,,  # Empty title should skip
"Bad Price Book",Anon,,General,to-read,,not-a-date,not-a-number,,
"""
    files = {"file": ("dirty.csv", io.BytesIO(dirty_csv.encode("utf-8")), "text/csv")}
    resp = client.post("/books/import", headers=auth_headers, files=files)
    assert resp.status_code == 200
    data = resp.json()
    assert data["total_rows"] == 4
    assert data["imported"] == 3
    assert data["skipped"] == 1

    # Verify Mythical Man-Month was parsed correctly
    mmm_resp = client.get("/books?search=Mythical", headers=auth_headers)
    assert mmm_resp.status_code == 200
    mmm = mmm_resp.json()["items"][0]
    assert mmm["title"] == "The Mythical Man-Month"
    assert "Fred Brooks" in mmm["authors"]
    assert "W.H. Gates" in mmm["authors"]
    assert float(mmm["purchase_price"]) == 34.99
    assert mmm["my_status"]["status"] == "abandoned"

    # Verify re-importing the same CSV updates rather than crashes
    resp2 = client.post("/books/import", headers=auth_headers, files=files)
    assert resp2.status_code == 200
    assert resp2.json()["imported"] == 3
