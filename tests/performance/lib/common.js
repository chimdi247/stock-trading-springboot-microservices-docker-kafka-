// Shared helpers for all k6 scenarios.
import http from 'k6/http'
import { check, fail, sleep } from 'k6'
import { Counter, Rate, Trend } from 'k6/metrics'

export const BASE_URL = __ENV.BASE_URL || 'http://api-gateway:8080'   // service name inside the compose network
export const USERS = Number(__ENV.USERS || 20)                       // pre-registered traders shared across VUs

export const orderLatency = new Trend('order_placement_duration', true)
export const ordersExecuted = new Counter('orders_executed')
export const ordersNotExecuted = new Counter('orders_not_executed')
export const businessErrors = new Rate('business_errors')

const JSON_HDR = { 'Content-Type': 'application/json' }

export function authHeaders(token) {
  return { headers: { ...JSON_HDR, Authorization: `Bearer ${token}` } }
}

/** Run once per test: register N traders with a huge wallet so cash never limits throughput. */
export function setupUsers(n = USERS) {
  const run = Date.now()
  const users = []
  for (let i = 0; i < n; i++) {
    const email = `k6-${run}-${i}@example.com`
    const r = http.post(`${BASE_URL}/api/v1/users/register`,
      JSON.stringify({ firstName: 'K6', lastName: `User${i}`, email, password: 'secret123', initialDeposit: 1000000000 }),
      { headers: JSON_HDR, tags: { name: 'setup_register' } })
    if (r.status !== 200 && r.status !== 201) fail(`setup: register failed ${r.status} ${r.body}`)
    const u = r.json()
    users.push({ userId: u.userId, token: u.accessToken, email })
  }
  const m = http.get(`${BASE_URL}/api/v1/market/stocks`, authHeaders(users[0].token))
  const symbols = m.json().map((s) => s.symbol)
  return { users, symbols }
}

export function pickUser(data) {
  return data.users[(__VU - 1) % data.users.length]
}

export function browse(user) {
  const a = authHeaders(user.token)
  const res = http.batch([
    ['GET', `${BASE_URL}/api/v1/market/stocks`, null, { ...a, tags: { name: 'GET /market/stocks' } }],
    ['GET', `${BASE_URL}/api/v1/portfolio/me`, null, { ...a, tags: { name: 'GET /portfolio/me' } }],
    ['GET', `${BASE_URL}/api/v1/orders/my-orders`, null, { ...a, tags: { name: 'GET /orders/my-orders' } }],
  ])
  check(res[0], { 'market 200': (r) => r.status === 200 })
  check(res[1], { 'portfolio 200': (r) => r.status === 200 })
  check(res[2], { 'orders 200': (r) => r.status === 200 })
  return res
}

export function trade(user, symbols, side) {
  const symbol = symbols[Math.floor(Math.random() * symbols.length)]
  const t0 = Date.now()
  const r = http.post(`${BASE_URL}/api/v1/orders`,
    JSON.stringify({ userId: user.userId, symbol, type: side, quantity: 1 + Math.floor(Math.random() * 3) }),
    { ...authHeaders(user.token), tags: { name: `POST /orders ${side}` } })
  orderLatency.add(Date.now() - t0)
  const ok = check(r, { 'order accepted (201)': (x) => x.status === 201 })
  let executed = false
  if (ok) {
    executed = r.json('status') === 'EXECUTED'
    check(r, { 'order EXECUTED': () => executed })
  }
  executed ? ordersExecuted.add(1) : ordersNotExecuted.add(1)
  businessErrors.add(!executed)
  return r
}

/** Realistic mix: 70% browsing, 25% trading (BUY/SELL alternating), 5% login. */
export function userJourney(data) {
  const user = pickUser(data)
  const dice = Math.random()
  if (dice < 0.70) {
    browse(user)
  } else if (dice < 0.95) {
    trade(user, data.symbols, Math.random() < 0.6 ? 'BUY' : 'SELL')
  } else {
    const r = http.post(`${BASE_URL}/api/v1/users/login`, JSON.stringify({ email: user.email, password: 'secret123' }),
      { headers: JSON_HDR, tags: { name: 'POST /login' } })
    check(r, { 'login 200': (x) => x.status === 200 })
  }
  sleep(0.5 + Math.random())   // think time
}

export function summaryTo(name) {
  return (data) => ({
    [`/results/${name}-summary.json`]: JSON.stringify(data, null, 2),
    stdout: textSummary(data),
  })
}

function textSummary(d) {
  const m = d.metrics
  const f = (x, p = 1) => (x === undefined ? 'n/a' : x.toFixed(p))
  return `
  ── ${d.options && d.options.scenarios ? Object.keys(d.options.scenarios).join(',') : 'run'} ─────────────────────────
  requests        : ${m.http_reqs ? m.http_reqs.values.count : 0}  (${f(m.http_reqs && m.http_reqs.values.rate)} req/s)
  failed requests : ${f(m.http_req_failed && m.http_req_failed.values.rate * 100, 2)} %
  latency p50/p95/p99 : ${f(m.http_req_duration.values.med)} / ${f(m.http_req_duration.values['p(95)'])} / ${f(m.http_req_duration.values['p(99)'])} ms
  orders executed : ${m.orders_executed ? m.orders_executed.values.count : 0}
  max VUs         : ${m.vus_max ? m.vus_max.values.max : 'n/a'}
`
}
