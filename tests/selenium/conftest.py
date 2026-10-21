import os

import pytest
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support.ui import WebDriverWait

BASE_URL = os.getenv("BASE_URL", "http://localhost:3000")


@pytest.fixture()
def driver():
    """Headless Chrome. Selenium Manager (built into selenium >= 4.6) downloads the matching driver."""
    opts = Options()
    if os.getenv("HEADED") != "1":
        opts.add_argument("--headless=new")
    opts.add_argument("--no-sandbox")
    opts.add_argument("--disable-dev-shm-usage")
    opts.add_argument("--window-size=1440,900")
    d = webdriver.Chrome(options=opts)
    d.implicitly_wait(0)
    yield d
    d.quit()


@pytest.fixture()
def wait(driver):
    return WebDriverWait(driver, 20)


@pytest.fixture()
def base_url():
    return BASE_URL
