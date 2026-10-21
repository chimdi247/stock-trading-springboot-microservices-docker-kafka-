import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Wallet, TrendingUp, TrendingDown, Briefcase, ListChecks, ArrowRight } from 'lucide-react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { useAuth } from '../context/AuthContext.jsx'
import { useMarket } from '../context/MarketContext.jsx'
import { StatCard, StatusBadge, TypeBadge, PageLoader, Sparkline, EmptyState } from '../components/ui.jsx'
import { formatCurrency, formatPercent, formatSigned, changeClass, formatDateTime } from '../lib/format.js'
import { summarizeOrders } from '../lib/orders.js'

const COLORS = ['#2dd4bf', '#38bdf8', '#a78bfa', '#f472b6', '#fbbf24', '#fb923c']

export default function Dashboard() {
  const { api, wallet, session } = useAuth()
  const { list } = useMarket()
  const [portfolio, setPortfolio] = useState(null)
  const [orders, setOrders] = useState(null)

  useEffect(() => {
    let off = false
    Promise.allSettled([api.portfolio(), api.myOrders()]).then(([p, o]) => {
      if (off) return
      setPortfolio(p.status === 'fulfilled' ? p.value : { holdings: [], currentValue: 0, totalInvested: 0, totalPnl: 0, totalPnlPercent: 0 })
      setOrders(o.status === 'fulfilled' ? o.value : [])
    })
    return () => { off = true }
  }, [api])

  if (!portfolio || !orders) return <PageLoader label="Loading your dashboard…" />

  const s = summarizeOrders(orders)
  const net = Number(wallet) + Number(portfolio.currentValue || 0)
  const movers = [...list].sort((a, b) => Math.abs(Number(b.changePercent)) - Math.abs(Number(a.changePercent))).slice(0, 4)
  const alloc = (portfolio.holdings || []).map((h) => ({ name: h.symbol, value: Number(h.currentValue) }))
  const pnl = Number(portfolio.totalPnl || 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">Good to see you, {session.firstName} 👋</h1>
        <p className="mt-1 text-slate-400">Here’s how your account looks right now.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard testId="kpi-networth" label="Net worth" value={formatCurrency(net)} sub="Wallet + holdings" icon={Briefcase} />
        <StatCard label="Wallet cash" value={formatCurrency(wallet)} sub="Available to trade" icon={Wallet} />
        <StatCard label="Holdings value" value={formatCurrency(portfolio.currentValue)} sub={`Invested ${formatCurrency(portfolio.totalInvested)}`} icon={ListChecks} />
        <StatCard label="Total P&L" value={formatSigned(pnl)} tone={changeClass(pnl)} icon={pnl >= 0 ? TrendingUp : TrendingDown}
          sub={formatPercent(portfolio.totalPnlPercent)} />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <section className="card xl:col-span-2">
          <div className="flex items-center justify-between border-b border-ink-700/70 px-5 py-4">
            <h2 className="font-semibold text-white">Market movers</h2>
            <Link to="/market" className="flex items-center gap-1 text-sm text-brand-400 hover:underline">All stocks <ArrowRight className="h-4 w-4" /></Link>
          </div>
          <div className="grid gap-px bg-ink-700/40 sm:grid-cols-2">
            {movers.length === 0 && <div className="col-span-2"><PageLoader label="Waiting for prices…" /></div>}
            {movers.map((m) => (
              <Link key={m.symbol} to={`/trade?symbol=${m.symbol}`} className="flex items-center justify-between gap-3 bg-ink-850 p-5 transition hover:bg-ink-800">
                <div>
                  <p className="font-semibold text-white">{m.symbol}</p>
                  <p className="text-xs text-slate-400">{m.companyName}</p>
                  <p className={`num mt-2 text-sm font-semibold ${changeClass(m.changePercent)}`}>{formatPercent(m.changePercent)}</p>
                </div>
                <div className="text-right">
                  <p className="num text-lg font-semibold text-white">{formatCurrency(m.price)}</p>
                  <Sparkline data={m.history} up={Number(m.change) >= 0} width={110} height={32} />
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section className="card card-pad">
          <h2 className="font-semibold text-white">Allocation</h2>
          {alloc.length === 0 ? (
            <EmptyState title="No holdings yet" hint="Buy your first stock to see your allocation." action={<Link to="/trade" className="btn-primary mt-2">Start trading</Link>} />
          ) : (
            <>
              <div className="h-52">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={alloc} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={3} stroke="none">
                      {alloc.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v) => formatCurrency(v)} contentStyle={{ background: '#0f1829', border: '1px solid #26374f', borderRadius: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="mt-2 space-y-1.5 text-sm">
                {alloc.map((a, i) => (
                  <li key={a.name} className="flex items-center justify-between">
                    <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />{a.name}</span>
                    <span className="num text-slate-300">{formatCurrency(a.value)}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </div>

      <section className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-ink-700/70 px-5 py-4">
          <h2 className="font-semibold text-white">Recent orders <span className="ml-2 text-xs font-normal text-slate-400">{s.executed} executed · {s.failed} failed · {s.flagged} flagged</span></h2>
          <Link to="/orders" className="flex items-center gap-1 text-sm text-brand-400 hover:underline">View all <ArrowRight className="h-4 w-4" /></Link>
        </div>
        {orders.length === 0 ? <EmptyState title="No orders yet" hint="Your executed trades will show up here." /> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead><tr className="bg-ink-900/60"><th className="th">Time</th><th className="th">Symbol</th><th className="th">Side</th><th className="th text-right">Qty</th><th className="th text-right">Total</th><th className="th">Status</th></tr></thead>
              <tbody className="divide-y divide-ink-700/50">
                {orders.slice(0, 5).map((o) => (
                  <tr key={o.id} className="hover:bg-ink-800/50">
                    <td className="td text-slate-400">{formatDateTime(o.createdAt)}</td>
                    <td className="td font-semibold text-white">{o.symbol}</td>
                    <td className="td"><TypeBadge type={o.type} /></td>
                    <td className="td num text-right">{o.quantity}</td>
                    <td className="td num text-right">{formatCurrency(o.totalAmount)}</td>
                    <td className="td"><StatusBadge status={o.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
