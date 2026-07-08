import { useState, useMemo, useEffect } from 'react'
import {
  MdChevronLeft, MdChevronRight, MdTrendingUp, MdAttachMoney,
  MdInventory, MdStorefront, MdDownload, MdReceiptLong, MdPeopleAlt, MdWarning
} from 'react-icons/md'
import { useApp } from '@/context/AppContext'
import { fmtQty } from '@/utils/utils'
import * as XLSX from 'xlsx'
import { API_BASE_URL } from '@/config/api'
import styles from '@/styles/MonthlyReport.module.css'

const isTouchDevice = () => window.matchMedia('(pointer: coarse)').matches

const XL_PRIMARY = '185FA5'
const XL_PRIMARY_DARK = '0C447C'
const XL_PRIMARY_LIGHT = 'E6F1FB'

const CARD_CONFIG = [
  { key: 'revenue', label: 'Net Revenue', icon: <MdAttachMoney />, colorVar: 'var(--primary)', bgVar: 'var(--primary-light)' },
  { key: 'profit', label: 'Total Profit', icon: <MdTrendingUp />, colorVar: 'var(--badge-success-text)', bgVar: 'var(--success-light)' },
  { key: 'taxCollected', label: 'VAT Collected', icon: <MdAttachMoney />, colorVar: 'var(--accent)', bgVar: 'var(--accent-light)' },
  { key: 'items', label: 'Items Sold', icon: <MdInventory />, colorVar: 'var(--badge-warning-text)', bgVar: 'var(--warning-light)' },
  { key: 'txns', label: 'Transactions', icon: <MdReceiptLong />, colorVar: 'var(--badge-accent-text)', bgVar: 'var(--accent-light)' },
  { key: 'debtCollected', label: 'Debt Collected', icon: <MdPeopleAlt />, colorVar: 'var(--badge-info-text)', bgVar: 'var(--info-light)' },
  { key: 'expenses', label: 'Total Expenses', icon: <MdAttachMoney />, colorVar: 'var(--danger)', bgVar: 'var(--danger-light)' },
  { key: 'expiredLoss', label: 'Inventory Loss', icon: <MdWarning />, colorVar: 'var(--badge-warning-text)', bgVar: 'var(--warning-light)' },
  { key: 'netProfit', label: 'Net Profit', icon: <MdTrendingUp />, colorVar: 'var(--badge-success-text)', bgVar: 'var(--success-light)' },
]

const EXPENSE_CAT_LABELS = {
  rent: '🏠 Rent', utilities: '💡 Utilities', wages: '👷 Wages',
  supplies: '🛒 Supplies', petty_cash: '💵 Petty Cash',
  transport: '🚗 Transport', maintenance: '🔧 Maintenance',
  marketing: '📢 Marketing', taxes: '📋 Taxes', other: '📎 Other',
}

const fmt = n => Number(n).toLocaleString('en-KE')

// ── Active qty helper — subtracts voided units ────────────────────────
function activeQtyM(item) {
  if (item.voidStatus === 'voided') return 0
  return Math.max(0, (item.qty || 0) - (item.voidedQty || 0) - (item.returnedQty || 0))
}

export default function MonthlyReport() {
  const { sales, products, isOwner, currentUser, stores, settings } = useApp()
  const currency = settings?.currency || 'KSh'
  const [selectedStore, setSelectedStore] = useState(isOwner ? 'All' : currentUser.store)
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())

  const [repayments, setRepayments] = useState([])
  const [repayLoading, setRepayLoading] = useState(false)
  const [monthlyExpenses, setMonthlyExpenses] = useState([])
  const [expenseLoading, setExpenseLoading] = useState(false)
  const [monthlyExpTotal, setMonthlyExpTotal] = useState(0)
  const [monthlyExpiredLoss, setMonthlyExpiredLoss] = useState(0)

  const monthName = new Date(year, month).toLocaleDateString('en-KE', { month: 'long', year: 'numeric' })
  const prevMonth = () => { if (month === 0) { setMonth(11); setYear(y => y - 1) } else setMonth(m => m - 1) }
  const nextMonth = () => { if (month === 11) { setMonth(0); setYear(y => y + 1) } else setMonth(m => m + 1) }
  const isNextDisabled = year === now.getFullYear() && month === now.getMonth()

  // ── Fetch repayments ──────────────────────────────────────────────
  useEffect(() => {
    let active = true
    const load = async () => {
      setRepayLoading(true)
      try {
        const token = currentUser?.token
        if (!token) return
        const res = await fetch(`${API_BASE_URL}/api/customers/repayments/month?` +
          new URLSearchParams({
            year: String(year),
            month: String(month + 1),
            store: selectedStore === 'All' ? '' : selectedStore,
          }), { headers: { Authorization: `Bearer ${token}` } })
        if (!res.ok) throw new Error('Failed')
        const data = await res.json()
        if (active) setRepayments(Array.isArray(data) ? data : [])
      } catch { if (active) setRepayments([]) }
      if (active) setRepayLoading(false)
    }
    load()
    return () => { active = false }
  }, [year, month, selectedStore, currentUser])

  // ── Fetch monthly expenses ────────────────────────────────────────
  useEffect(() => {
    let active = true
    const load = async () => {
      setExpenseLoading(true)
      try {
        const token = currentUser?.token
        if (!token) return
        const params = new URLSearchParams({ year: String(year), month: String(month + 1) })
        if (selectedStore !== 'All') params.set('store', selectedStore)
        const res = await fetch(`${API_BASE_URL}/api/expenses/monthly?${params}`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        if (!res.ok) throw new Error()
        const data = await res.json()
        if (active) { setMonthlyExpenses(data.expenses || []); setMonthlyExpTotal(data.grandTotal || 0) }
      } catch { if (active) { setMonthlyExpenses([]); setMonthlyExpTotal(0) } }
      if (active) setExpenseLoading(false)
    }
    load()
    return () => { active = false }
  }, [year, month, selectedStore, currentUser])

  // ── Fetch monthly expired stock loss ─────────────────────────────
  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        const token = currentUser?.token
        if (!token) return
        const params = new URLSearchParams({ year: String(year), month: String(month + 1) })
        if (selectedStore !== 'All') params.set('store', selectedStore)
        const url = `${API_BASE_URL}/api/expired/?${params}`
        const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
        if (!res.ok) throw new Error()
        const data = await res.json()
        if (active) setMonthlyExpiredLoss(data.totalLoss || 0)
      } catch { if (active) setMonthlyExpiredLoss(0) }
    }
    load()
    return () => { active = false }
  }, [year, month, selectedStore, currentUser])

  // ── Product map ───────────────────────────────────────────────────
  const productMap = useMemo(() => {
    const m = {}
    products.forEach(p => { m[String(p._id)] = { buyPrice: p.buyPrice || 0, name: p.name, category: p.category } })
    return m
  }, [products])

  // ── Month sales — exclude voided and returned ─────────────────────
  const monthSales = useMemo(() =>
    sales.filter(s => {
      if (!s.date) return false
      const d = new Date(s.date)
      return d.getFullYear() === year && d.getMonth() === month &&
        !s.returned && !s.voided &&
        (selectedStore === 'All' || s.store === selectedStore)
    }),
    [sales, year, month, selectedStore]
  )

  const totalDebtCollected = repayments.reduce((s, r) => s + (r.amount || 0), 0)

  const debtByRecorder = useMemo(() => {
    const m = {}
    repayments.forEach(r => {
      const name = r.recordedBy || 'Unknown'
      if (!m[name]) m[name] = { count: 0, total: 0 }
      m[name].count += 1
      m[name].total += r.amount || 0
    })
    return Object.entries(m).sort((a, b) => b[1].total - a[1].total)
  }, [repayments])

  // ── Totals — all use activeQtyM, revenue/profit are net of VAT ──────
  const totalRevenue = monthSales.reduce((sum, s) => {
    const taxFactor = s.taxRate > 0 ? 1 / (1 + s.taxRate) : 1
    return sum + (s.items?.reduce((rv, item) => {
      if (item.voidStatus === 'voided') return rv
      return rv + (item.price || 0) * activeQtyM(item)
    }, 0) || 0) * taxFactor
  }, 0)

  const totalProfit = monthSales.reduce((sum, sale) => {
    const taxFactor = sale.taxRate > 0 ? 1 / (1 + sale.taxRate) : 1
    return sum + (sale.items?.reduce((s2, item) => {
      if (item.voidStatus === 'voided') return s2
      const buy = productMap[String(item.productId?._id || item.productId)]?.buyPrice || 0
      return s2 + (item.price * taxFactor - buy) * activeQtyM(item)
    }, 0) || 0)
  }, 0)

  const totalTaxCollected = monthSales.reduce((sum, sale) => sum + (sale.taxAmount || 0), 0)

  const totalItems = monthSales.reduce((sum, s) =>
    sum + (s.items?.reduce((q, item) => {
      if (item.voidStatus === 'voided') return q
      return q + activeQtyM(item)
    }, 0) || 0), 0)

  const summaryValues = {
    revenue: Math.round(totalRevenue),
    profit: Math.round(totalProfit),
    taxCollected: Math.round(totalTaxCollected),
    items: totalItems,
    txns: monthSales.length,
    debtCollected: totalDebtCollected,
    expenses: monthlyExpTotal,
    expiredLoss: monthlyExpiredLoss,
    netProfit: Math.round(totalProfit) - monthlyExpTotal - monthlyExpiredLoss,
  }

  const formatCardValue = (key, val) => {
    if (['revenue', 'profit', 'taxCollected', 'debtCollected', 'expenses', 'expiredLoss', 'netProfit'].includes(key)) return `${currency} ${Number(val).toLocaleString()}`
    if (key === 'items') return String(fmtQty(val || 0))
    return val.toLocaleString()
  }

  const daysInMonth = new Date(year, month + 1, 0).getDate()

  // ── Daily data — uses activeQtyM ──────────────────────────────────
  const dailyData = useMemo(() => Array.from({ length: daysInMonth }, (_, idx) => {
    const day = idx + 1
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    const daySales = monthSales.filter(s => s.date?.startsWith(dateStr))

    const revenue = daySales.reduce((sum, s) => {
      const taxFactor = s.taxRate > 0 ? 1 / (1 + s.taxRate) : 1
      return sum + (s.items?.reduce((rv, item) => {
        if (item.voidStatus === 'voided') return rv
        return rv + (item.price || 0) * activeQtyM(item)
      }, 0) || 0) * taxFactor
    }, 0)

    const profit = daySales.reduce((sum, sale) => {
      const taxFactor = sale.taxRate > 0 ? 1 / (1 + sale.taxRate) : 1
      return sum + (sale.items?.reduce((s2, item) => {
        if (item.voidStatus === 'voided') return s2
        const buy = productMap[String(item.productId?._id || item.productId)]?.buyPrice || 0
        return s2 + (item.price * taxFactor - buy) * activeQtyM(item)
      }, 0) || 0)
    }, 0)

    const items = daySales.reduce((sum, s) =>
      sum + (s.items?.reduce((q, item) => {
        if (item.voidStatus === 'voided') return q
        return q + activeQtyM(item)
      }, 0) || 0), 0)

    const dayDebt = repayments.filter(r => r.date?.startsWith(dateStr)).reduce((s, r) => s + (r.amount || 0), 0)
    const dayExp = monthlyExpenses.filter(e => e.date === dateStr).reduce((s, e) => s + e.amount, 0)

    return { day, date: dateStr, revenue, profit, items, transactions: daySales.length, debtCollected: dayDebt, expenses: dayExp }
  }), [monthSales, daysInMonth, year, month, productMap, repayments, monthlyExpenses])

  const maxRevenue = Math.max(...dailyData.map(d => d.revenue), 1)

  // ── Product sales map — uses activeQtyM, net revenue ─────────────
  const productSalesMap = useMemo(() => {
    const m = {}
    monthSales.forEach(sale => {
      const taxFactor = sale.taxRate > 0 ? 1 / (1 + sale.taxRate) : 1
      sale.items?.forEach(item => {
        if (item.voidStatus === 'voided') return
        const qty = activeQtyM(item)
        if (qty <= 0) return
        const id = String(item.productId?._id || item.productId)
        const name = productMap[id]?.name || id
        if (!m[name]) m[name] = { qty: 0, revenue: 0 }
        m[name].qty += qty
        m[name].revenue += qty * item.price * taxFactor
      })
    })
    return m
  }, [monthSales, productMap])

  const topProducts = Object.entries(productSalesMap).sort((a, b) => b[1].revenue - a[1].revenue).slice(0, 5)

  // ── Employee map — uses activeQtyM, net revenue/profit ───────────
  const empMap = useMemo(() => {
    const m = {}
    monthSales.forEach(s => {
      const taxFactor = s.taxRate > 0 ? 1 / (1 + s.taxRate) : 1
      const name = s.cashier || 'Unknown'
      if (!m[name]) m[name] = { qty: 0, revenue: 0, count: 0, profit: 0 }

      const saleRevenue = (s.items?.reduce((rv, item) => {
        if (item.voidStatus === 'voided') return rv
        return rv + (item.price || 0) * activeQtyM(item)
      }, 0) || 0) * taxFactor

      m[name].revenue += saleRevenue
      m[name].count += 1
      m[name].qty += s.items?.reduce((q, item) => {
        if (item.voidStatus === 'voided') return q
        return q + activeQtyM(item)
      }, 0) || 0
      m[name].profit += s.items?.reduce((s2, item) => {
        if (item.voidStatus === 'voided') return s2
        const buy = productMap[String(item.productId?._id || item.productId)]?.buyPrice || 0
        return s2 + (item.price * taxFactor - buy) * activeQtyM(item)
      }, 0) || 0
    })
    return m
  }, [monthSales, productMap])

  const empPerformance = Object.entries(empMap).sort((a, b) => b[1].revenue - a[1].revenue)
  const maxEmpRevenue = Math.max(...empPerformance.map(e => e[1].revenue), 1)

  const expenseByCategory = useMemo(() => {
    const m = {}
    monthlyExpenses.forEach(e => { m[e.category] = (m[e.category] || 0) + e.amount })
    return Object.entries(m).sort((a, b) => b[1] - a[1])
  }, [monthlyExpenses])

  // ── XLSX Export ───────────────────────────────────────────────────
  const handleDownloadCSV = () => {
    const profitMarginPct = totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(1) : '0.0'
    const avgTxnValue = monthSales.length > 0 ? Math.round(totalRevenue / monthSales.length) : 0
    const fmtDate = d => new Date(d + 'T00:00:00').toLocaleDateString('en-KE', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })

    const titleStyle = { font: { bold: true, sz: 14, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: XL_PRIMARY } }, alignment: { horizontal: 'left' } }
    const secStyle = { font: { bold: true, sz: 11, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: XL_PRIMARY_DARK } }, alignment: { horizontal: 'left' } }
    const hdrStyle = { font: { bold: true, sz: 10, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '2D7DD2' } }, alignment: { horizontal: 'center' }, border: { top: { style: 'thin', color: { rgb: 'FFFFFF' } }, bottom: { style: 'thin', color: { rgb: 'FFFFFF' } }, left: { style: 'thin', color: { rgb: 'FFFFFF' } }, right: { style: 'thin', color: { rgb: 'FFFFFF' } } } }
    const totStyle = { font: { bold: true, sz: 10, color: { rgb: XL_PRIMARY_DARK } }, fill: { fgColor: { rgb: XL_PRIMARY_LIGHT } }, alignment: { horizontal: 'center' }, border: { top: { style: 'medium', color: { rgb: '2D7DD2' } }, bottom: { style: 'medium', color: { rgb: '2D7DD2' } }, left: { style: 'thin', color: { rgb: 'CCE0F5' } }, right: { style: 'thin', color: { rgb: 'CCE0F5' } } } }
    const cel = (i) => ({ font: { sz: 10, color: { rgb: '333333' } }, fill: { fgColor: { rgb: i % 2 === 0 ? 'FFFFFF' : 'F0F6FD' } }, alignment: { horizontal: 'center' }, border: { top: { style: 'thin', color: { rgb: 'E0E0E0' } }, bottom: { style: 'thin', color: { rgb: 'E0E0E0' } }, left: { style: 'thin', color: { rgb: 'E0E0E0' } }, right: { style: 'thin', color: { rgb: 'E0E0E0' } } } })
    const lft = (i) => ({ ...cel(i), alignment: { horizontal: 'left' } })
    const grn = (i) => ({ ...cel(i), font: { sz: 10, color: { rgb: '2E7D32' }, bold: true } })
    const blu = (i) => ({ ...cel(i), font: { sz: 10, color: { rgb: '0369a1' }, bold: true } })
    const red = (i) => ({ ...cel(i), font: { sz: 10, color: { rgb: 'C62828' }, bold: true } })
    const kvL = { font: { bold: true, sz: 10, color: { rgb: '555555' } }, fill: { fgColor: { rgb: 'F8FAFB' } }, alignment: { horizontal: 'left' }, border: { top: { style: 'thin', color: { rgb: 'E0E0E0' } }, bottom: { style: 'thin', color: { rgb: 'E0E0E0' } }, left: { style: 'thin', color: { rgb: 'E0E0E0' } }, right: { style: 'thin', color: { rgb: 'E0E0E0' } } } }
    const kvV = { font: { bold: true, sz: 11, color: { rgb: XL_PRIMARY } }, fill: { fgColor: { rgb: XL_PRIMARY_LIGHT } }, alignment: { horizontal: 'right' }, border: { top: { style: 'thin', color: { rgb: 'E0E0E0' } }, bottom: { style: 'thin', color: { rgb: 'E0E0E0' } }, left: { style: 'thin', color: { rgb: 'E0E0E0' } }, right: { style: 'thin', color: { rgb: 'E0E0E0' } } } }

    const ws = {}, merges = []
    let r = 0
    const sc = (row, col, value, style) => { const addr = XLSX.utils.encode_cell({ r: row, c: col }); ws[addr] = { v: value, t: typeof value === 'number' ? 'n' : 's', s: style } }
    const mc = (row, from, to) => merges.push({ s: { r: row, c: from }, e: { r: row, c: to } })

    sc(r, 0, 'MONTHLY BUSINESS REPORT', titleStyle); mc(r, 0, 6); r++
    sc(r, 0, `Period: ${monthName}`, { ...titleStyle, font: { bold: false, sz: 11, color: { rgb: 'FFFFFF' } } }); mc(r, 0, 6); r++
    sc(r, 0, `Branch: ${selectedStore}`, { ...titleStyle, font: { bold: false, sz: 11, color: { rgb: 'FFFFFF' } } }); mc(r, 0, 6); r++
    sc(r, 0, `Generated: ${new Date().toLocaleDateString('en-KE', { day: '2-digit', month: 'long', year: 'numeric' })}`, { ...titleStyle, font: { bold: false, sz: 10, color: { rgb: 'CCE0F5' } } }); mc(r, 0, 6); r++
    r++

    sc(r, 0, 'SUMMARY', secStyle); mc(r, 0, 6); r++
      ;[
        ['Net Revenue (excl. VAT)',   `${currency} ${fmt(Math.round(totalRevenue))}`,   'Items Sold',       fmt(totalItems)],
        ['Total Profit',             `${currency} ${fmt(Math.round(totalProfit))}`,     'Transactions',     fmt(monthSales.length)],
        ['VAT Collected (→ KRA)',    `${currency} ${fmt(Math.round(totalTaxCollected))}`,'Avg. Txn Value',  `${currency} ${fmt(Math.round(avgTxnValue))}`],
        ['Total Expenses',           `${currency} ${fmt(monthlyExpTotal)}`,             'Net Profit (true)',`${currency} ${fmt(Math.round(totalProfit) - monthlyExpTotal - monthlyExpiredLoss)}`],
        ['Inventory Loss (Expired)', `${currency} ${fmt(monthlyExpiredLoss)}`,          '',                 ''],
        ['Debt Collected',           `${currency} ${fmt(totalDebtCollected)}`,          'Debt Collections', fmt(repayments.length)],
      ].forEach(([l1, v1, l2, v2]) => {
        sc(r, 0, l1, kvL); sc(r, 1, v1, kvV)
        sc(r, 2, '', { fill: { fgColor: { rgb: 'FFFFFF' } } })
        sc(r, 3, l2, kvL); sc(r, 4, v2, kvV)
        sc(r, 5, '', { fill: { fgColor: { rgb: 'FFFFFF' } } })
        sc(r, 6, '', { fill: { fgColor: { rgb: 'FFFFFF' } } })
        r++
      })
    r++

    sc(r, 0, 'DAILY BREAKDOWN', secStyle); mc(r, 0, 6); r++
      ;[`Date`, 'Transactions', 'Items Sold', `Revenue (${currency})`, `Profit (${currency})`, `Debt In (${currency})`, `Expenses (${currency})`].forEach((h, c) => sc(r, c, h, hdrStyle)); r++
    const activeDays = dailyData.filter(d => d.revenue > 0 || d.debtCollected > 0 || d.expenses > 0)
    activeDays.forEach((d, i) => {
      sc(r, 0, fmtDate(d.date), lft(i)); sc(r, 1, d.transactions, cel(i)); sc(r, 2, d.items, cel(i))
      sc(r, 3, d.revenue, cel(i)); sc(r, 4, d.profit, grn(i)); sc(r, 5, d.debtCollected, blu(i))
      sc(r, 6, d.expenses, d.expenses > 0 ? red(i) : cel(i)); r++
    })
    sc(r, 0, 'TOTAL', totStyle); sc(r, 1, monthSales.length, totStyle); sc(r, 2, totalItems, totStyle)
    sc(r, 3, totalRevenue, totStyle)
    sc(r, 4, totalProfit, { ...totStyle, font: { bold: true, sz: 10, color: { rgb: '2E7D32' } } })
    sc(r, 5, totalDebtCollected, { ...totStyle, font: { bold: true, sz: 10, color: { rgb: '0369a1' } } })
    sc(r, 6, monthlyExpTotal, { ...totStyle, font: { bold: true, sz: 10, color: { rgb: 'C62828' } } })
    r++; r++

    sc(r, 0, 'TOP PRODUCTS', secStyle); mc(r, 0, 6); r++
      ;['Rank', 'Product Name', 'Qty Sold', 'Revenue (KSh)', 'Revenue Share %', '', ''].forEach((h, c) => sc(r, c, h, hdrStyle)); r++
    topProducts.forEach(([name, d], i) => {
      const share = totalRevenue > 0 ? ((d.revenue / totalRevenue) * 100).toFixed(1) + '%' : '0.0%'
      sc(r, 0, `#${i + 1}`, cel(i)); sc(r, 1, name, lft(i)); sc(r, 2, d.qty, cel(i))
      sc(r, 3, d.revenue, cel(i)); sc(r, 4, share, cel(i)); sc(r, 5, '', cel(i)); sc(r, 6, '', cel(i)); r++
    })
    r++

    sc(r, 0, 'EMPLOYEE PERFORMANCE', secStyle); mc(r, 0, 6); r++
      ;['Rank', 'Employee', 'Transactions', 'Items Sold', 'Revenue (KSh)', 'Profit (KSh)', ''].forEach((h, c) => sc(r, c, h, hdrStyle)); r++
    empPerformance.forEach(([name, d], i) => {
      sc(r, 0, `#${i + 1}`, cel(i)); sc(r, 1, name, lft(i)); sc(r, 2, d.count, cel(i))
      sc(r, 3, d.qty, cel(i)); sc(r, 4, d.revenue, cel(i)); sc(r, 5, d.profit, grn(i)); sc(r, 6, '', cel(i)); r++
    })
    r++

    if (repayments.length > 0) {
      sc(r, 0, 'DEBT COLLECTIONS', secStyle); mc(r, 0, 6); r++
        ;['Rank', 'Recorded By', 'Collections', 'Total Collected (KSh)', '', '', ''].forEach((h, c) => sc(r, c, h, hdrStyle)); r++
      debtByRecorder.forEach(([name, d], i) => {
        sc(r, 0, `#${i + 1}`, cel(i)); sc(r, 1, name, lft(i)); sc(r, 2, d.count, cel(i))
        sc(r, 3, d.total, blu(i)); sc(r, 4, '', cel(i)); sc(r, 5, '', cel(i)); sc(r, 6, '', cel(i)); r++
      })
      sc(r, 0, 'TOTAL', totStyle); sc(r, 1, '', totStyle)
      sc(r, 2, repayments.length, totStyle)
      sc(r, 3, totalDebtCollected, { ...totStyle, font: { bold: true, sz: 10, color: { rgb: '0369a1' } } })
      sc(r, 4, '', totStyle); sc(r, 5, '', totStyle); sc(r, 6, '', totStyle); r++; r++
    }

    if (monthlyExpenses.length > 0) {
      sc(r, 0, 'EXPENSES BY CATEGORY', secStyle); mc(r, 0, 6); r++
        ;['Category', 'Total (KSh)', 'Count', '', '', '', ''].forEach((h, c) => sc(r, c, h, hdrStyle)); r++
      expenseByCategory.forEach(([cat, total], i) => {
        const count = monthlyExpenses.filter(e => e.category === cat).length
        sc(r, 0, EXPENSE_CAT_LABELS[cat] || cat, lft(i)); sc(r, 1, total, red(i)); sc(r, 2, count, cel(i))
        for (let c = 3; c <= 6; c++) sc(r, c, '', cel(i)); r++
      })
      sc(r, 0, 'TOTAL EXPENSES', totStyle)
      sc(r, 1, monthlyExpTotal, { ...totStyle, font: { bold: true, sz: 10, color: { rgb: 'C62828' } } })
      sc(r, 2, monthlyExpenses.length, totStyle)
      for (let c = 3; c <= 6; c++) sc(r, c, '', totStyle); r++
    }

    ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r, c: 6 } })
    ws['!merges'] = merges
    ws['!cols'] = [{ wch: 22 }, { wch: 24 }, { wch: 14 }, { wch: 14 }, { wch: 18 }, { wch: 18 }, { wch: 18 }]
    ws['!rows'] = Array.from({ length: r }, (_, i) => ({ hpt: i < 4 ? 22 : 18 }))

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Monthly Report')

    if (monthlyExpenses.length > 0) {
      const expRows = monthlyExpenses.map(e => ({
        Date: e.date,
        Time: e.time || '',
        Category: EXPENSE_CAT_LABELS[e.category] || e.category,
        Description: e.description || '',
        'Amount (KSh)': e.amount,
        'Recorded By': e.recordedBy || '',
      }))
      const expSheet = XLSX.utils.json_to_sheet(expRows)
      expSheet['!cols'] = [{ wch: 13 }, { wch: 13 }, { wch: 16 }, { wch: 32 }, { wch: 14 }, { wch: 20 }]
      XLSX.utils.book_append_sheet(wb, expSheet, 'Expenses')
    }

    XLSX.writeFile(wb, `monthly-report-${year}-${String(month + 1).padStart(2, '0')}-${selectedStore.replace(/\s+/g, '-')}.xlsx`)
  }

  const card = { background: 'var(--bg-card)', border: '1px solid var(--border-soft)', borderRadius: 'var(--radius-lg)', padding: '1.25rem', boxShadow: 'var(--shadow-card)' }

  return (
    <div>
      {/* Sub-header */}
      <div className="flex justify-between items-center mb-5 flex-wrap gap-3">
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          {isOwner ? `Viewing: ${selectedStore}` : `Performance for ${currentUser.store}`}
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          {isOwner && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border-soft)' }}>
              <MdStorefront style={{ color: 'var(--primary)', fontSize: '18px' }} />
              <select value={selectedStore} onChange={e => setSelectedStore(e.target.value)}
                className="text-sm font-semibold outline-none bg-transparent cursor-pointer"
                style={{ color: 'var(--text-primary)' }}>
                <option value="All">✨ All Locations</option>
                {stores?.map(st => <option key={st._id} value={st.name}>📍 {st.name}</option>)}
              </select>
            </div>
          )}
          <div className="flex items-center gap-1 px-3 py-2 rounded-xl"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-soft)' }}>
            <MdChevronLeft onClick={prevMonth} style={{ fontSize: '22px', cursor: 'pointer', color: 'var(--text-secondary)' }} />
            <span className="text-sm font-semibold" style={{ minWidth: '148px', textAlign: 'center', color: 'var(--text-primary)' }}>{monthName}</span>
            <MdChevronRight
              onClick={isNextDisabled ? undefined : nextMonth}
              style={{ fontSize: '22px', cursor: isNextDisabled ? 'default' : 'pointer', color: isNextDisabled ? 'var(--border-medium)' : 'var(--text-secondary)' }}
            />
          </div>
          <button onClick={handleDownloadCSV}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white transition"
            style={{ background: 'var(--primary)', border: 'none', cursor: 'pointer' }}
            onMouseEnter={e => { if (!isTouchDevice()) e.currentTarget.style.background = 'var(--primary-dark)' }}
            onMouseLeave={e => { if (!isTouchDevice()) e.currentTarget.style.background = 'var(--primary)' }}>
            <MdDownload style={{ fontSize: '16px' }} /> Download Excel
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid gap-3 mb-5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
        {CARD_CONFIG.map((c, i) => {
          const isNetProfit = c.key === 'netProfit'
          const netVal = summaryValues['netProfit'] || 0
          const cardColor = isNetProfit && netVal < 0 ? 'var(--danger)' : c.colorVar
          const cardBg = isNetProfit && netVal < 0 ? 'var(--danger-light)' : c.bgVar
          return (
            <div key={i} style={{ ...card, borderLeft: `3px solid ${cardColor}`, display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: 'var(--radius-md)', background: cardBg, color: cardColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', flexShrink: 0 }}>
                {c.icon}
              </div>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '3px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{c.label}</div>
                <div style={{ fontSize: '17px', fontWeight: '700', color: 'var(--text-primary)' }}>{formatCardValue(c.key, summaryValues[c.key])}</div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Daily bar chart */}
      <div style={{ ...card, marginBottom: '1rem' }}>
        <div className="flex justify-between items-center mb-4">
          <h2 style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)' }}>Daily Revenue — {monthName}</h2>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Hover bars for details</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height: '140px', overflowX: 'auto', paddingBottom: '4px' }}>
          {dailyData.map((d, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', flex: '1', minWidth: '22px' }}>
              <div
                title={`Day ${d.day}: Rev KSh ${d.revenue.toLocaleString()} | Profit KSh ${d.profit.toLocaleString()}${d.debtCollected > 0 ? ` | Debt KSh ${d.debtCollected.toLocaleString()}` : ''}${d.expenses > 0 ? ` | Exp KSh ${d.expenses.toLocaleString()}` : ''}`}
                style={{
                  width: '100%', borderRadius: '3px 3px 0 0',
                  background: d.revenue > 0 ? `linear-gradient(to top, var(--primary), var(--primary-muted))` : 'var(--bg-muted)',
                  height: `${Math.max((d.revenue / maxRevenue) * 110, d.revenue > 0 ? 4 : 0)}px`,
                  transition: 'height 0.3s', cursor: d.revenue > 0 ? 'pointer' : 'default',
                }}
              />
              <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>{d.day}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom grid */}
      <div className={styles.bottomGrid}>

        {/* Day-by-day table */}
        <div style={card}>
          <h2 style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '1rem' }}>Day-by-Day Breakdown</h2>
          <div style={{ overflowY: 'auto', overflowX: 'auto', maxHeight: '320px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--bg-muted)' }}>
                  {['Date', 'Items', 'Revenue', 'Profit', 'Txns', 'Debt In', 'Expenses'].map(h => (
                    <th key={h} style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: '700', textAlign: 'left', padding: '8px 10px', borderBottom: `1px solid var(--border-soft)`, position: 'sticky', top: 0, background: 'var(--bg-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dailyData.filter(d => d.revenue > 0 || d.debtCollected > 0 || d.expenses > 0).length === 0 ? (
                  <tr><td colSpan={7} style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>No activity this month.</td></tr>
                ) : (
                  dailyData.filter(d => d.revenue > 0 || d.debtCollected > 0 || d.expenses > 0).map((d, i) => (
                    <tr key={i} style={{ background: i % 2 === 0 ? 'transparent' : 'var(--bg-muted)', borderBottom: `1px solid var(--border-soft)` }}>
                      <td style={{ padding: '8px 10px', fontSize: '12px', color: 'var(--text-primary)', fontWeight: '500' }}>
                        {new Date(d.date + 'T00:00:00').toLocaleDateString('en-KE', { weekday: 'short', day: 'numeric', month: 'short' })}
                      </td>
                      <td style={{ padding: '8px 10px', fontSize: '12px', color: 'var(--text-secondary)' }}>{fmtQty(d.items || 0)}</td>
                      <td style={{ padding: '8px 10px', fontSize: '12px', color: 'var(--primary)', fontWeight: '600' }}>KSh {d.revenue.toLocaleString()}</td>
                      <td style={{ padding: '8px 10px', fontSize: '12px', color: d.profit >= 0 ? 'var(--success-dark)' : 'var(--danger)', fontWeight: '600' }}>KSh {d.profit.toLocaleString()}</td>
                      <td style={{ padding: '8px 10px', fontSize: '12px', color: 'var(--text-muted)' }}>{d.transactions}</td>
                      <td style={{ padding: '8px 10px', fontSize: '12px', color: d.debtCollected > 0 ? 'var(--info-600)' : 'var(--text-muted)', fontWeight: d.debtCollected > 0 ? '600' : '400' }}>
                        {d.debtCollected > 0 ? `KSh ${d.debtCollected.toLocaleString()}` : '—'}
                      </td>
                      <td style={{ padding: '8px 10px', fontSize: '12px', color: d.expenses > 0 ? 'var(--danger)' : 'var(--text-muted)', fontWeight: d.expenses > 0 ? '600' : '400' }}>
                        {d.expenses > 0 ? `KSh ${d.expenses.toLocaleString()}` : '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

          {/* Top Products */}
          <div style={card}>
            <h2 style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '1rem' }}>Top Products</h2>
            {topProducts.length === 0 ? (
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center', padding: '1rem 0' }}>No sales this month.</p>
            ) : (
              topProducts.map(([name, data], i) => (
                <div key={i} style={{ marginBottom: i < topProducts.length - 1 ? '12px' : '0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '11px', color: 'var(--primary)', fontWeight: '700', minWidth: '16px' }}>#{i + 1}</span>
                      <span style={{ fontSize: '12px', color: 'var(--text-primary)', fontWeight: '600' }}>{name}</span>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '12px', color: 'var(--primary)', fontWeight: '600' }}>KSh {data.revenue.toLocaleString()}</span>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '4px' }}>· {fmtQty(data.qty || 0)} pcs</span>
                    </div>
                  </div>
                  <div style={{ height: '4px', background: 'var(--bg-muted)', borderRadius: '2px' }}>
                    <div style={{ height: '100%', borderRadius: '2px', width: `${Math.round((data.revenue / (topProducts[0][1].revenue || 1)) * 100)}%`, background: 'var(--primary)' }} />
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Employee Performance */}
          <div style={card}>
            <h2 style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '1rem' }}>Employee Performance</h2>
            {empPerformance.length === 0 ? (
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center', padding: '1rem 0' }}>No sales this month.</p>
            ) : (
              empPerformance.map(([name, data], i) => (
                <div key={i} style={{ marginBottom: i < empPerformance.length - 1 ? '14px' : '0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontSize: '12px', color: 'var(--text-primary)', fontWeight: '600' }}>{name}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '1px' }}>{data.count} sales · {fmtQty(data.qty || 0)} items</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '12px', color: 'var(--badge-success-text)', fontWeight: '600' }}>KSh {data.revenue.toLocaleString()}</div>
                      <div style={{ fontSize: '11px', color: 'var(--badge-accent-text)' }}>Profit: KSh {data.profit.toLocaleString()}</div>
                    </div>
                  </div>
                  <div style={{ height: '4px', background: 'var(--bg-muted)', borderRadius: '2px' }}>
                    <div style={{ height: '100%', borderRadius: '2px', width: `${Math.round((data.revenue / maxEmpRevenue) * 100)}%`, background: 'var(--success)' }} />
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Debt Collections */}
          <div style={card}>
            <h2 style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <MdPeopleAlt style={{ color: 'var(--info-600)', fontSize: '18px' }} /> Debt Collections
            </h2>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>
              {repayLoading ? 'Loading...' : `${repayments.length} payment${repayments.length !== 1 ? 's' : ''} recorded`}
            </div>
            {repayLoading ? (
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center', padding: '0.5rem 0' }}>Loading...</p>
            ) : repayments.length === 0 ? (
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center', padding: '0.5rem 0' }}>No debt collected this month.</p>
            ) : (
              <>
                <div style={{ padding: '10px 12px', borderRadius: 'var(--radius-md)', background: 'var(--info-light)', border: '1px solid var(--info-light)', marginBottom: '12px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--info-600)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>Total Collected</div>
                  <div style={{ fontSize: '20px', fontWeight: 900, color: 'var(--info-600)' }}>KSh {totalDebtCollected.toLocaleString()}</div>
                </div>
                {debtByRecorder.map(([name, d], i) => (
                  <div key={i} style={{ marginBottom: i < debtByRecorder.length - 1 ? '10px' : '0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontSize: '12px', color: 'var(--text-primary)', fontWeight: '600' }}>{name}</span>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: '12px', color: 'var(--info-600)', fontWeight: '600' }}>KSh {d.total.toLocaleString()}</span>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '4px' }}>· {d.count}×</span>
                      </div>
                    </div>
                    <div style={{ height: '4px', background: 'var(--bg-muted)', borderRadius: '2px' }}>
                      <div style={{ height: '100%', borderRadius: '2px', width: `${Math.round((d.total / (debtByRecorder[0][1].total || 1)) * 100)}%`, background: 'var(--info-600)' }} />
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>

          {/* Monthly Expenses */}
          <div style={card}>
            <h2 style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>💸 Monthly Expenses</span>
              <span style={{ fontSize: '12px', fontWeight: 400, color: 'var(--text-muted)' }}>
                {expenseLoading ? '…' : `${monthlyExpenses.length} entries`}
              </span>
            </h2>
            {expenseLoading ? (
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center', padding: '0.5rem 0' }}>Loading...</p>
            ) : monthlyExpenses.length === 0 ? (
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center', padding: '0.5rem 0' }}>No expenses this month.</p>
            ) : (
              <>
                <div style={{ padding: '10px 12px', borderRadius: 'var(--radius-md)', background: 'var(--danger-light)', border: '1px solid var(--danger-light)', marginBottom: '12px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--badge-danger-text)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>Total Expenses</div>
                  <div style={{ fontSize: '20px', fontWeight: 900, color: 'var(--danger)' }}>KSh {monthlyExpTotal.toLocaleString()}</div>
                </div>
                {expenseByCategory.map(([cat, total], i) => (
                  <div key={cat} style={{ marginBottom: i < expenseByCategory.length - 1 ? '10px' : '0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontSize: '12px', color: 'var(--text-primary)', fontWeight: '600' }}>
                        {EXPENSE_CAT_LABELS[cat] || cat}
                      </span>
                      <span style={{ fontSize: '12px', color: 'var(--danger)', fontWeight: '600' }}>
                        KSh {total.toLocaleString()}
                      </span>
                    </div>
                    <div style={{ height: '4px', background: 'var(--bg-muted)', borderRadius: '2px' }}>
                      <div style={{ height: '100%', borderRadius: '2px', width: `${Math.round((total / (expenseByCategory[0][1] || 1)) * 100)}%`, background: 'var(--danger)' }} />
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}
