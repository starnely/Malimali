import { useState, useEffect } from 'react'
import { MdNotifications, MdPerson, MdWarning, MdUndo, MdCheckCircle, MdClose, MdLocationOn, MdAccessTime, MdLogout, MdAccountCircle } from 'react-icons/md'
import { useApp } from '@/context/AppContext'
import { useSocket } from '@/context/SocketContext'
import { useLocation, useNavigate } from 'react-router-dom'

const pageTitles = {
  '/': 'Dashboard',
  '/products': 'Products',
  '/stock-in': 'Stock In',
  '/stock-out': 'Stock Out',
  '/barcodes': 'POS Terminal',
  '/sales-history': 'Sales History',
  '/reports': 'Reports',
  '/employees': 'Employees',
  '/daily-archives': 'Daily Archives',
  '/settings': 'Settings',
  '/monthly-report': 'Monthly Report',
  '/profile': 'My Profile',
}

export default function TopBar() {
  const {
    currentUser, isOwner, logout,
    lowStockProducts,
    fetchSales, fetchReturns, fetchProducts,
    addNotification,
    settings
  } = useApp()

  const socket = useSocket()
  const location = useLocation()
  const navigate = useNavigate()

  const [toasts, setToasts] = useState([])
  const [currentTime, setCurrentTime] = useState(new Date()) // ✅ New: Time State
  const [showProfileMenu, setShowProfileMenu] = useState(false) // ✅ New: Dropdown State

  const backendUrl = "http://localhost:5000";

  // ── Real-Time Clock Effect ─────────────────────────────────────────────
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // ── Toast helpers ──────────────────────────────────────────────────────
  const addToast = (toast) => {
    const id = Date.now() + Math.random()
    setToasts(prev => [{ ...toast, id }, ...prev].slice(0, 5))
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 8000)
  }

  const removeToast = (id) => setToasts(prev => prev.filter(t => t.id !== id))

  // ── Socket listeners ───────────────────────────────────────────────────
  useEffect(() => {
    if (!socket) return

    socket.on('newReturnRequest', (data) => {
      addToast({
        type: 'return',
        title: '🔔 New Return Request',
        message: `${data.requesterName} wants to return items — KSh ${(data.refundAmount || 0).toLocaleString()}`,
        reason: data.reason,
        action: () => navigate('/sales-history'),
      })

      addNotification(
        `${data.requesterName} wants to return an item — KSh ${(data.refundAmount || 0).toLocaleString()} · Reason: ${data.reason || 'N/A'}`,
        'warning',
        'owner'
      )

      fetchReturns()
    })

    socket.on('returnUpdated', (data) => {
      const approved = data.status === 'approved'
      addToast({
        type: approved ? 'success' : 'error',
        title: approved ? '✅ Return Approved' : '❌ Return Rejected',
        message: data.message || (approved
          ? `Refund KSh ${(data.refundAmount || 0).toLocaleString()} to customer`
          : 'Your return request was rejected by the owner'),
      })
      fetchSales()
      fetchProducts()
      fetchReturns()
    })

    socket.on('newSale', () => {
      fetchSales()
      fetchProducts()
    })

    return () => {
      socket.off('newReturnRequest')
      socket.off('returnUpdated')
      socket.off('newSale')
    }
  }, [socket])

  const pageTitle = pageTitles[location.pathname] || 'Dashboard'
  const lowStockCount = lowStockProducts?.length || 0

  return (
    <>
      {/* ── Toast notifications ── */}
      {toasts.length > 0 && (
        <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
          {toasts.map(toast => (
            <div
              key={toast.id}
              className={`pointer-events-auto rounded-xl shadow-lg p-4 border flex gap-3 items-start animate-slideUp ${toast.type === 'success' ? 'bg-green-50  border-green-400' :
                  toast.type === 'error' ? 'bg-red-50    border-red-400' :
                    toast.type === 'return' ? 'bg-orange-50 border-orange-400' :
                      'bg-blue-50   border-blue-400'
                }`}
            >
              <div className="text-xl flex-shrink-0 mt-0.5">
                {toast.type === 'success' ? <MdCheckCircle className="text-green-600" /> :
                  toast.type === 'error' ? <MdClose className="text-red-600" /> :
                    toast.type === 'return' ? <MdUndo className="text-orange-600" /> :
                      <MdNotifications className="text-blue-600" />}
              </div>

              <div className="flex-1 min-w-0">
                <div className={`text-sm font-semibold mb-0.5 ${toast.type === 'success' ? 'text-green-800' :
                    toast.type === 'error' ? 'text-red-800' :
                      toast.type === 'return' ? 'text-orange-800' :
                        'text-blue-800'
                  }`}>
                  {toast.title}
                </div>
                <div className="text-xs text-gray-600 leading-relaxed">{toast.message}</div>
                {toast.action && (
                  <button
                    onClick={toast.action}
                    className="mt-2 text-xs font-semibold text-orange-700 hover:text-orange-900 underline"
                  >
                    View in Sales History →
                  </button>
                )}
              </div>

              <button
                onClick={() => removeToast(toast.id)}
                className="text-gray-400 hover:text-gray-600 flex-shrink-0 mt-0.5"
              >
                <MdClose className="text-base" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── TopBar ── */}
      <div className="h-[65px] bg-white border-b border-gray-200 flex items-center justify-between px-6 sticky top-0 z-50 shadow-sm">

        {/* LEFT: Business Info & Title */}
        <div className="flex items-center gap-3">
          {settings?.logo && (
            <img
              src={`${backendUrl}${settings.logo}`}
              alt="Logo"
              className="w-10 h-10 object-contain rounded border bg-gray-50"
            />
          )}
          <div>
            <h2 className="text-base font-bold text-gray-900 tracking-tight leading-none">
              {settings?.companyName || "POS System"} <span className="text-[10px] text-blue-500 font-normal">v3.0</span>
            </h2>
            <div className="flex items-center gap-1 text-[10px] text-gray-400 uppercase tracking-widest mt-1">
              <span className="font-semibold text-gray-500">{pageTitle}</span>
              {settings?.location && (
                <>
                  <span className="mx-1">•</span>
                  <MdLocationOn className="text-[12px]" />
                  <span>{settings.location}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT: Status & User section */}
        <div className="flex items-center gap-4">

          {/* Real-Time Clock */}
          <div className="hidden lg:flex items-center gap-2 bg-slate-900 text-cyan-400 px-3 py-1.5 rounded-lg font-mono text-sm border border-slate-700 shadow-inner">
            <MdAccessTime className="text-cyan-500" />
            {currentTime.toLocaleTimeString()}
          </div>

          {/* Low stock notifications */}
          {isOwner && (
            <div
              onClick={() => navigate('/products', { state: { filter: 'lowStock' } })}
              className={`relative cursor-pointer p-2 rounded-lg transition ${lowStockCount ? 'bg-orange-50' : 'hover:bg-gray-100'}`}
            >
              <MdNotifications className={`text-xl ${lowStockCount ? 'text-orange-700' : 'text-gray-500'}`} />
              {lowStockCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] font-semibold w-4 h-4 rounded-full flex items-center justify-center border-2 border-white">
                  {lowStockCount}
                </span>
              )}
            </div>
          )}

          <div className="hidden md:block w-px h-7 bg-gray-200" />

          {/* Clickable Profile Section */}
          <div className="relative">
            {/* The Trigger Button */}
            <div
              onClick={(e) => {
                e.stopPropagation(); // Prevents the click from reaching the background 'close' div
                setShowProfileMenu(!showProfileMenu);
              }}
              className={`flex items-center gap-3 px-3 py-1.5 rounded-xl border transition-all cursor-pointer ${showProfileMenu ? 'bg-gray-100 border-gray-300 shadow-inner' : 'border-transparent hover:bg-gray-50'
                }`}
            >
              <div className="hidden md:block text-right">
                <div className="text-sm font-bold text-gray-900 leading-none">{currentUser?.name}</div>
                <div className="text-[9px] text-blue-600 uppercase font-black mt-1 tracking-wider">{currentUser?.role}</div>
              </div>
              <div className={`w-10 h-10 rounded-full flex items-center justify-center shadow-md border-2 border-white ${isOwner ? 'bg-blue-600' : 'bg-green-600'}`}>
                <MdPerson className="text-xl text-white" />
              </div>
            </div>

            {/* Profile Dropdown Menu */}
            {showProfileMenu && (
              <>
                {/* Invisible Overlay to close the menu when clicking anywhere else */}
                <div
                  className="fixed inset-0 z-[60]"
                  onClick={() => setShowProfileMenu(false)}
                ></div>

                {/* The Actual Menu Container */}
                <div className="absolute right-0 mt-3 w-64 bg-white rounded-2xl shadow-2xl border border-gray-100 z-[70] overflow-hidden animate-fadeIn">
                  <div className="p-4 bg-gray-50 border-b">
                    <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Account Details</p>
                    <p className="text-sm font-bold text-gray-800 truncate mt-1">{currentUser?.username}</p>
                  </div>

                  <div className="p-2">
                    <button
                      onClick={() => {
                        navigate('/profile');
                        setShowProfileMenu(false);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-blue-50 rounded-xl transition font-medium"
                    >
                      <MdAccountCircle className="text-xl text-blue-600" />
                      View Profile Information
                    </button>

                    <button
                      onClick={() => {
                        logout();
                        setShowProfileMenu(false);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-600 hover:bg-red-50 rounded-xl transition mt-1 font-medium"
                    >
                      <MdLogout className="text-xl" />
                      Sign Out
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

        </div>
      </div>
    </>
  )
}