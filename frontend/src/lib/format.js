// Pure formatting helpers (unit-tested in tests/unit/frontend).

const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 })
const num = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 })

export function formatCurrency(value) {
  const n = Number(value)
  return Number.isFinite(n) ? inr.format(n) : '—'
}

export function formatNumber(value) {
  const n = Number(value)
  return Number.isFinite(n) ? num.format(n) : '—'
}

export function formatCompact(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return '—'
  const abs = Math.abs(n)
  if (abs >= 1e7) return (n / 1e7).toFixed(2) + ' Cr'
  if (abs >= 1e5) return (n / 1e5).toFixed(2) + ' L'
  if (abs >= 1e3) return (n / 1e3).toFixed(1) + 'K'
  return String(Math.round(n))
}

export function formatPercent(value, withSign = true) {
  const n = Number(value)
  if (!Number.isFinite(n)) return '—'
  const sign = withSign && n > 0 ? '+' : ''
  return `${sign}${n.toFixed(2)}%`
}

export function formatSigned(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return '—'
  return (n > 0 ? '+' : '') + inr.format(n)
}

export function formatDateTime(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

/** 'text-gain' | 'text-loss' | 'text-slate-400' */
export function changeClass(value) {
  const n = Number(value)
  if (!Number.isFinite(n) || n === 0) return 'text-slate-400'
  return n > 0 ? 'text-gain' : 'text-loss'
}

export function initials(first = '', last = '') {
  return ((first[0] || '') + (last[0] || '')).toUpperCase() || '?'
}
