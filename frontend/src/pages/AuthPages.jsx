import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Mail, Lock, User, ArrowRight, ShieldCheck, Zap, LineChart } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { Logo, Spinner } from '../components/ui.jsx'
import { validateLogin, validateRegistration } from '../lib/validators.js'
import { extractErrorMessage } from '../lib/errors.js'

function Shell({ title, subtitle, children, footer }) {
  return (
    <div className="grid min-h-full lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-ink-900 via-ink-850 to-ink-950 p-12 lg:flex lg:flex-col lg:justify-between">
        <div className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-brand-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-40 -left-20 h-96 w-96 rounded-full bg-sky-500/10 blur-3xl" />
        <Logo size="lg" />
        <div className="relative max-w-md space-y-8">
          <h2 className="text-4xl font-bold leading-tight tracking-tight text-white">Trade smarter with <span className="text-brand-400">live market data</span>.</h2>
          <ul className="space-y-5 text-slate-300">
            <li className="flex gap-4"><Zap className="mt-0.5 h-5 w-5 shrink-0 text-brand-400" /><span><b className="text-white">Real-time prices</b> streamed over WebSockets, no refresh needed.</span></li>
            <li className="flex gap-4"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-brand-400" /><span><b className="text-white">AI fraud checks</b> screen every order before it executes.</span></li>
            <li className="flex gap-4"><LineChart className="mt-0.5 h-5 w-5 shrink-0 text-brand-400" /><span><b className="text-white">Live portfolio P&amp;L</b> across all of your holdings.</span></li>
          </ul>
        </div>
        <p className="relative text-xs text-slate-500">Simulated market · Demo platform</p>
      </div>
      <div className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md animate-slideIn">
          <div className="mb-8 lg:hidden"><Logo /></div>
          <h1 className="text-3xl font-bold tracking-tight text-white">{title}</h1>
          <p className="mt-2 text-slate-400">{subtitle}</p>
          <div className="mt-8">{children}</div>
          <div className="mt-6 text-center text-sm text-slate-400">{footer}</div>
        </div>
      </div>
    </div>
  )
}

function Field({ id, label, icon: Icon, error, ...props }) {
  return (
    <div>
      <label className="label" htmlFor={id}>{label}</label>
      <div className="relative">
        {Icon && <Icon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />}
        <input id={id} name={id} className={`input ${Icon ? '!pl-10' : ''} ${error ? '!border-loss' : ''}`} aria-invalid={!!error} {...props} />
      </div>
      {error && <p className="mt-1.5 text-xs text-loss" role="alert">{error}</p>}
    </div>
  )
}

export function LoginPage() {
  const { login, isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [form, setForm] = useState({ email: '', password: '' })
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState(null)
  const [busy, setBusy] = useState(false)

  if (isAuthenticated) return <Navigate to={location.state?.from || '/'} replace />

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  async function submit(e) {
    e.preventDefault()
    const v = validateLogin(form)
    setErrors(v); setFormError(null)
    if (Object.keys(v).length) return
    setBusy(true)
    try {
      await login(form.email, form.password)
      navigate(location.state?.from || '/', { replace: true })
    } catch (ex) {
      setFormError(extractErrorMessage(ex, 'Unable to sign in'))
    } finally { setBusy(false) }
  }

  return (
    <Shell title="Welcome back" subtitle="Sign in to your trading account"
      footer={<>New here? <Link to="/register" className="font-semibold text-brand-400 hover:underline">Create an account</Link></>}>
      <form onSubmit={submit} className="space-y-5" noValidate>
        <Field id="email" label="E-mail" icon={Mail} type="email" autoComplete="email" placeholder="you@example.com" value={form.email} onChange={set('email')} error={errors.email} data-testid="login-email" />
        <Field id="password" label="Password" icon={Lock} type="password" autoComplete="current-password" placeholder="••••••••" value={form.password} onChange={set('password')} error={errors.password} data-testid="login-password" />
        {formError && <div role="alert" data-testid="login-error" className="rounded-xl border border-loss/40 bg-loss/10 px-4 py-3 text-sm text-red-300">{formError}</div>}
        <button className="btn-primary w-full" disabled={busy} data-testid="login-submit">{busy ? <Spinner className="!text-ink-950" /> : <>Sign in <ArrowRight className="h-4 w-4" /></>}</button>
        <button type="button" className="btn-ghost w-full text-xs" data-testid="fill-demo"
          onClick={() => setForm({ email: 'admin@example.com', password: 'password123' })}>
          Use demo account (admin@example.com)
        </button>
      </form>
    </Shell>
  )
}

export function RegisterPage() {
  const { register, isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', password: '', initialDeposit: '10000' })
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState(null)
  const [busy, setBusy] = useState(false)

  if (isAuthenticated) return <Navigate to="/" replace />
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  async function submit(e) {
    e.preventDefault()
    const v = validateRegistration(form)
    setErrors(v); setFormError(null)
    if (Object.keys(v).length) return
    setBusy(true)
    try {
      await register({ ...form, email: form.email.trim(), initialDeposit: Number(form.initialDeposit || 0) })
      navigate('/', { replace: true })
    } catch (ex) {
      setFormError(extractErrorMessage(ex, 'Unable to create account'))
    } finally { setBusy(false) }
  }

  return (
    <Shell title="Create your account" subtitle="Start with a simulated wallet — no real money involved"
      footer={<>Already registered? <Link to="/login" className="font-semibold text-brand-400 hover:underline">Sign in</Link></>}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <div className="grid grid-cols-2 gap-4">
          <Field id="firstName" label="First name" icon={User} value={form.firstName} onChange={set('firstName')} error={errors.firstName} data-testid="reg-first" />
          <Field id="lastName" label="Last name" value={form.lastName} onChange={set('lastName')} error={errors.lastName} data-testid="reg-last" />
        </div>
        <Field id="email" label="E-mail" icon={Mail} type="email" autoComplete="email" value={form.email} onChange={set('email')} error={errors.email} data-testid="reg-email" />
        <Field id="password" label="Password (min 6 characters)" icon={Lock} type="password" autoComplete="new-password" value={form.password} onChange={set('password')} error={errors.password} data-testid="reg-password" />
        <Field id="initialDeposit" label="Initial deposit (₹)" inputMode="decimal" value={form.initialDeposit} onChange={set('initialDeposit')} error={errors.initialDeposit} data-testid="reg-deposit" />
        {formError && <div role="alert" data-testid="register-error" className="rounded-xl border border-loss/40 bg-loss/10 px-4 py-3 text-sm text-red-300">{formError}</div>}
        <button className="btn-primary w-full" disabled={busy} data-testid="register-submit">{busy ? <Spinner className="!text-ink-950" /> : <>Create account <ArrowRight className="h-4 w-4" /></>}</button>
      </form>
    </Shell>
  )
}
