import { useState, useEffect, useMemo } from 'react'
import {
  MdClose, MdAttachMoney, MdInventory, MdTrendingUp,
  MdPerson, MdLockClock, MdCheckCircle,
  MdWarning, MdMoney, MdDownload, MdPeopleAlt,
  MdAccountBalanceWallet,
} from 'react-icons/md'
import { useApp } from '@/context/AppContext'
import { buildLiveSummary, fmtQty } from '@/utils/utils'
import * as XLSX from 'xlsx'
import { API_BASE_URL } from '@/config/api'

const isTouchDevice = () => window.matchMedia('(pointer: coarse)').matches

export default function DailySummaryModal({ onClose }) {
  const {
    sales, products, currentUser, isCashier, isOwner,
    closeShift, hasClosedShiftToday,
    fetchExpenseSummary, fetchPettyCashToday,   // ★ Phase 6
  } = useApp()

  const today = new Date().toLocaleDateString('en-CA')
  // EAT today string (for expense/petty cash API calls)
  const todayEAT = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString().split('T')[0]

  // ── Today's debt repayments ──────────────────────────────────────────
  const [todayRepayments, setTodayRepayments] = useState([])

  useEffect(() => {
    let active = true
    const load = async () => {
      const token = currentUser?.token
      if (!token) return
      try {
        const res = await fetch(
          `${API_BASE_URL}/api/customers/repayments/month?year=${new Date().getFullYear()}&month=${new Date().getMonth() + 1}&store=`,
          { headers: { Authorization: `Bearer ${token}` } }
        )
        if (!res.ok) return
        const data = await res.json()
        if (active) setTodayRepayments(
          Array.isArray(data) ? data.filter(r => r.date === today) : []
        )
      } catch { /* silent fail */ }
    }
    load()
    return () => { active = false }
  }, [today, currentUser])

  // ── Phase 6: Today's expenses ────────────────────────────────────────
  const [expenseSummary, setExpenseSummary] = useState([])
  const [expenseTotal, setExpenseTotal] = useState(0)
  const [expenseLoading, setExpenseLoading] = useState(true)

  useEffect(() => {
    if (!currentUser?.token) return
    let active = true
    const load = async () => {
      setExpenseLoading(true)
      try {
        const store = isOwner ? null : (currentUser.store || null)
        const data = await fetchExpenseSummary({ ...(store ? { store } : {}), date: todayEAT })
        if (active) {
          setExpenseSummary(data.summary || [])
          setExpenseTotal(data.grandTotal || 0)
        }
      } catch { if (active) { setExpenseSummary([]); setExpenseTotal(0) } }
      finally { if (active) setExpenseLoading(false) }
    }
    load()
    return () => { active = false }
  }, [currentUser, fetchExpenseSummary, todayEAT, isOwner])

  // ── Phase 6: Today's petty cash ──────────────────────────────────────
  const [pettyCash, setPettyCash] = useState(null)
  const [pettyCashLoading, setPettyCashLoading] = useState(true)

  useEffect(() => {
    if (!currentUser?.token) return
    let active = true
    const load = async () => {
      setPettyCashLoading(true)
      try {
        const store = isOwner ? null : (currentUser.store || null)
        if (!store) { if (active) { setPettyCash(null); setPettyCashLoading(false) }; return }
        const data = await fetchPettyCashToday(store)

        if (active) setPettyCash(data.record || null)
      } catch { if (active) setPettyCash(null) }
      finally { if (active) setPettyCashLoading(false) }
    }
    load()
    return () => { active = false }
  }, [currentUser, fetchPettyCashToday, isOwner])

  const EXPENSE_CAT_LABELS = {
    rent: '🏠 Rent', utilities: '💡 Utilities', wages: '👷 Wages',
    supplies: '🛒 Supplies', petty_cash: '💵 Petty Cash',
    transport: '🚗 Transport', maintenance: '🔧 Maintenance',
    marketing: '📢 Marketing', taxes: '📋 Taxes', other: '📎 Other',
  }

  const totalDebtCollected = todayRepayments.reduce((s, r) => s + (r.amount || 0), 0)

  const isCashierMode = (isCashier || currentUser?.role === 'cashier' || currentUser?.role === 'employee')
  const alreadyClosed = hasClosedShiftToday?.() || false

  const [selectedDate, setSelectedDate] = useState(today)
  const [actualCash, setActualCash] = useState('')
  const [closing, setClosing] = useState(false)
  const [closed, setClosed] = useState(false)
  const [closeError, setCloseError] = useState('')

  const dateToShow = isCashierMode ? today : selectedDate

  const allSummary = useMemo(() =>
    buildLiveSummary(dateToShow, sales, products) || null,
    [dateToShow, sales, products]
  )

  const empName = currentUser?.fullname || currentUser?.username || ''
  const summary = useMemo(() => {
    if (!isCashierMode || !allSummary) return allSummary
    const mySales = sales.filter(s => {
      const d = s.date ? String(s.date).slice(0, 10) : null
      return d === dateToShow && s.cashier === empName && !s.returned && !s.voided
    })
    if (mySales.length === 0) return null
    return buildLiveSummary(dateToShow, mySales, products)
  }, [isCashierMode, allSummary, sales, dateToShow, empName, products])

  const displayDate = new Date(dateToShow + 'T00:00:00').toLocaleDateString('en-KE', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  })

  const cashSales = summary?.paymentBreakdown?.cash || 0
  const openingFloat = 0
  const expectedCash = openingFloat + cashSales
  const actualCashNum = Number(actualCash) || 0
  const variance = actualCash !== '' ? actualCashNum - expectedCash : null
  const isBalanced = variance !== null && variance === 0
  const isOver = variance !== null && variance > 0
  const isShort = variance !== null && variance < 0

  const paymentTiles = summary ? [
    {
      label: '💵 Cash Sales',
      value: summary.paymentBreakdown.cash,
      sub: `${summary.cashSalesCount || 0} cash · ${summary.splitSalesCount || 0} split`,
      color: 'var(--success-dark)', bg: 'var(--success-light)',
    },
    {
      label: '📱 M-Pesa Total',
      value: summary.paymentBreakdown.mpesa,
      sub: `${summary.mpesaSalesCount || 0} mpesa`,
      color: 'var(--info-dark)', bg: 'var(--info-light)',
    },
    {
      label: '💳 Card (EDC)',
      value: summary.paymentBreakdown.card || 0,
      sub: `${summary.cardSalesCount || 0} card sales`,
      color: summary.paymentBreakdown.card > 0 ? 'var(--primary-dark)' : 'var(--text-muted)',
      bg: summary.paymentBreakdown.card > 0 ? 'var(--primary-light)' : 'var(--bg-muted)',
    },
    {
      label: '🏦 Bank Transfer',
      value: summary.paymentBreakdown.bank || 0,
      sub: `${summary.bankSalesCount || 0} transfers`,
      color: summary.paymentBreakdown.bank > 0 ? 'var(--primary-dark)' : 'var(--text-muted)',
      bg: summary.paymentBreakdown.bank > 0 ? 'var(--primary-light)' : 'var(--bg-muted)',
    },
    {
      label: '📋 Credit (Owed)',
      value: summary.paymentBreakdown.credit || 0,
      sub: `${summary.creditSalesCount || 0} credit sales`,
      color: summary.paymentBreakdown.credit > 0 ? 'var(--warning-dark)' : 'var(--text-muted)',
      bg: summary.paymentBreakdown.credit > 0 ? 'var(--warning-light)' : 'var(--bg-muted)',
    },
  ] : []

  const balancedTotal = summary
    ? (summary.paymentBreakdown.cash || 0)
    + (summary.paymentBreakdown.mpesa || 0)
    + (summary.paymentBreakdown.credit || 0)
    + (summary.paymentBreakdown.card || 0)
    + (summary.paymentBreakdown.bank || 0)
    : 0

  const handleCloseShift = async () => {
    if (actualCash === '') { setCloseError('Please count and enter the cash in your drawer.'); return }
    setCloseError('')
    setClosing(true)
    const result = await closeShift({ actualCash: actualCashNum })
    setClosing(false)
    if (result.success) {
      setClosed(true)
    } else {
      setCloseError(result.message || 'Failed to close shift. Try again.')
    }
  }

  // ── Excel export ─────────────────────────────────────────────────────
  const XL_PRIMARY = '185FA5'
  const XL_PRIMARY_DARK = '0C447C'
  const XL_PRIMARY_LIGHT = 'E6F1FB'

  const handleDownloadExcel = () => {
    if (!summary) return
    const fmt = n => Number(n).toLocaleString('en-KE')
    const ws = {}, merges = []
    let r = 0

    const sc = (row, col, value, style) => {
      const addr = XLSX.utils.encode_cell({ r: row, c: col })
      ws[addr] = { v: value, t: typeof value === 'number' ? 'n' : 's', s: style }
    }
    const mc = (row, from, to) => merges.push({ s: { r: row, c: from }, e: { r: row, c: to } })

    const titleStyle = { font: { bold: true, sz: 14, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: XL_PRIMARY } }, alignment: { horizontal: 'left' } }
    const metaStyle = { font: { bold: false, sz: 11, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: XL_PRIMARY } }, alignment: { horizontal: 'left' } }
    const secStyle = { font: { bold: true, sz: 11, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: XL_PRIMARY_DARK } }, alignment: { horizontal: 'left' } }
    const hdrStyle = { font: { bold: true, sz: 10, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '2D7DD2' } }, alignment: { horizontal: 'center' }, border: { top: { style: 'thin', color: { rgb: 'FFFFFF' } }, bottom: { style: 'thin', color: { rgb: 'FFFFFF' } }, left: { style: 'thin', color: { rgb: 'FFFFFF' } }, right: { style: 'thin', color: { rgb: 'FFFFFF' } } } }
    const cel = (i) => ({ font: { sz: 10, color: { rgb: '333333' } }, fill: { fgColor: { rgb: i % 2 === 0 ? 'FFFFFF' : 'F0F6FD' } }, alignment: { horizontal: 'center' }, border: { top: { style: 'thin', color: { rgb: 'E0E0E0' } }, bottom: { style: 'thin', color: { rgb: 'E0E0E0' } }, left: { style: 'thin', color: { rgb: 'E0E0E0' } }, right: { style: 'thin', color: { rgb: 'E0E0E0' } } } })
    const lft = (i) => ({ ...cel(i), alignment: { horizontal: 'left' } })
    const kvL = { font: { bold: true, sz: 10, color: { rgb: '555555' } }, fill: { fgColor: { rgb: 'F8FAFB' } }, alignment: { horizontal: 'left' }, border: { top: { style: 'thin', color: { rgb: 'E0E0E0' } }, bottom: { style: 'thin', color: { rgb: 'E0E0E0' } }, left: { style: 'thin', color: { rgb: 'E0E0E0' } }, right: { style: 'thin', color: { rgb: 'E0E0E0' } } } }
    const kvV = { font: { bold: true, sz: 11, color: { rgb: XL_PRIMARY } }, fill: { fgColor: { rgb: XL_PRIMARY_LIGHT } }, alignment: { horizontal: 'right' }, border: { top: { style: 'thin', color: { rgb: 'E0E0E0' } }, bottom: { style: 'thin', color: { rgb: 'E0E0E0' } }, left: { style: 'thin', color: { rgb: 'E0E0E0' } }, right: { style: 'thin', color: { rgb: 'E0E0E0' } } } }
    const grn = (i) => ({ ...cel(i), font: { sz: 10, color: { rgb: '2E7D32' }, bold: true } })
    const blu = (i) => ({ ...cel(i), font: { sz: 10, color: { rgb: '0369a1' }, bold: true } })
    const red = (i) => ({ ...cel(i), font: { sz: 10, color: { rgb: 'C62828' }, bold: true } })  // ★ Phase 6
    const COLS = 6

    // Header
    sc(r, 0, isCashierMode ? 'Z-REPORT — DAILY SHIFT CLOSE' : 'DAILY SUMMARY REPORT', titleStyle); mc(r, 0, COLS - 1); r++
    sc(r, 0, `Date: ${displayDate}`, metaStyle); mc(r, 0, COLS - 1); r++
    if (isCashierMode) { sc(r, 0, `Cashier: ${empName}`, metaStyle); mc(r, 0, COLS - 1); r++ }
    sc(r, 0, `Generated: ${new Date().toLocaleDateString('en-KE', { day: '2-digit', month: 'long', year: 'numeric' })}`, { ...metaStyle, font: { sz: 10, color: { rgb: 'CCE0F5' } } }); mc(r, 0, COLS - 1); r++
    r++

    // Summary
    sc(r, 0, 'SUMMARY', secStyle); mc(r, 0, COLS - 1); r++
    const net = summary.totalRevenue - expenseTotal  // ★ Phase 6: P&L
    const kpis = [
      ['Total Revenue', `KSh ${fmt(summary.totalRevenue)}`, 'Transactions', String(summary.totalTransactions)],
      ['Total Profit', `KSh ${fmt(summary.totalProfit)}`, 'Items Sold', String(fmtQty(summary.totalItems || 0))],
      ['Cost of Goods', `KSh ${fmt(summary.totalCOGS)}`, '', ''],
      ['Total Expenses', `KSh ${fmt(expenseTotal)}`, 'Net (Rev−Exp)', `KSh ${fmt(net)}`],   // ★ Phase 6
      ['Debt Collected', `KSh ${fmt(totalDebtCollected)}`, 'Collections', String(todayRepayments.length)],
    ]
    kpis.forEach(([l1, v1, l2, v2]) => {
      sc(r, 0, l1, kvL); sc(r, 1, v1, kvV)
      sc(r, 2, '', { fill: { fgColor: { rgb: 'FFFFFF' } } })
      sc(r, 3, l2, l2 ? kvL : { fill: { fgColor: { rgb: 'FFFFFF' } } })
      sc(r, 4, v2, v2 ? kvV : { fill: { fgColor: { rgb: 'FFFFFF' } } })
      sc(r, 5, '', { fill: { fgColor: { rgb: 'FFFFFF' } } })
      r++
    })
    r++

    // Payment breakdown
    sc(r, 0, 'PAYMENT BREAKDOWN', secStyle); mc(r, 0, COLS - 1); r++
      ;['Method', 'Amount (KSh)', 'Sales Count', '', '', ''].forEach((h, c) => sc(r, c, h, h ? hdrStyle : { fill: { fgColor: { rgb: '2D7DD2' } } })); r++
    const payments = [
      ['Cash', summary.paymentBreakdown.cash || 0, summary.cashSalesCount || 0],
      ['M-Pesa', summary.paymentBreakdown.mpesa || 0, summary.mpesaSalesCount || 0],
      ['Card (EDC)', summary.paymentBreakdown.card || 0, summary.cardSalesCount || 0],
      ['Bank Transfer', summary.paymentBreakdown.bank || 0, summary.bankSalesCount || 0],
      ['Credit (Owed)', summary.paymentBreakdown.credit || 0, summary.creditSalesCount || 0],
    ]
    payments.forEach(([method, amount, count], i) => {
      sc(r, 0, method, lft(i)); sc(r, 1, amount, cel(i)); sc(r, 2, count, cel(i))
      for (let c = 3; c < COLS; c++) sc(r, c, '', cel(i))
      r++
    })
    r++

    // ★ Phase 6: Expenses section in Excel
    if (expenseSummary.length > 0) {
      sc(r, 0, 'EXPENSES TODAY', secStyle); mc(r, 0, COLS - 1); r++
        ;['Category', 'Amount (KSh)', 'Count', '', '', ''].forEach((h, c) => sc(r, c, h, h ? hdrStyle : { fill: { fgColor: { rgb: '2D7DD2' } } })); r++
      expenseSummary.forEach((cat, i) => {
        sc(r, 0, EXPENSE_CAT_LABELS[cat._id] || cat._id, lft(i))
        sc(r, 1, cat.total, red(i))
        sc(r, 2, cat.count || '', cel(i))
        for (let c = 3; c < COLS; c++) sc(r, c, '', cel(i))
        r++
      })
      sc(r, 0, 'TOTAL EXPENSES', { ...lft(0), font: { bold: true, sz: 10, color: { rgb: 'C62828' } } })
      sc(r, 1, expenseTotal, red(0))
      for (let c = 2; c < COLS; c++) sc(r, c, '', cel(0))
      r++; r++
    }

    // ★ Phase 6: Petty cash section in Excel
    if (pettyCash) {
      sc(r, 0, 'PETTY CASH', secStyle); mc(r, 0, COLS - 1); r++
        ;['Item', 'Amount (KSh)', '', '', '', ''].forEach((h, c) => sc(r, c, h, h ? hdrStyle : { fill: { fgColor: { rgb: '2D7DD2' } } })); r++
      const pcRows = [
        ['Opening Float', pettyCash.openingFloat],
        ['Cash In', pettyCash.totalIn],
        ['Cash Out', pettyCash.totalOut],
        ['Net Balance', pettyCash.netBalance],
        ['Actual Count', pettyCash.isClosed ? (pettyCash.closingFloat ?? '—') : '—'],
      ]
      pcRows.forEach(([label, val], i) => {
        sc(r, 0, label, lft(i))
        sc(r, 1, typeof val === 'number' ? val : String(val), cel(i))
        for (let c = 2; c < COLS; c++) sc(r, c, '', cel(i))
        r++
      })
      r++
    }

    // ★ Phase 6: P&L summary in Excel
    sc(r, 0, 'PROFIT & LOSS SUMMARY', secStyle); mc(r, 0, COLS - 1); r++
    const plRows = [
      ['Gross Revenue', summary.totalRevenue, '#2E7D32'],
      ['Total Expenses', expenseTotal, '#C62828'],
      ['Net Profit', summary.totalRevenue - expenseTotal, (summary.totalRevenue - expenseTotal) >= 0 ? '#2E7D32' : '#C62828'],
    ]
    plRows.forEach(([label, val, hexColor], i) => {
      sc(r, 0, label, lft(i))
      sc(r, 1, val, { ...cel(i), font: { sz: i === 2 ? 11 : 10, color: { rgb: hexColor }, bold: i === 2 } })
      for (let c = 2; c < COLS; c++) sc(r, c, '', cel(i))
      r++
    })
    r++

    // Debt collections section
    if (todayRepayments.length > 0) {
      sc(r, 0, 'DEBT COLLECTIONS TODAY', secStyle); mc(r, 0, COLS - 1); r++
        ;['Customer', 'Amount (KSh)', 'Recorded By', '', '', ''].forEach((h, c) => sc(r, c, h, h ? hdrStyle : { fill: { fgColor: { rgb: '2D7DD2' } } })); r++
      todayRepayments.forEach((rep, i) => {
        sc(r, 0, rep.customerName || '—', lft(i))
        sc(r, 1, rep.amount || 0, blu(i))
        sc(r, 2, rep.recordedBy || '—', lft(i))
        for (let c = 3; c < COLS; c++) sc(r, c, '', cel(i))
        r++
      })
      r++
    }

    // Cash reconciliation (cashier mode)
    if (isCashierMode) {
      sc(r, 0, 'CASH RECONCILIATION', secStyle); mc(r, 0, COLS - 1); r++
        ;['Item', 'Amount (KSh)', '', '', '', ''].forEach((h, c) => sc(r, c, h, h ? hdrStyle : { fill: { fgColor: { rgb: '2D7DD2' } } })); r++
      const recon = [
        ['Opening Float', openingFloat],
        ['Cash Sales Today', cashSales],
        ['Expected in Drawer', expectedCash],
        ['Actual Cash Counted', actualCashNum],
        ['Variance', variance ?? 0],
      ]
      recon.forEach(([label, val], i) => {
        sc(r, 0, label, lft(i))
        sc(r, 1, val, i === 4
          ? { ...cel(i), font: { sz: 10, color: { rgb: (variance ?? 0) >= 0 ? '2E7D32' : 'C62828' }, bold: true } }
          : cel(i))
        for (let c = 2; c < COLS; c++) sc(r, c, '', cel(i))
        r++
      })
      r++
    }

    // Employee breakdown (owner mode)
    if (!isCashierMode && summary.perEmployee?.length > 0) {
      sc(r, 0, 'SALES BY EMPLOYEE', secStyle); mc(r, 0, COLS - 1); r++
        ;['Employee', 'Transactions', 'Items Sold', 'Revenue (KSh)', 'Profit (KSh)', ''].forEach((h, c) => sc(r, c, h, h ? hdrStyle : { fill: { fgColor: { rgb: '2D7DD2' } } })); r++
      summary.perEmployee.forEach((emp, i) => {
        sc(r, 0, emp.name, lft(i)); sc(r, 1, emp.transactions, cel(i)); sc(r, 2, emp.itemsSold, cel(i))
        sc(r, 3, emp.revenue, cel(i)); sc(r, 4, emp.profit, grn(i)); sc(r, 5, '', cel(i)); r++
      })
    }

    ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r, c: COLS - 1 } })
    ws['!merges'] = merges
    ws['!cols'] = [{ wch: 22 }, { wch: 18 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 10 }]
    ws['!rows'] = Array.from({ length: r }, (_, i) => ({ hpt: i < 4 ? 22 : 18 }))

    const wb = XLSX.utils.book_new()
    const sheetName = isCashierMode ? 'Z-Report' : 'Daily Summary'
    XLSX.utils.book_append_sheet(wb, ws, sheetName)
    const fileName = isCashierMode
      ? `z-report-${empName.replace(/\s+/g, '-')}-${dateToShow}.xlsx`
      : `daily-summary-${dateToShow}.xlsx`
    XLSX.writeFile(wb, fileName)
  }

  const modalTitle = isCashierMode
    ? (alreadyClosed || closed ? 'Z-Report — Shift Closed' : 'Close Shift — Z Report')
    : 'Daily Summary'

  return (
    <>
      <div
        className="modal-overlay fixed inset-0 flex items-center justify-center z-[1000] p-4"
        style={{ background: 'rgba(15,23,42,0.55)', WebkitBackdropFilter: 'blur(3px)', backdropFilter: 'blur(3px)' }}
      >
        <div
          className="modal-container w-full rounded-xl overflow-hidden flex flex-col"
          style={{ background: 'var(--bg-card)', maxWidth: '640px', maxHeight: '92dvh', boxShadow: 'var(--shadow-dropdown)' }}
        >
          {/* Header */}
          <div
            className="flex-shrink-0 px-6 py-4 flex justify-between items-center"
            style={{ background: 'var(--sidebar-bg)', borderBottom: '1px solid var(--sidebar-border)' }}
          >
            <div>
              <div className="text-white text-base font-bold">{modalTitle}</div>
              <div className="text-xs mt-0.5" style={{ color: 'var(--primary-muted)' }}>
                {isCashierMode ? `${empName} · ${displayDate}` : displayDate}
              </div>
            </div>
            <div className="flex items-center gap-3">
              {!isCashierMode && (
                <input
                  type="date"
                  value={selectedDate}
                  onChange={e => setSelectedDate(e.target.value)}
                  className="px-3 py-1.5 rounded-lg text-xs outline-none"
                  style={{ border: '1px solid var(--sidebar-border)', background: 'rgba(255,255,255,0.1)', color: '#fff' }}
                />
              )}
              <button
                onClick={onClose}
                className="close-icon w-7 h-7 [@media(pointer:coarse)]:w-11 [@media(pointer:coarse)]:h-11 flex items-center justify-center rounded-lg transition"
                style={{ color: 'rgba(255,255,255,0.6)', background: 'transparent', border: 'none', cursor: 'pointer' }}
                onMouseEnter={e => { if (!isTouchDevice()) e.currentTarget.style.background = 'rgba(255,255,255,0.1)' }}
                onMouseLeave={e => { if (!isTouchDevice()) e.currentTarget.style.background = 'transparent' }}
              >
                <MdClose size={18} />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="scroll-content flex-1 overflow-y-auto p-6">

            {isCashierMode && (alreadyClosed || closed) && !closing && (
              <div className="rounded-xl p-4 mb-5 flex items-center gap-3"
                style={{ background: 'var(--success-light)', border: '1px solid var(--success)' }}>
                <MdCheckCircle style={{ color: 'var(--success)', fontSize: '24px', flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--success-dark)' }}>
                    Shift Closed Successfully
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--success-dark)', marginTop: '2px' }}>
                    Your Z-Report has been saved. You can print it below.
                  </div>
                </div>
              </div>
            )}

            {!summary ? (
              <div className="text-center py-12" style={{ color: 'var(--text-muted)' }}>
                <div className="text-4xl mb-3">📊</div>
                <p className="text-sm font-medium">
                  {isCashierMode ? 'No sales recorded today.' : 'No sales recorded for this date.'}
                </p>
              </div>
            ) : (
              <>
                {/* Summary cards */}
                <div className="grid grid-cols-2 gap-3 mb-5">
                  {[
                    { label: 'Total Revenue', value: `KSh ${summary.totalRevenue.toLocaleString()}`, icon: <MdAttachMoney />, color: 'var(--primary)', bg: 'var(--primary-light)' },
                    { label: 'Profit Today', value: `KSh ${summary.totalProfit.toLocaleString()}`, icon: <MdTrendingUp />, color: summary.totalProfit >= 0 ? 'var(--success-dark)' : 'var(--danger-dark)', bg: summary.totalProfit >= 0 ? 'var(--success-light)' : 'var(--danger-light)' },
                    { label: 'Items Sold', value: fmtQty(summary?.totalItems || 0), icon: <MdInventory />, color: 'var(--warning-dark)', bg: 'var(--warning-light)' },
                    { label: 'Transactions', value: summary.totalTransactions, icon: <MdPerson />, color: 'var(--info-dark)', bg: 'var(--info-light)' },
                    { label: 'Debt Collected', value: `KSh ${totalDebtCollected.toLocaleString()}`, icon: <MdPeopleAlt />, color: '#0369a1', bg: '#e0f2fe' },
                  ].map((card, i) => (
                    <div key={i} className="rounded-xl p-4 flex items-center gap-3" style={{ background: card.bg }}>
                      <div className="text-2xl" style={{ color: card.color }}>{card.icon}</div>
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: card.color, opacity: 0.8 }}>{card.label}</div>
                        <div className="text-lg font-black mt-0.5" style={{ color: card.color }}>{card.value}</div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Profit breakdown */}
                <div className="rounded-xl p-4 mb-4" style={{ background: 'var(--bg-muted)', border: '1px solid var(--border-soft)' }}>
                  <div className="text-xs font-black uppercase tracking-wider mb-3" style={{ color: 'var(--text-secondary)' }}>Profit Breakdown</div>
                  {[
                    { label: 'Revenue', value: `KSh ${summary.totalRevenue.toLocaleString()}`, color: 'var(--primary)' },
                    { label: 'Cost of Goods Sold', value: `− KSh ${summary.totalCOGS.toLocaleString()}`, color: 'var(--danger)' },
                    { label: 'Profit', value: `KSh ${summary.totalProfit.toLocaleString()}`, color: summary.totalProfit >= 0 ? 'var(--success-dark)' : 'var(--danger-dark)', bold: true },
                  ].map((row, i) => (
                    <div key={i} className="flex justify-between py-2"
                      style={{ borderTop: i === 2 ? '1px solid var(--border-soft)' : 'none', marginTop: i === 2 ? '4px' : '0' }}>
                      <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{row.label}</span>
                      <span className="text-sm" style={{ color: row.color, fontWeight: row.bold ? 700 : 400 }}>{row.value}</span>
                    </div>
                  ))}
                </div>

                {/* Payment breakdown */}
                <div className="rounded-xl p-4 mb-4" style={{ background: 'var(--bg-muted)', border: '1px solid var(--border-soft)' }}>
                  <div className="text-xs font-black uppercase tracking-wider mb-3" style={{ color: 'var(--text-secondary)' }}>Payment Breakdown</div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {paymentTiles.map((p, i) => (
                      <div key={i} className="rounded-lg p-3 text-center" style={{ background: p.bg }}>
                        <div className="text-xs font-semibold mb-1" style={{ color: p.color }}>{p.label}</div>
                        <div className="text-base font-black" style={{ color: p.color }}>KSh {p.value.toLocaleString()}</div>
                        <div className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>{p.sub}</div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 px-3 py-2 rounded-lg flex justify-between text-xs"
                    style={{ background: 'var(--bg-card)', border: '1px solid var(--border-soft)', color: 'var(--text-muted)' }}>
                    <span>Balanced Total (all methods)</span>
                    <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                      KSh {balancedTotal.toLocaleString()}
                      {balancedTotal === summary.totalRevenue ? ' ✅ Match' : ' ⚠️ Discrepancy'}
                    </span>
                  </div>
                </div>

                {/* ★ Phase 6: Expenses panel */}
                <div className="rounded-xl p-4 mb-4" style={{
                  background: expenseTotal > 0 ? 'var(--danger-light)' : 'var(--bg-muted)',
                  border: `1px solid ${expenseTotal > 0 ? '#fecaca' : 'var(--border-soft)'}`,
                }}>
                  <div className="text-xs font-black uppercase tracking-wider mb-3" style={{ color: expenseTotal > 0 ? 'var(--danger-dark)' : 'var(--text-secondary)' }}>
                    💸 Expenses Today
                  </div>
                  {expenseLoading ? (
                    <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Loading...</div>
                  ) : expenseSummary.length === 0 ? (
                    <div style={{ fontSize: '13px', color: 'var(--text-muted)', fontStyle: 'italic' }}>No expenses logged today</div>
                  ) : (
                    <>
                      {expenseSummary.map((cat, i) => (
                        <div key={cat._id} className="flex justify-between py-2"
                          style={{ borderBottom: i < expenseSummary.length - 1 ? '1px solid #fecaca' : 'none', fontSize: '13px' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>{EXPENSE_CAT_LABELS[cat._id] || cat._id}</span>
                          <span style={{ fontWeight: 700, color: 'var(--danger)' }}>KSh {cat.total.toLocaleString()}</span>
                        </div>
                      ))}
                      <div className="flex justify-between pt-3 mt-1"
                        style={{ borderTop: '2px solid #fecaca', fontSize: '14px', fontWeight: 800 }}>
                        <span style={{ color: 'var(--danger-dark)' }}>Total Expenses</span>
                        <span style={{ color: 'var(--danger)' }}>KSh {expenseTotal.toLocaleString()}</span>
                      </div>
                    </>
                  )}
                </div>

                {/* ★ Phase 6: P&L summary panel */}
                {(() => {
                  const net = summary.totalRevenue - expenseTotal
                  return (
                    <div className="rounded-xl p-4 mb-4" style={{
                      background: net >= 0 ? 'var(--success-light)' : 'var(--danger-light)',
                      border: `1px solid ${net >= 0 ? 'var(--success)' : 'var(--danger)'}`,
                    }}>
                      <div className="text-xs font-black uppercase tracking-wider mb-3"
                        style={{ color: net >= 0 ? 'var(--success-dark)' : 'var(--danger-dark)' }}>
                        📊 Profit & Loss (Today)
                      </div>
                      {[
                        { label: 'Gross Revenue', value: summary.totalRevenue, color: 'var(--success-dark)' },
                        { label: 'Total Expenses', value: expenseTotal, color: 'var(--danger)', prefix: '− ' },
                      ].map((row, i) => (
                        <div key={i} className="flex justify-between py-1.5" style={{ fontSize: '13px' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>{row.label}</span>
                          <span style={{ fontWeight: 700, color: row.color }}>{row.prefix || ''}KSh {row.value.toLocaleString()}</span>
                        </div>
                      ))}
                      <div className="flex justify-between pt-3 mt-1"
                        style={{ borderTop: `2px solid ${net >= 0 ? 'var(--success)' : 'var(--danger)'}`, fontSize: '15px', fontWeight: 900 }}>
                        <span style={{ color: net >= 0 ? 'var(--success-dark)' : 'var(--danger-dark)' }}>Net Profit</span>
                        <span style={{ color: net >= 0 ? 'var(--success-dark)' : 'var(--danger)' }}>
                          {net < 0 ? '−' : ''}KSh {Math.abs(net).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  )
                })()}

                {/* ★ Phase 6: Petty cash snapshot */}
                {!pettyCashLoading && pettyCash && (
                  <div className="rounded-xl p-4 mb-4" style={{ background: 'var(--bg-muted)', border: '1px solid var(--border-soft)' }}>
                    <div className="flex items-center gap-2 mb-3">
                      <MdAccountBalanceWallet style={{ color: 'var(--primary)', fontSize: '16px' }} />
                      <div className="text-xs font-black uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
                        Petty Cash
                      </div>
                      <span style={{
                        marginLeft: 'auto', fontSize: '11px', fontWeight: 700, padding: '2px 8px',
                        borderRadius: 12, fontFamily: 'inherit',
                        background: pettyCash.isClosed ? 'var(--success-light)' : 'var(--warning-light)',
                        color: pettyCash.isClosed ? 'var(--success-dark)' : 'var(--warning-dark)',
                      }}>
                        {pettyCash.isClosed ? '✅ Closed' : '🔓 Open'}
                      </span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      {[
                        { label: 'Opening', value: pettyCash.openingFloat, color: 'var(--primary)' },
                        { label: 'Cash In', value: pettyCash.totalIn, color: 'var(--success)' },
                        { label: 'Cash Out', value: pettyCash.totalOut, color: 'var(--danger)' },
                        { label: 'Balance', value: pettyCash.netBalance, color: pettyCash.netBalance >= 0 ? 'var(--success-dark)' : 'var(--danger)' },
                      ].map(s => (
                        <div key={s.label} style={{ padding: '8px 12px', background: 'var(--bg-card)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-soft)' }}>
                          <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 3 }}>{s.label}</div>
                          <div style={{ fontSize: '14px', fontWeight: 900, color: s.color }}>KSh {(s.value || 0).toLocaleString()}</div>
                        </div>
                      ))}
                    </div>
                    {pettyCash.isClosed && pettyCash.closingFloat != null && (
                      <div style={{ marginTop: 8, fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center' }}>
                        Actual count at close: KSh {pettyCash.closingFloat.toLocaleString()}
                        {pettyCash.closingFloat !== pettyCash.netBalance && (
                          <span style={{ marginLeft: 8, color: pettyCash.closingFloat > pettyCash.netBalance ? 'var(--success-dark)' : 'var(--danger-dark)', fontWeight: 700 }}>
                            ({pettyCash.closingFloat > pettyCash.netBalance ? '+' : ''}
                            {(pettyCash.closingFloat - pettyCash.netBalance).toLocaleString()} variance)
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Debt collections panel */}
                {totalDebtCollected > 0 && (
                  <div className="rounded-xl p-4 mb-4" style={{ background: '#f0f9ff', border: '1px solid #bae6fd' }}>
                    <div className="text-xs font-black uppercase tracking-wider mb-3" style={{ color: '#0369a1' }}>
                      💰 Debt Collections Today
                    </div>
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                        {todayRepayments.length} payment{todayRepayments.length !== 1 ? 's' : ''} recorded
                      </span>
                      <span className="text-base font-black" style={{ color: '#0369a1' }}>
                        KSh {totalDebtCollected.toLocaleString()}
                      </span>
                    </div>
                    {todayRepayments.slice(0, 5).map((rep, i) => (
                      <div key={i} className="flex justify-between items-center py-2"
                        style={{ borderTop: i > 0 ? '1px solid #e0f2fe' : 'none', fontSize: '12px' }}>
                        <div>
                          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{rep.customerName || '—'}</span>
                          <span style={{ color: 'var(--text-muted)', marginLeft: '8px' }}>by {rep.recordedBy}</span>
                        </div>
                        <span style={{ fontWeight: 700, color: '#0369a1' }}>KSh {rep.amount?.toLocaleString()}</span>
                      </div>
                    ))}
                    {todayRepayments.length > 5 && (
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px', textAlign: 'center' }}>
                        +{todayRepayments.length - 5} more — see full report
                      </div>
                    )}
                  </div>
                )}

                {/* Cash reconciliation — cashier mode only */}
                {isCashierMode && (
                  <div className="rounded-xl p-4 mb-4" style={{
                    background: 'var(--bg-muted)', border: '2px solid var(--primary)',
                  }}>
                    <div className="text-xs font-black uppercase tracking-wider mb-4" style={{ color: 'var(--primary)' }}>
                      💰 Cash Drawer Reconciliation
                    </div>
                    <div style={{ marginBottom: '16px' }}>
                      {[
                        { label: 'Opening Float', value: openingFloat, muted: true },
                        { label: 'Cash Sales Today', value: cashSales, muted: false },
                        { label: 'Expected in Drawer', value: expectedCash, bold: true, highlight: true },
                      ].map((row, i) => (
                        <div key={i} className="flex justify-between items-center py-2"
                          style={{ borderBottom: i < 2 ? '1px solid var(--border-soft)' : 'none' }}>
                          <span style={{
                            fontSize: '13px',
                            color: row.muted ? 'var(--text-muted)' : 'var(--text-secondary)',
                            fontWeight: row.bold ? '700' : '400'
                          }}>
                            {row.label}
                          </span>
                          <span style={{
                            fontSize: row.bold ? '15px' : '13px',
                            fontWeight: row.bold ? '800' : '500',
                            color: row.highlight ? 'var(--primary)' : 'var(--text-primary)',
                            padding: row.highlight ? '2px 8px' : '0',
                            borderRadius: row.highlight ? '6px' : '0',
                            background: row.highlight ? 'var(--primary-light)' : 'transparent',
                          }}>
                            KSh {row.value.toLocaleString()}
                          </span>
                        </div>
                      ))}
                    </div>

                    {!alreadyClosed && !closed ? (
                      <div>
                        <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '8px' }}>
                          Actual Cash in Drawer (count it now)
                        </label>
                        <div style={{ position: 'relative' }}>
                          <MdMoney style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '18px' }} />
                          <input
                            type="number" min="0"
                            placeholder="Enter amount counted"
                            value={actualCash}
                            onChange={e => setActualCash(e.target.value)}
                            style={{
                              width: '100%', padding: '12px 12px 12px 38px',
                              borderRadius: 'var(--radius-md)', fontSize: '16px', fontWeight: '700',
                              border: `2px solid ${variance === null ? 'var(--border-medium)' : isBalanced ? 'var(--success)' : isShort ? 'var(--danger)' : 'var(--warning)'}`,
                              background: 'var(--bg-card)', color: 'var(--text-primary)',
                              outline: 'none', boxSizing: 'border-box',
                            }}
                          />
                        </div>
                        {variance !== null && (
                          <div className="mt-3 rounded-lg p-3 flex items-center justify-between"
                            style={{
                              background: isBalanced ? 'var(--success-light)' : isShort ? 'var(--danger-light)' : 'var(--warning-light)',
                              border: `1px solid ${isBalanced ? 'var(--success)' : isShort ? 'var(--danger)' : 'var(--warning)'}`,
                            }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              {isBalanced
                                ? <MdCheckCircle style={{ color: 'var(--success)', fontSize: '20px' }} />
                                : <MdWarning style={{ color: isShort ? 'var(--danger)' : 'var(--warning)', fontSize: '20px' }} />
                              }
                              <span style={{
                                fontSize: '13px', fontWeight: '700',
                                color: isBalanced ? 'var(--success-dark)' : isShort ? 'var(--danger-dark)' : 'var(--warning-dark)',
                              }}>
                                {isBalanced ? 'Drawer balanced ✓'
                                  : isShort ? `Short by KSh ${Math.abs(variance).toLocaleString()}`
                                    : `Over by KSh ${Math.abs(variance).toLocaleString()}`}
                              </span>
                            </div>
                            <span style={{
                              fontSize: '16px', fontWeight: '800',
                              color: isBalanced ? 'var(--success-dark)' : isShort ? 'var(--danger-dark)' : 'var(--warning-dark)',
                            }}>
                              {isOver ? '+' : isShort ? '-' : ''}KSh {Math.abs(variance).toLocaleString()}
                            </span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="rounded-lg p-3" style={{ background: 'var(--success-light)', border: '1px solid var(--success)' }}>
                        <div style={{ fontSize: '12px', color: 'var(--success-dark)', fontWeight: '600' }}>
                          Reconciliation saved at shift close.
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Employee breakdown — owner/manager only */}
                {!isCashierMode && (
                  <div className="rounded-xl p-4" style={{ background: 'var(--bg-muted)', border: '1px solid var(--border-soft)' }}>
                    <div className="text-xs font-black uppercase tracking-wider mb-3" style={{ color: 'var(--text-secondary)' }}>Sales by Person</div>
                    {summary.perEmployee.length === 0 ? (
                      <div className="text-sm text-center py-4" style={{ color: 'var(--text-muted)' }}>No employee data.</div>
                    ) : summary.perEmployee.map((emp, i) => (
                      <div key={emp.name} className="flex justify-between items-center py-3"
                        style={{ borderTop: i > 0 ? '1px solid var(--border-soft)' : 'none' }}>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-black flex-shrink-0"
                            style={{ background: 'var(--primary-light)', color: 'var(--primary)' }}>
                            {emp.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{emp.name}</div>
                            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                              {emp.transactions} transactions · {emp.itemsSold} items
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-black" style={{ color: 'var(--primary)' }}>
                            KSh {emp.revenue.toLocaleString()}
                          </div>
                          <div className="text-xs" style={{ color: 'var(--success-dark)' }}>
                            Profit: KSh {emp.profit.toLocaleString()}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          <div
            className="no-print flex-shrink-0 px-6 py-3 flex justify-between items-center gap-3"
            style={{ borderTop: '1px solid var(--border-soft)', background: 'var(--bg-card)' }}
          >
            {closeError && (
              <div style={{ fontSize: '12px', color: 'var(--danger-dark)', fontWeight: '600', flex: 1 }}>
                ⚠️ {closeError}
              </div>
            )}
            <div className="flex gap-2 ml-auto">
              {summary && (
                <button
                  onClick={handleDownloadExcel}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition"
                  style={{ background: 'var(--primary)', color: '#fff', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
                  onMouseEnter={e => { if (!isTouchDevice()) e.currentTarget.style.background = 'var(--primary-dark)' }}
                  onMouseLeave={e => { if (!isTouchDevice()) e.currentTarget.style.background = 'var(--primary)' }}
                >
                  <MdDownload /> Download {isCashierMode ? 'Z-Report' : 'Excel'}
                </button>
              )}
              {isCashierMode && !alreadyClosed && !closed && (
                <button
                  onClick={handleCloseShift}
                  disabled={closing || actualCash === ''}
                  className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-bold text-white transition"
                  style={{
                    background: closing || actualCash === '' ? 'var(--border-medium)' : 'var(--primary)',
                    cursor: closing || actualCash === '' ? 'not-allowed' : 'pointer',
                    border: 'none', fontFamily: 'inherit',
                  }}
                  onMouseEnter={e => { if (!closing && actualCash !== '' && !isTouchDevice()) e.currentTarget.style.background = 'var(--primary-dark)' }}
                  onMouseLeave={e => { if (!closing && actualCash !== '' && !isTouchDevice()) e.currentTarget.style.background = 'var(--primary)' }}
                >
                  <MdLockClock />
                  {closing ? 'Closing Shift…' : 'Confirm Close Shift'}
                </button>
              )}
              {isCashierMode && (alreadyClosed || closed) && (
                <button
                  onClick={onClose}
                  className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-bold text-white transition"
                  style={{ background: 'var(--success)', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  <MdCheckCircle /> Done
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
