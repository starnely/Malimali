import { MdClose, MdPerson, MdWarning } from 'react-icons/md'
import { useApp } from '@/context/AppContext'

export default function DebtorPanel({ date, onClose }) {
  const { sales } = useApp()

  const creditSales = sales.filter(s =>
    s.date === date && s.paymentMethod === 'credit' && !s.returned
  )

  const byEmployee = creditSales.reduce((acc, sale) => {
    const key = sale.soldBy || 'Unknown'
    if (!acc[key]) acc[key] = []
    acc[key].push(sale)
    return acc
  }, {})

  const totalCredit = creditSales.reduce((sum, s) => sum + s.total, 0)

  const displayDate = new Date(date).toLocaleDateString('en-KE', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  })

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="bg-yellow-700 text-white flex justify-between items-center px-5 py-3">
          <div>
            <div className="font-bold text-lg">📋 Credit Sales — Debtors</div>
            <div className="text-xs opacity-75">{displayDate}</div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-xs opacity-75">Total owed</div>
              <div className="text-xl font-bold">KSh {totalCredit.toLocaleString()}</div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors"
            >
              <MdClose />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-5">
          {creditSales.length === 0 ? (
            <div className="text-center text-gray-400 py-12">
              <div className="text-3xl mb-2">✅</div>
              <div className="font-medium">No credit sales on this date</div>
            </div>
          ) : (
            Object.entries(byEmployee).map(([employeeName, empSales]) => {
              const empTotal = empSales.reduce((sum, s) => sum + s.total, 0)
              const byCustomer = empSales.reduce((acc, sale) => {
                const customer = sale.customerName || 'Unknown customer'
                if (!acc[customer]) acc[customer] = []
                acc[customer].push(sale)
                return acc
              }, {})

              return (
                <div key={employeeName} className="border rounded-lg mb-4 overflow-hidden">
                  <div className="bg-gray-50 px-4 py-2 flex justify-between items-center border-b">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-blue-800 flex items-center justify-center">
                        <MdPerson className="text-white text-sm" />
                      </div>
                      <div>
                        <div className="font-semibold text-sm">{employeeName}</div>
                        <div className="text-xs text-gray-500">
                          {empSales.length} credit sale{empSales.length !== 1 ? 's' : ''}
                        </div>
                      </div>
                    </div>
                    <div className="font-bold text-yellow-700">KSh {empTotal.toLocaleString()}</div>
                  </div>

                  <div className="p-3">
                    {Object.entries(byCustomer).map(([customerName, customerSales], ci, arr) => {
                      const customerTotal = customerSales.reduce((sum, s) => sum + s.total, 0)
                      return (
                        <div key={customerName} className={`${ci < arr.length - 1 ? 'border-b pb-3 mb-3' : ''}`}>
                          <div className="flex justify-between items-center mb-2">
                            <div className="flex items-center gap-2">
                              <span>👤</span>
                              <span className="font-medium text-sm">{customerName}</span>
                              {customerName === 'Unknown customer' && (
                                <span className="text-xs bg-yellow-100 text-yellow-700 px-2 rounded">
                                  No name recorded
                                </span>
                              )}
                            </div>
                            <span className="font-bold text-red-700 text-sm">
                              KSh {customerTotal.toLocaleString()}
                            </span>
                          </div>

                          {customerSales.map(sale => (
                            <div key={sale.id} className="flex justify-between items-center bg-gray-50 rounded px-3 py-2 mb-1">
                              <div>
                                <div className="text-sm font-medium">{sale.name}</div>
                                <div className="text-xs text-gray-500">
                                  {sale.qty} × KSh {Number(sale.sellPrice).toLocaleString()}
                                  {sale.receiptId && <span className="ml-2 text-blue-700">{sale.receiptId}</span>}
                                  <span className="ml-2">{sale.time}</span>
                                </div>
                              </div>
                              <div className="text-sm font-bold text-blue-700">
                                KSh {sale.total.toLocaleString()}
                              </div>
                            </div>
                          ))}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })
          )}

          {creditSales.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-400 rounded-lg p-3 flex items-start gap-2 mt-3">
              <MdWarning className="text-yellow-500 text-lg" />
              <p className="text-xs text-yellow-800">
                These customers have not paid yet. Total owed: <strong>KSh {totalCredit.toLocaleString()}</strong>.  
                Follow up with the respective cashier to collect payment.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
