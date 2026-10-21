// BREAKPOINT / CAPACITY: raise the ARRIVAL RATE (req/s) until thresholds fail; the last good rate is the capacity.
import { setupUsers, browse, pickUser, summaryTo } from './lib/common.js'

export const options = {
  scenarios: {
    breakpoint: {
      executor: 'ramping-arrival-rate',
      startRate: 10,
      timeUnit: '1s',
      preAllocatedVUs: 200,
      maxVUs: 1500,
      stages: [{ duration: '15m', target: 600 }],
    },
  },
  thresholds: {
    http_req_failed: [{ threshold: 'rate<0.05', abortOnFail: true, delayAbortEval: '30s' }],
    http_req_duration: [{ threshold: 'p(95)<2000', abortOnFail: true, delayAbortEval: '30s' }],
  },
}
export const setup = () => setupUsers(Number(__ENV.USERS || 50))
export default function (data) { browse(pickUser(data)) }
export const handleSummary = summaryTo('breakpoint')
