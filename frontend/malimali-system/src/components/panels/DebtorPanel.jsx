import { MdClose, MdPerson, MdWarning, MdReceipt } from 'react-icons/md'
import { useApp } from '@/context/AppContext'
import { useMemo } from 'react'

export default function DebtorPanel({ date, onClose }) {
  const { sales, isOwner, currentUser } = useApp()

  // 1. Filter sales by date, payment status, and store access
  const creditSales = useMemo(() => {
    const targetDate = date?.slice(0, 10)
    return sales.filter(s => {
      const dateMatch = s.date?.slice(0, 10) === targetDate
      const hasCredit = s.paymentInfo?.paymentMethod === 'credit' || s.paymentInfo?.paymentMethod === 'split'
      const storeMatch = isOwner || s.store === currentUser.store
      return dateMatch && hasCredit && storeMatch && !s.returned
    })
  }, [sales, date, isOwner, currentUser])

  // 2. Group by Cashier
  const byEmployee = useMemo(() => {
    return creditSales.reduce((acc, sale) => {
      const key = sale.cashier || 'Unknown Staff'
      if (!acc[key]) acc[key] = []
      acc[key].push(sale)
      return acc
    }, {})
  }, [creditSales])

  const totalCredit = creditSales.reduce((sum, s) => {
    const amountOwed = (s.paymentInfo?.creditPart ?? s.paymentInfo?.finalTotal ?? 0);
    return sum + amountOwed;
  }, 0);

  const displayDate = new Date(date + 'T00:00:00').toLocaleDateString('en-KE', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  })

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">

        {/* Header */}
        <div className="bg-red-700 text-white flex justify-between items-center px-6 py-4">
          <div>
            <div className="font-black text-xl tracking-tight">Debt Tracking</div>
            <div className="text-xs font-medium text-red-100 uppercase tracking-widest">{displayDate}</div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-[10px] uppercase font-bold text-red-200">Total Owed</div>
              <div className="text-2xl font-black italic">KSh {totalCredit.toLocaleString()}</div>
            </div>
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-all active:scale-90"
            >
              <MdClose size={24} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-6 space-y-6">
          {creditSales.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-5xl mb-4">✨</div>
              <div className="font-bold text-gray-800 text-lg">No Debtors Found</div>
              <p className="text-sm text-gray-400">All sales for this day were fully paid.</p>
            </div>
          ) : (
            Object.entries(byEmployee).map(([employeeName, empSales]) => {
              const empTotalDebt = empSales.reduce((sum, s) => {
                // Provide a safe fallback for every addition
                const debtValue = (s.paymentInfo?.creditPart ?? s.paymentInfo?.finalTotal ?? 0);
                return sum + debtValue;
              }, 0);

              return (
                <div key={employeeName} className="border border-gray-100 rounded-xl overflow-hidden shadow-sm">
                  {/* Cashier Bar */}
                  <div className="bg-gray-50 px-4 py-3 flex justify-between items-center border-b border-gray-100">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center text-white font-bold text-xs">
                        {employeeName[0]}
                      </div>
                      <div>
                        <div className="font-bold text-gray-800 text-sm">{employeeName}</div>
                        <div className="text-[10px] text-gray-400 font-bold uppercase">{empSales.length} Credit Tickets</div>
                      </div>
                    </div>
                    <div className="text-sm font-black text-red-600">KSh {empTotalDebt.toLocaleString()}</div>
                  </div>

                  {/* Sales Detail */}
                  <div className="p-2 space-y-2">
                    {empSales.map((sale) => (
                      <div key={sale._id} className="bg-white border border-gray-50 rounded-lg p-3">
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-gray-400"><MdReceipt size={14} /></span>
                            <span className="font-bold text-xs text-gray-700">{sale.paymentInfo?.customerName || 'Walk-in (No Name)'}</span>
                          </div>
                          <span className="text-xs font-black text-red-700 bg-red-50 px-2 py-0.5 rounded">
                            KSh {(sale.paymentInfo?.creditPart ?? sale.paymentInfo?.finalTotal ?? 0).toLocaleString()}
                          </span>
                        </div>

                        {/* List items in the sale */}
                        <div className="pl-6 space-y-1">
                          {sale.items?.map((item, idx) => (
                            <div key={idx} className="flex justify-between text-[11px] text-gray-500">
                              <span>{item.name} (x{item.qty})</span>
                              <span className="font-medium text-gray-400">@ KSh {item.price.toLocaleString()}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })
          )}

          {creditSales.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex items-start gap-3">
              <div className="p-2 bg-yellow-400 rounded-lg text-white">
                <MdWarning size={20} />
              </div>
              <div>
                <p className="text-xs text-yellow-900 leading-relaxed">
                  <strong>Risk Alert:</strong> These amounts are currently not in your drawer or M-Pesa.
                  Ensure <strong>{Object.keys(byEmployee).join(', ')}</strong> provides documentation for these credit arrangements.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}