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
export function buildLiveSummary(date, sales, products = [], storeName = "All") {
  const normalize = d => (d ? String(d).slice(0, 10) : null)
  const targetDate = normalize(date)

  const daySales = sales.filter(s => {
    const dateMatch = normalize(s.date) === targetDate && !s.returned
    const storeMatch = storeName === "All" || s.store === storeName
    return dateMatch && storeMatch
  })

  if (daySales.length === 0) return null

  let totalRevenue = 0
  let totalProfit = 0
  let totalCOGS = 0
  let cashInDrawer = 0
  let mpesaTotal = 0
  let creditTotal = 0
  let cashSalesCount = 0
  let mpesaSalesCount = 0
  let creditSalesCount = 0
  let splitSalesCount = 0

  const employeeMap = {}

  daySales.forEach(s => {
    // ── Use s.total (updated after return) NOT paymentInfo.finalTotal ──
    const saleAmount = s.total ?? 0

    totalRevenue += saleAmount

    // ── Payment breakdown using s.total as source of truth ──
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
      // For split payments, distribute the reduced total proportionally
      // based on original cash/mpesa ratio
      const originalCashPart = s.paymentInfo?.cashPart || 0
      const originalMpesaPart = s.paymentInfo?.mpesaPart || 0
      const originalTotal = originalCashPart + originalMpesaPart || 1

      // Proportion of how much was cash vs mpesa originally
      const cashRatio = originalCashPart / originalTotal
      const mpesaRatio = originalMpesaPart / originalTotal

      cashInDrawer += saleAmount * cashRatio
      mpesaTotal += saleAmount * mpesaRatio
      splitSalesCount++
    }

    // ── Profit & COGS — use current item qty (reduced after return) ──
    let saleProfit = 0
    let saleQty = 0

    if (s.items) {
      s.items.forEach(item => {
        // Skip fully returned items
        if (item.isFullyReturned) return

        const product = products.find(p =>
          String(p._id) === String(item.productId?._id || item.productId)
        )
        const buyPrice = product?.buyPrice || 0
        const qty = item.qty || 0

        const itemCost = buyPrice * qty
        const itemProfit = (item.price - buyPrice) * qty

        totalCOGS += itemCost
        totalProfit += itemProfit
        saleProfit += itemProfit
        saleQty += qty
      })
    }

    // ── Employee tracking ──
    const empName = s.cashier || 'Unknown'
    if (!employeeMap[empName]) {
      employeeMap[empName] = { name: empName, revenue: 0, profit: 0, transactions: 0, itemsSold: 0 }
    }
    employeeMap[empName].revenue += saleAmount
    employeeMap[empName].profit += saleProfit
    employeeMap[empName].transactions += 1
    employeeMap[empName].itemsSold += saleQty
  })

  // Round cash and mpesa to avoid floating point display issues
  cashInDrawer = Math.round(cashInDrawer)
  mpesaTotal = Math.round(mpesaTotal)

  return {
    date: targetDate,
    totalRevenue: Math.round(totalRevenue),
    totalProfit: Math.round(totalProfit),
    totalCOGS: Math.round(totalCOGS),
    totalItems: daySales.reduce((q, s) =>
      q + (s.items?.reduce((iq, i) => iq + (i.isFullyReturned ? 0 : i.qty), 0) || 0), 0),
    totalTransactions: daySales.length,
    paymentBreakdown: {
      cash: cashInDrawer,
      mpesa: mpesaTotal,
      credit: Math.round(creditTotal),
    },
    cashSalesCount,
    mpesaSalesCount,
    creditSalesCount,
    splitSalesCount,
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