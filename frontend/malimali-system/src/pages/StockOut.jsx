import { useState } from 'react'
import { MdPointOfSale, MdCheckCircle, MdWarning } from 'react-icons/md'
import { useApp } from '@/context/AppContext'
import { useNavigate } from 'react-router-dom'

export default function StockOut() {
  const { products, sales, today, currentUser, isOwner } = useApp()
  const navigate = useNavigate()

  // Logic to determine if current user has "Elevated View" (Owner or Manager)
  const hasFullView = isOwner || currentUser?.role === 'owner' || currentUser?.role === 'manager'

  const [form, setForm] = useState({ productId: '', qty: '' })
  const [errors, setErrors] = useState({})

  const selectedProduct = products.find(p => String(p._id) === form.productId)

  // Filter sales based on role: Owners/Managers see all, Cashiers see only theirs
  const todaySales = sales.filter(s => {
    const saleDate = s.date ? String(s.date).slice(0, 10) : ''
    return saleDate === today && !s.returned &&
      (hasFullView || s.cashier === currentUser?.name)
  })

  const todayRevenue = todaySales.reduce((sum, s) => sum + (s.total || 0), 0)
  const todayItems = todaySales.reduce((sum, s) =>
    sum + (s.items?.reduce((q, i) => q + i.qty, 0) || 0), 0)

  // For Summary Cards: Owners/Managers see cumulative totals; Cashiers see personal totals
  const allSales = sales.filter(s => !s.returned && (hasFullView || s.cashier === currentUser?.name))
  const allRevenue = allSales.reduce((sum, s) => sum + (s.total || 0), 0)


 const handleGoToPOS = () => navigate('/barcodes')

  const salesLog = sales.filter(s => {
    const saleDate = s.date ? String(s.date).slice(0, 10) : ''
    return saleDate === today && (hasFullView || s.cashier === currentUser?.name)
  })

  return (
    <div className="p-6 bg-gray-100 min-h-screen">
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-gray-800">Stock Out & Sales</h1>
        <p className="text-sm text-gray-500 mt-1">
          {hasFullView ? "Monitoring store-wide performance" : "Viewing your personal sales for today"}
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
        {[
          {
            label: hasFullView ? 'Store Revenue Today' : 'My Revenue Today',
            value: `KSh ${todayRevenue.toLocaleString()}`,
            color: 'border-blue-800'
          },
          { 
            label: hasFullView ? 'Total Items Sold' : 'My Items Sold', 
            value: todayItems, 
            color: 'border-green-700' 
          },
          {
            label: hasFullView ? 'Total Transactions' : 'My Transactions',
            value: todaySales.length,
            color: 'border-yellow-700'
          },
        ].map((card, i) => (
          <div key={i} className={`bg-white border border-gray-200 rounded-lg p-4 ${card.color} border-l-4 shadow-sm`}>
            <div className="text-xs text-gray-500 mb-1 font-bold uppercase tracking-wider">{card.label}</div>
            <div className="text-xl font-bold text-gray-800">{card.value}</div>
          </div>
        ))}
      </div>

      {/* POS redirect banner */}
      <div className="bg-white border-2 border-dashed border-blue-200 rounded-xl p-6 mb-6 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-800 text-2xl">
            <MdPointOfSale />
          </div>
          <div>
            <div className="text-base font-bold text-gray-800">Ready to sell?</div>
            <div className="text-xs text-gray-500 mt-0.5">The POS Terminal supports barcode scanning and multiple payment methods.</div>
          </div>
        </div>
        <button
          onClick={handleGoToPOS}
          className="w-full md:w-auto bg-blue-800 text-white px-8 py-3 rounded-lg text-sm font-bold hover:bg-blue-900 transition-all shadow-md active:scale-95 flex items-center justify-center gap-2"
        >
          Open POS Terminal
        </button>
      </div>

      {/* Today's sales log */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
          <h2 className="text-sm font-bold text-gray-800 uppercase tracking-tight">
            {hasFullView ? "Live Store Sales Log" : "Your Transaction History"}
          </h2>
          <span className="text-[10px] bg-blue-100 text-blue-800 px-2 py-1 rounded-full font-bold">{today}</span>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-gray-50/50">
                <th className="text-xs text-gray-400 font-bold text-left px-6 py-3 uppercase">Receipt</th>
                <th className="text-xs text-gray-400 font-bold text-left px-6 py-3 uppercase">Items</th>
                <th className="text-xs text-gray-400 font-bold text-left px-6 py-3 uppercase">Total</th>
                <th className="text-xs text-gray-400 font-bold text-left px-6 py-3 uppercase">Store</th>
                <th className="text-xs text-gray-400 font-bold text-left px-6 py-3 uppercase">{hasFullView ? 'Cashier' : 'Payment'}</th>
                <th className="text-xs text-gray-400 font-bold text-left px-6 py-3 uppercase text-right">Time</th>
              </tr>
            </thead>
            <tbody>
              {salesLog.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-gray-400 text-sm italic">No sales recorded yet today.</td>
                </tr>
              ) : (
                salesLog.map((sale, i) => {
                  const itemsQty = sale.items?.reduce((q, it) => q + it.qty, 0) || 0
                  const pm = sale.paymentInfo?.paymentMethod || 'cash'
                  return (
                    <tr key={sale._id} className={`${sale.returned ? 'bg-red-50/50 opacity-60' : i % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'} hover:bg-blue-50/50 transition-colors`}>
                      <td className="px-6 py-4 text-xs font-bold text-blue-800 tracking-tighter">#{sale.receiptId || '—'}</td>
                      <td className="px-6 py-4 text-gray-600 font-medium">{itemsQty} units</td>
                      <td className={`px-6 py-4 font-bold text-gray-900 ${sale.returned ? 'line-through text-red-400' : ''}`}>
                        KSh {(sale.total || 0).toLocaleString()}
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-[10px] font-bold bg-gray-200 text-gray-700 px-2 py-0.5 rounded uppercase">
                          {sale.store || 'Main Store'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-500 font-medium">
                        {hasFullView ? sale.cashier : pm.toUpperCase()}
                      </td>
                      <td className="px-6 py-4 text-gray-400 text-right font-mono text-xs">{sale.time || '—'}</td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}