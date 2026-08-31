from fastapi.testclient import TestClient


def _create_book(client: TestClient, headers: dict[str, str], title: str, **extra) -> dict:
    resp = client.post("/books", headers=headers, json={"title": title, **extra})
    assert resp.status_code == 201
    return resp.json()


def test_register_with_invite_joins_library(client: TestClient, auth_headers: dict[str, str]):
    # Owner creates an invite code
    invite = client.post("/library/invite", headers=auth_headers)
    assert invite.status_code == 200
    code = invite.json()["invite_code"]
    assert code

    # Invite preview is public
    preview = client.get(f"/auth/invite/{code}")
    assert preview.status_code == 200
    assert preview.json()["library_name"] == "Test User"
    assert preview.json()["member_count"] == 1

    # New user registers with the code
    resp = client.post(
        "/auth/register",
        json={
            "email": "partner@example.com",
            "password": "password123",
            "display_name": "Partner",
            "invite_code": code,
        },
    )
    assert resp.status_code == 201
    partner_headers = {"Authorization": f"Bearer {resp.json()['access_token']}"}

    # Both accounts are in one library
    me = client.get("/auth/me", headers=partner_headers).json()
    assert me["role"] == "member"

    lib = client.get("/library", headers=auth_headers).json()
    assert len(lib["members"]) == 2
    assert lib["my_role"] == "owner"


def test_register_with_bad_invite_fails(client: TestClient):
    resp = client.post(
        "/auth/register",
        json={
            "email": "nobody@example.com",
            "password": "password123",
            "display_name": "Nobody",
            "invite_code": "not-a-code",
        },
    )
    assert resp.status_code == 400


def test_revoked_invite_fails(client: TestClient, auth_headers: dict[str, str]):
    code = client.post("/library/invite", headers=auth_headers).json()["invite_code"]
    revoke = client.delete("/library/invite", headers=auth_headers)
    assert revoke.status_code == 204

    resp = client.post(
        "/auth/register",
        json={
            "email": "late@example.com",
            "password": "password123",
            "display_name": "Late",
            "invite_code": code,
        },
    )
    assert resp.status_code == 400


def test_members_share_books_shelves_tags(
    client: TestClient,
    auth_headers: dict[str, str],
    auth_headers_member: dict[str, str],
):
    book = _create_book(
        client, auth_headers, "Shared Book", shelf="Living Room", tags=["family"]
    )

    # The member sees the owner's book
    listing = client.get("/books", headers=auth_headers_member).json()
    assert listing["total"] == 1
    assert listing["items"][0]["title"] == "Shared Book"
    assert listing["items"][0]["added_by"] == "Test User"

    # The member sees shared shelves and tags
    assert "Living Room" in client.get("/shelves", headers=auth_headers_member).json()
    assert "family" in client.get("/tags", headers=auth_headers_member).json()

    # The member can edit the shared book
    patch = client.patch(
        f"/books/{book['id']}", headers=auth_headers_member, json={"genre": "Fiction"}
    )
    assert patch.status_code == 200


def test_members_have_separate_statuses(
    client: TestClient,
    auth_headers: dict[str, str],
    auth_headers_member: dict[str, str],
):
    book = _create_book(client, auth_headers, "Status Book")

    # Owner finishes the book with a rating
    resp = client.patch(
        f"/books/{book['id']}/status",
        headers=auth_headers,
        json={"status": "finished", "rating": 9},
    )
    assert resp.status_code == 200

    # The member's own status is untouched
    detail_member = client.get(f"/books/{book['id']}", headers=auth_headers_member).json()
    assert detail_member["my_status"] is None

    # The detail view shows both members side by side
    by_name = {m["display_name"]: m for m in detail_member["member_statuses"]}
    assert by_name["Test User"]["status"] == "finished"
    assert by_name["Test User"]["rating"] == 9
    assert by_name["Member User"]["status"] == "unread"


def test_member_cannot_manage_library(
    client: TestClient,
    auth_headers_member: dict[str, str],
):
    assert (
        client.patch("/library", headers=auth_headers_member, json={"name": "Taken Over"})
    ).status_code == 403
    assert client.post("/library/invite", headers=auth_headers_member).status_code == 403
    assert client.delete("/library/invite", headers=auth_headers_member).status_code == 403
    assert (
        client.post(
            "/public/my-share-link",
            headers=auth_headers_member,
            json={"share_slug": "mine", "is_public_shelf": True},
        )
    ).status_code == 403


def test_stats_shared_books_separate_reading(
    client: TestClient,
    auth_headers: dict[str, str],
    auth_headers_member: dict[str, str],
):
    book = _create_book(client, auth_headers, "Stats Book", page_count=100)
    client.patch(
        f"/books/{book['id']}/status",
        headers=auth_headers,
        json={"status": "finished", "finished_at": "2026-08-01"},
    )

    stats_owner = client.get("/stats", headers=auth_headers).json()
    stats_member = client.get("/stats", headers=auth_headers_member).json()

    # Library totals are shared
    assert stats_owner["total_books"] == 1
    assert stats_member["total_books"] == 1

    # Reading progress is personal
    assert stats_owner["status_counts"]["finished"] == 1
    assert stats_member["status_counts"]["finished"] == 0
    assert stats_member["status_counts"]["unread"] == 1


def test_public_shelf_aggregates_member_statuses(
    client: TestClient,
    auth_headers: dict[str, str],
    auth_headers_member: dict[str, str],
):
    book = _create_book(client, auth_headers, "Public Book")
    client.patch(
        f"/books/{book['id']}/status",
        headers=auth_headers_member,
        json={"status": "finished", "rating": 7},
    )

    share = client.get("/public/my-share-link", headers=auth_headers).json()
    slug = share["share_url"].split("/share/")[1]

    public = client.get(f"/public/library/{slug}").json()
    assert public["owner_name"] == "Test User"
    assert public["total_books"] == 1
    assert public["books"][0]["status"] == "finished"
    assert public["books"][0]["rating"] == 7
