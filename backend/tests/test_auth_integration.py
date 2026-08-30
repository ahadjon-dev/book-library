from fastapi.testclient import TestClient


def test_auth_header_malformed_and_edge_cases(client: TestClient):
    # 1. Invalid bearer token format
    resp = client.get("/auth/me", headers={"Authorization": "NotBearer 12345"})
    assert resp.status_code == 401

    # 2. Corrupted token signature
    resp = client.get("/auth/me", headers={"Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.corrupted.token"})
    assert resp.status_code == 401

    # 3. Non-existent user in token
    from app.core.security import create_access_token
    token = create_access_token(subject="nonexistent@example.com")
    resp = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 401

    # 4. Change password with identical new password
    token_real = create_access_token(subject="test@example.com")
    same_pass_resp = client.post(
        "/auth/change-password",
        headers={"Authorization": f"Bearer {token_real}"},
        json={"current_password": "password123", "new_password": "password123"},
    )
    assert same_pass_resp.status_code == 400
    assert "different" in same_pass_resp.json()["detail"].lower()
