import uuid

from conftest import Client


def test_seeded_admin_can_login(admin):
    assert admin.user["email"] == "admin@example.com"
    assert float(admin.user["walletBalance"]) >= 0
    assert admin.user["accessToken"].count(".") == 2          # a JWT


def test_wrong_password_is_401_with_message():
    r = Client().login("admin@example.com", "definitely-wrong")
    assert r.status_code == 401
    assert r.json()["message"] == "Invalid email or password"


def test_unknown_user_gets_identical_401():
    r = Client().login("nobody-" + uuid.uuid4().hex[:6] + "@example.com", "x")
    assert r.status_code == 401
    assert r.json()["message"] == "Invalid email or password"


def test_register_then_duplicate_is_409(trader):
    r = trader.post("/api/v1/users/register", json={
        "firstName": "A", "lastName": "B", "email": trader.email, "password": "secret123"})
    assert r.status_code == 409
    assert "already registered" in r.json()["message"].lower()


def test_register_validation_rejects_short_password():
    r = Client().post("/api/v1/users/register", json={
        "firstName": "A", "lastName": "B", "email": "x@example.com", "password": "123"})
    assert r.status_code == 400


def test_me_returns_profile_and_wallet(trader):
    r = trader.get("/api/v1/users/me")
    assert r.status_code == 200
    assert r.json()["email"] == trader.email
    assert float(r.json()["walletBalance"]) == 100000.0


def test_add_funds_increases_wallet(trader):
    r = trader.post(f"/api/v1/users/{trader.user['userId']}/funds/add", params={"amount": 2500})
    assert r.status_code == 200
    assert float(trader.get("/api/v1/users/me").json()["walletBalance"]) == 102500.0


def test_protected_routes_require_a_token():
    c = Client()
    for path in ("/api/v1/users/me", "/api/v1/orders/my-orders", "/api/v1/portfolio/me", "/api/v1/market/stocks"):
        assert c.get(path).status_code == 401, path


def test_garbage_token_is_rejected():
    c = Client()
    c.token = "not.a.jwt"
    assert c.get("/api/v1/users/me").status_code == 401
