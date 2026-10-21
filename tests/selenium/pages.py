"""Tiny page-object layer so tests read like user stories."""
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC


def tid(value):
    return (By.CSS_SELECTOR, f'[data-testid="{value}"]')


class LoginPage:
    def __init__(self, driver, wait, base_url):
        self.d, self.w, self.base = driver, wait, base_url

    def open(self):
        self.d.get(f"{self.base}/login")
        self.w.until(EC.visibility_of_element_located(tid("login-email")))
        return self

    def sign_in(self, email, password):
        self.d.find_element(*tid("login-email")).send_keys(email)
        self.d.find_element(*tid("login-password")).send_keys(password)
        self.d.find_element(*tid("login-submit")).click()

    def error_text(self):
        return self.w.until(EC.visibility_of_element_located(tid("login-error"))).text


class Shell:
    """The authenticated layout (header wallet, nav)."""

    def __init__(self, driver, wait):
        self.d, self.w = driver, wait

    def wallet_text(self):
        return self.w.until(EC.visibility_of_element_located(tid("wallet-balance"))).text

    def go(self, link_text):
        self.w.until(EC.element_to_be_clickable((By.LINK_TEXT, link_text))).click()
