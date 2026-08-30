import io
from fastapi.testclient import TestClient


def test_shelf_scanner_pipeline(client: TestClient, auth_headers: dict[str, str]):
    # 1. Upload mock shelf image
    mock_image = io.BytesIO(b"fake_image_bytes_for_testing")
    files = {"file": ("shelf.jpg", mock_image, "image/jpeg")}
    scan_resp = client.post("/books/scan-shelf", headers=auth_headers, files=files)
    assert scan_resp.status_code == 200
    scan_data = scan_resp.json()
    assert scan_data["detected_count"] > 0
    assert len(scan_data["items"]) > 0
    first_item = scan_data["items"][0]
    assert "title" in first_item
    assert first_item["matched"] is True

    # 2. Test Bulk Add of scanned items
    bulk_payload = {
        "books": [
            {
                "title": "Dune",
                "authors": ["Frank Herbert"],
                "genre": "Sci-Fi",
                "publication_year": 1965,
                "page_count": 412,
                "owned": True,
            },
            {
                "title": "Hyperion",
                "authors": ["Dan Simmons"],
                "genre": "Sci-Fi",
                "publication_year": 1989,
                "page_count": 482,
                "owned": True,
            },
        ]
    }
    bulk_resp = client.post("/books/bulk-add", headers=auth_headers, json=bulk_payload)
    assert bulk_resp.status_code == 200
    bulk_data = bulk_resp.json()
    assert bulk_data["added_count"] == 2
    assert len(bulk_data["books"]) == 2

    # 3. Re-scan and check duplicate detection
    rescan_resp = client.post("/books/scan-shelf", headers=auth_headers, files=files)
    assert rescan_resp.status_code == 200
    # Any item matching 'Dune' should now have already_in_library = True
    for item in rescan_resp.json()["items"]:
        if item["title"].lower() == "dune":
            assert item["already_in_library"] is True
