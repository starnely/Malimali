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
 * Revenue and profit are net of inclusive VAT (tax excluded).
 * taxFactor = 1/(1+taxRate) for VAT-inclusive pricing; falls back to 1 for historical sales.
 */
export function buildLiveSummary(date, sales, products = [], storeName = "All", expiredLoss = 0) {
  const normalize = d => (d ? String(d).slice(0, 10) : null)
  const targetDate = normalize(date)

  const daySales = sales.filter(s => {
    const dateMatch = normalize(s.date) === targetDate && !s.returned && !s.voided && s.status !== 'pending'
    const storeMatch = storeName === "All" || s.store === storeName
    return dateMatch && storeMatch
  })

  if (daySales.length === 0) return null

  let totalRevenue = 0
  let totalProfit = 0
  let totalCOGS = 0
  let totalGrossRevenue = 0
  let totalTaxCollected = 0
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
    // taxFactor converts gross (incl. VAT) price to net price.
    // For historical sales where taxRate is 0/undefined, factor = 1 (no change).
    const taxFactor = s.taxRate > 0 ? 1 / (1 + s.taxRate) : 1

    let saleGross = 0
    let saleCOGS = 0
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

        saleGross += sellPrice * qty
        saleCOGS  += buyPrice * qty
        saleQty   += qty
      })
    }

    if (saleGross === 0 && saleQty === 0) return

    const saleNet    = saleGross * taxFactor
    const saleTax    = saleGross - saleNet
    const saleProfit = saleNet - saleCOGS

    totalGrossRevenue += saleGross
    totalRevenue      += saleNet
    totalProfit       += saleProfit
    totalCOGS         += saleCOGS
    totalTaxCollected += saleTax
    totalItems        += saleQty
    totalTransactions += 1

    // Payment breakdown uses GROSS amounts (actual money received per method)
    if (method === 'cash') {
      cashInDrawer += saleGross
      cashSalesCount++
    } else if (method === 'mpesa') {
      mpesaTotal += saleGross
      mpesaSalesCount++
    } else if (method === 'credit') {
      creditTotal += saleGross
      creditSalesCount++
    } else if (method === 'split') {
      const origCash  = s.paymentInfo?.cashPart  || 0
      const origMpesa = s.paymentInfo?.mpesaPart || 0
      const origTotal = origCash + origMpesa || 1
      cashInDrawer += saleGross * (origCash  / origTotal)
      mpesaTotal   += saleGross * (origMpesa / origTotal)
      splitSalesCount++
    } else if (method === 'card') {
      cardTotal += saleGross
      cardSalesCount++
    } else if (method === 'bank') {
      bankTotal += saleGross
      bankSalesCount++
    }

    // Per-employee tracking (net revenue and profit)
    const empName = s.cashier || 'Unknown'
    if (!employeeMap[empName]) {
      employeeMap[empName] = { name: empName, revenue: 0, profit: 0, transactions: 0, itemsSold: 0 }
    }
    employeeMap[empName].revenue      += saleNet
    employeeMap[empName].profit       += saleProfit
    employeeMap[empName].transactions += 1
    employeeMap[empName].itemsSold    += saleQty
  })

  if (totalTransactions === 0) return null

  return {
    date: targetDate,
    totalRevenue:      Math.round(totalRevenue),
    totalProfit:       Math.round(totalProfit),
    totalCOGS:         Math.round(totalCOGS),
    totalGrossRevenue: Math.round(totalGrossRevenue),
    totalTaxCollected: Math.round(totalTaxCollected),
    totalItems,
    totalTransactions,
    paymentBreakdown: {
      cash:   Math.round(cashInDrawer),
      mpesa:  Math.round(mpesaTotal),
      credit: Math.round(creditTotal),
      card:   Math.round(cardTotal),
      bank:   Math.round(bankTotal),
    },
    cashSalesCount,
    mpesaSalesCount,
    creditSalesCount,
    splitSalesCount,
    cardSalesCount,
    bankSalesCount,
    perEmployee: Object.values(employeeMap).sort((a, b) => b.revenue - a.revenue),
    totalExpiredLoss: Math.round(expiredLoss),
    isLive: true,
  }
}

/**
 * Format a stock/quantity number for display — strips IEEE 754 float noise.
 * 53.546000000000001 → 53.546 | 5 → 5 | 1.5 → 1.5
 */
export function fmtQty(n) {
  return +Number(n).toFixed(3)
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
