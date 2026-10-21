import { test, expect } from '@playwright/test'
import { loginAsAdmin, registerNewUser, money } from './helpers.js'

test.describe('market + trading', () => {
  test('market page lists stocks and prices tick live', async ({ page }) => {
    await loginAsAdmin(page)
    await page.getByRole('link', { name: 'Market' }).first().click()
    const rows = page.locator('[data-testid^="stock-row-"]')
    await expect(rows.first()).toBeVisible()
    expect(await rows.count()).toBeGreaterThanOrEqual(3)

    // Prices are simulated every 2 s; within ~25 s at least one price must change
    const price = page.locator('[data-testid^="price-"]')
    const snapshot = async () => (await price.allTextContents()).join('|')
    const first = await snapshot()
    await expect.poll(snapshot, { timeout: 25_000, intervals: [1000] }).not.toBe(first)
  })

  test('live-status badge reports the connection', async ({ page }) => {
    await loginAsAdmin(page)
    await expect(page.getByTestId('live-status').first()).toBeVisible()
  })

  test('search filters the stock table', async ({ page }) => {
    await loginAsAdmin(page)
    await page.goto('/market')
    const rows = page.locator('[data-testid^="stock-row-"]')
    await expect(rows.first()).toBeVisible()
    const total = await rows.count()
    await page.getByTestId('market-search').fill('zzzz-no-such-stock')
    await expect(rows).toHaveCount(0)
    await page.getByTestId('market-search').fill('')
    await expect(rows).toHaveCount(total)
  })

  test('buy order executes, wallet drops, order appears in history and portfolio', async ({ page }) => {
    await registerNewUser(page, '100000')
    const walletEl = page.getByTestId('wallet-balance')
    const before = money(await walletEl.innerText())

    await page.goto('/trade')
    await expect(page.getByTestId('trade-price')).toContainText('₹')
    await page.getByTestId('qty-input').fill('2')
    await expect(page.getByTestId('order-total')).not.toHaveText('₹0.00')
    await page.getByTestId('place-order').click()

    const result = page.getByTestId('order-result')
    await expect(result).toBeVisible({ timeout: 30_000 })
    await expect(result).toContainText(/executed/i)

    await expect.poll(async () => money(await walletEl.innerText())).toBeLessThan(before)

    await page.goto('/orders')
    await expect(page.getByTestId('order-row').first()).toContainText('BUY')
    await expect(page.getByTestId('order-row').first()).toContainText(/Executed/)

    // Portfolio is fed asynchronously through Kafka — allow time for the consumer
    await page.goto('/portfolio')
    await expect(page.getByTestId('holding-row').first()).toBeVisible({ timeout: 40_000 })
  })

  test('cannot buy more than the wallet allows (client-side guard)', async ({ page }) => {
    await registerNewUser(page, '10')
    await page.goto('/trade')
    await expect(page.getByTestId('trade-price')).toContainText('₹')
    await page.getByTestId('qty-input').fill('1000')
    await page.getByTestId('place-order').click()
    await expect(page.getByTestId('toast').first()).toContainText(/insufficient wallet balance/i)
    await expect(page.getByTestId('order-result')).toHaveCount(0)
  })

  test('cannot sell shares you do not own', async ({ page }) => {
    await registerNewUser(page)
    await page.goto('/trade')
    await page.getByTestId('side-SELL').click()
    await page.getByTestId('qty-input').fill('5')
    await page.getByTestId('place-order').click()
    await expect(page.getByTestId('toast').first()).toContainText(/only own 0/i)
  })

  test('add funds increases the wallet', async ({ page }) => {
    await registerNewUser(page, '1000')
    const walletEl = page.getByTestId('wallet-balance')
    const before = money(await walletEl.innerText())
    await page.getByTestId('add-funds').click()
    await page.getByTestId('funds-amount').fill('2500')
    await page.getByTestId('funds-submit').click()
    await expect.poll(async () => money(await walletEl.innerText())).toBe(before + 2500)
  })

  test('orders page filters by status', async ({ page }) => {
    await loginAsAdmin(page)
    await page.goto('/orders')
    await page.getByTestId('filter-FAILED').click()
    await expect(page.getByTestId('filter-FAILED')).toBeVisible()
    await page.getByTestId('filter-ALL').click()
  })
})
