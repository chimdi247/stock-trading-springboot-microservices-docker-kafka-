// Thin fetch wrapper for the API gateway. Factory form so it can be unit-tested
// with an injected fetch implementation.
import { extractErrorMessage } from './errors.js'

export class ApiError extends Error {
  constructor(message, status, body) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.body = body
  }
}

export function createApi({ baseUrl = '', getToken = () => null, onUnauthorized = () => {}, fetchImpl } = {}) {
  const doFetch = fetchImpl || ((...a) => globalThis.fetch(...a))

  async function request(path, { method = 'GET', body, auth = true } = {}) {
    const headers = { Accept: 'application/json' }
    if (body !== undefined) headers['Content-Type'] = 'application/json'
    const token = auth ? getToken() : null
    if (token) headers.Authorization = `Bearer ${token}`

    let res
    try {
      res = await doFetch(baseUrl + path, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined })
    } catch (e) {
      throw new ApiError('Cannot reach the server. Is the platform running?', 0, null)
    }

    let data = null
    const text = await res.text()
    if (text) {
      try { data = JSON.parse(text) } catch { data = text }
    }

    if (!res.ok) {
      // 401 on a protected call = expired/invalid token -> force re-login.
      // (A 401 from /login itself is just "wrong password" — auth:false calls skip this.)
      if (auth && (res.status === 401 || res.status === 403)) onUnauthorized()
      const msg = res.status === 401 && !auth
        ? extractErrorMessage(data, 'Invalid email or password')
        : res.status === 401 || res.status === 403
          ? 'Your session has expired. Please sign in again.'
          : extractErrorMessage(data && data.message ? data.message : data, `Request failed (${res.status})`)
      throw new ApiError(msg, res.status, data)
    }
    return data
  }

  return {
    login: (email, password) => request('/api/v1/users/login', { method: 'POST', body: { email, password }, auth: false }),
    register: (payload) => request('/api/v1/users/register', { method: 'POST', body: payload, auth: false }),
    me: () => request('/api/v1/users/me'),
    addFunds: (userId, amount) => request(`/api/v1/users/${encodeURIComponent(userId)}/funds/add?amount=${encodeURIComponent(amount)}`, { method: 'POST' }),
    stocks: () => request('/api/v1/market/stocks'),
    stock: (symbol) => request(`/api/v1/market/stocks/${encodeURIComponent(symbol)}`),
    // NOTE: OrderRequest has @NotBlank userId which Bean Validation checks BEFORE the
    // controller overrides it with the gateway-verified X-User-Id, so we must send one.
    placeOrder: ({ userId, symbol, type, quantity }) =>
      request('/api/v1/orders', { method: 'POST', body: { userId, symbol, type, quantity: Number(quantity) } }),
    myOrders: () => request('/api/v1/orders/my-orders'),
    portfolio: () => request('/api/v1/portfolio/me'),
  }
}
