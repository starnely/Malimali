import { useState, useEffect, useMemo, useRef } from 'react'
import {
  MdAttachMoney, MdTrendingUp, MdInventory, MdReceiptLong,
  MdPeopleAlt, MdAccountBalanceWallet, MdRefresh, MdDownload,
  MdCalendarToday, MdStorefront, MdWarning,
  MdChevronLeft, MdChevronRight, MdLocalShipping,
} from 'react-icons/md'
import { useApp } from '@/context/AppContext'
import { buildLiveSummary, fmtQty } from '@/utils/utils'
import * as XLSX from 'xlsx'
import { API_BASE_URL } from '@/config/api'
import styles from '@/styles/DailyReport.module.css'

const isTouchDevice = () => window.matchMedia('(pointer: coarse)').matches

const TODAY_EAT = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString().split('T')[0]

const EXPENSE_CAT_LABELS = {
  rent: '🏠 Rent', utilities: '💡 Utilities', wages: '👷 Wages',
  supplies: '🛒 Supplies', petty_cash: '💵 Petty Cash',
  transport: '🚗 Transport', maintenance: '🔧 Maintenance',
  marketing: '📢 Marketing', taxes: '📋 Taxes', other: '📎 Other',
}

const XL_PRIMARY       = '185FA5'
const XL_PRIMARY_DARK  = '0C447C'
const XL_PRIMARY_LIGHT = 'E6F1FB'

function SectionHeader({ icon, title, subtitle }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
      <div style={{ width: 32, height: 32, borderRadius: 'var(--radius-md)', background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)', fontSize: 18, flexShrink: 0 }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)' }}>{title}</div>
        {subtitle && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{subtitle}</div>}
      </div>
    </div>
  )
}

function Card({ children, style }) {
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-soft)', borderRadius: 'var(--radius-lg)', padding: '18px 20px', boxShadow: 'var(--shadow-card)', ...style }}>
      {children}
    </div>
  )
}

function StatTile({ label, value, color, bg, icon, sub }) {
  return (
    <div style={{ background: bg, borderRadius: 'var(--radius-lg)', padding: '14px 16px', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
      {icon && <div style={{ fontSize: 22, color, flexShrink: 0, marginTop: 2 }}>{icon}</div>}
      <div>
        <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em', color, opacity: 0.8, marginBottom: 3 }}>{label}</div>
        <div style={{ fontSize: 18, fontWeight: 900, color }}>{value}</div>
        {sub && <div style={{ fontSize: 11, color, opacity: 0.65, marginTop: 2 }}>{sub}</div>}
      </div>
    </div>
  )
}

export default function DailyReport() {
  const {
    sales, products, currentUser, isOwner, stores,
    dailyArchives, fetchExpenseSummary, fetchPettyCashToday,
  } = useApp()

  const [selectedDate,  setSelectedDate]  = useState(TODAY_EAT)
  const [selectedStore, setSelectedStore] = useState(isOwner ? 'All' : (currentUser?.store || ''))

  const [repayments,     setRepayments]     = useState([])
  const [repayLoading,   setRepayLoading]   = useState(false)
  const [expenseSummary, setExpenseSummary] = useState([])
  const [expenseTotal,   setExpenseTotal]   = useState(0)
  const [expenseLoading, setExpenseLoading] = useState(true)
  const [pettyCash,      setPettyCash]      = useState(null)
  const [pcLoading,      setPcLoading]      = useState(true)
  const [supplierDebt,   setSupplierDebt]   = useState(0)
  const [debtLoading,    setDebtLoading]    = useState(true)
  const [expiredLoss,    setExpiredLoss]    = useState(0)
  const [expiredLoading, setExpiredLoading] = useState(true)
  const [refreshKey,     setRefreshKey]     = useState(0)
  const storeSelectRef = useRef(null)

  // ── Fetch repayments ──────────────────────────────────────────────
  useEffect(() => {
    let active = true
    setRepayLoading(true)
    const d = new Date(selectedDate + 'T00:00:00')
    const yr = d.getFullYear()
    const mo = d.getMonth() + 1
    const storeParam = (!isOwner && currentUser?.store) ? currentUser.store : (selectedStore !== 'All' ? selectedStore : '')
    const load = async () => {
      try {
        const res = await fetch(
          `${API_BASE_URL}/api/customers/repayments/month?year=${yr}&month=${mo}&store=${encodeURIComponent(storeParam)}`,
          { headers: { Authorization: `Bearer ${currentUser?.token}` } }
        )
        if (!res.ok) throw new Error()
        const data = await res.json()
        if (active) setRepayments(Array.isArray(data) ? data.filter(r => r.date === selectedDate) : [])
      } catch { if (active) setRepayments([]) }
      if (active) setRepayLoading(false)
    }
    load()
    return () => { active = false }
  }, [selectedDate, selectedStore, isOwner, currentUser, refreshKey])

  // ── Fetch expenses ────────────────────────────────────────────────
  useEffect(() => {
    let active = true
    setExpenseLoading(true)
    const storeParam = isOwner ? (selectedStore !== 'All' ? selectedStore : null) : (currentUser?.store || null)
    const load = async () => {
      try {
        const data = await fetchExpenseSummary({
          ...(storeParam ? { store: storeParam } : {}),
          date: selectedDate,
        })
        if (active) { setExpenseSummary(data.summary || []); setExpenseTotal(data.grandTotal || 0) }
      } catch { if (active) { setExpenseSummary([]); setExpenseTotal(0) } }
      if (active) setExpenseLoading(false)
    }
    load()
    return () => { active = false }
  }, [selectedDate, selectedStore, isOwner, currentUser, fetchExpenseSummary, refreshKey])

  // ── Fetch petty cash ──────────────────────────────────────────────
  useEffect(() => {
    let active = true
    setPcLoading(true)
    const storeParam = isOwner ? (selectedStore !== 'All' ? selectedStore : null) : (currentUser?.store || null)
    const load = async () => {
      try {
        if (!storeParam) { if (active) { setPettyCash(null); setPcLoading(false) }; return }
        const data = await fetchPettyCashToday(storeParam)
        if (active) setPettyCash(data.record || null)
      } catch { if (active) setPettyCash(null) }
      if (active) setPcLoading(false)
    }
    load()
    return () => { active = false }
  }, [selectedDate, selectedStore, isOwner, currentUser, fetchPettyCashToday, refreshKey])

  // ── Fetch outstanding supplier debt ──────────────────────────────
  useEffect(() => {
    let active = true
    setDebtLoading(true)
    const storeParam = isOwner
      ? (selectedStore !== 'All' ? selectedStore : '')
      : (currentUser?.store || '')
    const load = async () => {
      try {
        const url = storeParam
          ? `${API_BASE_URL}/api/purchase-orders/outstanding?store=${encodeURIComponent(storeParam)}`
          : `${API_BASE_URL}/api/purchase-orders/outstanding`
        const res = await fetch(url, { headers: { Authorization: `Bearer ${currentUser?.token}` } })
        if (!res.ok) throw new Error()
        const data = await res.json()
        if (active) setSupplierDebt(data.totalOutstanding || 0)
      } catch { if (active) setSupplierDebt(0) }
      if (active) setDebtLoading(false)
    }
    load()
    return () => { active = false }
  }, [selectedDate, selectedStore, isOwner, currentUser, refreshKey])

  // ── Fetch expired stock loss ─────────────────────────────────────
  useEffect(() => {
    let active = true
    setExpiredLoading(true)
    const storeParam = isOwner ? (selectedStore !== 'All' ? selectedStore : '') : (currentUser?.store || '')
    const load = async () => {
      try {
        const params = new URLSearchParams({ date: selectedDate })
        if (storeParam) params.set('store', storeParam)
        const url = `${API_BASE_URL}/api/expired/?${params}`
        const res = await fetch(url, { headers: { Authorization: `Bearer ${currentUser?.token}` } })
        const data = await res.json()
        if (!res.ok) throw new Error()
        if (active) setExpiredLoss(data.totalLoss || 0)
      } catch { if (active) setExpiredLoss(0) }
      if (active) setExpiredLoading(false)
    }
    load()
    return () => { active = false }
  }, [selectedDate, selectedStore, isOwner, currentUser, refreshKey])

  // ── Build summary ─────────────────────────────────────────────────
  const storeFilter = isOwner ? selectedStore : (currentUser?.store || 'All')
  const summary = useMemo(() =>
    buildLiveSummary(selectedDate, sales, products, storeFilter, expiredLoss),
    [selectedDate, sales, products, storeFilter, expiredLoss]
  )

  // ── Shift archives ────────────────────────────────────────────────
  const dayArchives = useMemo(() =>
    dailyArchives.filter(a => {
      const dateMatch  = a.date === selectedDate || String(a.date).slice(0, 10) === selectedDate
      const storeMatch = isOwner ? (selectedStore === 'All' || a.store === selectedStore) : a.store === currentUser?.store
      return dateMatch && storeMatch
    }),
    [dailyArchives, selectedDate, selectedStore, isOwner, currentUser]
  )

  const totalDebtCollected = repayments.reduce((s, r) => s + (r.amount || 0), 0)
  const netProfit          = (summary?.totalProfit || 0) - expenseTotal - expiredLoss
  const displayDate        = new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-KE', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  })

  // ── Date navigation ───────────────────────────────────────────────
  const prevDay = () => {
    const d = new Date(selectedDate + 'T00:00:00')
    d.setDate(d.getDate() - 1)
    setSelectedDate(d.toISOString().slice(0, 10))
  }
  const nextDay = () => {
    if (selectedDate >= TODAY_EAT) return
    const d = new Date(selectedDate + 'T00:00:00')
    d.setDate(d.getDate() + 1)
    setSelectedDate(d.toISOString().slice(0, 10))
  }
  const isToday = selectedDate === TODAY_EAT

  // ── Excel export ──────────────────────────────────────────────────
  const handleExport = () => {
    if (!summary) return
    const fmt = n => Number(n).toLocaleString('en-KE')
    const ws = {}, merges = []
    let r = 0

    const sc = (row, col, value, style) => {
      const addr = XLSX.utils.encode_cell({ r: row, c: col })
      ws[addr] = { v: value, t: typeof value === 'number' ? 'n' : 's', s: style }
    }
    const mc = (row, from, to) => merges.push({ s: { r: row, c: from }, e: { r: row, c: to } })

    const title = { font: { bold: true, sz: 14, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: XL_PRIMARY } }, alignment: { horizontal: 'left' } }
    const meta  = { font: { bold: false, sz: 11, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: XL_PRIMARY } }, alignment: { horizontal: 'left' } }
    const sec   = { font: { bold: true, sz: 11, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: XL_PRIMARY_DARK } }, alignment: { horizontal: 'left' } }
    const hdr   = { font: { bold: true, sz: 10, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '2D7DD2' } }, alignment: { horizontal: 'center' }, border: { top: { style: 'thin', color: { rgb: 'FFFFFF' } }, bottom: { style: 'thin', color: { rgb: 'FFFFFF' } }, left: { style: 'thin', color: { rgb: 'FFFFFF' } }, right: { style: 'thin', color: { rgb: 'FFFFFF' } } } }
    const cel   = i => ({ font: { sz: 10, color: { rgb: '333333' } }, fill: { fgColor: { rgb: i % 2 === 0 ? 'FFFFFF' : 'F0F6FD' } }, alignment: { horizontal: 'center' }, border: { top: { style: 'thin', color: { rgb: 'E0E0E0' } }, bottom: { style: 'thin', color: { rgb: 'E0E0E0' } }, left: { style: 'thin', color: { rgb: 'E0E0E0' } }, right: { style: 'thin', color: { rgb: 'E0E0E0' } } } })
    const lft   = i => ({ ...cel(i), alignment: { horizontal: 'left' } })
    const kvL   = { font: { bold: true, sz: 10, color: { rgb: '555555' } }, fill: { fgColor: { rgb: 'F8FAFB' } }, alignment: { horizontal: 'left' }, border: { top: { style: 'thin', color: { rgb: 'E0E0E0' } }, bottom: { style: 'thin', color: { rgb: 'E0E0E0' } }, left: { style: 'thin', color: { rgb: 'E0E0E0' } }, right: { style: 'thin', color: { rgb: 'E0E0E0' } } } }
    const kvV   = { font: { bold: true, sz: 11, color: { rgb: XL_PRIMARY } }, fill: { fgColor: { rgb: XL_PRIMARY_LIGHT } }, alignment: { horizontal: 'right' }, border: { top: { style: 'thin', color: { rgb: 'E0E0E0' } }, bottom: { style: 'thin', color: { rgb: 'E0E0E0' } }, left: { style: 'thin', color: { rgb: 'E0E0E0' } }, right: { style: 'thin', color: { rgb: 'E0E0E0' } } } }
    const kvW   = { font: { bold: true, sz: 11, color: { rgb: 'B45309' } }, fill: { fgColor: { rgb: 'FEF3C7' } }, alignment: { horizontal: 'right' }, border: { top: { style: 'thin', color: { rgb: 'E0E0E0' } }, bottom: { style: 'thin', color: { rgb: 'E0E0E0' } }, left: { style: 'thin', color: { rgb: 'E0E0E0' } }, right: { style: 'thin', color: { rgb: 'E0E0E0' } } } }
    const grn   = i => ({ ...cel(i), font: { sz: 10, color: { rgb: '2E7D32' }, bold: true } })
    const red   = i => ({ ...cel(i), font: { sz: 10, color: { rgb: 'C62828' }, bold: true } })
    const blu   = i => ({ ...cel(i), font: { sz: 10, color: { rgb: '0369a1' }, bold: true } })
    const COLS  = 6

    sc(r, 0, 'DAILY Z-REPORT', title); mc(r, 0, COLS - 1); r++
    sc(r, 0, `Date: ${displayDate}`, meta); mc(r, 0, COLS - 1); r++
    sc(r, 0, `Store: ${selectedStore}`, meta); mc(r, 0, COLS - 1); r++
    sc(r, 0, `Generated: ${new Date().toLocaleDateString('en-KE', { day: '2-digit', month: 'long', year: 'numeric' })}`, { ...meta, font: { sz: 10, color: { rgb: 'CCE0F5' } } }); mc(r, 0, COLS - 1); r++
    r++

    sc(r, 0, 'SUMMARY', sec); mc(r, 0, COLS - 1); r++
    ;[
      ['Total Revenue',              `KSh ${fmt(summary.totalRevenue)}`,  'Transactions',    String(summary.totalTransactions)],
      ['Gross Profit',               `KSh ${fmt(summary.totalProfit)}`,   'Items Sold',      String(fmtQty(summary?.totalItems || 0))],
      ['Cost of Goods',              `KSh ${fmt(summary.totalCOGS)}`,     '',                ''],
      ['Total Expenses',             `KSh ${fmt(expenseTotal)}`,          'Net Profit',      `KSh ${fmt(netProfit)}`],
      ['Inventory Loss (Expired)',   `KSh ${fmt(expiredLoss)}`,           '',                ''],
      ['Debt Collected',             `KSh ${fmt(totalDebtCollected)}`,    'Collections',     String(repayments.length)],
      ['Supplier Debt (owed)',       `KSh ${fmt(supplierDebt)}`,          'Outstanding POs', ''],
    ].forEach(([l1, v1, l2, v2], idx) => {
      sc(r, 0, l1, kvL)
      sc(r, 1, v1, idx === 5 ? kvW : kvV)
      sc(r, 2, '', { fill: { fgColor: { rgb: 'FFFFFF' } } })
      sc(r, 3, l2, l2 ? kvL : { fill: { fgColor: { rgb: 'FFFFFF' } } })
      sc(r, 4, v2, v2 ? kvV : { fill: { fgColor: { rgb: 'FFFFFF' } } })
      sc(r, 5, '', { fill: { fgColor: { rgb: 'FFFFFF' } } })
      r++
    })
    r++

    sc(r, 0, 'PAYMENT BREAKDOWN', sec); mc(r, 0, COLS - 1); r++
    ;['Method', 'Amount (KSh)', 'Count', '', '', ''].forEach((h, c) => sc(r, c, h, h ? hdr : { fill: { fgColor: { rgb: '2D7DD2' } } })); r++
    ;[
      ['💵 Cash',          summary.paymentBreakdown.cash   || 0, summary.cashSalesCount   || 0],
      ['📱 M-Pesa',        summary.paymentBreakdown.mpesa  || 0, summary.mpesaSalesCount  || 0],
      ['💳 Card (EDC)',    summary.paymentBreakdown.card   || 0, summary.cardSalesCount   || 0],
      ['🏦 Bank Transfer', summary.paymentBreakdown.bank   || 0, summary.bankSalesCount   || 0],
      ['📋 Credit (Owed)', summary.paymentBreakdown.credit || 0, summary.creditSalesCount || 0],
    ].forEach(([method, amount, count], i) => {
      sc(r, 0, method, lft(i)); sc(r, 1, amount, cel(i)); sc(r, 2, count, cel(i))
      for (let c = 3; c < COLS; c++) sc(r, c, '', cel(i)); r++
    })
    r++

    if (expenseSummary.length > 0) {
      sc(r, 0, 'EXPENSES', sec); mc(r, 0, COLS - 1); r++
      ;['Category', 'Amount (KSh)', 'Count', '', '', ''].forEach((h, c) => sc(r, c, h, h ? hdr : { fill: { fgColor: { rgb: '2D7DD2' } } })); r++
      expenseSummary.forEach((cat, i) => {
        sc(r, 0, EXPENSE_CAT_LABELS[cat._id] || cat._id, lft(i))
        sc(r, 1, cat.total, red(i)); sc(r, 2, cat.count || '', cel(i))
        for (let c = 3; c < COLS; c++) sc(r, c, '', cel(i)); r++
      })
      sc(r, 0, 'TOTAL EXPENSES', { ...lft(0), font: { bold: true, sz: 10, color: { rgb: 'C62828' } } })
      sc(r, 1, expenseTotal, red(0))
      for (let c = 2; c < COLS; c++) sc(r, c, '', cel(0)); r++; r++
    }

    if (pettyCash) {
      sc(r, 0, 'PETTY CASH', sec); mc(r, 0, COLS - 1); r++
      ;['Item', 'Amount (KSh)', '', '', '', ''].forEach((h, c) => sc(r, c, h, h ? hdr : { fill: { fgColor: { rgb: '2D7DD2' } } })); r++
      ;[
        ['Opening Float', pettyCash.openingFloat],
        ['Cash In',       pettyCash.totalIn],
        ['Cash Out',      pettyCash.totalOut],
        ['Net Balance',   pettyCash.netBalance],
        ['Closing Count', pettyCash.isClosed ? (pettyCash.closingFloat ?? '—') : 'Not closed'],
        ['Status',        pettyCash.isClosed ? `Closed by ${pettyCash.closedBy}` : 'Open'],
      ].forEach(([label, val], i) => {
        sc(r, 0, label, lft(i))
        sc(r, 1, typeof val === 'number' ? val : String(val), cel(i))
        for (let c = 2; c < COLS; c++) sc(r, c, '', cel(i)); r++
      })
      r++
    }

    sc(r, 0, 'PROFIT & LOSS', sec); mc(r, 0, COLS - 1); r++
    ;[
      ['Gross Revenue',                    summary.totalRevenue, '2E7D32'],
      ['Cost of Goods (COGS)',             summary.totalCOGS,    'C62828'],
      ['Gross Profit',                     summary.totalProfit,  summary.totalProfit >= 0 ? '2E7D32' : 'C62828'],
      ['Total Expenses',                   expenseTotal,         'C62828'],
      ['Inventory Loss (Expired Stock)',   expiredLoss,          'B45309'],
      ['Net Profit',                       netProfit,            netProfit >= 0 ? '2E7D32' : 'C62828'],
      ['Supplier Debt (unpaid)',           supplierDebt,         supplierDebt > 0 ? 'B45309' : '2E7D32'],
    ].forEach(([label, val, hex], i) => {
      sc(r, 0, label, lft(i))
      sc(r, 1, val, { ...cel(i), font: { sz: i === 4 ? 11 : 10, color: { rgb: hex }, bold: i === 4 } })
      for (let c = 2; c < COLS; c++) sc(r, c, '', cel(i)); r++
    })
    r++

    if (dayArchives.length > 0) {
      sc(r, 0, 'SHIFT CLOSES', sec); mc(r, 0, COLS - 1); r++
      ;['Employee', 'Revenue', 'Transactions', 'Cash Variance', 'Closed At', ''].forEach((h, c) => sc(r, c, h, h ? hdr : { fill: { fgColor: { rgb: '2D7DD2' } } })); r++
      dayArchives.forEach((a, i) => {
        sc(r, 0, a.employeeName, lft(i)); sc(r, 1, a.revenue || 0, cel(i))
        sc(r, 2, a.transactions || 0, cel(i))
        const v = a.variance || 0
        sc(r, 3, v, { ...cel(i), font: { sz: 10, color: { rgb: v === 0 ? '2E7D32' : v > 0 ? '0369a1' : 'C62828' }, bold: v !== 0 } })
        sc(r, 4, a.closedAt ? new Date(a.closedAt).toLocaleTimeString('en-KE') : '—', cel(i))
        sc(r, 5, '', cel(i)); r++
      })
      r++
    }

    if (repayments.length > 0) {
      sc(r, 0, 'DEBT COLLECTIONS', sec); mc(r, 0, COLS - 1); r++
      ;['Customer', 'Amount (KSh)', 'Recorded By', '', '', ''].forEach((h, c) => sc(r, c, h, h ? hdr : { fill: { fgColor: { rgb: '2D7DD2' } } })); r++
      repayments.forEach((rep, i) => {
        sc(r, 0, rep.customerName || '—', lft(i))
        sc(r, 1, rep.amount || 0, blu(i))
        sc(r, 2, rep.recordedBy || '—', lft(i))
        for (let c = 3; c < COLS; c++) sc(r, c, '', cel(i)); r++
      })
      r++
    }

    if (summary.perEmployee?.length > 0) {
      sc(r, 0, 'SALES BY EMPLOYEE', sec); mc(r, 0, COLS - 1); r++
      ;['Employee', 'Transactions', 'Items', 'Revenue (KSh)', 'Profit (KSh)', ''].forEach((h, c) => sc(r, c, h, h ? hdr : { fill: { fgColor: { rgb: '2D7DD2' } } })); r++
      summary.perEmployee.forEach((emp, i) => {
        sc(r, 0, emp.name, lft(i)); sc(r, 1, emp.transactions, cel(i))
        sc(r, 2, emp.itemsSold, cel(i)); sc(r, 3, emp.revenue, cel(i))
        sc(r, 4, emp.profit, grn(i)); sc(r, 5, '', cel(i)); r++
      })
    }

    ws['!ref']    = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r, c: COLS - 1 } })
    ws['!merges'] = merges
    ws['!cols']   = [{ wch: 24 }, { wch: 18 }, { wch: 14 }, { wch: 14 }, { wch: 20 }, { wch: 10 }]
    ws['!rows']   = Array.from({ length: r }, (_, i) => ({ hpt: i < 4 ? 22 : 18 }))

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Z-Report')
    XLSX.writeFile(wb, `z-report-${selectedDate}-${selectedStore.replace(/\s+/g, '-')}.xlsx`)
  }

  return (
    <div className={styles.page}>

      {/* ── Header ── */}
      <div style={{ flexShrink: 0, padding: '20px 24px 14px', borderBottom: '1px solid var(--border-soft)', background: 'var(--bg-card)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              📊 Daily Z-Report
            </h1>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '3px 0 0' }}>
              Full day summary — revenue, expenses, petty cash, staff performance
            </p>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            {isOwner && stores.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', background: 'var(--bg-muted)', border: '1px solid var(--border-soft)', borderRadius: 'var(--radius-md)' }}>
                <MdStorefront style={{ color: 'var(--primary)', fontSize: 16 }} />
                <select
                  ref={storeSelectRef}
                  value={selectedStore}
                  onChange={e => setSelectedStore(e.target.value)}
                  style={{ border: 'none', background: 'transparent', color: 'var(--text-primary)', fontSize: 13, fontWeight: 600, outline: 'none', fontFamily: 'inherit', cursor: 'pointer' }}
                >
                  <option value="All">All Stores</option>
                  {stores.map(s => <option key={s._id} value={s.name}>{s.name}</option>)}
                </select>
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'var(--bg-muted)', border: '1px solid var(--border-soft)', borderRadius: 'var(--radius-md)', padding: '4px 8px' }}>
              <button onClick={prevDay} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', padding: 4 }}>
                <MdChevronLeft style={{ fontSize: 20 }} />
              </button>
              <input
                type="date"
                value={selectedDate}
                max={TODAY_EAT}
                onChange={e => setSelectedDate(e.target.value)}
                style={{ border: 'none', background: 'transparent', color: 'var(--text-primary)', fontSize: 13, fontWeight: 600, outline: 'none', fontFamily: 'inherit', cursor: 'pointer' }}
              />
              <button onClick={nextDay} disabled={isToday} style={{ background: 'none', border: 'none', cursor: isToday ? 'default' : 'pointer', color: isToday ? 'var(--border-medium)' : 'var(--text-secondary)', display: 'flex', padding: 4 }}>
                <MdChevronRight style={{ fontSize: 20 }} />
              </button>
            </div>

            {!isToday && (
              <button onClick={() => setSelectedDate(TODAY_EAT)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', background: 'var(--bg-muted)', border: '1px solid var(--border-soft)', borderRadius: 'var(--radius-md)', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'inherit' }}>
                <MdCalendarToday style={{ fontSize: 14 }} /> Today
              </button>
            )}

            <button onClick={() => setRefreshKey(k => k + 1)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', background: 'var(--bg-muted)', border: '1px solid var(--border-soft)', borderRadius: 'var(--radius-md)', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'inherit' }}>
              <MdRefresh style={{ fontSize: 16 }} /> Refresh
            </button>

            {summary && (
              <button
                onClick={handleExport}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
                onMouseEnter={e => { if (!isTouchDevice()) e.currentTarget.style.background = 'var(--primary-dark)' }}
                onMouseLeave={e => { if (!isTouchDevice()) e.currentTarget.style.background = 'var(--primary)' }}
              >
                <MdDownload style={{ fontSize: 16 }} /> Export Excel
              </button>
            )}
          </div>
        </div>

        <div style={{ marginTop: 10, fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>
          {displayDate}
          {selectedStore !== 'All' && <span style={{ marginLeft: 8, color: 'var(--primary)' }}>· {selectedStore}</span>}
          {isToday && <span style={{ marginLeft: 8, padding: '2px 8px', background: 'var(--success-light)', color: 'var(--success-dark)', borderRadius: 8, fontSize: 11, fontWeight: 700 }}>LIVE</span>}
        </div>
      </div>

      {/* ── Content ── */}
      <div className={styles.content} style={{ padding: '20px 24px 32px' }}>
        {!summary && !expenseLoading && !pcLoading && !repayLoading ? (
          <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: 56, marginBottom: 16, opacity: 0.3 }}>📊</div>
            <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>No sales recorded</div>
            <div style={{ fontSize: 13 }}>No activity found for {displayDate}</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* ── KPI Cards ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>
              <StatTile
                label="Total Revenue"
                value={`KSh ${(summary?.totalRevenue || 0).toLocaleString()}`}
                color="var(--primary)" bg="var(--primary-light)"
                icon={<MdAttachMoney />}
                sub={`${summary?.totalTransactions || 0} transactions`}
              />
              <StatTile
                label="Gross Profit"
                value={`KSh ${(summary?.totalProfit || 0).toLocaleString()}`}
                color={summary?.totalProfit >= 0 ? 'var(--success-dark)' : 'var(--danger)'}
                bg={summary?.totalProfit >= 0 ? 'var(--success-light)' : 'var(--danger-light)'}
                icon={<MdTrendingUp />}
                sub={`${summary?.totalRevenue > 0 ? Math.round((summary.totalProfit / summary.totalRevenue) * 100) : 0}% margin`}
              />
              <StatTile
                label="Items Sold"
                value={fmtQty(summary?.totalItems || 0).toLocaleString()}
                color="var(--warning-dark)" bg="var(--warning-light)"
                icon={<MdInventory />}
              />
              <StatTile
                label="Total Expenses"
                value={expenseLoading ? '—' : `KSh ${expenseTotal.toLocaleString()}`}
                color={expenseTotal > 0 ? 'var(--danger)' : 'var(--text-muted)'}
                bg={expenseTotal > 0 ? 'var(--danger-light)' : 'var(--bg-muted)'}
                icon={<MdReceiptLong />}
                sub={expenseSummary.length > 0 ? `${expenseSummary.length} categories` : 'None logged'}
              />
              <StatTile
                label="Net Profit"
                value={expenseLoading || !summary ? '—' : `${netProfit < 0 ? '−' : ''}KSh ${Math.abs(netProfit).toLocaleString()}`}
                color={netProfit >= 0 ? 'var(--success-dark)' : 'var(--danger)'}
                bg={netProfit >= 0 ? '#f0fdf4' : 'var(--danger-light)'}
                icon={netProfit >= 0 ? <MdTrendingUp /> : <MdWarning />}
                sub={netProfit >= 0 ? 'Gross Profit − Expenses − Expired Loss' : '⚠️ Expenses + losses exceed gross profit'}
              />
              <StatTile
                label="Debt Collected"
                value={repayLoading ? '—' : `KSh ${totalDebtCollected.toLocaleString()}`}
                color="#0369a1" bg="#e0f2fe"
                icon={<MdPeopleAlt />}
                sub={`${repayments.length} payment${repayments.length !== 1 ? 's' : ''}`}
              />
              <StatTile
                label="Supplier Debt"
                value={debtLoading ? '—' : `KSh ${supplierDebt.toLocaleString()}`}
                color={supplierDebt > 0 ? '#b45309' : 'var(--success-dark)'}
                bg={supplierDebt > 0 ? '#fef3c7' : 'var(--success-light)'}
                icon={<MdLocalShipping />}
                sub={supplierDebt > 0 ? 'Outstanding to suppliers' : '✓ All suppliers paid'}
              />
            </div>

            {/* ── P&L + Payment breakdown ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <Card>
                <SectionHeader icon={<MdTrendingUp />} title="Profit & Loss" subtitle="Revenue vs expenses for this day" />
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {[
                    { label: 'Gross Revenue',                    value: summary?.totalRevenue || 0,  color: 'var(--primary)',      sign: '',  bold: false, muted: false, topBorder: false, large: false },
                    { label: 'Cost of Goods (COGS)',             value: summary?.totalCOGS    || 0,  color: 'var(--text-muted)',   sign: '−', bold: false, muted: true,  topBorder: false, large: false },
                    { label: 'Gross Profit',                     value: summary?.totalProfit  || 0,  color: (summary?.totalProfit || 0) >= 0 ? 'var(--success-dark)' : 'var(--danger)', sign: '', bold: true, muted: false, topBorder: true, large: false },
                    { label: 'Total Expenses',                   value: expenseTotal,                color: 'var(--danger)',        sign: '−', bold: false, muted: false, topBorder: false, large: false },
                    { label: 'Inventory Loss (Expired Stock)',   value: expiredLoss,                 color: '#b45309',              sign: '−', bold: false, muted: false, topBorder: false, large: false },
                    { label: 'Net Profit',                       value: netProfit,                   color: netProfit >= 0 ? 'var(--success-dark)' : 'var(--danger)', sign: '', bold: true, muted: false, topBorder: true, large: true },
                    { label: 'Supplier Debt (unpaid)',           value: supplierDebt,                color: supplierDebt > 0 ? '#b45309' : 'var(--success-dark)', sign: '', bold: false, muted: true, topBorder: true, large: false },
                  ].map((row, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderTop: row.topBorder ? '1px solid var(--border-soft)' : 'none', marginTop: row.topBorder ? 4 : 0 }}>
                      <span style={{ fontSize: 13, color: row.muted ? 'var(--text-muted)' : 'var(--text-secondary)', fontWeight: row.bold ? 700 : 400 }}>{row.label}</span>
                      <span style={{ fontSize: row.large ? 16 : 13, fontWeight: row.bold ? 800 : 500, color: row.color }}>
                        {row.sign || (row.value < 0 ? '−' : '')}KSh {Math.abs(row.value).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </Card>

              <Card>
                <SectionHeader icon={<MdAttachMoney />} title="Payment Breakdown" subtitle="How customers paid today" />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {summary ? [
                    { label: '💵 Cash',          value: summary.paymentBreakdown.cash   || 0, count: summary.cashSalesCount   || 0, color: 'var(--success-dark)', bg: 'var(--success-light)' },
                    { label: '📱 M-Pesa',         value: summary.paymentBreakdown.mpesa  || 0, count: summary.mpesaSalesCount  || 0, color: 'var(--info-dark)',    bg: 'var(--info-light)' },
                    { label: '💳 Card (EDC)',     value: summary.paymentBreakdown.card   || 0, count: summary.cardSalesCount   || 0, color: 'var(--primary)',      bg: 'var(--primary-light)' },
                    { label: '🏦 Bank Transfer',  value: summary.paymentBreakdown.bank   || 0, count: summary.bankSalesCount   || 0, color: 'var(--primary)',      bg: 'var(--primary-light)' },
                    { label: '📋 Credit (Owed)',  value: summary.paymentBreakdown.credit || 0, count: summary.creditSalesCount || 0, color: 'var(--warning-dark)', bg: 'var(--warning-light)' },
                  ].filter(p => p.value > 0 || p.label.includes('Cash')).map((p, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: p.bg, borderRadius: 'var(--radius-md)' }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: p.color }}>{p.label}</span>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 14, fontWeight: 800, color: p.color }}>KSh {p.value.toLocaleString()}</div>
                        <div style={{ fontSize: 10, color: p.color, opacity: 0.7 }}>{p.count} sale{p.count !== 1 ? 's' : ''}</div>
                      </div>
                    </div>
                  )) : <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>No sales data</div>}
                </div>
              </Card>
            </div>

            {/* ── Expenses + Petty Cash ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <Card>
                <SectionHeader
                  icon={<MdReceiptLong />}
                  title="Expenses Today"
                  subtitle={expenseLoading ? 'Loading...' : `${expenseSummary.length} categories · KSh ${expenseTotal.toLocaleString()} total`}
                />
                {expenseLoading ? (
                  <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Loading...</div>
                ) : expenseSummary.length === 0 ? (
                  <div style={{ color: 'var(--text-muted)', fontSize: 13, fontStyle: 'italic', textAlign: 'center', padding: '20px 0' }}>
                    ✅ No expenses logged today
                  </div>
                ) : (
                  <div>
                    {expenseSummary.map((cat, i) => (
                      <div key={cat._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: i < expenseSummary.length - 1 ? '1px solid var(--border-soft)' : 'none' }}>
                        <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{EXPENSE_CAT_LABELS[cat._id] || cat._id}</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--danger)' }}>KSh {cat.total.toLocaleString()}</span>
                      </div>
                    ))}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10, marginTop: 6, borderTop: '2px solid var(--danger)', fontSize: 14, fontWeight: 800 }}>
                      <span style={{ color: 'var(--danger-dark)' }}>Total</span>
                      <span style={{ color: 'var(--danger)' }}>KSh {expenseTotal.toLocaleString()}</span>
                    </div>
                  </div>
                )}
              </Card>

              <Card>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                  <SectionHeader
                    icon={<MdAccountBalanceWallet />}
                    title="Petty Cash"
                    subtitle={
                      pcLoading
                        ? 'Loading...'
                        : pettyCash
                          ? `Opened by ${pettyCash.openedBy}`
                          : (isOwner && selectedStore === 'All')
                            ? <span
                                onClick={() => storeSelectRef.current?.focus()}
                                style={{ cursor: 'pointer', color: 'var(--primary)', textDecoration: 'underline dotted' }}
                              >Select a store to view ↑</span>
                            : 'Not opened today'
                    }
                  />
                  {!pcLoading && pettyCash && (
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                      background: !pettyCash.isClosed ? 'var(--warning-light)' : pettyCash.closedBy === 'System (Auto-Close)' ? '#fef3c7' : 'var(--success-light)',
                      color:      !pettyCash.isClosed ? 'var(--warning-dark)' : pettyCash.closedBy === 'System (Auto-Close)' ? '#92400e' : 'var(--success-dark)',
                    }}>
                      {!pettyCash.isClosed ? '🔓 Open' : pettyCash.closedBy === 'System (Auto-Close)' ? '⚠️ Auto-Closed' : '✅ Closed'}
                    </span>
                  )}
                </div>
                {pcLoading ? (
                  <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Loading...</div>
                ) : !pettyCash ? (
                  <div style={{ color: 'var(--text-muted)', fontSize: 13, fontStyle: 'italic', textAlign: 'center', padding: '20px 0' }}>
                    {isOwner && selectedStore === 'All' ? 'Select a specific store to view petty cash' : 'Petty cash not opened today'}
                  </div>
                ) : (
                  <div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
                      {[
                        { label: 'Opening Float', value: pettyCash.openingFloat, color: 'var(--primary)',      bg: 'var(--primary-light)' },
                        { label: 'Cash In',        value: pettyCash.totalIn,      color: 'var(--success-dark)', bg: 'var(--success-light)' },
                        { label: 'Cash Out',       value: pettyCash.totalOut,     color: 'var(--danger)',       bg: 'var(--danger-light)' },
                        { label: 'Net Balance',    value: pettyCash.netBalance,   color: pettyCash.netBalance >= 0 ? 'var(--success-dark)' : 'var(--danger)', bg: pettyCash.netBalance >= 0 ? 'var(--success-light)' : 'var(--danger-light)' },
                      ].map(s => (
                        <div key={s.label} style={{ padding: '8px 12px', background: s.bg, borderRadius: 'var(--radius-md)' }}>
                          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: s.color, opacity: 0.7, marginBottom: 3 }}>{s.label}</div>
                          <div style={{ fontSize: 14, fontWeight: 900, color: s.color }}>KSh {(s.value || 0).toLocaleString()}</div>
                        </div>
                      ))}
                    </div>
                    {pettyCash.isClosed && pettyCash.closingFloat != null && (
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '8px 12px', background: 'var(--bg-muted)', borderRadius: 'var(--radius-md)', display: 'flex', justifyContent: 'space-between' }}>
                        <span>Actual count at close</span>
                        <span style={{ fontWeight: 700, color: pettyCash.closingFloat === pettyCash.netBalance ? 'var(--success-dark)' : 'var(--danger-dark)' }}>
                          KSh {pettyCash.closingFloat.toLocaleString()}
                          {pettyCash.closingFloat !== pettyCash.netBalance && (
                            <span style={{ marginLeft: 6 }}>
                              ({pettyCash.closingFloat > pettyCash.netBalance ? '+' : ''}{(pettyCash.closingFloat - pettyCash.netBalance).toLocaleString()} variance)
                            </span>
                          )}
                        </span>
                      </div>
                    )}
                    {pettyCash.transactions?.length > 0 && (
                      <div style={{ marginTop: 10 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                          Transactions ({pettyCash.transactions.length})
                        </div>
                        {pettyCash.transactions.slice(0, 4).map((tx, i) => (
                          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '5px 0', borderBottom: i < Math.min(3, pettyCash.transactions.length - 1) ? '1px solid var(--border-soft)' : 'none' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>{tx.description || (tx.type === 'in' ? 'Cash In' : 'Cash Out')}</span>
                            <span style={{ fontWeight: 700, color: tx.type === 'in' ? 'var(--success-dark)' : 'var(--danger)' }}>
                              {tx.type === 'in' ? '+' : '−'}KSh {tx.amount?.toLocaleString()}
                            </span>
                          </div>
                        ))}
                        {pettyCash.transactions.length > 4 && (
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, textAlign: 'center' }}>
                            +{pettyCash.transactions.length - 4} more — see Petty Cash page
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </Card>
            </div>

            {/* ── Shift Closes + Debt Collections ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <Card>
                <SectionHeader
                  icon={<MdReceiptLong />}
                  title="Shift Closes"
                  subtitle={`${dayArchives.length} cashier${dayArchives.length !== 1 ? 's' : ''} closed today`}
                />
                {dayArchives.length === 0 ? (
                  <div style={{ color: 'var(--text-muted)', fontSize: 13, fontStyle: 'italic', textAlign: 'center', padding: '20px 0' }}>
                    No shifts closed yet today
                  </div>
                ) : (
                  dayArchives.map((a, i) => {
                    const v = a.variance || 0
                    return (
                      <div key={a._id || i} style={{ padding: '10px 0', borderBottom: i < dayArchives.length - 1 ? '1px solid var(--border-soft)' : 'none' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--primary-light)', color: 'var(--primary)', fontWeight: 900, fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              {(a.employeeName || '?')[0].toUpperCase()}
                            </div>
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{a.employeeName}</div>
                              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                {a.transactions} txns · {a.closedAt ? new Date(a.closedAt).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' }) : '—'}
                              </div>
                            </div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--primary)' }}>KSh {(a.revenue || 0).toLocaleString()}</div>
                            {v !== 0 && (
                              <div style={{ fontSize: 11, fontWeight: 700, color: v > 0 ? '#0369a1' : 'var(--danger)' }}>
                                {v > 0 ? `+KSh ${v.toLocaleString()} over` : `KSh ${Math.abs(v).toLocaleString()} short`}
                              </div>
                            )}
                            {v === 0 && a.actualCash > 0 && (
                              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--success-dark)' }}>✓ Balanced</div>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })
                )}
              </Card>

              <Card>
                <SectionHeader
                  icon={<MdPeopleAlt />}
                  title="Debt Collections"
                  subtitle={repayLoading ? 'Loading...' : `${repayments.length} payment${repayments.length !== 1 ? 's' : ''} · KSh ${totalDebtCollected.toLocaleString()}`}
                />
                {repayLoading ? (
                  <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Loading...</div>
                ) : repayments.length === 0 ? (
                  <div style={{ color: 'var(--text-muted)', fontSize: 13, fontStyle: 'italic', textAlign: 'center', padding: '20px 0' }}>
                    No debt collected today
                  </div>
                ) : (
                  <div>
                    <div style={{ padding: '10px 14px', background: '#e0f2fe', borderRadius: 'var(--radius-md)', marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 12, color: '#0369a1', fontWeight: 700 }}>Total Collected</span>
                      <span style={{ fontSize: 18, fontWeight: 900, color: '#0369a1' }}>KSh {totalDebtCollected.toLocaleString()}</span>
                    </div>
                    {repayments.slice(0, 6).map((rep, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: i < Math.min(5, repayments.length - 1) ? '1px solid var(--border-soft)' : 'none', fontSize: 12 }}>
                        <div>
                          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{rep.customerName || '—'}</span>
                          <span style={{ color: 'var(--text-muted)', marginLeft: 6 }}>· {rep.recordedBy}</span>
                        </div>
                        <span style={{ fontWeight: 700, color: '#0369a1' }}>KSh {rep.amount?.toLocaleString()}</span>
                      </div>
                    ))}
                    {repayments.length > 6 && (
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6, textAlign: 'center' }}>+{repayments.length - 6} more</div>
                    )}
                  </div>
                )}
              </Card>
            </div>

            {/* ── Employee performance ── */}
            {summary?.perEmployee?.length > 0 && (
              <Card>
                <SectionHeader icon={<MdPeopleAlt />} title="Employee Performance" subtitle={`${summary.perEmployee.length} staff active today`} />
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 500 }}>
                    <thead>
                      <tr style={{ background: 'var(--sidebar-bg)' }}>
                        {['Employee', 'Transactions', 'Items', 'Revenue', 'Profit', 'Shift Status'].map(h => (
                          <th key={h} style={{ padding: '10px 14px', fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'white', textAlign: 'left' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {summary.perEmployee.map((emp, i) => {
                        const archive  = dayArchives.find(a => a.employeeName === emp.name)
                        const hasClosed = !!archive
                        const v        = archive?.variance || 0
                        return (
                          <tr key={emp.name} style={{ borderBottom: '1px solid var(--border-soft)', background: i % 2 === 0 ? 'transparent' : 'var(--bg-muted)' }}>
                            <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--primary-light)', color: 'var(--primary)', fontWeight: 900, fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                  {emp.name[0].toUpperCase()}
                                </div>
                                {emp.name}
                              </div>
                            </td>
                            <td style={{ padding: '10px 14px', fontSize: 13, color: 'var(--text-secondary)' }}>{emp.transactions}</td>
                            <td style={{ padding: '10px 14px', fontSize: 13, color: 'var(--text-secondary)' }}>{emp.itemsSold}</td>
                            <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 700, color: 'var(--primary)' }}>KSh {emp.revenue.toLocaleString()}</td>
                            <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 700, color: emp.profit >= 0 ? 'var(--success-dark)' : 'var(--danger)' }}>KSh {emp.profit.toLocaleString()}</td>
                            <td style={{ padding: '10px 14px' }}>
                              {hasClosed ? (
                                <div>
                                  <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 12, background: 'var(--success-light)', color: 'var(--success-dark)' }}>✓ Closed</span>
                                  {v !== 0 && (
                                    <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 700, color: v > 0 ? '#0369a1' : 'var(--danger)' }}>
                                      {v > 0 ? `+${v.toLocaleString()}` : v.toLocaleString()} variance
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 12, background: 'var(--warning-light)', color: 'var(--warning-dark)' }}>⏳ Working</span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}

          </div>
        )}
      </div>
    </div>
  )
}
