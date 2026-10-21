import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { Client } from '@stomp/stompjs'
import SockJS from 'sockjs-client'
import { useAuth } from './AuthContext.jsx'

const MarketCtx = createContext(null)
export const useMarket = () => useContext(MarketCtx)

const HISTORY = 80

function merge(prev, incoming) {
  const old = prev[incoming.symbol]
  const price = Number(incoming.price)
  const oldPrice = old ? Number(old.price) : price
  const history = old ? old.history.slice(-(HISTORY - 1)) : []
  history.push(price)
  return {
    ...prev,
    [incoming.symbol]: {
      ...old,
      ...incoming,
      price,
      history,
      dir: price > oldPrice ? 'up' : price < oldPrice ? 'down' : old?.dir || null,
      tick: (old?.tick || 0) + 1,
    },
  }
}

/**
 * Live prices. REST gives the initial snapshot; STOMP-over-SockJS (/ws → gateway →
 * market-data-service) pushes a tick per symbol every ~2s. If the socket is down the
 * provider falls back to polling /api/v1/market/stocks so the UI never goes stale.
 */
export function MarketProvider({ children }) {
  const { api, isAuthenticated } = useAuth()
  const [stocks, setStocks] = useState({})
  const [status, setStatus] = useState('connecting') // connecting | live | polling
  const [loading, setLoading] = useState(true)
  const statusRef = useRef(status)
  statusRef.current = status

  const symbolsKey = Object.keys(stocks).sort().join(',')

  // 1) initial snapshot
  useEffect(() => {
    if (!isAuthenticated) return
    let cancelled = false
    api.stocks()
      .then((list) => { if (!cancelled) setStocks((p) => list.reduce(merge, p)) })
      .catch(() => {})
      .finally(() => !cancelled && setLoading(false))
    return () => { cancelled = true }
  }, [api, isAuthenticated])

  // 2) websocket subscriptions (re-created only when the symbol set changes)
  useEffect(() => {
    if (!isAuthenticated || !symbolsKey) return
    const symbols = symbolsKey.split(',')
    const client = new Client({
      webSocketFactory: () => new SockJS('/ws'),
      reconnectDelay: 4000,
      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,
      onConnect: () => {
        setStatus('live')
        symbols.forEach((s) =>
          client.subscribe(`/topic/prices/${s}`, (msg) => {
            try { setStocks((p) => merge(p, JSON.parse(msg.body))) } catch { /* ignore bad frame */ }
          }),
        )
      },
      onWebSocketClose: () => setStatus('polling'),
      onStompError: () => setStatus('polling'),
    })
    client.activate()
    return () => { client.deactivate() }
  }, [isAuthenticated, symbolsKey])

  // 3) polling fallback while the socket is not live
  useEffect(() => {
    if (!isAuthenticated) return
    const id = setInterval(() => {
      if (statusRef.current === 'live') return
      api.stocks().then((list) => setStocks((p) => list.reduce(merge, p))).catch(() => {})
    }, 3000)
    return () => clearInterval(id)
  }, [api, isAuthenticated])

  const list = useMemo(() => Object.values(stocks).sort((a, b) => a.symbol.localeCompare(b.symbol)), [stocks])
  const value = useMemo(() => ({ stocks, list, status, loading }), [stocks, list, status, loading])
  return <MarketCtx.Provider value={value}>{children}</MarketCtx.Provider>
}
