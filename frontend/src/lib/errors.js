// Turn whatever the backend sends into a short, human message.
// Order failures come back as Feign strings like:
//   [422] during [POST] to [http://user-service...]: [{"status":422,"message":"Insufficient wallet balance"}]

export function extractErrorMessage(input, fallback = 'Something went wrong') {
  if (!input) return fallback
  const raw = typeof input === 'string' ? input : input.message || ''
  if (!raw) return fallback
  const m = raw.match(/"message"\s*:\s*"([^"]+)"/)
  if (m) return m[1]
  return raw.length > 160 ? raw.slice(0, 157) + '…' : raw
}

export function isUnauthorized(status) {
  return status === 401 || status === 403
}
