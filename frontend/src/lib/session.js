// Session persistence (localStorage) — guarded so it also works in non-browser tests.
const KEY = 'tradesphere.session'

export function loadSession(storage = globalThis.localStorage) {
  try {
    const raw = storage && storage.getItem(KEY)
    if (!raw) return null
    const s = JSON.parse(raw)
    return s && s.accessToken ? s : null
  } catch { return null }
}

export function saveSession(session, storage = globalThis.localStorage) {
  try { storage && storage.setItem(KEY, JSON.stringify(session)) } catch { /* private mode */ }
}

export function clearSession(storage = globalThis.localStorage) {
  try { storage && storage.removeItem(KEY) } catch { /* ignore */ }
}

/** Decode the JWT `exp` (no signature check — the gateway does that). */
export function isTokenExpired(token, now = Date.now()) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
    return !payload.exp || payload.exp * 1000 <= now
  } catch { return true }
}
