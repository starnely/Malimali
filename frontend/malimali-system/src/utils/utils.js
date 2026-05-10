// ── EAT timezone ──────────────────────────────────────────────────────
// East Africa Time = UTC+3
export function nowEAT() {
  return new Date(Date.now() + 3 * 60 * 60 * 1000)
}
export function todayEAT() {
  return nowEAT().toISOString().split("T")[0]
}

/**
 * Build a live summary for a given date from the sales array.
 * All field names match the backend Sale model exactly.
 */
export function buildLiveSummary(date, sales, products = []) {
  const normalize = d => (d ? String(d).slice(0, 10) : null)
  const targetDate = normalize(date)

  const daySales = sales.filter(
    s => normalize(s.date) === targetDate && !s.returned
  )
  if (daySales.length === 0) return null

  let totalRevenue = 0
  let totalProfit = 0
  let totalCOGS = 0
  let cashInDrawer = 0
  let mpesaTotal = 0
  let creditTotal = 0

  // Trackers for counts
  let cashSalesCount = 0
  let mpesaSalesCount = 0
  let creditSalesCount = 0
  let splitSalesCount = 0

  // Tracker for employees
  const employeeMap = {}

  daySales.forEach(s => {
    const saleAmount = s.paymentInfo?.finalTotal ?? s.total ?? 0
    totalRevenue += saleAmount

    // 1. Payment Breakdown Logic
    const method = s.paymentInfo?.paymentMethod
    if (method === 'cash') {
      cashInDrawer += saleAmount
      cashSalesCount++
    } else if (method === 'mpesa') {
      mpesaTotal += saleAmount
      mpesaSalesCount++
    } else if (method === 'credit') {
      creditTotal += saleAmount
      creditSalesCount++
    } else if (method === 'split') {
      cashInDrawer += (s.paymentInfo?.cashPart || 0)
      mpesaTotal += (s.paymentInfo?.mpesaPart || 0)
      splitSalesCount++
    }

    // 2. Profit & COGS Logic
    let saleProfit = 0
    let saleQty = 0
    if (s.items) {
      s.items.forEach(item => {
        const product = products.find(p =>
          String(p._id) === String(item.productId?._id || item.productId)
        )
        const buyPrice = product?.buyPrice || 0
        const itemCost = buyPrice * item.qty
        const itemProfit = (item.price - buyPrice) * item.qty

        totalCOGS += itemCost
        totalProfit += itemProfit
        saleProfit += itemProfit
        saleQty += item.qty
      })
    }

    // 3. Employee Logic
    const empName = s.cashier || 'Unknown'
    if (!employeeMap[empName]) {
      employeeMap[empName] = { name: empName, revenue: 0, profit: 0, transactions: 0, itemsSold: 0 }
    }
    employeeMap[empName].revenue += saleAmount
    employeeMap[empName].profit += saleProfit
    employeeMap[empName].transactions += 1
    employeeMap[empName].itemsSold += saleQty
  })

  return {
    date: targetDate,
    totalRevenue,
    totalProfit,
    totalCOGS, // ✅ Added for Profit Breakdown
    totalItems: daySales.reduce((q, s) => q + (s.items?.reduce((iq, i) => iq + i.qty, 0) || 0), 0),
    totalTransactions: daySales.length,
    paymentBreakdown: {
      cash: cashInDrawer,
      mpesa: mpesaTotal,
      credit: creditTotal,
    },
    // ✅ Added for Payment Breakdown UI
    cashSalesCount,
    mpesaSalesCount,
    creditSalesCount,
    splitSalesCount,
    // ✅ Added for "Sales by Person" UI
    perEmployee: Object.values(employeeMap).sort((a, b) => b.revenue - a.revenue),
    isLive: true,
  }
}

/**
 * Format numbers into Kenyan Shillings.
 */
export function formatCurrency(amount) {
  return `KSh ${Number(amount || 0).toLocaleString()}`
}

/**
 * Get next receipt number — local fallback only.
 * Backend generates receiptId authoritatively.
 */
export function getNextReceiptNumber() {
  const current = Number(localStorage.getItem('malimali_receipt_counter')) || 0
  const next = current + 1
  localStorage.setItem('malimali_receipt_counter', String(next))
  return `RCP-${String(next).padStart(3, '0')}`
}