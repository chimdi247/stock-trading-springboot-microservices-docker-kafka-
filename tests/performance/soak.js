// SOAK / ENDURANCE: moderate constant load for hours — exposes memory leaks, connection-pool exhaustion,
// Kafka consumer lag build-up, disk growth (watch the Grafana dashboards while it runs).
//   DURATION=4h VUS=30 ./run-perf.sh soak
import { setupUsers, userJourney, summaryTo } from './lib/common.js'

export const options = {
  scenarios: {
    soak: {
      executor: 'constant-vus',
      vus: Number(__ENV.VUS || 30),
      duration: __ENV.DURATION || '1h',
      gracefulStop: '1m',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<600', 'p(99)<2000'],
    business_errors: ['rate<0.03'],
  },
}
export const setup = () => setupUsers()
export default userJourney
export const handleSummary = summaryTo('soak')
