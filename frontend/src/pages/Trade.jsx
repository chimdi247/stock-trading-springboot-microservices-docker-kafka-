import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip } from 'recharts'
import { CheckCircle2, XCircle, ShieldAlert } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { useMarket } from '../context/MarketContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { PageLoader, Spinner, StatusBadge } from '../components/ui.jsx'
import { formatCurrency, formatPercent, changeClass } from '../lib/format.js'
import { estimateTotal, checkOrderFeasibility } from '../lib/orders.js'
import { validateOrder } from '../lib/validators.js'
import { extractErrorMessage } from '../lib/errors.js'

export default function Trade() {
  const { api, session, wallet, refreshWallet } = useAuth()
  const { stocks, list, loading } = useMarket()
  const toast = useToast()
  const [params, setParams] = useSearchParams()
  const [side, setSide] = useState(params.get('side') === 'SELL' ? 'SELL' : 'BUY')
  const [quantity, setQuantity] = useState('1')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)
  const [holdings, setHoldings] = useState({})

  const symbol = params.get('symbol') || list[0]?.symbol || ''
  const stock = stocks[symbol]

  const loadHoldings = () =>
    api.portfolio().then((p) => setHoldings(Object.fromEntries((p.holdings || []).map((h) => [h.symbol, h.quantity])))).catch(() => {})
  useEffect(() => { loadHoldings() }, [api]) // eslint-disable-line react-hooks/exhaustive-deps

  const total = useMemo(() => estimateTotal(stock?.price, quantity), [stock?.price, quantity])
  const owned = holdings[symbol] || 0
  const chart = useMemo(() => (stock?.history || []).map((p, i) => ({ i, p })), [stock?.history])
  const up = Number(stock?.change) >= 0

  if (loading && !stock) return <PageLoader label="Loading market…" />

  async function submit(e) {
    e.preventDefault()
    const v = validateOrder({ symbol, quantity })
    if (Object.keys(v).length) return toast.error('Check your order', Object.values(v)[0])
    const blocked = checkOrderFeasibility({ type: side, total, quantity, walletBalance: wallet, ownedQuantity: owned })
    if (blocked) return toast.error('Cannot place order', blocked)

    setBusy(true); setResult(null)
    try {
      const order = await api.placeOrder({ userId: session.userId, symbol, type: side, quantity })
      setResult(order)
      if (order.status === 'EXECUTED') toast.success('Order executed', `${side} ${order.quantity} × ${order.symbol} @ ${formatCurrency(order.price)}`)
      else if (order.status === 'FLAGGED') toast.info('Order flagged by AI', order.aiReason || 'Held for review')
      else toast.error('Order failed', extractErrorMessage(order.failureReason, 'The order could not be completed'))
      await refreshWallet()
      // Portfolio is updated asynchronously from Kafka — give the consumer a moment
      setTimeout(loadHoldings, 1200)
    } catch (ex) {
      toast.error('Order rejected', extractErrorMessage(ex))
    } finally { setBusy(false) }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">Trade</h1>
        <p className="mt-1 text-slate-400">Orders execute at the live market price after an AI fraud check.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Chart */}
        <section className="card card-pad lg:col-span-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm text-slate-400">{stock?.companyName}</p>
              <p className="text-2xl font-bold text-white">{symbol}</p>
            </div>
            <div className="text-right">
              <p className="num text-3xl font-semibold text-white" data-testid="trade-price">{formatCurrency(stock?.price)}</p>
              <p className={`num text-sm font-semibold ${changeClass(stock?.change)}`}>{formatCurrency(stock?.change)} ({formatPercent(stock?.changePercent)})</p>
            </div>
          </div>
          <div className="mt-4 h-72">
            <ResponsiveContainer>
              <AreaChart data={chart} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="g" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor={up ? '#22c55e' : '#ef4444'} stopOpacity={0.35} /><stop offset="100%" stopColor={up ? '#22c55e' : '#ef4444'} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="i" hide />
                <YAxis domain={['auto', 'auto']} width={64} tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => v.toFixed(0)} />
                <Tooltip formatter={(v) => formatCurrency(v)} labelFormatter={() => ''} contentStyle={{ background: '#0f1829', border: '1px solid #26374f', borderRadius: 12 }} />
                <Area type="monotone" dataKey="p" stroke={up ? '#22c55e' : '#ef4444'} strokeWidth={2} fill="url(#g)" isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 grid grid-cols-3 gap-3 text-center text-sm">
            {[['Open', stock?.open], ['High', stock?.high], ['Low', stock?.low]].map(([k, v]) => (
              <div key={k} className="rounded-xl bg-ink-900/70 py-2.5"><p className="text-xs text-slate-400">{k}</p><p className="num font-semibold text-white">{formatCurrency(v)}</p></div>
            ))}
          </div>
        </section>

        {/* Order ticket */}
        <section className="card card-pad lg:col-span-2">
          <div className="grid grid-cols-2 gap-2 rounded-xl bg-ink-900 p-1" role="tablist">
            {['BUY', 'SELL'].map((s) => (
              <button key={s} role="tab" aria-selected={side === s} data-testid={`side-${s}`} onClick={() => setSide(s)}
                className={`rounded-lg py-2.5 text-sm font-bold transition ${side === s ? (s === 'BUY' ? 'bg-gain text-ink-950' : 'bg-loss text-white') : 'text-slate-400 hover:text-white'}`}>{s}</button>
            ))}
          </div>

          <form onSubmit={submit} className="mt-5 space-y-4">
            <div>
              <label className="label" htmlFor="symbol">Stock</label>
              <select id="symbol" className="input" value={symbol} data-testid="symbol-select"
                onChange={(e) => setParams({ symbol: e.target.value, side })}>
                {list.map((s) => <option key={s.symbol} value={s.symbol}>{s.symbol} — {s.companyName}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="qty">Quantity</label>
              <input id="qty" type="number" min="1" step="1" className="input num" value={quantity} onChange={(e) => setQuantity(e.target.value)} data-testid="qty-input" />
              <p className="mt-1.5 text-xs text-slate-400">You own <b className="text-slate-200">{owned}</b> share{owned === 1 ? '' : 's'} of {symbol}</p>
            </div>

            <dl className="space-y-2 rounded-xl bg-ink-900/70 p-4 text-sm">
              <div className="flex justify-between"><dt className="text-slate-400">Market price</dt><dd className="num text-white">{formatCurrency(stock?.price)}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-400">Quantity</dt><dd className="num text-white">{Number(quantity) || 0}</dd></div>
              <div className="flex justify-between border-t border-ink-700 pt-2"><dt className="font-medium text-slate-200">Estimated total</dt><dd className="num text-lg font-semibold text-white" data-testid="order-total">{formatCurrency(total)}</dd></div>
              <div className="flex justify-between text-xs"><dt className="text-slate-500">Wallet after order</dt><dd className="num text-slate-300">{formatCurrency(side === 'BUY' ? wallet - total : Number(wallet) + total)}</dd></div>
            </dl>

            <button className={side === 'BUY' ? 'btn-buy w-full !py-3' : 'btn-sell w-full !py-3'} disabled={busy || !stock} data-testid="place-order">
              {busy ? <><Spinner className="!text-current" /> Checking & executing…</> : `${side === 'BUY' ? 'Buy' : 'Sell'} ${symbol}`}
            </button>
            <p className="text-center text-xs text-slate-500">Final price is the market price at execution time.</p>
          </form>

          {result && (
            <div className="mt-5 animate-slideIn rounded-xl border border-ink-600 bg-ink-900/70 p-4" data-testid="order-result">
              <div className="flex items-center gap-2">
                {result.status === 'EXECUTED' ? <CheckCircle2 className="h-5 w-5 text-gain" /> : result.status === 'FLAGGED' ? <ShieldAlert className="h-5 w-5 text-amber-400" /> : <XCircle className="h-5 w-5 text-loss" />}
                <p className="font-semibold text-white">Order {result.status.toLowerCase()}</p><StatusBadge status={result.status} />
              </div>
              <p className="num mt-2 text-sm text-slate-300">{result.type} {result.quantity} × {result.symbol} @ {formatCurrency(result.price)} = {formatCurrency(result.totalAmount)}</p>
              {result.status === 'FAILED' && <p className="mt-1 text-sm text-red-300">{extractErrorMessage(result.failureReason)}</p>}
              {result.status === 'FLAGGED' && <p className="mt-1 text-sm text-amber-300">{result.aiReason}</p>}
              <p className="mt-1 text-[11px] text-slate-500">Order ID {result.id}</p>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
