import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, ArrowUpRight } from 'lucide-react'
import { useMarket } from '../context/MarketContext.jsx'
import { PageLoader, Sparkline } from '../components/ui.jsx'
import { formatCurrency, formatPercent, formatNumber, formatCompact, changeClass } from '../lib/format.js'

function Row({ s }) {
  const [flash, setFlash] = useState('')
  const first = useRef(true)
  useEffect(() => {
    if (first.current) { first.current = false; return }
    if (!s.dir) return
    setFlash(s.dir === 'up' ? 'animate-flashUp' : 'animate-flashDown')
    const t = setTimeout(() => setFlash(''), 900)
    return () => clearTimeout(t)
  }, [s.tick]) // eslint-disable-line react-hooks/exhaustive-deps
  const up = Number(s.change) >= 0
  return (
    <tr className="group hover:bg-ink-800/50" data-testid={`stock-row-${s.symbol}`}>
      <td className="td">
        <p className="font-semibold text-white">{s.symbol}</p>
        <p className="text-xs text-slate-400">{s.companyName}</p>
      </td>
      <td className={`td num text-right text-base font-semibold text-white ${flash}`} data-testid={`price-${s.symbol}`}>{formatCurrency(s.price)}</td>
      <td className={`td num text-right ${changeClass(s.change)}`}>{up && Number(s.change) > 0 ? '+' : ''}{formatNumber(s.change)}</td>
      <td className={`td num text-right font-semibold ${changeClass(s.changePercent)}`}>{formatPercent(s.changePercent)}</td>
      <td className="td num hidden text-right text-slate-300 md:table-cell">{formatNumber(s.high)} / {formatNumber(s.low)}</td>
      <td className="td num hidden text-right text-slate-300 lg:table-cell">{formatCompact(s.volume)}</td>
      <td className="td hidden sm:table-cell"><Sparkline data={s.history} up={up} /></td>
      <td className="td text-right">
        <Link to={`/trade?symbol=${s.symbol}`} className="btn-ghost !px-3 !py-1.5 text-xs" data-testid={`trade-${s.symbol}`}>Trade <ArrowUpRight className="h-3.5 w-3.5" /></Link>
      </td>
    </tr>
  )
}

export default function Market() {
  const { list, loading, status } = useMarket()
  const [q, setQ] = useState('')
  const filtered = list.filter((s) => (s.symbol + s.companyName).toLowerCase().includes(q.toLowerCase()))

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">Market</h1>
          <p className="mt-1 text-slate-400">{status === 'live' ? 'Prices update in real time over WebSocket.' : 'Prices refresh every few seconds.'}</p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input className="input !pl-10" placeholder="Search symbol or company" value={q} onChange={(e) => setQ(e.target.value)} data-testid="market-search" />
        </div>
      </div>

      <div className="card overflow-hidden">
        {loading && list.length === 0 ? <PageLoader label="Loading prices…" /> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px]">
              <thead><tr className="bg-ink-900/60">
                <th className="th">Stock</th><th className="th text-right">Price</th><th className="th text-right">Change</th><th className="th text-right">Change %</th>
                <th className="th hidden text-right md:table-cell">High / Low</th><th className="th hidden text-right lg:table-cell">Volume</th><th className="th hidden sm:table-cell">Trend</th><th className="th" />
              </tr></thead>
              <tbody className="divide-y divide-ink-700/50">
                {filtered.map((s) => <Row key={s.symbol} s={s} />)}
                {filtered.length === 0 && <tr><td colSpan={8} className="td py-10 text-center text-slate-400">No stocks match “{q}”.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
