// Unit tests for the frontend's pure logic. Run:  node --test tests/unit/frontend/
import test from 'node:test'
import assert from 'node:assert/strict'

import { formatCurrency, formatPercent, formatSigned, formatCompact, changeClass, initials, formatDateTime } from '../../../frontend/src/lib/format.js'
import { validateLogin, validateRegistration, validateOrder, validateAmount, isValidEmail } from '../../../frontend/src/lib/validators.js'
import { extractErrorMessage } from '../../../frontend/src/lib/errors.js'
import { estimateTotal, checkOrderFeasibility, summarizeOrders, statusMeta } from '../../../frontend/src/lib/orders.js'
import { loadSession, saveSession, clearSession, isTokenExpired } from '../../../frontend/src/lib/session.js'

// ───────── format ─────────
test('formatCurrency formats INR and tolerates bad input', () => {
  assert.match(formatCurrency(1234.5), /₹\s?1,234\.5/)
  assert.equal(formatCurrency('abc'), '—')
  assert.equal(formatCurrency(undefined), '—')
})
test('formatPercent adds a + sign only for gains', () => {
  assert.equal(formatPercent(1.234), '+1.23%')
  assert.equal(formatPercent(-0.5), '-0.50%')
  assert.equal(formatPercent(0), '0.00%')
  assert.equal(formatPercent(2, false), '2.00%')
})
test('formatSigned prefixes gains', () => {
  assert.ok(formatSigned(10).startsWith('+'))
  assert.ok(!formatSigned(-10).startsWith('+'))
})
test('formatCompact uses Indian units', () => {
  assert.equal(formatCompact(1500), '1.5K')
  assert.equal(formatCompact(250000), '2.50 L')
  assert.equal(formatCompact(25000000), '2.50 Cr')
  assert.equal(formatCompact(12), '12')
})
test('changeClass picks colour by sign', () => {
  assert.equal(changeClass(1), 'text-gain')
  assert.equal(changeClass(-1), 'text-loss')
  assert.equal(changeClass(0), 'text-slate-400')
  assert.equal(changeClass('x'), 'text-slate-400')
})
test('initials + formatDateTime edge cases', () => {
  assert.equal(initials('Admin', 'User'), 'AU')
  assert.equal(initials(), '?')
  assert.equal(formatDateTime(null), '—')
  assert.equal(formatDateTime('not a date'), '—')
})

// ───────── validators ─────────
test('email validation', () => {
  assert.ok(isValidEmail('admin@example.com'))
  assert.ok(!isValidEmail('admin@'))
  assert.ok(!isValidEmail(''))
  assert.ok(!isValidEmail(null))
})
test('login validation', () => {
  assert.deepEqual(validateLogin({ email: 'a@b.co', password: 'x' }), {})
  const e = validateLogin({ email: 'bad', password: '' })
  assert.ok(e.email && e.password)
})
test('registration validation mirrors backend (password >= 6)', () => {
  const ok = { firstName: 'A', lastName: 'B', email: 'a@b.co', password: '123456', initialDeposit: '100' }
  assert.deepEqual(validateRegistration(ok), {})
  assert.ok(validateRegistration({ ...ok, password: '12345' }).password)
  assert.ok(validateRegistration({ ...ok, firstName: ' ' }).firstName)
  assert.ok(validateRegistration({ ...ok, initialDeposit: '-5' }).initialDeposit)
})
test('order validation requires a whole quantity >= 1', () => {
  assert.deepEqual(validateOrder({ symbol: 'AAPL', quantity: '3' }), {})
  assert.ok(validateOrder({ symbol: 'AAPL', quantity: '0' }).quantity)
  assert.ok(validateOrder({ symbol: 'AAPL', quantity: '1.5' }).quantity)
  assert.ok(validateOrder({ symbol: '', quantity: '1' }).symbol)
})
test('amount validation', () => {
  assert.equal(validateAmount('500'), null)
  assert.ok(validateAmount('0'))
  assert.ok(validateAmount('abc'))
  assert.ok(validateAmount('999999999'))
})

// ───────── errors ─────────
test('extractErrorMessage unwraps Feign-style bodies', () => {
  const feign = '[422] during [POST] to [http://user-service:8081/x]: [{"status":422,"message":"Insufficient wallet balance"}]'
  assert.equal(extractErrorMessage(feign), 'Insufficient wallet balance')
  assert.equal(extractErrorMessage({ message: 'Invalid email or password' }), 'Invalid email or password')
  assert.equal(extractErrorMessage(null, 'fallback'), 'fallback')
  assert.ok(extractErrorMessage('x'.repeat(500)).length <= 160)
})

// ───────── orders ─────────
test('estimateTotal rounds to 2 decimals and guards bad input', () => {
  assert.equal(estimateTotal(19.99, 3), 59.97)
  assert.equal(estimateTotal(100, 2), 200)
  assert.equal(estimateTotal(100, 0), 0)
  assert.equal(estimateTotal('x', 2), 0)
})
test('order feasibility: wallet for BUY, holdings for SELL', () => {
  assert.ok(checkOrderFeasibility({ type: 'BUY', total: 500, walletBalance: 100 }))
  assert.equal(checkOrderFeasibility({ type: 'BUY', total: 50, walletBalance: 100 }), null)
  assert.ok(checkOrderFeasibility({ type: 'SELL', quantity: 5, ownedQuantity: 2 }))
  assert.equal(checkOrderFeasibility({ type: 'SELL', quantity: 2, ownedQuantity: 2 }), null)
  assert.ok(checkOrderFeasibility({ type: 'SELL', quantity: 1 }))
})
test('summarizeOrders counts by status and sums executed volume only', () => {
  const s = summarizeOrders([
    { status: 'EXECUTED', totalAmount: 100 }, { status: 'EXECUTED', totalAmount: '50.5' },
    { status: 'FAILED', totalAmount: 999 }, { status: 'FLAGGED', totalAmount: 999 },
  ])
  assert.deepEqual(s, { total: 4, executed: 2, failed: 1, flagged: 1, volume: 150.5 })
  assert.equal(statusMeta('FLAGGED').tone, 'warn')
  assert.equal(statusMeta('???').label, '???')
})

// ───────── session ─────────
function fakeStorage() { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k) } }
function jwt(payload) { return ['h', Buffer.from(JSON.stringify(payload)).toString('base64url'), 's'].join('.') }

test('session save / load / clear round-trip', () => {
  const st = fakeStorage()
  assert.equal(loadSession(st), null)
  saveSession({ accessToken: 't', userId: 'u1' }, st)
  assert.equal(loadSession(st).userId, 'u1')
  clearSession(st)
  assert.equal(loadSession(st), null)
})
test('loadSession ignores corrupt data', () => {
  const st = fakeStorage(); st.setItem('tradesphere.session', '{oops')
  assert.equal(loadSession(st), null)
})
test('JWT expiry detection', () => {
  const now = Date.now()
  assert.equal(isTokenExpired(jwt({ exp: Math.floor(now / 1000) + 3600 }), now), false)
  assert.equal(isTokenExpired(jwt({ exp: Math.floor(now / 1000) - 10 }), now), true)
  assert.equal(isTokenExpired('garbage', now), true)
})
