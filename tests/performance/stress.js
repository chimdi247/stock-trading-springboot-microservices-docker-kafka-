// STRESS: push beyond normal load in steps to find where latency/errors start to degrade.
import { setupUsers, userJourney, summaryTo } from './lib/common.js'

export const options = {
  scenarios: {
    stress: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 50 },
        { duration: '3m', target: 100 },
        { duration: '3m', target: 200 },
        { duration: '3m', target: 300 },
        { duration: '3m', target: 400 },
        { duration: '3m', target: 0 },
      ],
      gracefulRampDown: '30s',
    },
  },
  // Looser thresholds: the goal is to OBSERVE the breaking region, not to stay green.
  thresholds: {
    http_req_failed: [{ threshold: 'rate<0.10', abortOnFail: true, delayAbortEval: '2m' }],
    http_req_duration: ['p(95)<3000'],
  },
}
export const setup = () => setupUsers(Number(__ENV.USERS || 50))
export default userJourney
export const handleSummary = summaryTo('stress')
