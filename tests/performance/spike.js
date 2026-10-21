// SPIKE: sudden surge (market open!) then drop. Checks autoscaling-free resilience and recovery time.
import { setupUsers, userJourney, summaryTo } from './lib/common.js'

export const options = {
  scenarios: {
    spike: {
      executor: 'ramping-vus',
      startVUs: 10,
      stages: [
        { duration: '1m',  target: 10 },    // baseline
        { duration: '20s', target: 300 },   // spike up
        { duration: '2m',  target: 300 },   // hold the spike
        { duration: '20s', target: 10 },    // spike down
        { duration: '3m',  target: 10 },    // recovery: latency must return to baseline
        { duration: '20s', target: 0 },
      ],
      gracefulRampDown: '30s',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.05'],
    http_req_duration: ['p(95)<2500'],
    'http_req_duration{name:GET /market/stocks}': ['p(95)<1000'],
  },
}
export const setup = () => setupUsers(Number(__ENV.USERS || 50))
export default userJourney
export const handleSummary = summaryTo('spike')
