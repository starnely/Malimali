import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  MdDashboard, MdInventory,
  MdPointOfSale, MdHistory, MdBarChart,
  MdClose, MdPerson, MdDocumentScanner, MdCategory, MdLocalShipping, MdStorefront,
  MdWarning, MdPeopleAlt, MdCreditCard,
  MdShoppingCart, MdAttachMoney, MdAccountBalanceWallet,
  MdExpandMore, MdExpandLess, MdLogout, MdReceiptLong, MdScale, MdArchive
} from 'react-icons/md'
import { useWindowSize } from '@/hooks/useWindowSize'
import { useApp } from '@/context/AppContext'
import { API_BASE_URL as backendUrl } from '@/config/api'
import styles from '@/styles/Sidebar.module.css'

const isTouchDevice = () => window.matchMedia('(pointer: coarse)').matches

const ownerLinks = [
  { to: '/', label: 'Dashboard', icon: <MdDashboard /> },
  { to: '/barcodes', label: 'Barcodes', icon: <MdDocumentScanner /> },
  {
    label: 'Products', icon: <MdInventory />, key: 'products',
    children: [
      { to: '/products', label: 'All Products', icon: <MdInventory /> },
      { to: '/stock-out', label: 'Stock Out', icon: <MdPointOfSale /> },
      { to: '/categories', label: 'Categories', icon: <MdCategory /> },
      { to: '/expired-stock', label: 'Expired Stock', icon: <MdWarning /> },
    ]
  },
  { to: '/sales-history', label: 'Sales History', icon: <MdHistory /> },
  { to: '/reports', label: 'Reports', icon: <MdBarChart /> },
  { to: '/daily-report', label: 'Daily Z-Report', icon: <MdReceiptLong /> },
  { to: '/daily-archives', label: 'Daily Archives', icon: <MdArchive /> },
  { to: '/weigh-station', label: 'Weigh Station', icon: <MdScale /> },
  { to: '/customers', label: 'Debtors', icon: <MdPeopleAlt /> },
  { to: '/employees', label: 'Staff Management', icon: <MdPerson /> },
  {
    label: 'Suppliers', icon: <MdLocalShipping />, key: 'suppliers',
    children: [
      { to: '/suppliers', label: 'Suppliers', icon: <MdLocalShipping /> },
      { to: '/purchase-orders', label: 'Purchase Orders', icon: <MdShoppingCart /> },
    ]
  },
  {
    label: 'Expenses', icon: <MdAttachMoney />, key: 'expenses',
    children: [
      { to: '/expenses', label: 'Expenses', icon: <MdAttachMoney /> },
      { to: '/petty-cash', label: 'Petty Cash', icon: <MdAccountBalanceWallet /> },
    ]
  },
  { to: '/stores', label: 'Stores', icon: <MdStorefront /> },
]

const managerLinks = [
  { to: '/', label: 'Dashboard', icon: <MdDashboard /> },
  { to: '/barcodes', label: 'Barcodes', icon: <MdDocumentScanner /> },
  {
    label: 'Products', icon: <MdInventory />, key: 'products',
    children: [
      { to: '/products', label: 'All Products', icon: <MdInventory /> },
      { to: '/stock-out', label: 'Stock Out', icon: <MdPointOfSale /> },
      { to: '/categories', label: 'Categories', icon: <MdCategory /> },
    ]
  },
  { to: '/sales-history', label: 'Sales History', icon: <MdHistory /> },
  { to: '/reports', label: 'Store Reports', icon: <MdBarChart /> },
  { to: '/daily-report', label: 'Daily Z-Report', icon: <MdReceiptLong /> },
  { to: '/daily-archives', label: 'Daily Archives', icon: <MdArchive /> },
  { to: '/weigh-station', label: 'Weigh Station', icon: <MdScale /> },
  { to: '/customers', label: 'Debtors', icon: <MdPeopleAlt /> },
  {
    label: 'Suppliers', icon: <MdLocalShipping />, key: 'suppliers',
    children: [
      { to: '/suppliers', label: 'Suppliers', icon: <MdLocalShipping /> },
      { to: '/purchase-orders', label: 'Purchase Orders', icon: <MdShoppingCart /> },
    ]
  },
  {
    label: 'Expenses', icon: <MdAttachMoney />, key: 'expenses',
    children: [
      { to: '/expenses', label: 'Expenses', icon: <MdAttachMoney /> },
      { to: '/petty-cash', label: 'Petty Cash', icon: <MdAccountBalanceWallet /> },
    ]
  },
  { to: '/stores', label: 'Stores', icon: <MdStorefront /> },
]

const cashierLinks = [
  { to: '/barcodes', label: 'Scan to Sell', icon: <MdDocumentScanner /> },
  { to: '/stock-out', label: 'Record Sale', icon: <MdPointOfSale /> },
  { to: '/sales-history', label: 'My Sales', icon: <MdHistory /> },
  { to: '/my-credits', label: 'My Credits', icon: <MdCreditCard /> },
  { to: '/weigh-station', label: 'Weigh Station', icon: <MdScale /> },
]

// ── Collapsible group ─────────────────────────────────────────────────
function NavGroup({ group, onMobileClose }) {
  const { isMobile } = useWindowSize()

  // Auto-open if a child route is currently active
  const isAnyChildActive = group.children?.some(c => window.location.pathname === c.to)
  const [open, setOpen] = useState(isAnyChildActive)

  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-all duration-150"
        style={{ color: 'var(--sidebar-text)', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
        onMouseEnter={e => { if (!isTouchDevice()) e.currentTarget.style.background = 'var(--sidebar-hover-bg)' }}
        onMouseLeave={e => { if (!isTouchDevice()) e.currentTarget.style.background = 'transparent' }}
      >
        <span className="text-[17px] flex-shrink-0">{group.icon}</span>
        <span className="truncate flex-1 text-left">{group.label}</span>
        <span className="text-[14px] flex-shrink-0" style={{ opacity: 0.6 }}>
          {open ? <MdExpandLess /> : <MdExpandMore />}
        </span>
      </button>

      {open && (
        <div style={{ marginLeft: 14, borderLeft: '1px solid rgba(255,255,255,0.08)', paddingLeft: 8, marginTop: 2, marginBottom: 2 }}>
          {group.children.map(child => (
            <NavLink
              key={child.to}
              to={child.to}
              end
              onClick={() => isMobile && onMobileClose?.()}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-[12px] font-medium transition-all duration-150 ${styles.navItem}
                ${isActive ? 'shadow-sm' : ''}`
              }
              style={({ isActive }) => isActive
                ? { background: 'var(--sidebar-active-bg)', color: 'var(--sidebar-active-text)' }
                : { color: 'var(--sidebar-text)' }
              }
            >
              {({ isActive }) => (
                <>
                  <span className={`text-[15px] flex-shrink-0 ${isActive ? 'scale-110' : ''}`}>{child.icon}</span>
                  <span className="truncate">{child.label}</span>
                  {isActive && <span className="ml-auto w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: 'var(--sidebar-active-text)', opacity: 0.6 }} />}
                </>
              )}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Sidebar() {
  const { isMobile } = useWindowSize()
  const { currentUser, isOwner, isManager, settings, logout, sidebarOpen, setSidebarOpen } = useApp()
  const navigate = useNavigate()

  const companyName = settings?.companyName || settings?.businessName || 'Business Retail'
  const homeRoute = (isOwner || isManager) ? '/' : '/barcodes'

  const getLinks = () => {
    if (isOwner || currentUser?.role === 'owner') return ownerLinks
    if (currentUser?.role === 'manager') return managerLinks
    return cashierLinks
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const sidebarContent = (
    <div className="w-[230px] h-screen flex flex-col" style={{ background: 'var(--sidebar-bg)', boxShadow: '4px 0 24px rgba(30,27,75,0.18)' }}>

      {/* Brand */}
      <div className="px-5 py-5 flex items-center gap-3 flex-shrink-0" style={{ borderBottom: '1px solid var(--sidebar-border)' }}>
        <button
          onClick={() => { navigate(homeRoute); setSidebarOpen(false) }}
          style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0, touchAction: 'manipulation', userSelect: 'none' }}
          onMouseEnter={e => { if (!isTouchDevice()) e.currentTarget.style.opacity = '0.85' }}
          onMouseLeave={e => { if (!isTouchDevice()) e.currentTarget.style.opacity = '1' }}
          onMouseDown={e => e.currentTarget.style.opacity = '0.7'}
          onMouseUp={e => e.currentTarget.style.opacity = '1'}
          title="Go to home"
        >
          {settings?.logo ? (
            <img src={`${backendUrl}${settings.logo}`} alt="Logo" className="w-9 h-9 object-contain rounded-lg bg-white/10 p-1 flex-shrink-0" />
          ) : (
            <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-black text-base flex-shrink-0" style={{ background: 'var(--primary)' }}>
              {companyName.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="text-white text-[13px] font-bold truncate leading-tight">{companyName}</div>
            <div className="text-[10px] font-semibold uppercase tracking-widest truncate mt-0.5" style={{ color: 'var(--primary-muted)' }}>
              {currentUser?.store || 'Main Terminal'}
            </div>
          </div>
        </button>
        {isMobile && (
          <button onClick={() => setSidebarOpen(false)} className="text-white/60 hover:text-white transition ml-1 flex-shrink-0">
            <MdClose className="text-xl" />
          </button>
        )}
      </div>

      {/* Role badge */}
      <div className="px-5 pt-4 pb-2 flex-shrink-0">
        <span className="text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-md"
          style={{ background: 'rgba(255,255,255,0.07)', color: 'var(--primary-muted)', letterSpacing: '0.12em' }}>
          {currentUser?.role || 'Staff'} Menu
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 pb-2 mt-1 space-y-0.5 custom-scrollbar">
        {getLinks().map((link, i) => {
          if (link.children) {
            return <NavGroup key={link.key || i} group={link} onMobileClose={() => setSidebarOpen(false)} />
          }
          return (
            <NavLink
              key={link.to}
              to={link.to}
              end
              onClick={() => isMobile && setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-all duration-150 group ${styles.navItem}
                ${isActive ? 'shadow-md' : ''}`
              }
              style={({ isActive }) => isActive
                ? { background: 'var(--sidebar-active-bg)', color: 'var(--sidebar-active-text)' }
                : { color: 'var(--sidebar-text)' }
              }
            >
              {({ isActive }) => (
                <>
                  <span className={`text-[17px] flex-shrink-0 transition-transform duration-150 ${isActive ? 'scale-110' : 'group-hover:scale-105'}`}>
                    {link.icon}
                  </span>
                  <span className="truncate">{link.label}</span>
                  {isActive && <span className="ml-auto w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: 'var(--sidebar-active-text)', opacity: 0.6 }} />}
                </>
              )}
            </NavLink>
          )
        })}
      </nav>

      {/* Bottom — Logout + version */}
      <div className="px-3 flex-shrink-0" style={{ borderTop: '1px solid var(--sidebar-border)', paddingTop: 10, paddingBottom: 12 }}>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-all duration-150"
          style={{ color: '#FDA4AF', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
          onMouseEnter={e => { if (!isTouchDevice()) { e.currentTarget.style.background = 'rgba(239,68,68,0.12)'; e.currentTarget.style.color = '#FCA5A5' } }}
          onMouseLeave={e => { if (!isTouchDevice()) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#FDA4AF' } }}
        >
          <MdLogout className="text-[17px] flex-shrink-0" />
          <span>Sign Out</span>
        </button>
        <div className="text-center mt-2">
          <span className="text-[10px] font-semibold" style={{ color: 'var(--primary-muted)', opacity: 0.45 }}>
            POS System v3.0
          </span>
        </div>
      </div>
    </div>
  )

  return (
    <>
      {isMobile ? (
        <>
          {sidebarOpen && <div onClick={() => setSidebarOpen(false)} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[1000]" />}
          <div className={`fixed top-0 left-0 h-screen z-[1001] transition-transform duration-300 ease-out ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
            {sidebarContent}
          </div>
        </>
      ) : (
        <div className="fixed top-0 left-0 h-screen z-[100]">
          {sidebarContent}
        </div>
      )}
    </>
  )
}
