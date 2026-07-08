import { useMemo } from 'react'
import { fmtQty } from '@/utils/utils'
import { MdClose, MdPerson, MdPrint } from 'react-icons/md'
import { useApp } from '@/context/AppContext'

const isTouchDevice = () => window.matchMedia('(pointer: coarse)').matches

export default function EmployeeSalesModal({ employee, sales, products = [], date, onClose }) {
  const { settings } = useApp()
  const currency = settings?.currency || 'KSh'

  const { employeeSales, totalItems, totalRevenue, totalProfit, productMap } = useMemo(() => {
    const pMap = {}
    products.forEach(p => { pMap[String(p._id)] = p.buyPrice || 0 })

    const filtered = sales.filter(s =>
      s.cashier === employee && s.date?.startsWith(date) && !s.returned && !s.voided
    )

    const activeQty = (item) => {
      if (item.voidStatus === 'voided') return 0
      return Math.max(0, (item.qty || 0) - (item.voidedQty || 0) - (item.returnedQty || 0))
    }

    let itemsCount = 0, revenue = 0, profit = 0
    filtered.forEach(sale => {
      const taxFactor = sale.taxRate > 0 ? 1 / (1 + sale.taxRate) : 1
      sale.items?.forEach(item => {
        if (item.voidStatus === 'voided') return
        const qty = activeQty(item)
        if (qty <= 0) return
        itemsCount += qty
        revenue    += (item.price || 0) * qty * taxFactor
        const buy   = pMap[String(item.productId?._id || item.productId)] || 0
        profit     += (item.price * taxFactor - buy) * qty
      })
    })

    return { employeeSales: filtered, totalItems: itemsCount, totalRevenue: revenue, totalProfit: profit, productMap: pMap }
  }, [employee, sales, products, date])

  const displayDate = new Date(date + 'T00:00:00').toLocaleDateString('en-KE', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  })

  const activeQty = (item) => {
    if (item.voidStatus === 'voided') return 0
    return Math.max(0, (item.qty || 0) - (item.voidedQty || 0) - (item.returnedQty || 0))
  }

  return (
    <>
      <style>{`@media print { .no-print { display: none !important; } * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; } .modal-overlay { background: white !important; position: static !important; padding: 0 !important; } .modal-container { box-shadow: none !important; border: none !important; width: 100% !important; max-width: none !important; max-height: none !important; } .scroll-area { overflow: visible !important; height: auto !important; } table { width: 100% !important; border: 1px solid #eee !important; } }`}</style>
      <div className="modal-overlay fixed inset-0 flex items-center justify-center z-[1000] p-4" style={{ background: 'var(--overlay-bg)', WebkitBackdropFilter: 'blur(3px)', backdropFilter: 'blur(3px)' }}>
        <div className="modal-container w-full rounded-xl overflow-hidden flex flex-col" style={{ background: 'var(--bg-card)', maxWidth: '640px', maxHeight: '85dvh', boxShadow: 'var(--shadow-dropdown)' }}>
          <div className="flex-shrink-0 px-5 py-4 flex justify-between items-center" style={{ background: 'var(--sidebar-bg)', borderBottom: '1px solid var(--sidebar-border)' }}>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'var(--primary-light)' }}><MdPerson style={{ color: 'var(--primary)', fontSize: '20px' }} /></div>
              <div><div className="text-white text-sm font-bold">{employee}</div><div className="text-xs" style={{ color: 'var(--primary-muted)' }}>{displayDate}</div></div>
            </div>
            <button className="no-print w-7 h-7 [@media(pointer:coarse)]:w-11 [@media(pointer:coarse)]:h-11 flex items-center justify-center rounded-lg transition" onClick={onClose} style={{ color: 'rgba(255,255,255,0.6)' }} onMouseEnter={e => { if (!isTouchDevice()) e.currentTarget.style.background = 'rgba(255,255,255,0.1)' }} onMouseLeave={e => { if (!isTouchDevice()) e.currentTarget.style.background = 'transparent' }}><MdClose size={18} /></button>
          </div>

          <div className="flex-shrink-0 grid grid-cols-4 gap-3 px-5 py-4" style={{ borderBottom: '1px solid var(--border-soft)' }}>
            {[
              { label: 'Transactions', value: employeeSales.length, color: 'var(--primary)', bg: 'var(--primary-light)' },
              { label: 'Items Sold', value: fmtQty(totalItems), color: 'var(--badge-success-text)', bg: 'var(--success-light)' },
              { label: 'Revenue', value: `${currency} ${Math.round(totalRevenue).toLocaleString()}`, color: 'var(--badge-warning-text)', bg: 'var(--warning-light)' },
              { label: 'Profit', value: `${currency} ${Math.round(totalProfit).toLocaleString()}`, color: 'var(--badge-info-text)', bg: 'var(--info-light)' },
            ].map((card, i) => (
              <div key={i} className="rounded-lg p-2.5 text-center" style={{ background: card.bg }}>
                <div className="text-[10px] font-black uppercase tracking-wider mb-1" style={{ color: card.color }}>{card.label}</div>
                <div className="text-sm font-black" style={{ color: card.color }}>{card.value}</div>
              </div>
            ))}
          </div>

          <div className="scroll-area flex-1 overflow-y-auto">
            {employeeSales.length === 0 ? (
              <div className="py-12 text-center" style={{ color: 'var(--text-muted)' }}><div className="text-3xl mb-2">📋</div><p className="text-sm">No sales recorded for this date.</p></div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-muted)', position: 'sticky', top: 0, zIndex: 10 }}>
                    {['#', 'Receipt', 'Items', 'Revenue', 'Profit', 'Time'].map(h => (
                      <th key={h} style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', textAlign: 'left', padding: '10px 14px', borderBottom: '1px solid var(--border-soft)', letterSpacing: '0.06em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {employeeSales.map((sale, i) => {
                    const taxFactor   = sale.taxRate > 0 ? 1 / (1 + sale.taxRate) : 1
                    const saleItems   = sale.items?.reduce((q, it) => { if (it.voidStatus === 'voided') return q; return q + activeQty(it) }, 0) || 0
                    const saleRevenue = (sale.items?.reduce((rv, it) => { if (it.voidStatus === 'voided') return rv; return rv + (it.price || 0) * activeQty(it) }, 0) || 0) * taxFactor
                    const saleProfit  = sale.items?.reduce((s2, item) => { if (item.voidStatus === 'voided') return s2; const buy = productMap[String(item.productId?._id || item.productId)] || 0; return s2 + (item.price * taxFactor - buy) * activeQty(item) }, 0) || 0
                    return (
                      <tr key={sale._id} style={{ borderBottom: '1px solid var(--border-soft)' }} onMouseEnter={e => { if (!isTouchDevice()) e.currentTarget.style.background = 'var(--primary-light)' }} onMouseLeave={e => { if (!isTouchDevice()) e.currentTarget.style.background = 'transparent' }}>
                        <td style={{ padding: '10px 14px', fontSize: '12px', color: 'var(--text-muted)' }}>{i + 1}</td>
                        <td style={{ padding: '10px 14px', fontSize: '12px', color: 'var(--primary)', fontWeight: 700 }}>{sale.receiptId || '—'}</td>
                        <td style={{ padding: '10px 14px', fontSize: '13px', color: 'var(--text-primary)' }}>{fmtQty(saleItems)}</td>
                        <td style={{ padding: '10px 14px', fontSize: '13px', color: 'var(--text-primary)', fontWeight: 500 }}>{currency} {Math.round(saleRevenue).toLocaleString()}</td>
                        <td style={{ padding: '10px 14px', fontSize: '13px', color: 'var(--badge-success-text)', fontWeight: 600 }}>{currency} {Math.round(saleProfit).toLocaleString()}</td>
                        <td style={{ padding: '10px 14px', fontSize: '12px', color: 'var(--text-muted)' }}>{sale.time || '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot style={{ position: 'sticky', bottom: 0 }}>
                  <tr style={{ background: 'var(--bg-muted)', borderTop: '2px solid var(--border-medium)' }}>
                    <td colSpan={2} style={{ padding: '10px 14px', fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>Totals</td>
                    <td style={{ padding: '10px 14px', fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>{fmtQty(totalItems)}</td>
                    <td style={{ padding: '10px 14px', fontSize: '13px', fontWeight: 700, color: 'var(--primary)' }}>{currency} {Math.round(totalRevenue).toLocaleString()}</td>
                    <td style={{ padding: '10px 14px', fontSize: '13px', fontWeight: 700, color: 'var(--badge-success-text)' }}>{currency} {Math.round(totalProfit).toLocaleString()}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
              </div>
            )}
          </div>
          <div className="no-print flex-shrink-0 px-5 py-3 flex justify-end" style={{ borderTop: '1px solid var(--border-soft)' }}>
            <button onClick={() => window.print()} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold text-white transition" style={{ background: 'var(--primary)' }} onMouseEnter={e => { if (!isTouchDevice()) e.currentTarget.style.background = 'var(--primary-dark)' }} onMouseLeave={e => { if (!isTouchDevice()) e.currentTarget.style.background = 'var(--primary)' }}><MdPrint /> Print Report</button>
          </div>
        </div>
      </div>
    </>
  )
}
