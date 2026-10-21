// LOAD: expected day-to-day traffic. Ramp up, hold steady, ramp down.
//   SLOs: p95 < 500 ms, p99 < 1.5 s, < 1% HTTP failures, > 97% of orders executed.
import { setupUsers, userJourney, summaryTo } from './lib/common.js'

const PEAK = Number(__ENV.PEAK_VUS || 50)
export const options = {
  scenarios: {
    load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: __ENV.RAMP || '2m', target: PEAK },
        { duration: __ENV.HOLD || '10m', target: PEAK },
        { duration: __ENV.RAMP_DOWN || '2m', target: 0 },
      ],
      gracefulRampDown: '30s',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<500', 'p(99)<1500'],
    'http_req_duration{name:POST /orders BUY}': ['p(95)<1500'],   // order path includes the AI fraud check
    business_errors: ['rate<0.03'],
    checks: ['rate>0.98'],
  },
}
export const setup = () => setupUsers()
export default userJourney
export const handleSummary = summaryTo('load')
