// BASELINE LATENCY per endpoint at low concurrency (isolates each route's cost).
import http from 'k6/http'
import { group } from 'k6'
import { Trend } from 'k6/metrics'
import { setupUsers, authHeaders, BASE_URL, summaryTo } from './lib/common.js'

const routes = {
  market: new Trend('route_market_ms', true),
  portfolio: new Trend('route_portfolio_ms', true),
  orders: new Trend('route_orders_ms', true),
  me: new Trend('route_me_ms', true),
}
export const options = {
  vus: 5, duration: '1m',
  thresholds: { route_market_ms: ['p(95)<150'], route_portfolio_ms: ['p(95)<400'], route_orders_ms: ['p(95)<300'], route_me_ms: ['p(95)<200'] },
}
export const setup = () => setupUsers(5)
export default function (data) {
  const u = data.users[(__VU - 1) % data.users.length]
  const a = authHeaders(u.token)
  group('market', () => routes.market.add(http.get(`${BASE_URL}/api/v1/market/stocks`, a).timings.duration))
  group('portfolio', () => routes.portfolio.add(http.get(`${BASE_URL}/api/v1/portfolio/me`, a).timings.duration))
  group('orders', () => routes.orders.add(http.get(`${BASE_URL}/api/v1/orders/my-orders`, a).timings.duration))
  group('me', () => routes.me.add(http.get(`${BASE_URL}/api/v1/users/me`, a).timings.duration))
}
export const handleSummary = summaryTo('api-latency')
