// ── EAT timezone ──────────────────────────────────────────────────────
export function nowEAT() {
  return new Date(Date.now() + 3 * 60 * 60 * 1000)
}
export function todayEAT() {
  return nowEAT().toISOString().split("T")[0]
}

// ── Shared item helpers ───────────────────────────────────────────────
export function activeQty(item) {
  if (item.voidStatus === 'voided') return 0
  const afterVoid = Math.max(0, (item.qty || 0) - (item.voidedQty || 0))
  const afterReturned = Math.max(0, afterVoid - (item.returnedQty || 0))
  return afterReturned
}

export function isActiveItem(item) {
  if (item.voidStatus === 'voided') return false
  return activeQty(item) > 0
}

/**
 * Build a live summary for a given date from the sales array.
 * Correctly handles partial voids and returned items.
 */
export function buildLiveSummary(date, sales, products = [], storeName = "All") {
  const normalize = d => (d ? String(d).slice(0, 10) : null)
  const targetDate = normalize(date)

  const daySales = sales.filter(s => {
    const dateMatch = normalize(s.date) === targetDate && !s.returned && !s.voided
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
  let cardTotal = 0
  let bankTotal = 0
  let cashSalesCount = 0
  let mpesaSalesCount = 0
  let creditSalesCount = 0
  let splitSalesCount = 0
  let cardSalesCount = 0
  let bankSalesCount = 0
  let totalItems = 0
  let totalTransactions = 0

  const employeeMap = {}

  daySales.forEach(s => {
    const method = s.paymentInfo?.paymentMethod

    // ── Calculate actual sale revenue from active items only ──────────
    let saleRevenue = 0
    let saleProfit = 0
    let saleQty = 0

    if (s.items) {
      s.items.forEach(item => {
        if (!isActiveItem(item)) return
        const qty = activeQty(item)
        const product = products.find(p =>
          String(p._id) === String(item.productId?._id || item.productId)
        )
        const buyPrice = item.buyPrice ?? product?.buyPrice ?? 0
        const sellPrice = item.price || 0

        saleRevenue += sellPrice * qty
        saleProfit += (sellPrice - buyPrice) * qty
        totalCOGS += buyPrice * qty
        saleQty += qty
      })
    }

    // Skip sale if all items were voided/returned (nothing to count)
    if (saleRevenue === 0 && saleQty === 0) return

    totalRevenue += saleRevenue
    totalProfit += saleProfit
    totalItems += saleQty
    totalTransactions += 1

    // ── Payment method breakdown ──────────────────────────────────────
    if (method === 'cash') {
      cashInDrawer += saleRevenue
      cashSalesCount++
    } else if (method === 'mpesa') {
      mpesaTotal += saleRevenue
      mpesaSalesCount++
    } else if (method === 'credit') {
      creditTotal += saleRevenue
      creditSalesCount++
    } else if (method === 'split') {
      const origCash = s.paymentInfo?.cashPart || 0
      const origMpesa = s.paymentInfo?.mpesaPart || 0
      const origTotal = origCash + origMpesa || 1
      // Allocate active revenue proportionally across cash/mpesa split
      cashInDrawer += saleRevenue * (origCash / origTotal)
      mpesaTotal += saleRevenue * (origMpesa / origTotal)
      splitSalesCount++
    } else if (method === 'card') {
      cardTotal += saleRevenue
      cardSalesCount++
    } else if (method === 'bank') {
      bankTotal += saleRevenue
      bankSalesCount++
    }

    // ── Per-employee tracking ─────────────────────────────────────────
    const empName = s.cashier || 'Unknown'
    if (!employeeMap[empName]) {
      employeeMap[empName] = { name: empName, revenue: 0, profit: 0, transactions: 0, itemsSold: 0 }
    }
    employeeMap[empName].revenue += saleRevenue
    employeeMap[empName].profit += saleProfit
    employeeMap[empName].transactions += 1
    employeeMap[empName].itemsSold += saleQty
  })

  return {
    date: targetDate,
    totalRevenue: Math.round(totalRevenue),
    totalProfit: Math.round(totalProfit),
    totalCOGS: Math.round(totalCOGS),
    totalItems,
    totalTransactions,
    paymentBreakdown: {
      cash: Math.round(cashInDrawer),
      mpesa: Math.round(mpesaTotal),
      credit: Math.round(creditTotal),
      card: Math.round(cardTotal),
      bank: Math.round(bankTotal),
    },
    cashSalesCount,
    mpesaSalesCount,
    creditSalesCount,
    splitSalesCount,
    cardSalesCount,
    bankSalesCount,
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
 */
export function getNextReceiptNumber() {
  const current = Number(localStorage.getItem('malimali_receipt_counter')) || 0
  const next = current + 1
  localStorage.setItem('malimali_receipt_counter', String(next))
  return `RCP-${String(next).padStart(3, '0')}`
}
