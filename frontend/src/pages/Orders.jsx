import { useEffect, useMemo, useState } from 'react'
import { RefreshCw, ListOrdered } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { EmptyState, PageLoader, StatusBadge, TypeBadge, StatCard } from '../components/ui.jsx'
import { formatCurrency, formatDateTime } from '../lib/format.js'
import { summarizeOrders } from '../lib/orders.js'
import { extractErrorMessage } from '../lib/errors.js'

const FILTERS = ['ALL', 'EXECUTED', 'FAILED', 'FLAGGED']

export default function Orders() {
  const { api } = useAuth()
  const [orders, setOrders] = useState(null)
  const [filter, setFilter] = useState('ALL')
  const [error, setError] = useState(null)
  const [spin, setSpin] = useState(false)

  const load = async () => {
    setSpin(true)
    try { setOrders(await api.myOrders()); setError(null) } catch (e) { setError(extractErrorMessage(e)); setOrders((o) => o || []) } finally { setSpin(false) }
  }
  useEffect(() => { load() }, [api]) // eslint-disable-line react-hooks/exhaustive-deps

  const rows = useMemo(() => (orders || []).filter((o) => filter === 'ALL' || o.status === filter), [orders, filter])
  if (!orders) return <PageLoader label="Loading orders…" />
  const s = summarizeOrders(orders)

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">Orders</h1>
          <p className="mt-1 text-slate-400">Your complete trade history.</p>
        </div>
        <button onClick={load} className="btn-ghost" data-testid="refresh-orders"><RefreshCw className={`h-4 w-4 ${spin ? 'animate-spin' : ''}`} /> Refresh</button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total orders" value={s.total} />
        <StatCard label="Executed" value={s.executed} tone="text-gain" />
        <StatCard label="Failed / flagged" value={`${s.failed} / ${s.flagged}`} tone={s.failed + s.flagged ? 'text-amber-400' : 'text-white'} />
        <StatCard label="Executed volume" value={formatCurrency(s.volume)} />
      </div>
      {error && <div role="alert" className="rounded-xl border border-loss/40 bg-loss/10 px-4 py-3 text-sm text-red-300">{error}</div>}

      <div className="card overflow-hidden">
        <div className="flex gap-2 border-b border-ink-700/70 p-3">
          {FILTERS.map((f) => (
            <button key={f} onClick={() => setFilter(f)} data-testid={`filter-${f}`}
              className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${filter === f ? 'bg-brand-500/15 text-brand-400 ring-1 ring-brand-500/30' : 'text-slate-400 hover:bg-ink-700/60'}`}>{f === 'ALL' ? 'All' : f[0] + f.slice(1).toLowerCase()}</button>
          ))}
        </div>
        {rows.length === 0 ? <EmptyState icon={ListOrdered} title="No orders to show" hint={filter === 'ALL' ? 'Place your first trade from the Trade page.' : 'No orders with this status.'} /> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px]" data-testid="orders-table">
              <thead><tr className="bg-ink-900/60"><th className="th">Time</th><th className="th">Symbol</th><th className="th">Side</th><th className="th text-right">Qty</th><th className="th text-right">Price</th><th className="th text-right">Total</th><th className="th">Status</th><th className="th">Details</th></tr></thead>
              <tbody className="divide-y divide-ink-700/50">
                {rows.map((o) => (
                  <tr key={o.id} className="hover:bg-ink-800/50" data-testid="order-row">
                    <td className="td whitespace-nowrap text-slate-400">{formatDateTime(o.createdAt)}</td>
                    <td className="td font-semibold text-white">{o.symbol}</td>
                    <td className="td"><TypeBadge type={o.type} /></td>
                    <td className="td num text-right">{o.quantity}</td>
                    <td className="td num text-right">{formatCurrency(o.price)}</td>
                    <td className="td num text-right font-semibold text-white">{formatCurrency(o.totalAmount)}</td>
                    <td className="td"><StatusBadge status={o.status} /></td>
                    <td className="td max-w-[260px] truncate text-xs text-slate-400" title={o.failureReason || o.aiReason || ''}>{o.status === 'FAILED' ? extractErrorMessage(o.failureReason, '') : o.aiReason || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
