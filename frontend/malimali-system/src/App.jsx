import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import axios from 'axios'
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
import SetupWizard from '@/pages/SetupWizard'
import { useWindowSize } from '@/hooks/useWindowSize'
import { useApp } from '@/context/AppContext'
import { SocketProvider } from '@/context/SocketContext';
import Profile from './pages/Profile';
import '@/App.css'

function App() {
  const { isMobile } = useWindowSize()
  const { 
    isOwner, 
    currentUser, 
    login, 
    isSetupComplete 
  } = useApp()

  // Local state to handle login UI toggle
  const [isLoggedIn, setIsLoggedIn] = useState(!!currentUser)

  // Sync isLoggedIn if currentUser changes (e.g. on logout)
  useEffect(() => {
    setIsLoggedIn(!!currentUser)
  }, [currentUser])

  // 1. Loading State: If isSetupComplete is null (fetching from backend)
  if (isSetupComplete === null) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="flex flex-col items-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
          <div className="text-gray-600 font-medium">Initializing System...</div>
        </div>
      </div>
    );
  }

  return (
    <SocketProvider>
      <BrowserRouter>
        {/* 2. Setup Phase: If backend says setup is not done, force SetupWizard */}
        {!isSetupComplete ? (
          <Routes>
            <Route path="*" element={<SetupWizard />} />
          </Routes>
        ) : (
          /* 3. Normal Operation Phase */
          <>
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
                      <Route path="/sales-history" element={<SalesHistory />} />
                      <Route path="/profile"       element={<Profile />} />

                      {/* ── FALLBACK ── */}
                      <Route path="*" element={<Navigate to="/" />} />
                    </Routes>
                  </div>
                </div>
              </div>
            ) : (
              /* Not logged in? Show Login */
              <Login onLogin={() => setIsLoggedIn(true)} />
            )}
          </>
        )}
      </BrowserRouter>
    </SocketProvider>
  )
}

export default App