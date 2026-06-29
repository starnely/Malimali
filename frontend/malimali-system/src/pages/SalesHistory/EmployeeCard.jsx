import { MdExpandMore, MdExpandLess, MdFilterList, MdCheckCircle, MdTimer } from 'react-icons/md'
import { fmtQty } from '@/utils/utils'
import DateGroup from './DateGroup'
import styles from '@/styles/SalesHistory.module.css'

export default function EmployeeCard({
  cashier, cashierSales, expandedEmployee, setExpandedEmployee,
  employeeDateFilter, setEmployeeDateFilter,
  isOwner, setReturnModal, setVoidModal, employeeData, category,
}) {
  const isExpanded = expandedEmployee === cashier

  const categoryFilteredSales = cashierSales.filter(s =>
    category === 'All' || s.items?.some(i => i.productId?.category === category)
  )

  const empFilter = employeeDateFilter[cashier] || {}
  const filteredSales = categoryFilteredSales.filter(s => {
    const matchFrom = !empFilter.from || new Date(s.date) >= new Date(empFilter.from)
    const matchTo   = !empFilter.to   || new Date(s.date) <= new Date(empFilter.to + 'T23:59:59')
    return matchFrom && matchTo
  })

  // ── Active qty: subtracts voided AND returned units ───────────────
  const activeQty = (item) => {
    if (item.voidStatus === 'voided') return 0
    return Math.max(0, (item.qty || 0) - (item.voidedQty || 0) - (item.returnedQty || 0))
  }

  const cashierRevenue = filteredSales.reduce((sum, s) => {
    if (s.voided) return sum
    return sum + (s.items
      ?.filter(i => category === 'All' || i.productId?.category === category)
      .reduce((iSum, i) => {
        if (i.voidStatus === 'voided') return iSum
        return iSum + (i.price || 0) * activeQty(i)
      }, 0) || 0)
  }, 0)

  const cashierItems = filteredSales.reduce((sum, s) => {
    if (s.voided) return sum
    return sum + (s.items
      ?.filter(i => category === 'All' || i.productId?.category === category)
      .reduce((iSum, i) => {
        if (i.voidStatus === 'voided') return iSum
        return iSum + activeQty(i)
      }, 0) || 0)
  }, 0)

  const cashierTx = filteredSales.filter(s => {
    if (s.voided) return false
    return s.items?.some(i => i.voidStatus !== 'voided' && activeQty(i) > 0)
  }).length

  const byDate = filteredSales.reduce((groups, sale) => {
    const d = new Date(sale.date)
    if (isNaN(d)) return groups
    const day = d.toISOString().split('T')[0]
    if (!groups[day]) groups[day] = []
    groups[day].push(sale)
    return groups
  }, {})

  const dates    = Object.keys(byDate).sort((a, b) => b.localeCompare(a))
  const isClosed = employeeData?.shiftStatus === 'closed'

  return (
    <div className="mb-4 rounded-xl transition-shadow duration-200"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border-soft)', boxShadow: 'var(--shadow-card)' }}>
      <div
        onClick={() => setExpandedEmployee(prev => prev === cashier ? null : cashier)}
        className={`flex justify-between items-center px-5 py-4 cursor-pointer ${styles.stickyEmployeeHeader} ${styles.cardHeaderHover}`}
      >
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-black"
              style={{ background: 'var(--primary-light)', color: 'var(--primary)' }}>
              {cashier.charAt(0).toUpperCase()}
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white"
              style={{ background: isClosed ? 'var(--text-muted)' : 'var(--success)' }} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{cashier}</span>
              {isClosed ? (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase"
                  style={{ background: 'var(--bg-muted)', color: 'var(--text-muted)' }}>
                  <MdCheckCircle className="text-xs" /> Shift Closed
                </span>
              ) : (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase animate-pulse"
                  style={{ background: 'var(--success-light)', color: 'var(--success-dark)' }}>
                  <MdTimer className="text-xs" /> Working
                </span>
              )}
            </div>
            <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {cashierTx} transactions · {fmtQty(cashierItems)} items
            </div>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right">
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Net Revenue</div>
            <div className="text-base font-black" style={{ color: 'var(--primary)' }}>KSh {cashierRevenue.toLocaleString()}</div>
          </div>
          {isExpanded ? <MdExpandLess className="text-xl" style={{ color: 'var(--text-muted)' }} /> : <MdExpandMore className="text-xl" style={{ color: 'var(--text-muted)' }} />}
        </div>
      </div>

      {isExpanded && (
        <div className="rounded-b-xl overflow-hidden" style={{ borderTop: '1px solid var(--border-soft)', background: 'var(--bg-muted)' }}>
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:flex-wrap px-5 py-3">
            {/* Row 1: label */}
            <div className="flex items-center gap-2">
              <MdFilterList className="flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
              <span className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
                Filter {cashier}'s sales:
              </span>
            </div>
            {/* Row 2: date inputs */}
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={empFilter.from || ''}
                onChange={e => setEmployeeDateFilter(prev => ({ ...prev, [cashier]: { ...prev[cashier], from: e.target.value } }))}
                className="px-2 py-1 rounded-lg text-xs outline-none flex-1 min-w-0"
                style={{ border: '1px solid var(--border-medium)', background: 'var(--bg-card)', color: 'var(--text-primary)' }}
              />
              <span className="flex-shrink-0 text-xs" style={{ color: 'var(--text-muted)' }}>to</span>
              <input
                type="date"
                value={empFilter.to || ''}
                onChange={e => setEmployeeDateFilter(prev => ({ ...prev, [cashier]: { ...prev[cashier], to: e.target.value } }))}
                className="px-2 py-1 rounded-lg text-xs outline-none flex-1 min-w-0"
                style={{ border: '1px solid var(--border-medium)', background: 'var(--bg-card)', color: 'var(--text-primary)' }}
              />
              {(empFilter.from || empFilter.to) && (
                <button
                  onClick={() => setEmployeeDateFilter(prev => ({ ...prev, [cashier]: {} }))}
                  className="flex-shrink-0 text-xs px-2.5 py-1.5 rounded-lg font-bold"
                  style={{ background: 'var(--danger-light)', color: 'var(--danger-dark)', touchAction: 'manipulation', userSelect: 'none' }}
                >
                  ×
                </button>
              )}
            </div>
          </div>
          <div className="px-4 pb-4">
            {dates.length === 0 ? (
              <div className="text-center py-6 text-sm" style={{ color: 'var(--text-muted)' }}>No sales in this filter range</div>
            ) : (
              dates.map(date => (
                <DateGroup key={date} date={date} sales={byDate[date]} isOwner={isOwner} setReturnModal={setReturnModal} setVoidModal={setVoidModal} category={category} />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
