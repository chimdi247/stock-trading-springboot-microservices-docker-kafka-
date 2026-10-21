import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react'

const ToastCtx = createContext(null)
export const useToast = () => useContext(ToastCtx)

const ICONS = {
  success: <CheckCircle2 className="h-5 w-5 text-gain" />,
  error: <AlertTriangle className="h-5 w-5 text-loss" />,
  info: <Info className="h-5 w-5 text-brand-400" />,
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const dismiss = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), [])
  const push = useCallback((type, title, message) => {
    const id = Math.random().toString(36).slice(2)
    setToasts((t) => [...t, { id, type, title, message }])
    setTimeout(() => dismiss(id), 5500)
  }, [dismiss])

  const api = useMemo(() => ({
    success: (t, m) => push('success', t, m),
    error: (t, m) => push('error', t, m),
    info: (t, m) => push('info', t, m),
  }), [push])

  return (
    <ToastCtx.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed right-4 top-4 z-[100] flex w-full max-w-sm flex-col gap-3" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} data-testid="toast" className="pointer-events-auto card flex animate-slideIn items-start gap-3 p-4">
            {ICONS[t.type]}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-100">{t.title}</p>
              {t.message && <p className="mt-0.5 break-words text-sm text-slate-400">{t.message}</p>}
            </div>
            <button onClick={() => dismiss(t.id)} aria-label="Dismiss" className="text-slate-500 hover:text-slate-200">
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}
