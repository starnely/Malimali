import { useState, useEffect, useCallback } from 'react'
import {
  MdNotifications, MdPerson, MdWarning, MdClose, MdLocationOn,
  MdAccessTime, MdLogout, MdAccountCircle, MdLockClock, MdChat,
  MdSettings, MdDocumentScanner, MdArchive,
} from 'react-icons/md'
import { useApp } from '@/context/AppContext'
import { useSocket } from '@/context/SocketContext'
import { useLocation, useNavigate } from 'react-router-dom'
import ChatModal from '@/components/modals/ChatModal'
import DailySummaryModal from '@/components/modals/DailySummaryModal'

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
  '/categories': 'Categories',
  '/expired-stock': 'Expired Stock',
  '/suppliers': 'Suppliers',
  '/purchase-orders': 'Purchase Orders',
  '/expenses': 'Expenses',
  '/petty-cash': 'Petty Cash',
  '/customers': 'Debtors',
  '/stores': 'Stores',
}

// ── Notification Panel ────────────────────────────────────────────────
function NotificationPanel({ onClose }) {
  const {
    myNotifications, markNotificationRead, markAllNotificationsRead,
    clearNotifications, isOwner, currentUser,
    shiftCloseNotifs, markShiftCloseNotifRead, clearShiftCloseNotifs
  } = useApp()

  const target = isOwner ? 'owner' : (currentUser?.fullname || currentUser?.username || 'staff')

  const allNotifications = isOwner
    ? [
      ...(shiftCloseNotifs || []).map(n => ({
        id: n.id,
        message: `🔒 ${n.employeeName} closed shift at ${n.time} — KSh ${(n.revenue || 0).toLocaleString()}`,
        type: 'info', read: n.read, date: n.date, time: n.time, isShiftClose: true,
      })),
      ...(myNotifications || []),
    ]
    : (myNotifications || [])

  const handleMarkAllRead = () => {
    markAllNotificationsRead(target)
    if (isOwner) (shiftCloseNotifs || []).forEach(n => markShiftCloseNotifRead(n.id))
  }
  const handleClearAll = () => {
    clearNotifications(target)
    if (isOwner) clearShiftCloseNotifs()
  }
  const handleRead = (notif) => {
    if (notif.isShiftClose) markShiftCloseNotifRead(notif.id)
    else markNotificationRead(notif.id)
  }

  const typeStyles = {
    success: { bg: 'var(--success-light)', border: 'var(--success)', color: 'var(--success-dark)' },
    error: { bg: 'var(--danger-light)', border: 'var(--danger)', color: 'var(--danger-dark)' },
    warning: { bg: 'var(--warning-light)', border: 'var(--warning)', color: 'var(--warning-dark)' },
    info: { bg: 'var(--info-light)', border: 'var(--info)', color: 'var(--info-dark)' },
  }

  return (
    <div className="fixed top-0 right-0 h-screen w-[340px] bg-white z-[2000] flex flex-col animate-slideInRight"
      style={{ boxShadow: '-4px 0 32px rgba(0,0,0,0.12)' }}>
      <div className="px-5 py-4 flex justify-between items-center flex-shrink-0"
        style={{ background: 'var(--sidebar-bg)', borderBottom: '1px solid var(--sidebar-border)' }}>
        <div className="flex items-center gap-2">
          <MdNotifications className="text-white text-lg" />
          <span className="text-white text-sm font-bold">Notifications</span>
        </div>
        <button onClick={onClose} className="w-7 h-7 rounded-md flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition">
          <MdClose className="text-base" />
        </button>
      </div>

      {allNotifications.length > 0 && (
        <div className="flex gap-2 px-4 py-2.5 flex-shrink-0"
          style={{ borderBottom: '1px solid var(--border-soft)', background: 'var(--bg-muted)' }}>
          <button onClick={handleMarkAllRead} className="flex-1 px-2 py-1.5 rounded-md text-xs font-semibold"
            style={{ background: 'var(--primary-light)', color: 'var(--primary)' }}>
            Mark all read
          </button>
          <button onClick={handleClearAll} className="flex-1 px-2 py-1.5 rounded-md text-xs font-semibold"
            style={{ background: 'var(--danger-light)', color: 'var(--danger-dark)' }}>
            Clear all
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {allNotifications.length === 0 ? (
          <div className="text-center py-16" style={{ color: 'var(--text-muted)' }}>
            <div className="text-4xl mb-3">🔔</div>
            <p className="text-sm font-medium">No notifications yet</p>
          </div>
        ) : allNotifications.map(notif => {
          const ts = typeStyles[notif.type] || typeStyles.info
          return (
            <div key={notif.id} onClick={() => handleRead(notif)} className="rounded-lg p-3 cursor-pointer transition-opacity"
              style={notif.read
                ? { background: 'var(--bg-muted)', border: '1px solid var(--border-soft)', opacity: 0.65 }
                : { background: ts.bg, borderLeft: `3px solid ${ts.border}`, border: `1px solid ${ts.border}20` }
              }>
              <p className="text-sm leading-snug" style={{ color: notif.read ? 'var(--text-secondary)' : ts.color, fontWeight: notif.read ? 400 : 500 }}>
                {notif.message}
              </p>
              <div className="flex items-center gap-2 mt-1.5">
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{notif.date} · {notif.time}</span>
                {!notif.read && (
                  <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full text-white" style={{ background: 'var(--primary)' }}>NEW</span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── TopBar ────────────────────────────────────────────────────────────
export default function TopBar() {
  const {
    currentUser, isOwner, isManager, logout, lowStockProducts,
    settings, unreadCount, unreadMsgCount, setUnreadMsgCount,
    markAllNotificationsRead,
    shiftCloseNotifs, markShiftCloseNotifRead,
    hasClosedShiftToday,
  } = useApp()

  const socket = useSocket()
  const location = useLocation()
  const navigate = useNavigate()

  const [toasts, setToasts] = useState([])
  const [currentTime, setCurrentTime] = useState(new Date())
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [showDailySummary, setShowDailySummary] = useState(false)
  const [showChat, setShowChat] = useState(false)

  const backendUrl = 'http://localhost:5000'
  const alreadyClosed = hasClosedShiftToday?.() || false

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const handleOpenNotifications = () => {
    setShowNotifications(true)
    const target = isOwner ? 'owner' : (currentUser?.fullname || currentUser?.username || 'staff')
    markAllNotificationsRead(target)
    if (isOwner) (shiftCloseNotifs || []).forEach(n => markShiftCloseNotifRead(n.id))
  }

  const handleOpenChat = () => {
    setShowChat(true)
    setTimeout(() => setUnreadMsgCount(0), 0)
  }

  const addToast = useCallback((toast) => {
    const id = Date.now() + Math.random()
    setToasts(prev => [{ ...toast, id }, ...prev].slice(0, 5))
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 8000)
  }, [])

  const removeToast = (id) => setToasts(prev => prev.filter(t => t.id !== id))

  const toastStyles = {
    success: { border: 'var(--success)', icon: '✅', bg: 'var(--success-light)', color: 'var(--success-dark)' },
    error: { border: 'var(--danger)', icon: '❌', bg: 'var(--danger-light)', color: 'var(--danger-dark)' },
    return: { border: 'var(--warning)', icon: '🔄', bg: 'var(--warning-light)', color: 'var(--warning-dark)' },
    info: { border: 'var(--info)', icon: 'ℹ️', bg: 'var(--info-light)', color: 'var(--info-dark)' },
  }

  // ── Socket listeners — TOASTS ONLY ───────────────────────────────
  // IMPORTANT: Topbar only handles visual toast popups here.
  // Bell notifications, data fetching, and addNotification are all
  // handled exclusively in AppContext to avoid socket.off() conflicts.
  // Never call socket.off() for events that AppContext also listens to.
  useEffect(() => {
    if (!socket) return

    const handleNewReturnRequest = (data) => {
      addToast({
        type: 'return',
        title: 'New Return Request',
        message: `${data.requesterName} wants to return — KSh ${(data.refundAmount || 0).toLocaleString()}`,
        action: () => navigate('/sales-history')
      })
    }

    const handleReturnUpdated = (data) => {
      const approved = data.status === 'approved'
      addToast({
        type: approved ? 'success' : 'error',
        title: approved ? 'Return Approved' : 'Return Rejected',
        message: data.message || (approved ? 'Return has been approved' : 'Request rejected')
      })
    }

    const handleNewSale = () => {
      // No toast needed — silent sync handled by AppContext
    }

    const handleShiftClosedConfirmation = () => {
      addToast({ type: 'success', title: 'Shift Closed', message: 'Your shift has been successfully closed.' })
    }

    const handleAdminShiftNotification = (data) => {
      // Owner toast for shift close — bell handled by AppContext
      if (isOwner) {
        addToast({
          type: 'info',
          title: 'Shift Closed',
          message: `${data.employeeName || 'An employee'} closed their shift — KSh ${(data.revenue || 0).toLocaleString()}`
        })
      }
    }

    // Use named handlers so we can remove only our specific listeners
    socket.on('newReturnRequest', handleNewReturnRequest)
    socket.on('returnUpdated', handleReturnUpdated)
    socket.on('newSale', handleNewSale)
    socket.on('shiftClosedConfirmation', handleShiftClosedConfirmation)
    socket.on('adminShiftNotification', handleAdminShiftNotification)

    return () => {
      // Remove only our specific handler functions — NOT socket.off(eventName)
      // which would remove ALL listeners including AppContext's
      socket.off('newReturnRequest', handleNewReturnRequest)
      socket.off('returnUpdated', handleReturnUpdated)
      socket.off('newSale', handleNewSale)
      socket.off('shiftClosedConfirmation', handleShiftClosedConfirmation)
      socket.off('adminShiftNotification', handleAdminShiftNotification)
    }
  }, [socket, addToast, navigate, isOwner])

  const pageTitle = pageTitles[location.pathname] || 'Dashboard'
  const businessName = settings?.businessName || settings?.companyName || 'POS System'
  const lowStockCount = lowStockProducts?.length || 0
  const canSeeSettings = isOwner || isManager
  const avatarColor = isOwner ? 'var(--primary)' : isManager ? 'var(--warning)' : 'var(--success)'
  const avatarInitial = (currentUser?.fullname || currentUser?.username || 'U').charAt(0).toUpperCase()

  const topbarShortcuts = (isOwner || isManager) ? [
    { to: '/barcodes', label: 'Barcodes', icon: <MdDocumentScanner size={15} /> },
    { to: '/daily-archives', label: 'Archives', icon: <MdArchive size={15} /> },
  ] : []

  return (
    <>
      {showNotifications && (
        <>
          <div onClick={() => setShowNotifications(false)} className="fixed inset-0 z-[1999]"
            style={{ background: 'rgba(15,23,42,0.4)', WebkitBackdropFilter: 'blur(2px)', backdropFilter: 'blur(2px)' }} />
          <NotificationPanel onClose={() => setShowNotifications(false)} />
        </>
      )}

      {showChat && <ChatModal onClose={() => setShowChat(false)} />}
      {showDailySummary && <DailySummaryModal onClose={() => setShowDailySummary(false)} />}

      {/* Toasts */}
      {toasts.length > 0 && (
        <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 w-80 pointer-events-none">
          {toasts.map(toast => {
            const ts = toastStyles[toast.type] || toastStyles.info
            return (
              <div key={toast.id} className="pointer-events-auto rounded-xl p-4 flex gap-3 items-start animate-slideUp relative"
                style={{ background: ts.bg, borderLeft: `3px solid ${ts.border}`, border: `1px solid ${ts.border}30`, boxShadow: 'var(--shadow-card)' }}>
                <span className="text-base mt-0.5">{ts.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold" style={{ color: ts.color }}>{toast.title}</p>
                  {toast.message && <p className="text-xs mt-0.5" style={{ color: ts.color, opacity: 0.8 }}>{toast.message}</p>}
                  {toast.action && <button onClick={toast.action} className="text-xs font-bold mt-1.5 underline underline-offset-2" style={{ color: ts.border }}>View →</button>}
                </div>
                <button onClick={() => removeToast(toast.id)} className="text-sm flex-shrink-0 opacity-50 hover:opacity-100 transition" style={{ color: ts.color }}>
                  <MdClose />
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* ── TopBar ──────────────────────────────────────────────────── */}
      <div
        className="h-[62px] flex items-center justify-between px-6 sticky top-0 z-50"
        style={{ background: 'var(--topbar-bg)', borderBottom: '1px solid var(--topbar-border)', boxShadow: 'var(--topbar-shadow)' }}
      >
        {/* LEFT */}
        <div className="flex items-center gap-3">
          {settings?.logo ? (
            <img src={`${backendUrl}${settings.logo}`} alt="Logo" className="w-8 h-8 object-contain rounded-lg flex-shrink-0"
              style={{ background: 'var(--bg-muted)', border: '1px solid var(--border-soft)', padding: '3px' }} />
          ) : (
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-black text-sm flex-shrink-0" style={{ background: 'var(--primary)' }}>
              {businessName.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <h1 className="text-base font-bold leading-none" style={{ color: 'var(--text-primary)' }}>{pageTitle}</h1>
            <div className="flex items-center gap-1 mt-1">
              <span className="text-[11px] font-semibold" style={{ color: 'var(--primary)' }}>{businessName}</span>
              {settings?.location && (
                <>
                  <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>·</span>
                  <MdLocationOn className="text-[11px]" style={{ color: 'var(--text-muted)' }} />
                  <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{settings.location}</span>
                </>
              )}
            </div>
          </div>

          {topbarShortcuts.length > 0 && (
            <div className="hidden md:flex items-center gap-2 ml-4">
              {topbarShortcuts.map(s => {
                const isActive = location.pathname === s.to
                return (
                  <button key={s.to} onClick={() => navigate(s.to)} title={s.label}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '7px 14px', borderRadius: 10, fontSize: 12, fontWeight: 700,
                      cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
                      background: isActive ? 'var(--primary)' : 'var(--bg-card)',
                      color: isActive ? '#fff' : 'var(--primary)',
                      border: `1.5px solid ${isActive ? 'var(--primary)' : 'var(--primary-muted)'}`,
                      boxShadow: isActive ? '0 2px 8px rgba(0,0,0,0.12)' : '0 1px 3px rgba(0,0,0,0.06)',
                    }}
                    onMouseEnter={e => { if (!isActive) { e.currentTarget.style.background = 'var(--primary)'; e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.12)' } }}
                    onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background = 'var(--bg-card)'; e.currentTarget.style.color = 'var(--primary)'; e.currentTarget.style.borderColor = 'var(--primary-muted)'; e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.06)' } }}
                  >
                    {s.icon} {s.label}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* RIGHT */}
        <div className="flex items-center gap-2">

          {/* Clock */}
          <div className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono text-sm"
            style={{ background: 'var(--clock-bg)', color: 'var(--clock-text)', border: '1px solid var(--clock-border)' }}>
            <MdAccessTime className="text-sm" />
            {currentTime.toLocaleTimeString()}
          </div>

          {/* Close Shift — cashier/employee only */}
          {currentUser?.role !== 'owner' && !isOwner && (
            <button
              onClick={() => !alreadyClosed && setShowDailySummary(true)}
              disabled={alreadyClosed}
              className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
              style={alreadyClosed
                ? { background: 'var(--bg-muted)', color: 'var(--text-muted)', cursor: 'not-allowed', border: '1px solid var(--border-soft)' }
                : { background: 'var(--warning-light)', color: 'var(--warning-dark)', border: '1px solid var(--warning)' }
              }
            >
              <MdLockClock className="text-base" />
              {alreadyClosed ? 'Shift Closed' : 'Close Shift'}
            </button>
          )}

          {/* Low stock warning — owner only */}
          {isOwner && (
            <button onClick={() => navigate('/products', { state: { filter: 'lowStock' } })}
              className="relative p-2 rounded-lg transition"
              style={{ background: lowStockCount > 0 ? 'var(--warning-light)' : 'transparent', border: 'none', cursor: 'pointer' }}>
              <MdWarning className="text-xl" style={{ color: lowStockCount > 0 ? 'var(--warning-dark)' : 'var(--text-muted)' }} />
              {lowStockCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-white text-[10px] font-black flex items-center justify-center border-2 border-white"
                  style={{ background: 'var(--danger)' }}>
                  {lowStockCount}
                </span>
              )}
            </button>
          )}

          {/* Chat */}
          <button onClick={handleOpenChat} className="relative p-2 rounded-lg transition"
            style={{ background: unreadMsgCount > 0 ? 'var(--primary-light)' : 'transparent', border: 'none', cursor: 'pointer' }}>
            <MdChat className="text-xl" style={{ color: unreadMsgCount > 0 ? 'var(--primary)' : 'var(--text-muted)' }} />
            {unreadMsgCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-white text-[10px] font-black flex items-center justify-center border-2 border-white"
                style={{ background: 'var(--primary)' }}>
                {unreadMsgCount > 9 ? '9+' : unreadMsgCount}
              </span>
            )}
          </button>

          {/* Notifications bell */}
          <button onClick={handleOpenNotifications} className="relative p-2 rounded-lg transition"
            style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}>
            <MdNotifications className="text-xl" style={{ color: 'var(--text-primary)' }} />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-white text-[10px] font-black flex items-center justify-center border-2 border-white"
                style={{ background: 'var(--danger)' }}>
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          <div className="hidden md:block w-px h-6 mx-1" style={{ background: 'var(--border-soft)' }} />

          {/* Profile dropdown */}
          <div className="relative">
            <button
              onClick={(e) => { e.stopPropagation(); setShowProfileMenu(!showProfileMenu) }}
              className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl transition-all"
              style={showProfileMenu
                ? { background: 'var(--primary-light)', border: '1px solid var(--primary-muted)' }
                : { border: '1px solid transparent' }
              }
            >
              <div className="hidden md:block text-right">
                <p className="text-sm font-bold leading-none" style={{ color: 'var(--text-primary)' }}>
                  {currentUser?.fullname || currentUser?.name || currentUser?.username || 'Operator'}
                </p>
                <p className="text-[10px] font-black uppercase tracking-wider mt-0.5" style={{ color: 'var(--primary)' }}>
                  {currentUser?.role}
                </p>
              </div>
              <div className="w-9 h-9 rounded-full flex items-center justify-center shadow-sm border-2 border-white flex-shrink-0 text-white font-black text-base"
                style={{ background: avatarColor }}>
                {avatarInitial}
              </div>
            </button>

            {showProfileMenu && (
              <>
                <div className="fixed inset-0 z-[60]" onClick={() => setShowProfileMenu(false)} />
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl overflow-hidden z-[70] animate-fadeIn"
                  style={{ boxShadow: 'var(--shadow-dropdown)', border: '1px solid var(--border-soft)' }}>
                  <div className="p-4" style={{ background: 'var(--primary-light)', borderBottom: '1px solid var(--border-soft)' }}>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-black text-base flex-shrink-0"
                        style={{ background: avatarColor }}>
                        {avatarInitial}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold truncate" style={{ color: 'var(--text-primary)' }}>
                          {currentUser?.fullname || currentUser?.username}
                        </p>
                        <p className="text-[10px] truncate" style={{ color: 'var(--text-muted)' }}>{currentUser?.username}</p>
                        <span className="inline-block text-[10px] font-black uppercase px-2 py-0.5 rounded-full mt-1 text-white"
                          style={{ background: avatarColor }}>
                          {currentUser?.role}
                        </span>
                      </div>
                    </div>
                    {currentUser?.store && (
                      <div className="mt-2 flex items-center gap-1.5">
                        <MdLocationOn style={{ fontSize: 12, color: 'var(--text-muted)', flexShrink: 0 }} />
                        <span className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>{currentUser.store}</span>
                      </div>
                    )}
                  </div>
                  <div className="p-2">
                    <button onClick={() => { navigate('/profile'); setShowProfileMenu(false) }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition"
                      style={{ color: 'var(--text-primary)', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--primary-light)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <MdAccountCircle className="text-xl flex-shrink-0" style={{ color: 'var(--primary)' }} />
                      My Profile
                    </button>
                    {canSeeSettings && (
                      <button onClick={() => { navigate('/settings'); setShowProfileMenu(false) }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition"
                        style={{ color: 'var(--text-primary)', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--primary-light)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <MdSettings className="text-xl flex-shrink-0" style={{ color: 'var(--primary)' }} />
                        Settings
                      </button>
                    )}
                    <div className="my-1.5 mx-2" style={{ height: 1, background: 'var(--border-soft)' }} />
                    <button onClick={() => { logout(); setShowProfileMenu(false) }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition"
                      style={{ color: 'var(--danger-dark)', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--danger-light)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <MdLogout className="text-xl flex-shrink-0" />
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
