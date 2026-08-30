from fastapi.testclient import TestClient


def test_login_success(client: TestClient):
    resp = client.post("/auth/login", json={"email": "test@example.com", "password": "password123"})
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"


def test_login_invalid_password(client: TestClient):
    resp = client.post("/auth/login", json={"email": "test@example.com", "password": "wrongpassword"})
    assert resp.status_code == 401
    assert resp.json()["detail"] == "Invalid email or password"


def test_get_me_authenticated(client: TestClient, auth_headers: dict[str, str]):
    resp = client.get("/auth/me", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["email"] == "test@example.com"
    assert data["display_name"] == "Test User"


def test_get_me_unauthenticated(client: TestClient):
    resp = client.get("/auth/me")
    assert resp.status_code == 401


def test_update_profile(client: TestClient, auth_headers: dict[str, str]):
    resp = client.patch("/auth/profile", headers=auth_headers, json={"display_name": "Updated Name"})
    assert resp.status_code == 200
    assert resp.json()["display_name"] == "Updated Name"


def test_change_password_flow(client: TestClient, auth_headers: dict[str, str]):
    # 1. Try with invalid current password
    resp = client.post(
        "/auth/change-password",
        headers=auth_headers,
        json={"current_password": "wrong", "new_password": "newpassword123"},
    )
    assert resp.status_code == 400
    assert "incorrect" in resp.json()["detail"].lower()

    # 2. Try with password too short (< 8 chars)
    resp = client.post(
        "/auth/change-password",
        headers=auth_headers,
        json={"current_password": "password123", "new_password": "short"},
    )
    assert resp.status_code == 422

    # 3. Successful change
    resp = client.post(
        "/auth/change-password",
        headers=auth_headers,
        json={"current_password": "password123", "new_password": "newpassword123"},
    )
    assert resp.status_code == 200
    assert resp.json()["message"] == "Password changed successfully"

    # 4. Login with new password
    login_resp = client.post("/auth/login", json={"email": "test@example.com", "password": "newpassword123"})
    assert login_resp.status_code == 200
