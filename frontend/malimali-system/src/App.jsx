import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useState } from 'react'
import Sidebar from '@/components/Sidebar'
import TopBar from '@/components/TopBar'
import Dashboard from '@/pages/Dashboard'
import Products from '@/pages/Products/Products'
import StockIn from '@/pages/StockIn'
import StockOut from '@/pages/StockOut'
import SalesHistory from '@/pages/SalesHistory/SalesHistory'
import Reports from '@/pages/Reports'
import Login from '@/pages/Login'
import Barcodes from '@/pages/Barcodes/Barcodes'
import MonthlyReport from '@/pages/MonthlyReport'
import Employees from '@/pages/Employees'
import DailyArchives from '@/pages/DailyArchives'
import Settings from '@/pages/Settings'
import { useWindowSize } from '@/hooks/useWindowSize'
import { useApp } from '@/context/AppContext'
import { SocketProvider } from '@/context/SocketContext'
import '@/App.css'

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const { isMobile } = useWindowSize()
  const { isOwner } = useApp()

  return (
    <SocketProvider>
      <BrowserRouter>
        {isLoggedIn ? (
          <div style={{ display: 'flex' }}>
            <Sidebar onLogout={() => setIsLoggedIn(false)} />
            <div style={{
              marginLeft: isMobile ? '0' : '220px',
              marginTop: isMobile ? '56px' : '0',
              width: '100%',
              minHeight: '100vh',
              display: 'flex',
              flexDirection: 'column'
            }}>
              <TopBar />
              <div style={{ flex: 1 }}>
                <Routes>
                  {/* ── DEFAULT ROUTING ── */}
                  {!isOwner && <Route path="/" element={<Navigate to="/barcodes" />} />}
                  {isOwner  && <Route path="/" element={<Dashboard />} />}

                  {/* ── OWNER ONLY ── */}
                  {isOwner && <Route path="/products"       element={<Products />} />}
                  {isOwner && <Route path="/stock-in"       element={<StockIn />} />}
                  {isOwner && <Route path="/reports"        element={<Reports />} />}
                  {isOwner && <Route path="/monthly-report" element={<MonthlyReport />} />}
                  {isOwner && <Route path="/employees"      element={<Employees />} />}
                  {isOwner && <Route path="/daily-archives" element={<DailyArchives />} />}
                  {isOwner && <Route path="/settings"       element={<Settings />} />}

                  {/* ── SHARED: both owner and employee ── */}
                  <Route path="/barcodes"      element={<Barcodes />} />
                  <Route path="/stock-out"     element={<StockOut />} />
                  {/* ✅ Sales history available to all — each sees their own */}
                  <Route path="/sales-history" element={<SalesHistory />} />

                  {/* ── FALLBACK ── */}
                  <Route path="*" element={<Navigate to="/" />} />
                </Routes>
              </div>
            </div>
          </div>
        ) : (
          <Login onLogin={() => setIsLoggedIn(true)} />
        )}
      </BrowserRouter>
    </SocketProvider>
  )
}

export default App
