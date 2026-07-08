import { MdPointOfSale } from 'react-icons/md'
import { fmtQty } from '@/utils/utils'
import { useApp } from '@/context/AppContext'
import { useNavigate } from 'react-router-dom'
import styles from '@/styles/StockOut.module.css'

export default function StockOut() {
  const { sales, today, currentUser, isOwner } = useApp()
  const navigate = useNavigate()

  const hasFullView = isOwner || currentUser?.role === 'manager'

  const isMine = s => hasFullView || s.cashier === (currentUser?.fullname || currentUser?.name || currentUser?.username)

  // ── Stats exclude voided and fully-returned sales ─────────────────
  const todaySales = sales.filter(s => {
    const saleDate = s.date ? String(s.date).slice(0, 10) : ''
    return saleDate === today && !s.returned && !s.voided && isMine(s)
  })

  const todayRevenue = todaySales.reduce((sum, s) =>
    sum + (s.items?.reduce((rv, item) => {
      if (item.voidStatus === 'voided') return rv
      const qty = Math.max(0, (item.qty || 0) - (item.voidedQty || 0) - (item.returnedQty || 0))
      return rv + (item.price || 0) * qty
    }, 0) || 0), 0)

  const todayItems = todaySales.reduce((sum, s) =>
    sum + (s.items?.reduce((q, item) => {
      if (item.voidStatus === 'voided') return q
      return q + Math.max(0, (item.qty || 0) - (item.voidedQty || 0) - (item.returnedQty || 0))
    }, 0) || 0), 0)

  // ── Log shows all sales including voided (for audit trail) ────────
  const salesLog = sales.filter(s => {
    const saleDate = s.date ? String(s.date).slice(0, 10) : ''
    return saleDate === today && isMine(s)
  })

  const cards = [
    {
      label: hasFullView ? 'Store Revenue Today' : 'My Revenue Today',
      value: `KSh ${todayRevenue.toLocaleString()}`,
      color: 'var(--primary)',
      bg: 'var(--primary-light)',
    },
    {
      label: hasFullView ? 'Total Items Sold' : 'My Items Sold',
      value: fmtQty(todayItems),
      color: 'var(--badge-success-text)',
      bg: 'var(--success-light)',
    },
    {
      label: hasFullView ? 'Total Transactions' : 'My Transactions',
      value: todaySales.length,
      color: 'var(--badge-warning-text)',
      bg: 'var(--warning-light)',
    },
  ]

  return (
    <div className="flex flex-col min-h-full md:h-full md:overflow-hidden" style={{ background: 'var(--bg-page)' }}>

      {/* ── Fixed header ───────────────────────────────── */}
      <div className="flex-shrink-0 px-6 pt-6 pb-4">
        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
          Stock Out & Sales
        </h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
          {hasFullView ? 'Monitoring store-wide performance' : 'Viewing your personal sales for today'}
        </p>
      </div>

      {/* ── Scrollable content ──────────────────────────── */}
      <div className="md:flex-1 md:overflow-y-auto px-6 pb-6">

        {/* Summary cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {cards.map((card, i) => (
            <div key={i} className="rounded-xl p-4"
              style={{ background: card.bg, borderLeft: `4px solid ${card.color}`, border: `1px solid ${card.color}20` }}>
              <div className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: card.color, opacity: 0.8 }}>
                {card.label}
              </div>
              <div className="text-xl font-black" style={{ color: card.color }}>
                {card.value}
              </div>
            </div>
          ))}
        </div>

        {/* POS redirect banner */}
        <div className="rounded-xl p-5 mb-6 flex flex-col md:flex-row justify-between items-center gap-4"
          style={{ background: 'var(--bg-card)', border: '2px dashed var(--primary-muted)' }}>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full flex items-center justify-center text-2xl flex-shrink-0"
              style={{ background: 'var(--primary-light)', color: 'var(--primary)' }}>
              <MdPointOfSale />
            </div>
            <div>
              <div className="font-bold text-base" style={{ color: 'var(--text-primary)' }}>Ready to sell?</div>
              <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                The POS Terminal supports barcode scanning and multiple payment methods.
              </div>
            </div>
          </div>
          <button onClick={() => navigate('/barcodes')}
            className={`w-full md:w-auto px-8 py-3 rounded-lg text-sm font-bold text-white transition-all flex items-center justify-center gap-2 ${styles.btnPrimary}`}
          >
            Open POS Terminal
          </button>
        </div>

        {/* Today's sales log */}
        <div className="rounded-xl overflow-hidden"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-soft)', boxShadow: 'var(--shadow-card)' }}>
          <div className="px-5 py-4 flex justify-between items-center" style={{ borderBottom: '1px solid var(--border-soft)' }}>
            <h2 className="text-sm font-bold uppercase tracking-wider" style={{ color: 'var(--text-primary)' }}>
              {hasFullView ? 'Live Store Sales Log' : 'Your Transaction History'}
            </h2>
            <span className="text-[10px] font-bold px-2 py-1 rounded-full"
              style={{ background: 'var(--primary-light)', color: 'var(--primary)' }}>
              {today}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr style={{ background: 'var(--bg-muted)' }}>
                  {['Receipt', 'Items', 'Total', 'Store', hasFullView ? 'Cashier' : 'Payment', 'Status', 'Time'].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-[10px] font-black uppercase tracking-widest"
                      style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border-soft)' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {salesLog.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center">
                      <div className="text-3xl mb-2">🧾</div>
                      <p className="text-sm italic" style={{ color: 'var(--text-muted)' }}>No sales recorded yet today.</p>
                    </td>
                  </tr>
                ) : (
                  salesLog.map((sale, i) => {
                    // Active qty and total — accounts for voids and partial returns
                    const itemsQty = sale.items?.reduce((q, it) => {
                      if (it.voidStatus === 'voided') return q
                      return q + Math.max(0, (it.qty || 0) - (it.voidedQty || 0) - (it.returnedQty || 0))
                    }, 0) || 0

                    const activeTotal = sale.items?.reduce((rv, it) => {
                      if (it.voidStatus === 'voided') return rv
                      return rv + (it.price || 0) * Math.max(0, (it.qty || 0) - (it.voidedQty || 0) - (it.returnedQty || 0))
                    }, 0) || 0

                    const pm = sale.paymentInfo?.paymentMethod || 'cash'
                    const isVoided = sale.voided === true
                    const hasPartialReturn = !isVoided && !sale.returned && sale.items?.some(it => (it.returnedQty || 0) > 0)

                    const rowBg = isVoided
                      ? 'var(--danger-light)'
                      : sale.returned
                        ? 'var(--warning-light)'
                        : i % 2 === 0 ? 'transparent' : 'var(--bg-muted)'

                    return (
                      <tr key={sale._id}
                        className={!isVoided && !sale.returned ? styles.rowHover : ''}
                        style={{ background: rowBg, borderBottom: '1px solid var(--border-soft)', opacity: isVoided || sale.returned ? 0.75 : 1 }}
                      >

                        <td className="px-5 py-3 text-xs font-black"
                          style={{ color: isVoided ? 'var(--danger-dark)' : 'var(--primary)', textDecoration: isVoided ? 'line-through' : 'none' }}>
                          #{sale.receiptId || '—'}
                        </td>

                        <td className="px-5 py-3 font-medium" style={{ color: 'var(--text-secondary)' }}>
                          {itemsQty} item{itemsQty !== 1 ? 's' : ''}
                        </td>

                        <td className="px-5 py-3 font-bold"
                          style={{ color: isVoided ? 'var(--danger)' : sale.returned ? 'var(--warning-dark)' : 'var(--text-primary)', textDecoration: isVoided || sale.returned ? 'line-through' : 'none' }}>
                          KSh {activeTotal.toLocaleString()}
                        </td>

                        <td className="px-5 py-3">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded uppercase"
                            style={{ background: 'var(--bg-muted)', color: 'var(--text-secondary)' }}>
                            {sale.store || 'Main Store'}
                          </span>
                        </td>

                        <td className="px-5 py-3 font-medium" style={{ color: 'var(--text-secondary)' }}>
                          {hasFullView ? sale.cashier : pm.toUpperCase()}
                        </td>

                        <td className="px-5 py-3">
                          {isVoided ? (
                            <span className="text-[10px] font-black px-2 py-0.5 rounded-full"
                              style={{ background: 'var(--danger)', color: '#fff' }}>VOID</span>
                          ) : sale.returned ? (
                            <span className="text-[10px] font-black px-2 py-0.5 rounded-full"
                              style={{ background: 'var(--warning)', color: '#fff' }}>RETURNED</span>
                          ) : hasPartialReturn ? (
                            <span className="text-[10px] font-black px-2 py-0.5 rounded-full"
                              style={{ background: 'var(--success-light)', color: 'var(--badge-success-text)' }}>PART. RETURN</span>
                          ) : (
                            <span className="text-[10px] font-black px-2 py-0.5 rounded-full"
                              style={{ background: 'var(--success-light)', color: 'var(--badge-success-text)' }}>SOLD</span>
                          )}
                        </td>

                        <td className="px-5 py-3 font-mono text-xs text-right" style={{ color: 'var(--text-muted)' }}>
                          {sale.time || '—'}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
