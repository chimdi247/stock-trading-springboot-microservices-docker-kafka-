import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useAuth } from './context/AuthContext.jsx'
import { MarketProvider } from './context/MarketContext.jsx'
import Layout from './components/Layout.jsx'
import { LoginPage, RegisterPage } from './pages/AuthPages.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Market from './pages/Market.jsx'
import Trade from './pages/Trade.jsx'
import Orders from './pages/Orders.jsx'
import Portfolio from './pages/Portfolio.jsx'

function Protected({ children }) {
  const { isAuthenticated } = useAuth()
  const location = useLocation()
  if (!isAuthenticated) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  return <MarketProvider>{children}</MarketProvider>
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route element={<Protected><Layout /></Protected>}>
        <Route index element={<Dashboard />} />
        <Route path="market" element={<Market />} />
        <Route path="trade" element={<Trade />} />
        <Route path="orders" element={<Orders />} />
        <Route path="portfolio" element={<Portfolio />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
