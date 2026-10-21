import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { LayoutDashboard, CandlestickChart, ArrowLeftRight, ListOrdered, PieChart, LogOut, Wallet, Plus, Wifi, WifiOff } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { useMarket } from '../context/MarketContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { Logo, Modal, Spinner } from './ui.jsx'
import { formatCurrency } from '../lib/format.js'
import { initials } from '../lib/format.js'
import { validateAmount } from '../lib/validators.js'
import { extractErrorMessage } from '../lib/errors.js'

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/market', label: 'Market', icon: CandlestickChart },
  { to: '/trade', label: 'Trade', icon: ArrowLeftRight },
  { to: '/orders', label: 'Orders', icon: ListOrdered },
  { to: '/portfolio', label: 'Portfolio', icon: PieChart },
]

function LiveBadge() {
  const { status } = useMarket()
  const live = status === 'live'
  return (
    <span data-testid="live-status" className={`hidden items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset sm:inline-flex ${live ? 'bg-gain/10 text-gain ring-gain/30' : 'bg-amber-500/10 text-amber-400 ring-amber-500/30'}`}>
      {live ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
      {live ? 'Live prices' : status === 'polling' ? 'Polling' : 'Connecting…'}
      {live && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-gain" />}
    </span>
  )
}

function AddFundsModal({ open, onClose }) {
  const { api, session, refreshWallet } = useAuth()
  const toast = useToast()
  const [amount, setAmount] = useState('10000')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function submit(e) {
    e.preventDefault()
    const err = validateAmount(amount)
    if (err) return setError(err)
    setBusy(true); setError(null)
    try {
      await api.addFunds(session.userId, amount)
      await refreshWallet()
      toast.success('Funds added', `${formatCurrency(amount)} deposited to your wallet`)
      onClose()
    } catch (ex) {
      setError(extractErrorMessage(ex))
    } finally { setBusy(false) }
  }

  return (
    <Modal open={open} title="Add funds" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label" htmlFor="amount">Amount (₹)</label>
          <input id="amount" data-testid="funds-amount" className="input num" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
          {error && <p className="mt-1.5 text-xs text-loss" role="alert">{error}</p>}
        </div>
        <div className="flex gap-2">
          {[5000, 10000, 50000, 100000].map((v) => (
            <button type="button" key={v} onClick={() => setAmount(String(v))} className="btn-ghost flex-1 !px-2 !py-1.5 text-xs">{v >= 1000 ? `${v / 1000}K` : v}</button>
          ))}
        </div>
        <button className="btn-primary w-full" disabled={busy} data-testid="funds-submit">{busy ? <Spinner className="!text-ink-950" /> : <Plus className="h-4 w-4" />} Deposit</button>
      </form>
    </Modal>
  )
}

export default function Layout() {
  const { user, wallet, logout } = useAuth()
  const navigate = useNavigate()
  const [fundsOpen, setFundsOpen] = useState(false)

  return (
    <div className="flex min-h-full">
      {/* Sidebar (desktop) */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-ink-700/70 bg-ink-900/70 p-5 backdrop-blur lg:flex">
        <Logo />
        <nav className="mt-10 flex flex-1 flex-col gap-1" aria-label="Main">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end}
              className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition ${isActive ? 'bg-brand-500/15 text-brand-400 ring-1 ring-brand-500/30' : 'text-slate-400 hover:bg-ink-700/60 hover:text-white'}`}>
              <Icon className="h-[18px] w-[18px]" /> {label}
            </NavLink>
          ))}
        </nav>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-brand-500 to-sky-500 text-sm font-bold text-ink-950">{initials(user.firstName, user.lastName)}</div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white" data-testid="user-name">{user.firstName} {user.lastName}</p>
              <p className="truncate text-xs text-slate-400">{user.email}</p>
            </div>
          </div>
          <button onClick={() => { logout(); navigate('/login') }} data-testid="logout" className="btn-ghost mt-4 w-full !py-2"><LogOut className="h-4 w-4" /> Sign out</button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-ink-700/70 bg-ink-950/80 px-4 py-3 backdrop-blur-md sm:px-8">
          <div className="lg:hidden"><Logo /></div>
          <div className="hidden lg:block"><LiveBadge /></div>
          <div className="flex items-center gap-3">
            <div className="lg:hidden"><LiveBadge /></div>
            <div className="flex items-center gap-2 rounded-xl border border-ink-600 bg-ink-850 px-3 py-1.5">
              <Wallet className="h-4 w-4 text-brand-400" />
              <span className="text-xs text-slate-400">Wallet</span>
              <span className="num text-sm font-semibold text-white" data-testid="wallet-balance">{formatCurrency(wallet)}</span>
            </div>
            <button onClick={() => setFundsOpen(true)} className="btn-primary !px-3 !py-2" data-testid="add-funds"><Plus className="h-4 w-4" /><span className="hidden sm:inline">Add funds</span></button>
            <button onClick={() => { logout(); navigate('/login') }} aria-label="Sign out" className="btn-ghost !px-2.5 !py-2 lg:hidden"><LogOut className="h-4 w-4" /></button>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 pb-28 pt-6 sm:px-8 lg:pb-10">
          <Outlet />
        </main>

        {/* Bottom nav (mobile) */}
        <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-ink-700/70 bg-ink-900/95 backdrop-blur lg:hidden" aria-label="Mobile">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => `flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium ${isActive ? 'text-brand-400' : 'text-slate-400'}`}>
              <Icon className="h-5 w-5" /> {label}
            </NavLink>
          ))}
        </nav>
      </div>
      <AddFundsModal open={fundsOpen} onClose={() => setFundsOpen(false)} />
    </div>
  )
}
