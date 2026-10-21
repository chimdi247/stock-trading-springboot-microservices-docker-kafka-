import os
import time
import uuid

import pytest
import requests

BASE_URL = os.getenv("BASE_URL", "http://localhost:8080")          # API gateway
ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "admin@example.com")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "password123")


class Client:
    def __init__(self, base=BASE_URL):
        self.base = base
        self.s = requests.Session()
        self.token = None
        self.user = None

    def _h(self):
        return {"Authorization": f"Bearer {self.token}"} if self.token else {}

    def get(self, path, **kw):
        return self.s.get(self.base + path, headers=self._h(), timeout=20, **kw)

    def post(self, path, **kw):
        return self.s.post(self.base + path, headers=self._h(), timeout=30, **kw)

    def login(self, email, password):
        r = self.post("/api/v1/users/login", json={"email": email, "password": password})
        if r.status_code == 200:
            self.user = r.json()
            self.token = self.user["accessToken"]
        return r


def wait_until(fn, timeout=30, interval=1.0):
    """Poll fn() until it returns a truthy value (for async Kafka -> portfolio updates)."""
    end = time.time() + timeout
    last = None
    while time.time() < end:
        last = fn()
        if last:
            return last
        time.sleep(interval)
    return last


@pytest.fixture(scope="session", autouse=True)
def stack_is_up():
    r = None
    for _ in range(30):
        try:
            r = requests.get(BASE_URL + "/actuator/health", timeout=3)
            if r.status_code == 200:
                return
        except requests.RequestException:
            pass
        time.sleep(2)
    pytest.exit(f"Gateway not reachable at {BASE_URL} — run `docker compose up -d --build` first", 2)


@pytest.fixture(scope="session")
def admin():
    c = Client()
    r = c.login(ADMIN_EMAIL, ADMIN_PASSWORD)
    assert r.status_code == 200, f"seed admin cannot log in: {r.status_code} {r.text}"
    return c


@pytest.fixture()
def trader():
    """A brand-new user with a known wallet — isolates tests from each other."""
    c = Client()
    email = f"it-{uuid.uuid4().hex[:10]}@example.com"
    r = c.post("/api/v1/users/register", json={
        "firstName": "Integration", "lastName": "Test", "email": email,
        "password": "secret123", "initialDeposit": 100000})
    assert r.status_code in (200, 201), r.text
    c.user = r.json()
    c.token = c.user["accessToken"]
    c.email = email
    return c
