import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { createApi } from '../lib/api.js'
import { clearSession, isTokenExpired, loadSession, saveSession } from '../lib/session.js'

const AuthCtx = createContext(null)
export const useAuth = () => useContext(AuthCtx)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(() => {
    const s = loadSession()
    return s && !isTokenExpired(s.accessToken) ? s : null
  })
  const [wallet, setWallet] = useState(session ? Number(session.walletBalance) : 0)
  const tokenRef = useRef(session?.accessToken || null)
  tokenRef.current = session?.accessToken || null

  const logout = useCallback(() => {
    clearSession()
    setSession(null)
    setWallet(0)
  }, [])

  const api = useMemo(
    () => createApi({ getToken: () => tokenRef.current, onUnauthorized: () => logout() }),
    [logout],
  )

  const startSession = useCallback((auth) => {
    const s = {
      accessToken: auth.accessToken,
      refreshToken: auth.refreshToken,
      userId: auth.userId,
      email: auth.email,
      firstName: auth.firstName,
      lastName: auth.lastName,
      walletBalance: auth.walletBalance,
    }
    saveSession(s)
    setSession(s)
    setWallet(Number(auth.walletBalance))
  }, [])

  const login = useCallback(async (email, password) => startSession(await api.login(email.trim(), password)), [api, startSession])
  const register = useCallback(async (payload) => startSession(await api.register(payload)), [api, startSession])

  /** Re-read wallet balance from the server (after orders / deposits). */
  const refreshWallet = useCallback(async () => {
    try {
      const me = await api.me()
      setWallet(Number(me.walletBalance))
      return me
    } catch { return null }
  }, [api])

  useEffect(() => { if (session) refreshWallet() }, [session?.userId]) // eslint-disable-line react-hooks/exhaustive-deps

  const value = useMemo(
    () => ({ session, user: session, isAuthenticated: !!session, wallet, setWallet, login, register, logout, refreshWallet, api }),
    [session, wallet, login, register, logout, refreshWallet, api],
  )
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>
}
