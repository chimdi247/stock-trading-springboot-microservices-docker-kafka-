import { expect } from '@playwright/test'

export const ADMIN = { email: 'admin@example.com', password: 'password123' }

export async function login(page, { email, password } = ADMIN) {
  await page.goto('/login')
  await page.getByTestId('login-email').fill(email)
  await page.getByTestId('login-password').fill(password)
  await page.getByTestId('login-submit').click()
}

export async function loginAsAdmin(page) {
  await login(page)
  await expect(page.getByTestId('wallet-balance')).toBeVisible()
}

export async function registerNewUser(page, deposit = '50000') {
  const email = `e2e-${Date.now()}-${Math.floor(Math.random() * 1e4)}@example.com`
  await page.goto('/register')
  await page.getByTestId('reg-first').fill('E2E')
  await page.getByTestId('reg-last').fill('Tester')
  await page.getByTestId('reg-email').fill(email)
  await page.getByTestId('reg-password').fill('secret123')
  await page.getByTestId('reg-deposit').fill(deposit)
  await page.getByTestId('register-submit').click()
  await expect(page.getByTestId('wallet-balance')).toBeVisible()
  return email
}

/** "₹1,23,456.50" -> 123456.5 */
export const money = (text) => Number(text.replace(/[^0-9.\-]/g, ''))
