import { test, expect } from '@playwright/test'

// Verifies the provisioned Grafana setup via its HTTP API (admin / admin by default).
const GRAFANA = process.env.GRAFANA_URL || 'http://localhost:3001'
const auth = 'Basic ' + Buffer.from(`${process.env.GRAFANA_USER || 'admin'}:${process.env.GRAFANA_PASSWORD || 'admin'}`).toString('base64')
const headers = { Authorization: auth }

test.describe('grafana provisioning', () => {
  test('datasources: Prometheus, Loki and Tempo are provisioned', async ({ request }) => {
    const r = await request.get(`${GRAFANA}/api/datasources`, { headers })
    expect(r.ok()).toBeTruthy()
    const names = (await r.json()).map((d) => d.name)
    for (const n of ['Prometheus', 'Loki', 'Tempo']) expect(names).toContain(n)
  })

  test('dashboards: services, kafka, mysql, proxysql, redis exist', async ({ request }) => {
    const r = await request.get(`${GRAFANA}/api/search?type=dash-db`, { headers })
    const uids = (await r.json()).map((d) => d.uid)
    for (const u of ['trading-services-overview', 'trading-kafka', 'trading-mysql', 'trading-proxysql', 'trading-redis']) {
      expect(uids, `dashboard ${u}`).toContain(u)
    }
  })

  test('alert rules: container + node CPU/memory rules are provisioned', async ({ request }) => {
    const r = await request.get(`${GRAFANA}/api/v1/provisioning/alert-rules`, { headers })
    expect(r.ok()).toBeTruthy()
    const uids = (await r.json()).map((x) => x.uid)
    for (const u of ['container-cpu-high', 'container-memory-high', 'node-cpu-high', 'node-memory-high']) expect(uids).toContain(u)
  })

  test('contact point uses the e-mail integration', async ({ request }) => {
    const r = await request.get(`${GRAFANA}/api/v1/provisioning/contact-points`, { headers })
    const types = (await r.json()).map((c) => c.type)
    expect(types).toContain('email')
  })

  test('Prometheus datasource answers queries', async ({ request }) => {
    const r = await request.get(`${GRAFANA}/api/datasources/proxy/uid/prometheus/api/v1/query?query=up`, { headers })
    expect(r.ok()).toBeTruthy()
    expect((await r.json()).status).toBe('success')
  })
})
