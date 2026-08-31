import io
from unittest.mock import AsyncMock, patch
from fastapi.testclient import TestClient

from app.services.vision import DetectedSpine


def test_shelf_scanner_not_configured_returns_503(client: TestClient, auth_headers: dict[str, str]):
    mock_image = io.BytesIO(b"\xff\xd8\xff\xe0fake_jpeg_data")
    files = {"file": ("shelf.jpg", mock_image, "image/jpeg")}

    with patch("app.core.config.settings.gemini_api_key", None):
        resp = client.post("/books/scan-shelf", headers=auth_headers, files=files)
        assert resp.status_code == 503
        assert "not configured" in resp.json()["detail"]


def test_shelf_scanner_payload_guards(client: TestClient, auth_headers: dict[str, str]):
    # Unsupported media type
    files = {"file": ("text.txt", io.BytesIO(b"hello world"), "text/plain")}
    resp = client.post("/books/scan-shelf", headers=auth_headers, files=files)
    assert resp.status_code == 415


def test_shelf_scanner_with_gemini_mock(client: TestClient, auth_headers: dict[str, str]):
    mock_image = io.BytesIO(b"\xff\xd8\xff\xe0valid_jpeg_header_bytes")
    files = {"file": ("shelf.jpg", mock_image, "image/jpeg")}

    mock_spines = [
        DetectedSpine(title="Dune", author="Frank Herbert", confidence=0.96),
        DetectedSpine(title="O'tkan Kunlar", author="Abdulla Qodiriy", confidence=0.92),
    ]

    with patch("app.core.config.settings.gemini_api_key", "mock-gemini-key"), \
         patch("app.services.shelf_scanner.extract_spines", new=AsyncMock(return_value=mock_spines)):
        resp = client.post("/books/scan-shelf", headers=auth_headers, files=files)
        assert resp.status_code == 200
        data = resp.json()
        assert data["detected_count"] == 2
        assert len(data["items"]) == 2

        # Check that Dune and O'tkan Kunlar were properly returned with their detected titles preserved
        titles = [i["title"] for i in data["items"]]
        assert "Dune" in titles
        assert "O'tkan Kunlar" in titles
