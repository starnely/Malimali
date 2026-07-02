import { useState, useMemo, useEffect } from 'react'
import {
  MdCheckCircle, MdBarChart, MdAccessTime,
  MdAttachMoney, MdTrendingUp, MdToday,
  MdWarning, MdPeopleAlt, MdShoppingCart, MdPayments,
  MdArrowUpward, MdArrowDownward,
} from 'react-icons/md'
import { useApp } from '@/context/AppContext'
import { useNavigate, useLocation } from 'react-router-dom'
import { fmtQty } from '@/utils/utils'
import EmployeeSalesModal from '@/components/modals/EmployeeSalesModal'
import styles from '@/styles/Dashboard.module.css'
import Button from '@/components/shared/Button'
import PendingReturnsPanel from '@/components/panels/PendingReturnsPanel'
import { API_BASE_URL } from '@/config/api'

export default function Dashboard() {
  const {
    socket, products, sales, todaySales, pendingReturns, dailyArchives,
    fetchSales, fetchArchives, fetchProducts,
    fetchCustomers, fetchExpenseSummary, currentUser,
  } = useApp()

  const [debtSummary, setDebtSummary] = useState(null)
  const [debtLoading, setDebtLoading] = useState(true)
  const [lowStockCount, setLowStockCount] = useState(null)
  const [stockLoading, setStockLoading] = useState(true)
  const [expenseTotal, setExpenseTotal] = useState(null)
  const [expenseCats, setExpenseCats] = useState(0)
  const [expenseLoading, setExpenseLoading] = useState(true)
  const [supplierDebt, setSupplierDebt] = useState(0)
  const [supplierDebtCount, setSupplierDebtCount] = useState(0)
  const [pendingInvoiceCount, setPendingInvoiceCount] = useState(0)
  const [supplierDebtLoading, setSupplierDebtLoading] = useState(true)

  const syncAllData = useMemo(() => () => {
    fetchSales(); fetchArchives(); fetchProducts()
  }, [fetchSales, fetchArchives, fetchProducts])

  const todayEAT = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString().split('T')[0]

  useEffect(() => {
    let active = true
    fetchCustomers({}).then(data => {
      if (!active || !Array.isArray(data)) return
      setDebtSummary({
        totalDebt: data.reduce((s, c) => s + (c.balance || 0), 0),
        overdueCount: data.filter(c => c.overdue).length,
        blacklistedCount: data.filter(c => c.blacklisted).length,
        activeCount: data.filter(c => c.balance > 0).length,
      })
      setDebtLoading(false)
    })
    return () => { active = false }
  }, [fetchCustomers])

  useEffect(() => {
    if (!currentUser?.token) return
    let active = true
    const load = async () => {
      setStockLoading(true)
      try {
        const store = currentUser.role === 'owner' ? null : (currentUser.store || null)
        const stockQuery = store ? `?store=${encodeURIComponent(store)}` : ''
        const res = await fetch(`${API_BASE_URL}/api/products/low-stock${stockQuery}`, { headers: { Authorization: `Bearer ${currentUser.token}` } })
        const data = await res.json()
        if (active) setLowStockCount(data.count ?? data.products?.length ?? 0)
      } catch { if (active) setLowStockCount(0) }
      finally { if (active) setStockLoading(false) }
    }
    load()
    return () => { active = false }
  }, [currentUser])

  useEffect(() => {
    if (!currentUser?.token) return
    let active = true
    const load = async () => {
      setExpenseLoading(true)
      try {
        const store = currentUser.role === 'owner' ? null : (currentUser.store || null)
        const data = await fetchExpenseSummary({ ...(store ? { store } : {}), date: todayEAT })
        if (active) { setExpenseTotal(data.grandTotal ?? 0); setExpenseCats(data.summary?.length ?? 0) }
      } catch { if (active) setExpenseTotal(0) }
      finally { if (active) setExpenseLoading(false) }
    }
    load()
    return () => { active = false }
  }, [currentUser, fetchExpenseSummary, todayEAT])

  useEffect(() => {
    if (!currentUser?.token) return
    let active = true
    const load = async () => {
      setSupplierDebtLoading(true)
      try {
        const store = currentUser.role === 'owner' ? null : (currentUser.store || null)
        const debtQuery = store ? `?store=${encodeURIComponent(store)}` : ''
        const res = await fetch(`${API_BASE_URL}/api/purchase-orders/outstanding${debtQuery}`, { headers: { Authorization: `Bearer ${currentUser.token}` } })
        const data = await res.json()
        if (active) { setSupplierDebt(data.totalOutstanding || 0); setSupplierDebtCount(data.count || 0); setPendingInvoiceCount(data.pendingInvoiceCount || 0) }
      } catch { if (active) { setSupplierDebt(0); setSupplierDebtCount(0) } }
      finally { if (active) setSupplierDebtLoading(false) }
    }
    load()
    return () => { active = false }
  }, [currentUser])

  useEffect(() => {
    syncAllData()
    if (socket) {
      socket.on('newSale', () => syncAllData())
      socket.on('productsUpdated', () => fetchProducts())
      socket.on('adminShiftNotification', () => fetchArchives())
      socket.on('supplierPaymentMade', () => {
        if (!currentUser?.token) return
        const store = currentUser.role === 'owner' ? null : (currentUser.store || null)
        const q = store ? `?store=${encodeURIComponent(store)}` : ''
        fetch(`${API_BASE_URL}/api/purchase-orders/outstanding${q}`, { headers: { Authorization: `Bearer ${currentUser.token}` } })
          .then(r => r.json()).then(d => { setSupplierDebt(d.totalOutstanding || 0); setSupplierDebtCount(d.count || 0); setPendingInvoiceCount(d.pendingInvoiceCount || 0) }).catch(() => { })
      })
    }
    const interval = setInterval(syncAllData, 5 * 60 * 1000)
    return () => {
      clearInterval(interval)
      if (socket) { socket.off('newSale'); socket.off('productsUpdated'); socket.off('adminShiftNotification'); socket.off('supplierPaymentMade') }
    }
  }, [socket, syncAllData, fetchArchives, fetchProducts, currentUser])

  const navigate = useNavigate()
  const location = useLocation()
  const [selectedEmployee, setSelectedEmployee] = useState(null)

  const today = new Date().toLocaleDateString('en-CA')
  const safeProducts = useMemo(() => products ?? [], [products])
  const safeTodaySales = useMemo(() => todaySales ?? [], [todaySales])
  const safeReturns = useMemo(() => pendingReturns ?? [], [pendingReturns])
  const safeDailyArchives = useMemo(() => dailyArchives ?? [], [dailyArchives])

  const closedTodayNames = useMemo(() =>
    safeDailyArchives
      .filter(a => a?.date && new Date(a.date).toLocaleDateString('en-CA') === today)
      .map(a => (a.employeeName || '').toLowerCase().trim()),
    [safeDailyArchives, today]
  )

  const productMap = useMemo(() => {
    const m = {}
    safeProducts.forEach(p => { m[String(p._id)] = p.buyPrice || 0 })
    return m
  }, [safeProducts])

  // ── Active qty: subtracts both voided and returned units ──────────
  const activeQty = (item) => {
    if (item.voidStatus === 'voided') return 0
    return Math.max(0, (item.qty || 0) - (item.voidedQty || 0) - (item.returnedQty || 0))
  }

  const calcRevenue = (arr) => arr.reduce((sum, s) => {
    if (s.returned || s.voided) return sum
    return sum + (s.items?.reduce((rv, item) => {
      if (item.voidStatus === 'voided') return rv
      return rv + (item.price || 0) * activeQty(item)
    }, 0) || 0)
  }, 0)

  const calcProfit = (arr) => arr.reduce((sum, sale) => {
    if (sale.returned || sale.voided) return sum
    return sum + (sale.items?.reduce((s2, item) => {
      if (item.voidStatus === 'voided') return s2
      const buy = productMap[String(item.productId?._id || item.productId)] || 0
      return s2 + (item.price - buy) * activeQty(item)
    }, 0) || 0)
  }, 0)

  const allSales = sales ?? []
  const todayRevenue = calcRevenue(safeTodaySales)
  const todayProfit = calcProfit(safeTodaySales)
  const todayQty = safeTodaySales.reduce((sum, s) => {
    if (s.voided || s.returned) return sum
    return sum + (s.items?.reduce((q, i) => {
      if (i.voidStatus === 'voided') return q
      return q + activeQty(i)
    }, 0) || 0)
  }, 0)
  const profitMargin = todayRevenue > 0 ? Math.round((todayProfit / todayRevenue) * 100) : 0
  const netPosition = todayRevenue - (expenseTotal || 0)

  const todaySellers = [...new Set(safeTodaySales.map(s => s.cashier).filter(Boolean))]
  const sellerStats = todaySellers.map(seller => {
    const sellerSales = safeTodaySales.filter(s => s.cashier === seller)
    const hasClosed = closedTodayNames.some(n => n === (seller || '').toLowerCase().trim())
    return {
      name: seller,
      total: calcRevenue(sellerSales),
      profit: calcProfit(sellerSales),
      qty: sellerSales.reduce((sum, s) => {
        if (s.voided || s.returned) return sum
        return sum + (s.items?.reduce((q, i) => {
          if (i.voidStatus === 'voided') return q
          return q + activeQty(i)
        }, 0) || 0)
      }, 0),
      count: sellerSales.length,
      hasClosed,
    }
  }).sort((a, b) => b.total - a.total)

  const hourNow = new Date().getHours()
  const greeting = hourNow < 12 ? 'Morning' : hourNow < 17 ? 'Afternoon' : 'Evening'

  return (
    <div className={styles.page}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: 4 }}>
            {new Date().toLocaleDateString('en-KE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', margin: 0, lineHeight: 1.2 }}>Good {greeting} 👋</h1>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
            {currentUser?.fullname || currentUser?.username} · {currentUser?.store || 'Headquarters'}
          </div>
        </div>
        <Button onClick={() => navigate(location.pathname + location.search, { state: { ...location.state, modal: 'daily-summary' } })} variant="primary">
          <MdBarChart style={{ fontSize: 18 }} /> Daily Summary
        </Button>
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
        <div className={`${styles.card} ${styles['card-warning']} ${styles['animate-slideUp']}`} style={{ cursor: 'pointer' }} onClick={() => navigate('/sales-history')}>
          <div className={`${styles.icon} ${styles['icon-warning']}`}><MdToday style={{ fontSize: 20 }} /></div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 4 }}>Today's Revenue</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--text-primary)', lineHeight: 1.1 }}>KSh {todayRevenue.toLocaleString()}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>{fmtQty(todayQty)} items sold</div>
          </div>
        </div>
        <div className={`${styles.card} ${styles[todayProfit >= 0 ? 'card-success' : 'card-danger']} ${styles['animate-slideUp']}`} style={{ cursor: 'pointer' }} onClick={() => navigate('/reports')}>
          <div className={`${styles.icon} ${styles[todayProfit >= 0 ? 'icon-success' : 'icon-danger']}`}>
            {todayProfit >= 0 ? <MdArrowUpward style={{ fontSize: 20 }} /> : <MdArrowDownward style={{ fontSize: 20 }} />}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 4 }}>Today's Profit</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--text-primary)', lineHeight: 1.1 }}>KSh {todayProfit.toLocaleString()}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>{profitMargin}% margin</div>
          </div>
        </div>
        <div className={`${styles.card} ${styles[expenseTotal > 0 ? 'card-danger' : 'card-primary']} ${styles['animate-slideUp']}`} style={{ cursor: 'pointer' }} onClick={() => navigate('/expenses')}>
          <div className={`${styles.icon} ${styles[expenseTotal > 0 ? 'icon-danger' : 'icon-primary']}`}><MdAttachMoney style={{ fontSize: 20 }} /></div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 4 }}>Today's Expenses</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--text-primary)', lineHeight: 1.1 }}>{expenseLoading ? '—' : `KSh ${(expenseTotal || 0).toLocaleString()}`}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>{expenseLoading ? 'Loading...' : expenseTotal > 0 ? `${expenseCats} categor${expenseCats !== 1 ? 'ies' : 'y'}` : 'None logged today'}</div>
          </div>
        </div>
        <div className={`${styles.card} ${styles[netPosition >= 0 ? 'card-success' : 'card-danger']} ${styles['animate-slideUp']}`} style={{ cursor: 'pointer' }} onClick={() => navigate('/reports')}>
          <div className={`${styles.icon} ${styles[netPosition >= 0 ? 'icon-success' : 'icon-danger']}`}><MdTrendingUp style={{ fontSize: 20 }} /></div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 4 }}>Net Position</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--text-primary)', lineHeight: 1.1 }}>KSh {netPosition.toLocaleString()}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>Revenue − Expenses</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14 }}>
        <div onClick={() => navigate('/products', { state: { filter: 'lowStock' } })} className={`${styles['animate-slideUp']} ${styles.metricTile}`} style={{ background: lowStockCount > 0 ? '#fff7ed' : 'var(--bg-card)', border: `1px solid ${lowStockCount > 0 ? '#fed7aa' : 'var(--border-soft)'}`, borderLeft: `4px solid ${lowStockCount > 0 ? '#ea580c' : 'var(--border-medium)'}`, borderRadius: 'var(--radius-lg)', padding: '16px 18px', cursor: 'pointer', boxShadow: 'var(--shadow-card)', transition: 'all 0.15s' }}>
          <div style={{ marginBottom: 8 }}><div style={{ width: 32, height: 32, borderRadius: 'var(--radius-sm)', background: lowStockCount > 0 ? '#fed7aa' : 'var(--bg-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><MdWarning style={{ color: lowStockCount > 0 ? '#ea580c' : 'var(--text-muted)', fontSize: 18 }} /></div></div>
          <div style={{ fontSize: 26, fontWeight: 900, color: lowStockCount > 0 ? '#ea580c' : 'var(--text-muted)', lineHeight: 1, marginBottom: 4 }}>{stockLoading ? '—' : lowStockCount}</div>
          <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em', color: lowStockCount > 0 ? '#ea580c' : 'var(--text-muted)', marginBottom: 2 }}>Low Stock</div>
          <div style={{ fontSize: 11, color: lowStockCount > 0 ? '#92400e' : 'var(--text-muted)' }}>{stockLoading ? 'Checking...' : lowStockCount === 0 ? 'All levels OK ✓' : 'Click to view'}</div>
        </div>
        <div onClick={() => navigate('/purchase-orders')} className={`${styles['animate-slideUp']} ${styles.metricTile}`} style={{ background: supplierDebt > 0 ? 'var(--danger-light)' : 'var(--bg-card)', border: `1px solid ${supplierDebt > 0 ? '#fecaca' : 'var(--border-soft)'}`, borderLeft: `4px solid ${supplierDebt > 0 ? 'var(--danger)' : 'var(--border-medium)'}`, borderRadius: 'var(--radius-lg)', padding: '16px 18px', cursor: 'pointer', boxShadow: 'var(--shadow-card)', transition: 'all 0.15s' }}>
          <div style={{ marginBottom: 8 }}><div style={{ width: 32, height: 32, borderRadius: 'var(--radius-sm)', background: supplierDebt > 0 ? '#fecaca' : 'var(--bg-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><MdPayments style={{ color: supplierDebt > 0 ? 'var(--danger)' : 'var(--text-muted)', fontSize: 18 }} /></div></div>
          <div style={{ fontSize: supplierDebt > 0 ? 18 : 26, fontWeight: 900, color: supplierDebt > 0 ? 'var(--danger)' : 'var(--text-muted)', lineHeight: 1, marginBottom: 4 }}>{supplierDebtLoading ? '—' : supplierDebt > 0 ? `KSh ${supplierDebt.toLocaleString()}` : '✓'}</div>
          <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em', color: supplierDebt > 0 ? 'var(--danger-dark)' : 'var(--text-muted)', marginBottom: 2 }}>Supplier Debt</div>
          <div style={{ fontSize: 11, color: supplierDebt > 0 ? 'var(--danger-dark)' : 'var(--text-muted)' }}>{supplierDebtLoading ? 'Loading...' : supplierDebt > 0 ? `${supplierDebtCount} unpaid PO${supplierDebtCount !== 1 ? 's' : ''}` : 'All suppliers paid'}</div>
          {!supplierDebtLoading && pendingInvoiceCount > 0 && (
            <div style={{ fontSize: 10, color: 'var(--warning-dark)', marginTop: 3 }}>⚠ {pendingInvoiceCount} awaiting invoice</div>
          )}
        </div>
        <div onClick={() => navigate('/sales-history')} className={`${styles['animate-slideUp']} ${styles.metricTile}`} style={{ background: safeReturns.length > 0 ? 'var(--info-light)' : 'var(--bg-card)', border: `1px solid ${safeReturns.length > 0 ? 'var(--info)' : 'var(--border-soft)'}`, borderLeft: `4px solid ${safeReturns.length > 0 ? 'var(--info)' : 'var(--border-medium)'}`, borderRadius: 'var(--radius-lg)', padding: '16px 18px', cursor: 'pointer', boxShadow: 'var(--shadow-card)', transition: 'all 0.15s' }}>
          <div style={{ marginBottom: 8 }}><div style={{ width: 32, height: 32, borderRadius: 'var(--radius-sm)', background: safeReturns.length > 0 ? 'var(--info)' : 'var(--bg-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><MdShoppingCart style={{ color: safeReturns.length > 0 ? '#fff' : 'var(--text-muted)', fontSize: 18 }} /></div></div>
          <div style={{ fontSize: 26, fontWeight: 900, color: safeReturns.length > 0 ? 'var(--info-dark)' : 'var(--text-muted)', lineHeight: 1, marginBottom: 4 }}>{safeReturns.length}</div>
          <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em', color: safeReturns.length > 0 ? 'var(--info-dark)' : 'var(--text-muted)', marginBottom: 2 }}>Pending Returns</div>
          <div style={{ fontSize: 11, color: safeReturns.length > 0 ? 'var(--info-dark)' : 'var(--text-muted)' }}>{safeReturns.length > 0 ? 'Click to review' : 'None pending ✓'}</div>
        </div>
      </div>

      <DebtWidget summary={debtSummary} loading={debtLoading} onNavigate={() => navigate('/customers')} />

      {safeReturns.length > 0 && (
        <div id="returns-section"><PendingReturnsPanel pendingReturns={safeReturns} /></div>
      )}

      <div className={styles.box}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 className={styles.title} style={{ margin: 0 }}>
            <MdBarChart style={{ color: 'var(--primary)', fontSize: 18 }} /> Sales by Employee Today
          </h2>
          {sellerStats.length > 0 && <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>{sellerStats.length} active · {fmtQty(todayQty)} items</span>}
        </div>
        {sellerStats.length === 0 ? (
          <div className={styles.empty}><div style={{ fontSize: 32, marginBottom: 8 }}>📊</div>No sales recorded today</div>
        ) : (
          <div className={styles.grid}>
            {sellerStats.map((s, i) => {
              const share = todayRevenue > 0 ? Math.round((s.total / todayRevenue) * 100) : 0
              return (
                <div key={i} className={`${styles.employeeCard} ${styles['animate-slideUp']}`} onClick={() => setSelectedEmployee(s.name)}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 900, fontSize: 12, flexShrink: 0 }}>{s.name.charAt(0).toUpperCase()}</div>
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{s.name}</span>
                    </div>
                    {s.hasClosed ? (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20, background: 'var(--success-light)', color: 'var(--success-dark)', whiteSpace: 'nowrap' }}><MdCheckCircle style={{ fontSize: 10 }} /> Closed</span>
                    ) : (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20, background: 'var(--warning-light)', color: 'var(--warning-dark)', whiteSpace: 'nowrap' }}><MdAccessTime style={{ fontSize: 10 }} /> Working</span>
                    )}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
                    <div><div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 2 }}>Revenue</div><div style={{ fontSize: 14, fontWeight: 900, color: 'var(--primary)' }}>KSh {s.total.toLocaleString()}</div></div>
                    <div><div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 2 }}>Profit</div><div style={{ fontSize: 14, fontWeight: 900, color: 'var(--success-dark)' }}>KSh {s.profit.toLocaleString()}</div></div>
                  </div>
                  <div style={{ height: 4, borderRadius: 4, background: 'var(--border-soft)', overflow: 'hidden', marginBottom: 5 }}>
                    <div style={{ height: '100%', width: `${share}%`, background: 'var(--primary)', borderRadius: 4, transition: 'width 0.5s ease' }} />
                  </div>
                  <div className={styles.muted}>{s.count} sales · {fmtQty(s.qty)} items · {share}% of today</div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {selectedEmployee && <EmployeeSalesModal employee={selectedEmployee} sales={allSales} products={safeProducts} date={today} onClose={() => setSelectedEmployee(null)} />}
    </div>
  )
}

function DebtWidget({ summary, loading, onNavigate }) {
  if (loading) return (
    <div className={styles.box} style={{ padding: '16px 20px' }}>
      <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Loading debtor summary...</div>
    </div>
  )
  return (
    <div className={styles.box} style={{ padding: '20px 24px', cursor: 'pointer' }} onClick={onNavigate}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 className={styles.title} style={{ margin: 0 }}><MdPeopleAlt style={{ color: 'var(--primary)' }} /> Debtor Tracker</h2>
        <button onClick={e => { e.stopPropagation(); onNavigate() }} className={styles.widgetAction} style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>View All →</button>
      </div>
      {!summary || summary.activeCount === 0 ? (
        <div className={styles.empty} style={{ padding: '12px 0' }}>✅ No outstanding credit balances</div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10, marginBottom: summary.overdueCount > 0 ? 14 : 0 }}>
            {[
              { label: 'Outstanding', value: `KSh ${summary.totalDebt.toLocaleString()}`, bg: '#eff6ff', border: '#bfdbfe', color: 'var(--primary)' },
              { label: 'Active Debtors', value: summary.activeCount, bg: '#eff6ff', border: '#bfdbfe', color: 'var(--primary)' },
              { label: 'Overdue', value: summary.overdueCount, bg: summary.overdueCount > 0 ? '#fff7ed' : '#f0fdf4', border: summary.overdueCount > 0 ? '#fed7aa' : '#bbf7d0', color: summary.overdueCount > 0 ? '#ea580c' : 'var(--success-dark)' },
              ...(summary.blacklistedCount > 0 ? [{ label: 'Blacklisted', value: summary.blacklistedCount, bg: '#fef2f2', border: '#fecaca', color: '#dc2626' }] : []),
            ].map(s => (
              <div key={s.label} style={{ background: s.bg, border: `1px solid ${s.border}`, borderRadius: 'var(--radius-md)', padding: '12px 14px' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: s.color, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{s.label}</div>
                <div style={{ fontSize: 18, fontWeight: 900, color: s.color }}>{s.value}</div>
              </div>
            ))}
          </div>
          {summary.overdueCount > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 'var(--radius-md)', padding: '10px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: '#92400e' }}>
                <MdWarning style={{ color: '#ea580c', fontSize: 16, flexShrink: 0 }} />
                {summary.overdueCount} customer{summary.overdueCount !== 1 ? 's have' : ' has'} passed their payment deadline
              </div>
              <button onClick={e => { e.stopPropagation(); onNavigate() }} className={styles.widgetAction} style={{ padding: '5px 12px', background: '#ea580c', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>Follow Up</button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
