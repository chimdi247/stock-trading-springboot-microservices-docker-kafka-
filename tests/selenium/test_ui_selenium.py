"""Cross-browser-style UI checks with Selenium WebDriver (complements the Playwright suite).

    cd tests/selenium && pip install -r requirements.txt && pytest -v
"""
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC

from pages import LoginPage, Shell, tid


def test_login_page_renders(driver, wait, base_url):
    LoginPage(driver, wait, base_url).open()
    assert "TradeSphere" in driver.title
    assert driver.find_element(By.TAG_NAME, "h1").text == "Welcome back"


def test_admin_login_shows_wallet(driver, wait, base_url):
    page = LoginPage(driver, wait, base_url).open()
    page.sign_in("admin@example.com", "password123")
    shell = Shell(driver, wait)
    assert "₹" in shell.wallet_text()
    wait.until(EC.url_to_be(base_url + "/"))


def test_wrong_password_shows_error(driver, wait, base_url):
    page = LoginPage(driver, wait, base_url).open()
    page.sign_in("admin@example.com", "bad-password")
    assert "Invalid email or password" in page.error_text()
    assert "/login" in driver.current_url


def test_protected_route_redirects_to_login(driver, wait, base_url):
    driver.get(f"{base_url}/portfolio")
    wait.until(EC.url_contains("/login"))


def test_navigation_and_live_market_table(driver, wait, base_url):
    LoginPage(driver, wait, base_url).open().sign_in("admin@example.com", "password123")
    shell = Shell(driver, wait)
    shell.wallet_text()
    shell.go("Market")
    rows = wait.until(lambda d: d.find_elements(By.CSS_SELECTOR, '[data-testid^="stock-row-"]') or False)
    assert len(rows) >= 3
    shell.go("Orders")
    wait.until(EC.visibility_of_element_located((By.XPATH, "//h1[normalize-space()='Orders']")))
    shell.go("Portfolio")
    wait.until(EC.visibility_of_element_located((By.XPATH, "//h1[normalize-space()='Portfolio']")))


def test_sign_out(driver, wait, base_url):
    LoginPage(driver, wait, base_url).open().sign_in("admin@example.com", "password123")
    Shell(driver, wait).wallet_text()
    wait.until(EC.element_to_be_clickable(tid("logout"))).click()
    wait.until(EC.url_contains("/login"))
