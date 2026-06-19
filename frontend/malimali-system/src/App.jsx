import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Sidebar from '@/components/shared/Sidebar'
import TopBar from '@/components/shared/Topbar'
import Dashboard from '@/pages/Dashboard'
import Products from '@/pages/Products/Products'
import StockOut from '@/pages/StockOut'
import SalesHistory from '@/pages/SalesHistory/SalesHistory'
import Reports from '@/pages/Reports'
import Login from '@/pages/Login'
import Barcodes from '@/pages/Barcodes/Barcodes'
import Employees from '@/pages/Employees'
import DailyArchives from '@/pages/DailyArchives'
import Settings from '@/pages/Settings'
import SetupWizard from '@/pages/SetupWizard'
import Profile from '@/pages/Profile'
import Categories from '@/pages/Categories'
import Suppliers from '@/pages/Suppliers'
import Stores from '@/pages/Stores'
import ExpiredStock from '@/pages/ExpiredStock'
import Customers from '@/pages/Customers'
import MyCredits from '@/pages/MyCredits'
import PurchaseOrders from '@/pages/PurchaseOrders'
import Expenses from '@/pages/Expenses'
import PettyCash from '@/pages/PettyCash'
import { useWindowSize } from '@/hooks/useWindowSize'
import { useApp } from '@/context/AppContext'
import DailyReport from '@/pages/DailyReport'
import WeighStation from './pages/WeighStation';
import '@/App.css'

function App() {
  const { isMobile } = useWindowSize()
  const { isOwner, isManager, isCashier, currentUser, isSetupComplete } = useApp()

  const isLoggedIn = !!currentUser

  if (isSetupComplete === null) {
    return (
      <div className="flex items-center justify-center h-screen" style={{ background: 'var(--bg-page)' }}>
        <div className="flex flex-col items-center gap-3">
          <div
            className="w-12 h-12 rounded-full border-4 border-t-transparent animate-spin"
            style={{ borderColor: 'var(--primary-light)', borderTopColor: 'var(--primary)' }}
          />
          <div className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
            Initializing System...
          </div>
        </div>
      </div>
    )
  }

  return (
    <BrowserRouter>
      {!isSetupComplete ? (
        <Routes>
          <Route path="*" element={<SetupWizard />} />
        </Routes>
      ) : (
        <>
          {isLoggedIn ? (
            <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
              <Sidebar />
              <div style={{
                marginLeft:    isMobile ? '0'    : '230px',
                marginTop:     isMobile ? '56px' : '0',
                width:         '100%',
                height:        '100vh',
                display:       'flex',
                flexDirection: 'column',
                overflow:      'visible',       // ← was 'hidden'
              }}>
                <TopBar />
                {/* ── Scrollable content area ── */}
                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
                  <Routes>
                    {/* ── DEFAULT ROUTING ── */}
                    {!isOwner && <Route path="/" element={<Navigate to="/barcodes" />} />}
                    {isOwner  && <Route path="/" element={<Dashboard />} />}

                    {/* ── OWNER ONLY ── */}
                    {isOwner && <Route path="/employees"      element={<Employees />} />}
                    {isOwner && <Route path="/daily-archives" element={<DailyArchives />} />}

                    {/* ── OWNER + MANAGER ── */}
                    {(isOwner || isManager) && <Route path="/products"        element={<Products />} />}
                    {(isOwner || isManager) && <Route path="/reports"         element={<Reports />} />}
                    {(isOwner || isManager) && <Route path="/categories"      element={<Categories />} />}
                    {(isOwner || isManager) && <Route path="/daily-report"   element={<DailyReport />} />}
                    {(isOwner || isManager) && <Route path="/suppliers"       element={<Suppliers />} />}
                    {(isOwner || isManager) && <Route path="/stores"          element={<Stores />} />}
                    {(isOwner || isManager) && <Route path="/expired-stock"   element={<ExpiredStock />} />}
                    {(isOwner || isManager) && <Route path="/settings"        element={<Settings />} />}
                    {(isOwner || isManager) && <Route path="/customers"       element={<Customers />} />}
                    {(isOwner || isManager) && <Route path="/purchase-orders" element={<PurchaseOrders />} />}
                    {(isOwner || isManager) && <Route path="/petty-cash"      element={<PettyCash />} />}

                    {/* ── CASHIER ONLY ── */}
                    {isCashier && <Route path="/my-credits" element={<MyCredits />} />}

                    {/* ── SHARED (all roles) ── */}
                    <Route path="/barcodes"      element={<Barcodes />} />
                    <Route path="/stock-out"     element={<StockOut />} />
                    <Route path="/sales-history" element={<SalesHistory />} />
                    <Route path="/profile"       element={<Profile />} />
                    <Route path="/expenses"      element={<Expenses />} />
                    <Route path="/weigh-station" element={<WeighStation />} />

                    {/* ── FALLBACK ── */}
                    <Route path="*" element={<Navigate to="/" />} />
                  </Routes>
                </div>
              </div>
            </div>
          ) : (
            <Login />
          )}
        </>
      )}
    </BrowserRouter>
  )
}

export default App
