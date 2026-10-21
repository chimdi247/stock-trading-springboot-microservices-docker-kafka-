import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { PieChart as PieIcon, TrendingUp, TrendingDown } from 'lucide-react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis } from 'recharts'
import { useAuth } from '../context/AuthContext.jsx'
import { EmptyState, PageLoader, StatCard } from '../components/ui.jsx'
import { formatCurrency, formatPercent, formatSigned, changeClass } from '../lib/format.js'

const COLORS = ['#2dd4bf', '#38bdf8', '#a78bfa', '#f472b6', '#fbbf24', '#fb923c']

export default function Portfolio() {
  const { api } = useAuth()
  const [p, setP] = useState(null)

  useEffect(() => {
    let off = false
    const load = () => api.portfolio().then((d) => !off && setP(d)).catch(() => !off && setP((x) => x || { holdings: [] }))
    load()
    const id = setInterval(load, 5000) // live P&L: prices move every 2s
    return () => { off = true; clearInterval(id) }
  }, [api])

  if (!p) return <PageLoader label="Loading portfolio…" />
  const holdings = p.holdings || []
  const pnl = Number(p.totalPnl || 0)
  const pie = holdings.map((h) => ({ name: h.symbol, value: Number(h.currentValue) }))
  const bars = holdings.map((h) => ({ name: h.symbol, pnl: Number(h.pnl) }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">Portfolio</h1>
        <p className="mt-1 text-slate-400">Holdings with live profit &amp; loss.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Current value" value={formatCurrency(p.currentValue)} />
        <StatCard label="Invested" value={formatCurrency(p.totalInvested)} />
        <StatCard label="Total P&L" value={formatSigned(pnl)} tone={changeClass(pnl)} icon={pnl >= 0 ? TrendingUp : TrendingDown} />
        <StatCard label="Return" value={formatPercent(p.totalPnlPercent)} tone={changeClass(pnl)} />
      </div>

      {holdings.length === 0 ? (
        <div className="card"><EmptyState icon={PieIcon} title="Your portfolio is empty" hint="Holdings appear here a moment after a BUY order executes." action={<Link to="/trade" className="btn-primary mt-2">Buy a stock</Link>} /></div>
      ) : (
        <>
          <div className="grid gap-6 lg:grid-cols-2">
            <section className="card card-pad">
              <h2 className="mb-2 font-semibold text-white">Allocation</h2>
              <div className="h-64"><ResponsiveContainer><PieChart>
                <Pie data={pie} dataKey="value" nameKey="name" innerRadius={60} outerRadius={95} paddingAngle={3} stroke="none">{pie.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie>
                <Tooltip formatter={(v) => formatCurrency(v)} contentStyle={{ background: '#0f1829', border: '1px solid #26374f', borderRadius: 12 }} />
              </PieChart></ResponsiveContainer></div>
            </section>
            <section className="card card-pad">
              <h2 className="mb-2 font-semibold text-white">P&amp;L by holding</h2>
              <div className="h-64"><ResponsiveContainer><BarChart data={bars}>
                <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} width={56} />
                <Tooltip formatter={(v) => formatSigned(v)} cursor={{ fill: 'rgba(255,255,255,.04)' }} contentStyle={{ background: '#0f1829', border: '1px solid #26374f', borderRadius: 12 }} />
                <Bar dataKey="pnl" radius={[6, 6, 0, 0]}>{bars.map((b, i) => <Cell key={i} fill={b.pnl >= 0 ? '#22c55e' : '#ef4444'} />)}</Bar>
              </BarChart></ResponsiveContainer></div>
            </section>
          </div>

          <section className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px]" data-testid="holdings-table">
                <thead><tr className="bg-ink-900/60"><th className="th">Symbol</th><th className="th text-right">Qty</th><th className="th text-right">Avg buy</th><th className="th text-right">Price</th><th className="th text-right">Value</th><th className="th text-right">P&amp;L</th><th className="th text-right">Return</th><th className="th" /></tr></thead>
                <tbody className="divide-y divide-ink-700/50">
                  {holdings.map((h) => (
                    <tr key={h.symbol} className="hover:bg-ink-800/50" data-testid="holding-row">
                      <td className="td font-semibold text-white">{h.symbol}</td>
                      <td className="td num text-right">{h.quantity}</td>
                      <td className="td num text-right">{formatCurrency(h.averageBuyPrice)}</td>
                      <td className="td num text-right">{formatCurrency(h.currentPrice)}</td>
                      <td className="td num text-right font-semibold text-white">{formatCurrency(h.currentValue)}</td>
                      <td className={`td num text-right ${changeClass(h.pnl)}`}>{formatSigned(h.pnl)}</td>
                      <td className={`td num text-right font-semibold ${changeClass(h.pnl)}`}>{formatPercent(h.pnlPercent)}</td>
                      <td className="td text-right"><Link to={`/trade?symbol=${h.symbol}&side=SELL`} className="btn-ghost !px-3 !py-1.5 text-xs">Sell</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  )
}
