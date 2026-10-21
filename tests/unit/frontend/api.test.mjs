import test from 'node:test'
import assert from 'node:assert/strict'
import { createApi, ApiError } from '../../../frontend/src/lib/api.js'

function mockFetch(status, body) {
  const calls = []
  const fn = async (url, init) => {
    calls.push({ url, init })
    return { ok: status >= 200 && status < 300, status, text: async () => (body === undefined ? '' : typeof body === 'string' ? body : JSON.stringify(body)) }
  }
  fn.calls = calls
  return fn
}

test('login posts credentials WITHOUT a bearer token', async () => {
  const f = mockFetch(200, { accessToken: 'abc' })
  const api = createApi({ getToken: () => 'stale', fetchImpl: f })
  const r = await api.login('admin@example.com', 'password123')
  assert.equal(r.accessToken, 'abc')
  assert.equal(f.calls[0].url, '/api/v1/users/login')
  assert.equal(f.calls[0].init.method, 'POST')
  assert.equal(f.calls[0].init.headers.Authorization, undefined)
  assert.deepEqual(JSON.parse(f.calls[0].init.body), { email: 'admin@example.com', password: 'password123' })
})

test('protected calls send the bearer token', async () => {
  const f = mockFetch(200, [])
  const api = createApi({ getToken: () => 'tok', fetchImpl: f })
  await api.myOrders()
  assert.equal(f.calls[0].init.headers.Authorization, 'Bearer tok')
  assert.equal(f.calls[0].url, '/api/v1/orders/my-orders')
})

test('wrong password surfaces the server message and does NOT log the user out', async () => {
  let loggedOut = false
  const api = createApi({ onUnauthorized: () => { loggedOut = true }, fetchImpl: mockFetch(401, { message: 'Invalid email or password' }) })
  await assert.rejects(() => api.login('a@b.co', 'x'), (e) => e instanceof ApiError && e.status === 401 && e.message === 'Invalid email or password')
  assert.equal(loggedOut, false)
})

test('expired token on a protected call triggers onUnauthorized', async () => {
  let loggedOut = false
  const api = createApi({ getToken: () => 't', onUnauthorized: () => { loggedOut = true }, fetchImpl: mockFetch(401, '') })
  await assert.rejects(() => api.portfolio(), /session has expired/)
  assert.equal(loggedOut, true)
})

test('network failure becomes a friendly ApiError(status 0)', async () => {
  const api = createApi({ fetchImpl: async () => { throw new TypeError('fetch failed') } })
  await assert.rejects(() => api.stocks(), (e) => e.status === 0 && /Cannot reach the server/.test(e.message))
})

test('placeOrder always includes userId (backend validates @NotBlank before overriding)', async () => {
  const f = mockFetch(201, { id: 'o1', status: 'EXECUTED' })
  const api = createApi({ getToken: () => 't', fetchImpl: f })
  await api.placeOrder({ userId: 'u1', symbol: 'AAPL', type: 'BUY', quantity: '3' })
  assert.deepEqual(JSON.parse(f.calls[0].init.body), { userId: 'u1', symbol: 'AAPL', type: 'BUY', quantity: 3 })
})

test('addFunds encodes path and amount', async () => {
  const f = mockFetch(200, {})
  const api = createApi({ getToken: () => 't', fetchImpl: f })
  await api.addFunds('u 1', '500.50')
  assert.equal(f.calls[0].url, '/api/v1/users/u%201/funds/add?amount=500.50')
})

test('server error message is extracted from Spring-style JSON', async () => {
  const api = createApi({ getToken: () => 't', fetchImpl: mockFetch(409, { message: 'Email already registered' }) })
  await assert.rejects(() => api.register({}), /Email already registered/)
})
