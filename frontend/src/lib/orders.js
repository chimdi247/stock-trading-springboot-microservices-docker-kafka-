// Order helpers (pure).
export const STATUS_META = {
  EXECUTED: { label: 'Executed', tone: 'gain' },
  FAILED: { label: 'Failed', tone: 'loss' },
  FLAGGED: { label: 'Flagged by AI', tone: 'warn' },
  PENDING: { label: 'Pending', tone: 'info' },
  AI_CHECK: { label: 'AI check', tone: 'info' },
}

export function statusMeta(status) {
  return STATUS_META[status] || { label: status || 'Unknown', tone: 'info' }
}

export function estimateTotal(price, quantity) {
  const p = Number(price), q = Number(quantity)
  if (!Number.isFinite(p) || !Number.isFinite(q) || q < 1) return 0
  return Math.round(p * q * 100) / 100
}

/** Can the user afford a BUY, or own enough shares for a SELL? Returns an error string or null. */
export function checkOrderFeasibility({ type, total, quantity, walletBalance, ownedQuantity }) {
  if (type === 'BUY' && Number(total) > Number(walletBalance)) return 'Insufficient wallet balance for this order'
  if (type === 'SELL' && Number(quantity) > Number(ownedQuantity || 0)) return `You only own ${ownedQuantity || 0} share(s) of this stock`
  return null
}

export function summarizeOrders(orders = []) {
  const s = { total: orders.length, executed: 0, failed: 0, flagged: 0, volume: 0 }
  for (const o of orders) {
    if (o.status === 'EXECUTED') { s.executed++; s.volume += Number(o.totalAmount) || 0 }
    else if (o.status === 'FAILED') s.failed++
    else if (o.status === 'FLAGGED') s.flagged++
  }
  return s
}
