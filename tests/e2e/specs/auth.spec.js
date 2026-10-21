import { test, expect } from '@playwright/test'
import { ADMIN, login, loginAsAdmin, registerNewUser } from './helpers.js'

test.describe('authentication', () => {
  test('unauthenticated visitors are redirected to /login', async ({ page }) => {
    await page.goto('/orders')
    await expect(page).toHaveURL(/\/login/)
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible()
  })

  test('seeded admin can sign in and sees wallet + name', async ({ page }) => {
    await loginAsAdmin(page)
    await expect(page).toHaveURL('/')
    await expect(page.getByTestId('user-name').or(page.getByTestId('wallet-balance')).first()).toBeVisible()
    await expect(page.getByText(/Good to see you, Admin/)).toBeVisible()
  })

  test('wrong password shows an error and stays on the login page', async ({ page }) => {
    await login(page, { email: ADMIN.email, password: 'wrong-password' })
    await expect(page.getByTestId('login-error')).toContainText('Invalid email or password')
    await expect(page).toHaveURL(/\/login/)
  })

  test('client-side validation blocks an invalid e-mail', async ({ page }) => {
    await page.goto('/login')
    await page.getByTestId('login-email').fill('not-an-email')
    await page.getByTestId('login-password').fill('x')
    await page.getByTestId('login-submit').click()
    await expect(page.getByText('Enter a valid e-mail address')).toBeVisible()
  })

  test('demo-account button pre-fills the seeded credentials', async ({ page }) => {
    await page.goto('/login')
    await page.getByTestId('fill-demo').click()
    await expect(page.getByTestId('login-email')).toHaveValue('admin@example.com')
  })

  test('new user can register and lands on the dashboard with their deposit', async ({ page }) => {
    await registerNewUser(page, '25000')
    await expect(page.getByTestId('wallet-balance')).toContainText('25,000')
  })

  test('duplicate registration shows the server error', async ({ page }) => {
    await page.goto('/register')
    await page.getByTestId('reg-first').fill('Dup')
    await page.getByTestId('reg-last').fill('User')
    await page.getByTestId('reg-email').fill(ADMIN.email)
    await page.getByTestId('reg-password').fill('secret123')
    await page.getByTestId('register-submit').click()
    await expect(page.getByTestId('register-error')).toContainText(/already registered/i)
  })

  test('sign-out clears the session', async ({ page, isMobile }) => {
    await loginAsAdmin(page)
    if (isMobile) await page.getByLabel('Sign out').click()
    else await page.getByTestId('logout').click()
    await expect(page).toHaveURL(/\/login/)
    await page.goto('/portfolio')
    await expect(page).toHaveURL(/\/login/)
  })
})
