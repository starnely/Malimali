import { useState, useEffect } from 'react'
import { MdNotifications, MdPerson, MdWarning, MdUndo, MdCheckCircle, MdClose } from 'react-icons/md'
import { useApp } from '@/context/AppContext'
import { useSocket } from '@/context/SocketContext'
import { useLocation, useNavigate } from 'react-router-dom'

const pageTitles = {
  '/':               'Dashboard',
  '/products':       'Products',
  '/stock-in':       'Stock In',
  '/stock-out':      'Stock Out',
  '/barcodes':       'POS Terminal',
  '/sales-history':  'Sales History',
  '/reports':        'Reports',
  '/employees':      'Employees',
  '/daily-archives': 'Daily Archives',
  '/settings':       'Settings',
  '/monthly-report': 'Monthly Report',
}

export default function TopBar() {
  const {
    currentUser, isOwner,
    lowStockProducts,
    fetchSales, fetchReturns, fetchProducts,
    addNotification,
  } = useApp()

  const socket   = useSocket()
  const location = useLocation()
  const navigate = useNavigate()

  const [toasts, setToasts] = useState([])

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

    // ✅ New return request — backend emits to "owner" room only
    // So this handler ONLY fires on the owner's browser
    socket.on('newReturnRequest', (data) => {
      // Toast for immediate visual feedback
      addToast({
        type: 'return',
        title: '🔔 New Return Request',
        // ✅ Use data.requesterName — the employee's name from backend
        // NOT currentUser.name which would show the owner's own name
        message: `${data.requesterName} wants to return items — KSh ${(data.refundAmount || 0).toLocaleString()}`,
        reason: data.reason,
        action: () => navigate('/sales-history'),
      })

      // ✅ Sidebar notification: target "owner" so only owner sidebar shows it
      addNotification(
        `${data.requesterName} wants to return an item — KSh ${(data.refundAmount || 0).toLocaleString()} · Reason: ${data.reason || 'N/A'}`,
        'warning',
        'owner'       // ← only owner's sidebar picks this up
      )

      fetchReturns()
    })

    // ✅ Return approved/rejected — backend emits to employee's userId room only
    // So this handler ONLY fires on the employee's browser
    socket.on('returnUpdated', (data) => {
      const approved = data.status === 'approved'

      // Toast for the employee
      addToast({
        type: approved ? 'success' : 'error',
        title: approved ? '✅ Return Approved' : '❌ Return Rejected',
        message: data.message || (approved
          ? `Refund KSh ${(data.refundAmount || 0).toLocaleString()} to customer`
          : 'Your return request was rejected by the owner'),
      })

      // ✅ No addNotification here — employee gets toast only, not a persistent sidebar notif
      // (The sidebar notification for the employee's OWN shift close is handled in AppContext.closeShift)

      fetchSales()
      fetchProducts()
      fetchReturns()
    })

    // New sale — refresh data silently
    socket.on('newSale', () => {
      fetchSales()
      fetchProducts()
    })

    return () => {
      socket.off('newReturnRequest')
      socket.off('returnUpdated')
      socket.off('newSale')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket])

  const pageTitle    = pageTitles[location.pathname] || 'Dashboard'
  const lowStockCount = lowStockProducts?.length || 0

  return (
    <>
      {/* ── Toast notifications (top-right overlay) ── */}
      {toasts.length > 0 && (
        <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
          {toasts.map(toast => (
            <div
              key={toast.id}
              className={`pointer-events-auto rounded-xl shadow-lg p-4 border flex gap-3 items-start animate-slideUp ${
                toast.type === 'success' ? 'bg-green-50  border-green-400'  :
                toast.type === 'error'   ? 'bg-red-50    border-red-400'    :
                toast.type === 'return'  ? 'bg-orange-50 border-orange-400' :
                                           'bg-blue-50   border-blue-400'
              }`}
            >
              {/* Icon */}
              <div className="text-xl flex-shrink-0 mt-0.5">
                {toast.type === 'success' ? <MdCheckCircle className="text-green-600" /> :
                 toast.type === 'error'   ? <MdClose       className="text-red-600"   /> :
                 toast.type === 'return'  ? <MdUndo        className="text-orange-600"/> :
                                            <MdNotifications className="text-blue-600"/>}
              </div>

              {/* Body */}
              <div className="flex-1 min-w-0">
                <div className={`text-sm font-semibold mb-0.5 ${
                  toast.type === 'success' ? 'text-green-800'  :
                  toast.type === 'error'   ? 'text-red-800'    :
                  toast.type === 'return'  ? 'text-orange-800' :
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

              {/* Dismiss */}
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
      <div className="h-[60px] bg-white border-b border-gray-200 flex items-center justify-between px-6 sticky top-0 z-50 shadow-sm">
        {/* Page title */}
        <h2 className="text-lg font-semibold text-gray-900 tracking-wide">{pageTitle}</h2>

        {/* Right section */}
        <div className="flex items-center gap-4">

          {/* Low stock bell — owner only */}
          {isOwner && (
            <div
              onClick={() => navigate('/products', { state: { filter: 'lowStock' } })}
              className={`relative cursor-pointer p-2 rounded-lg transition ${lowStockCount ? 'bg-orange-50' : ''}`}
            >
              <MdNotifications className={`text-xl ${lowStockCount ? 'text-orange-700' : 'text-gray-500'}`} />
              {lowStockCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] font-semibold w-4 h-4 rounded-full flex items-center justify-center">
                  {lowStockCount}
                </span>
              )}
            </div>
          )}

          {/* Low stock badge — owner only */}
          {isOwner && lowStockCount > 0 && (
            <div className="hidden md:flex items-center gap-1.5 bg-yellow-100 text-yellow-900 px-3 py-1.5 rounded-lg text-xs font-medium">
              <MdWarning /> {lowStockCount} low stock
            </div>
          )}

          <div className="hidden md:block w-px h-7 bg-gray-200" />

          {/* User info */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg">
            <div className={`w-9 h-9 rounded-full flex items-center justify-center ${isOwner ? 'bg-blue-100' : 'bg-green-100'}`}>
              <MdPerson className={`text-lg ${isOwner ? 'text-blue-700' : 'text-green-700'}`} />
            </div>
            <div className="hidden md:block">
              <div className="text-sm font-semibold text-gray-900">{currentUser?.name}</div>
              <div className="text-xs text-gray-500 capitalize">{currentUser?.role}</div>
            </div>
          </div>

        </div>
      </div>
    </>
  )
}
