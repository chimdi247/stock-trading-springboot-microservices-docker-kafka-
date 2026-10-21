import { Loader2, TrendingUp } from 'lucide-react'
import { useEffect } from 'react'
import { X } from 'lucide-react'
import { statusMeta } from '../lib/orders.js'

export function Spinner({ className = '' }) {
  return <Loader2 className={`h-5 w-5 animate-spin text-brand-400 ${className}`} aria-label="Loading" />
}

export function PageLoader({ label = 'Loading…' }) {
  return (
    <div className="flex h-64 items-center justify-center gap-3 text-slate-400">
      <Spinner /> <span className="text-sm">{label}</span>
    </div>
  )
}

export function Logo({ size = 'md' }) {
  const s = size === 'lg' ? 'h-11 w-11' : 'h-9 w-9'
  return (
    <div className="flex items-center gap-3">
      <div className={`${s} grid place-items-center rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 text-ink-950 shadow-glow`}>
        <TrendingUp className="h-5 w-5" strokeWidth={2.6} />
      </div>
      <div className="leading-tight">
        <p className="text-base font-bold tracking-tight text-white">TradeSphere</p>
        <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Trading platform</p>
      </div>
    </div>
  )
}

const TONES = {
  gain: 'bg-gain/15 text-gain ring-gain/30',
  loss: 'bg-loss/15 text-loss ring-loss/30',
  warn: 'bg-amber-500/15 text-amber-400 ring-amber-500/30',
  info: 'bg-sky-500/15 text-sky-300 ring-sky-500/30',
  neutral: 'bg-slate-500/15 text-slate-300 ring-slate-500/30',
}
export function Badge({ tone = 'neutral', children, className = '' }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${TONES[tone]} ${className}`}>{children}</span>
}
export function StatusBadge({ status }) {
  const m = statusMeta(status)
  return <Badge tone={m.tone}>{m.label}</Badge>
}
export function TypeBadge({ type }) {
  return <Badge tone={type === 'BUY' ? 'gain' : 'loss'}>{type}</Badge>
}

export function StatCard({ label, value, sub, icon: Icon, tone = 'text-white', testId }) {
  return (
    <div className="card card-pad" data-testid={testId}>
      <div className="flex items-start justify-between">
        <p className="label !mb-0">{label}</p>
        {Icon && <span className="grid h-8 w-8 place-items-center rounded-lg bg-ink-700/70 text-brand-400"><Icon className="h-4 w-4" /></span>}
      </div>
      <p className={`num mt-3 text-2xl font-semibold ${tone}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-slate-400">{sub}</p>}
    </div>
  )
}

export function Modal({ open, title, onClose, children }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm" onMouseDown={onClose} role="dialog" aria-modal="true" aria-label={title}>
      <div className="card w-full max-w-md animate-slideIn p-6" onMouseDown={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="text-slate-400 hover:text-white"><X className="h-5 w-5" /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function EmptyState({ icon: Icon, title, hint, action }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
      {Icon && <span className="grid h-12 w-12 place-items-center rounded-2xl bg-ink-700/70 text-slate-400"><Icon className="h-6 w-6" /></span>}
      <p className="font-semibold text-slate-200">{title}</p>
      {hint && <p className="max-w-sm text-sm text-slate-400">{hint}</p>}
      {action}
    </div>
  )
}

/** Dependency-free sparkline (cheap to re-render on every tick). */
export function Sparkline({ data = [], up = true, width = 120, height = 36 }) {
  if (data.length < 2) return <svg width={width} height={height} aria-hidden="true" />
  const min = Math.min(...data), max = Math.max(...data)
  const span = max - min || 1
  const pts = data.map((v, i) => `${((i / (data.length - 1)) * width).toFixed(1)},${(height - 3 - ((v - min) / span) * (height - 6)).toFixed(1)}`)
  const color = up ? '#22c55e' : '#ef4444'
  const id = `sg-${up ? 'u' : 'd'}`
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity=".35" /><stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,${height} ${pts.join(' ')} ${width},${height}`} fill={`url(#${id})`} />
      <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}
