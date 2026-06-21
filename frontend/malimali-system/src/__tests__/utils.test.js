import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  activeQty,
  isActiveItem,
  buildLiveSummary,
  formatCurrency,
  nowEAT,
  todayEAT,
  getNextReceiptNumber,
} from '@/utils/utils'

// ── activeQty ─────────────────────────────────────────────────────────

describe('activeQty', () => {
  it('returns raw qty when no voids or returns', () => {
    expect(activeQty({ qty: 5 })).toBe(5)
  })

  it('returns 0 when item is fully voided', () => {
    expect(activeQty({ qty: 3, voidStatus: 'voided' })).toBe(0)
  })

  it('subtracts voidedQty from qty', () => {
    expect(activeQty({ qty: 5, voidedQty: 2 })).toBe(3)
  })

  it('subtracts returnedQty from qty', () => {
    expect(activeQty({ qty: 5, returnedQty: 1 })).toBe(4)
  })

  it('subtracts both voidedQty and returnedQty', () => {
    expect(activeQty({ qty: 5, voidedQty: 2, returnedQty: 1 })).toBe(2)
  })

  it('clamps to 0 when deductions exceed qty', () => {
    expect(activeQty({ qty: 3, voidedQty: 5 })).toBe(0)
  })

  it('treats missing voidedQty/returnedQty as 0', () => {
    expect(activeQty({ qty: 4, voidedQty: undefined, returnedQty: null })).toBe(4)
  })

  it('treats missing qty as 0', () => {
    expect(activeQty({ voidedQty: 1 })).toBe(0)
  })
})

// ── isActiveItem ──────────────────────────────────────────────────────

describe('isActiveItem', () => {
  it('returns true when qty is fully intact', () => {
    expect(isActiveItem({ qty: 3 })).toBe(true)
  })

  it('returns false when voidStatus is voided', () => {
    expect(isActiveItem({ qty: 3, voidStatus: 'voided' })).toBe(false)
  })

  it('returns false when activeQty reaches 0 via returns', () => {
    expect(isActiveItem({ qty: 2, returnedQty: 2 })).toBe(false)
  })

  it('returns true when partially returned but activeQty > 0', () => {
    expect(isActiveItem({ qty: 3, returnedQty: 1 })).toBe(true)
  })
})

// ── formatCurrency ────────────────────────────────────────────────────

describe('formatCurrency', () => {
  it('formats a whole number with KSh prefix', () => {
    expect(formatCurrency(1000)).toBe('KSh 1,000')
  })

  it('formats zero', () => {
    expect(formatCurrency(0)).toBe('KSh 0')
  })

  it('handles undefined gracefully', () => {
    expect(formatCurrency(undefined)).toBe('KSh 0')
  })

  it('handles null gracefully', () => {
    expect(formatCurrency(null)).toBe('KSh 0')
  })

  it('formats large numbers with commas', () => {
    expect(formatCurrency(1500000)).toBe('KSh 1,500,000')
  })
})

// ── nowEAT / todayEAT ────────────────────────────────────────────────

describe('nowEAT / todayEAT', () => {
  beforeEach(() => {
    // Freeze at 2024-01-15 00:30:00 UTC  →  2024-01-15 03:30:00 EAT
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-01-15T00:30:00.000Z'))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('nowEAT returns a Date offset by +3h from UTC', () => {
    const eat = nowEAT()
    // UTC 00:30 + 3h = EAT 03:30
    expect(eat.getUTCHours()).toBe(3)
    expect(eat.getUTCMinutes()).toBe(30)
  })

  it('todayEAT returns the EAT calendar date as YYYY-MM-DD', () => {
    expect(todayEAT()).toBe('2024-01-15')
  })

  it('todayEAT rolls over to next day when UTC is late evening', () => {
    // 22:00 UTC = 01:00 EAT the next day
    vi.setSystemTime(new Date('2024-01-15T22:00:00.000Z'))
    expect(todayEAT()).toBe('2024-01-16')
  })
})

// ── getNextReceiptNumber ──────────────────────────────────────────────

describe('getNextReceiptNumber', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('returns RCP-001 on first call with empty storage', () => {
    expect(getNextReceiptNumber()).toBe('RCP-001')
  })

  it('increments on each call', () => {
    getNextReceiptNumber()           // RCP-001
    expect(getNextReceiptNumber()).toBe('RCP-002')
  })

  it('pads single digits to three places', () => {
    for (let i = 0; i < 9; i++) getNextReceiptNumber()
    expect(getNextReceiptNumber()).toBe('RCP-010')
  })

  it('picks up where localStorage left off', () => {
    localStorage.setItem('malimali_receipt_counter', '42')
    expect(getNextReceiptNumber()).toBe('RCP-043')
  })
})

// ── buildLiveSummary ──────────────────────────────────────────────────

const p1 = { _id: 'p1', buyPrice: 50 }
const p2 = { _id: 'p2', buyPrice: 20 }

function makeSale(overrides = {}) {
  return {
    date: '2024-03-10',
    returned: false,
    voided: false,
    store: 'Main Store',
    cashier: 'Alice',
    paymentInfo: { paymentMethod: 'cash' },
    items: [
      { productId: 'p1', qty: 2, price: 100, buyPrice: 50 },
    ],
    ...overrides,
  }
}

describe('buildLiveSummary', () => {
  it('returns null when no sales exist for the date', () => {
    expect(buildLiveSummary('2024-03-10', [], [], 'All')).toBeNull()
  })

  it('returns null when all matching sales are returned', () => {
    const sales = [makeSale({ returned: true })]
    expect(buildLiveSummary('2024-03-10', sales, [p1], 'All')).toBeNull()
  })

  it('returns null when all matching sales are voided at sale level', () => {
    const sales = [makeSale({ voided: true })]
    expect(buildLiveSummary('2024-03-10', sales, [p1], 'All')).toBeNull()
  })

  it('excludes sales from a different date', () => {
    const sales = [makeSale({ date: '2024-03-09' })]
    expect(buildLiveSummary('2024-03-10', sales, [p1], 'All')).toBeNull()
  })

  it('calculates totalRevenue correctly', () => {
    // 2 items × KSh 100 = KSh 200
    const sales = [makeSale()]
    const result = buildLiveSummary('2024-03-10', sales, [p1], 'All')
    expect(result.totalRevenue).toBe(200)
  })

  it('calculates totalProfit using item.buyPrice', () => {
    // (100 - 50) × 2 = KSh 100 profit
    const sales = [makeSale()]
    const result = buildLiveSummary('2024-03-10', sales, [p1], 'All')
    expect(result.totalProfit).toBe(100)
  })

  it('falls back to product catalog buyPrice when item.buyPrice is missing', () => {
    const sale = makeSale({
      items: [{ productId: 'p1', qty: 1, price: 100 }], // no buyPrice on item
    })
    const result = buildLiveSummary('2024-03-10', [sale], [p1], 'All')
    // profit = (100 - 50) × 1 = 50
    expect(result.totalProfit).toBe(50)
  })

  it('counts totalItems (sum of active qty)', () => {
    const sales = [makeSale()]
    const result = buildLiveSummary('2024-03-10', sales, [p1], 'All')
    expect(result.totalItems).toBe(2)
  })

  it('counts totalTransactions', () => {
    const sales = [makeSale(), makeSale()]
    const result = buildLiveSummary('2024-03-10', sales, [p1], 'All')
    expect(result.totalTransactions).toBe(2)
  })

  it('returns null when all item-level voids leave zero transactions', () => {
    // Sale passes the top-level filter (!s.returned && !s.voided) but every item
    // carries voidStatus:'voided', so activeQty=0 and no transactions are counted.
    // After the loop totalTransactions===0, so the function now returns null — the
    // same signal as "no sales at all", which lets all callers use a single !summary
    // check to show their "No sales recorded" empty state.
    const sale = makeSale({
      items: [{ productId: 'p1', qty: 2, price: 100, voidStatus: 'voided' }],
    })
    expect(buildLiveSummary('2024-03-10', [sale], [p1], 'All')).toBeNull()
  })

  it('deducts returnedQty from item qty when calculating revenue', () => {
    const sale = makeSale({
      items: [{ productId: 'p1', qty: 3, price: 100, buyPrice: 50, returnedQty: 1 }],
    })
    const result = buildLiveSummary('2024-03-10', [sale], [p1], 'All')
    // active qty = 2, revenue = 200, profit = 100
    expect(result.totalRevenue).toBe(200)
    expect(result.totalProfit).toBe(100)
  })

  describe('payment breakdown', () => {
    it('assigns cash revenue to paymentBreakdown.cash', () => {
      const result = buildLiveSummary('2024-03-10', [makeSale()], [p1], 'All')
      expect(result.paymentBreakdown.cash).toBe(200)
      expect(result.cashSalesCount).toBe(1)
    })

    it('assigns mpesa revenue correctly', () => {
      const sale = makeSale({ paymentInfo: { paymentMethod: 'mpesa' } })
      const result = buildLiveSummary('2024-03-10', [sale], [p1], 'All')
      expect(result.paymentBreakdown.mpesa).toBe(200)
      expect(result.mpesaSalesCount).toBe(1)
    })

    it('assigns credit revenue correctly', () => {
      const sale = makeSale({ paymentInfo: { paymentMethod: 'credit' } })
      const result = buildLiveSummary('2024-03-10', [sale], [p1], 'All')
      expect(result.paymentBreakdown.credit).toBe(200)
      expect(result.creditSalesCount).toBe(1)
    })

    it('splits revenue proportionally for split payment (60% cash / 40% mpesa)', () => {
      const sale = makeSale({
        paymentInfo: { paymentMethod: 'split', cashPart: 120, mpesaPart: 80 },
      })
      const result = buildLiveSummary('2024-03-10', [sale], [p1], 'All')
      // revenue = 200, cash share = 200 × (120/200) = 120, mpesa = 80
      expect(result.paymentBreakdown.cash).toBe(120)
      expect(result.paymentBreakdown.mpesa).toBe(80)
      expect(result.splitSalesCount).toBe(1)
    })

    it('handles a split where cashPart + mpesaPart is 0 without dividing by zero', () => {
      const sale = makeSale({
        paymentInfo: { paymentMethod: 'split', cashPart: 0, mpesaPart: 0 },
      })
      // origTotal defaults to 1 to prevent division by zero, so all revenue goes to cash (0/1 * 200 = 0)
      expect(() => buildLiveSummary('2024-03-10', [sale], [p1], 'All')).not.toThrow()
    })
  })

  describe('store filter', () => {
    it('"All" includes sales from any store', () => {
      const sales = [
        makeSale({ store: 'Main Store' }),
        makeSale({ store: 'Branch' }),
      ]
      const result = buildLiveSummary('2024-03-10', sales, [p1], 'All')
      expect(result.totalTransactions).toBe(2)
    })

    it('specific store name excludes other stores', () => {
      const sales = [
        makeSale({ store: 'Main Store' }),
        makeSale({ store: 'Branch' }),
      ]
      const result = buildLiveSummary('2024-03-10', sales, [p1], 'Branch')
      expect(result.totalTransactions).toBe(1)
    })
  })

  describe('perEmployee', () => {
    it('groups sales by cashier', () => {
      const sales = [
        makeSale({ cashier: 'Alice' }),
        makeSale({ cashier: 'Bob' }),
        makeSale({ cashier: 'Alice' }),
      ]
      const result = buildLiveSummary('2024-03-10', sales, [p1], 'All')
      const names = result.perEmployee.map(e => e.name)
      expect(names).toContain('Alice')
      expect(names).toContain('Bob')
      expect(result.perEmployee.find(e => e.name === 'Alice').transactions).toBe(2)
    })

    it('sorts perEmployee by revenue descending', () => {
      const highSale = makeSale({
        cashier: 'Bob',
        items: [{ productId: 'p1', qty: 10, price: 100, buyPrice: 50 }],
      })
      const lowSale = makeSale({ cashier: 'Alice' }) // 2 × 100 = 200
      const result = buildLiveSummary('2024-03-10', [highSale, lowSale], [p1], 'All')
      expect(result.perEmployee[0].name).toBe('Bob')
    })
  })

  it('returns the isLive flag', () => {
    const result = buildLiveSummary('2024-03-10', [makeSale()], [p1], 'All')
    expect(result.isLive).toBe(true)
  })

  it('accepts an ISO datetime string as the date parameter (slices to date part)', () => {
    // normalize() uses String(d).slice(0,10) — works for ISO strings, not Date objects.
    // The function is always called with string dates in the app.
    const result = buildLiveSummary('2024-03-10T12:00:00.000Z', [makeSale()], [p1], 'All')
    expect(result).not.toBeNull()
    expect(result.totalRevenue).toBe(200)
  })
})
