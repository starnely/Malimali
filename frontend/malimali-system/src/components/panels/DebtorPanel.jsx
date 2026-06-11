import { useMemo } from 'react'
import { MdClose, MdWarning, MdReceipt } from 'react-icons/md'
import { useApp } from '@/context/AppContext'

export default function DebtorPanel({ date, onClose }) {
  const { sales, isOwner, currentUser } = useApp()

  const creditSales = useMemo(() => {
    const targetDate = date?.slice(0, 10)
    return sales.filter(s => {
      const dateMatch  = s.date?.slice(0, 10) === targetDate
      const hasCredit  = s.paymentInfo?.paymentMethod === 'credit' || s.paymentInfo?.paymentMethod === 'split'
      const storeMatch = isOwner || s.store === currentUser?.store
      return dateMatch && hasCredit && storeMatch && !s.returned && !s.voided
    })
  }, [sales, date, isOwner, currentUser])

  const byEmployee = useMemo(() => {
    return creditSales.reduce((acc, sale) => {
      const key = sale.cashier || 'Unknown Staff'
      if (!acc[key]) acc[key] = []
      acc[key].push(sale)
      return acc
    }, {})
  }, [creditSales])

  const totalCredit = creditSales.reduce((sum, s) => {
    return sum + (s.paymentInfo?.creditPart ?? s.paymentInfo?.finalTotal ?? 0)
  }, 0)

  const displayDate = new Date(date + 'T00:00:00').toLocaleDateString('en-KE', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  })

  const formatPromise = (dateStr) => {
    if (!dateStr) return null
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const promise = new Date(dateStr + 'T00:00:00')
    const days = Math.ceil((promise - today) / (1000 * 60 * 60 * 24))
    const label = promise.toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })
    return { label, days }
  }

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50 p-4"
      style={{ background: 'rgba(15,23,42,0.6)', WebkitBackdropFilter: 'blur(4px)', backdropFilter: 'blur(4px)' }}
    >
      <div
        className="w-full rounded-2xl overflow-hidden flex flex-col"
        style={{
          background: 'var(--bg-card)',
          maxWidth: '560px',
          maxHeight: '85vh',
          boxShadow: 'var(--shadow-dropdown)',
        }}
      >
        {/* Header */}
        <div
          className="flex justify-between items-center px-6 py-4 flex-shrink-0"
          style={{ background: 'var(--danger)' }}
        >
          <div>
            <div className="text-white font-black text-lg tracking-tight">Debt Tracking</div>
            <div className="text-xs font-semibold mt-0.5" style={{ color: 'rgba(255,255,255,0.7)' }}>
              {displayDate}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.6)' }}>
                Total Owed
              </div>
              <div className="text-2xl font-black text-white italic">
                KSh {totalCredit.toLocaleString()}
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full flex items-center justify-center transition"
              style={{ background: 'rgba(255,255,255,0.1)' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
            >
              <MdClose size={20} className="text-white" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {creditSales.length === 0 ? (
            <div className="text-center py-14">
              <div className="text-5xl mb-3">✨</div>
              <div className="font-bold text-base" style={{ color: 'var(--text-primary)' }}>No Debtors Found</div>
              <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>All sales for this day were fully paid.</p>
            </div>
          ) : (
            Object.entries(byEmployee).map(([employeeName, empSales]) => {
              const empTotalDebt = empSales.reduce((sum, s) =>
                sum + (s.paymentInfo?.creditPart ?? s.paymentInfo?.finalTotal ?? 0), 0)

              return (
                <div
                  key={employeeName}
                  className="rounded-xl overflow-hidden"
                  style={{ border: '1px solid var(--border-soft)', boxShadow: 'var(--shadow-card)' }}
                >
                  {/* Cashier bar */}
                  <div
                    className="px-4 py-3 flex justify-between items-center"
                    style={{ background: 'var(--bg-muted)', borderBottom: '1px solid var(--border-soft)' }}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-white font-black text-xs flex-shrink-0"
                        style={{ background: 'var(--sidebar-bg)' }}
                      >
                        {employeeName[0].toUpperCase()}
                      </div>
                      <div>
                        <div className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>{employeeName}</div>
                        <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                          {empSales.length} Credit Ticket{empSales.length !== 1 ? 's' : ''}
                        </div>
                      </div>
                    </div>
                    <div className="text-sm font-black" style={{ color: 'var(--danger)' }}>
                      KSh {empTotalDebt.toLocaleString()}
                    </div>
                  </div>

                  {/* Sales detail */}
                  <div className="p-3 space-y-2">
                    {empSales.map(sale => {
                      const promise = formatPromise(sale.paymentInfo?.promiseDate)
                      const isOverdue = promise && promise.days < 0
                      const isDueToday = promise && promise.days === 0
                      const promiseColor = isOverdue ? 'var(--danger-dark)' : isDueToday ? '#ea580c' : 'var(--warning-dark)'

                      return (
                        <div
                          key={sale._id}
                          className="rounded-lg p-3"
                          style={{
                            background: 'var(--bg-card)',
                            border: `1px solid ${isOverdue ? 'var(--danger)' : 'var(--border-soft)'}`,
                          }}
                        >
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex items-center gap-2">
                              <MdReceipt size={13} style={{ color: 'var(--text-muted)' }} />
                              <span className="font-bold text-xs" style={{ color: 'var(--text-secondary)' }}>
                                {sale.paymentInfo?.customerName || 'Walk-in (No Name)'}
                              </span>
                            </div>
                            <span
                              className="text-xs font-black px-2 py-0.5 rounded"
                              style={{ background: 'var(--danger-light)', color: 'var(--danger-dark)' }}
                            >
                              KSh {(sale.paymentInfo?.creditPart ?? sale.paymentInfo?.finalTotal ?? 0).toLocaleString()}
                            </span>
                          </div>

                          {/* ── Phone + promise date ── */}
                          {sale.paymentInfo?.customerPhone && (
                            <div className="pl-5 text-[11px] mb-0.5" style={{ color: 'var(--text-muted)' }}>
                              📞 {sale.paymentInfo.customerPhone}
                            </div>
                          )}
                          {promise && (
                            <div className="pl-5 text-[11px] font-semibold mb-1" style={{ color: promiseColor }}>
                              {isOverdue
                                ? `⚠️ Overdue by ${Math.abs(promise.days)} day${Math.abs(promise.days) !== 1 ? 's' : ''} — promised ${promise.label}`
                                : isDueToday
                                ? `🔔 Due TODAY — ${promise.label}`
                                : `📅 Promised by ${promise.label} (${promise.days} day${promise.days !== 1 ? 's' : ''} left)`
                              }
                            </div>
                          )}

                          <div className="pl-5 space-y-0.5">
                            {sale.items?.map((item, idx) => (
                              <div key={idx} className="flex justify-between text-[11px]" style={{ color: 'var(--text-muted)' }}>
                                <span>{item.name} (×{item.qty})</span>
                                <span>@ KSh {item.price.toLocaleString()}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })
          )}

          {creditSales.length > 0 && (
            <div
              className="rounded-xl p-4 flex items-start gap-3"
              style={{ background: 'var(--warning-light)', border: '1px solid var(--warning)' }}
            >
              <div
                className="p-2 rounded-lg flex-shrink-0"
                style={{ background: 'var(--warning)', color: '#fff' }}
              >
                <MdWarning size={18} />
              </div>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--warning-dark)' }}>
                <strong>Risk Alert:</strong> These amounts are not in your drawer or M-Pesa.
                Ensure <strong>{Object.keys(byEmployee).join(', ')}</strong> provides
                documentation for these credit arrangements.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
