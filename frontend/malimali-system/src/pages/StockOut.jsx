import { useState } from 'react'
import { MdPointOfSale, MdCheckCircle, MdWarning } from 'react-icons/md'
import { useApp } from '@/context/AppContext'
import { useNavigate } from 'react-router-dom'

export default function StockOut() {
  const { products, sales, today, currentUser, isOwner } = useApp()
  const navigate = useNavigate()

  const [form, setForm] = useState({ productId: '', qty: '' })
  const [errors, setErrors] = useState({})

  // ✅ Fixed: use p._id (MongoDB ObjectId string), not p.id
  const selectedProduct = products.find(p => String(p._id) === form.productId)

  // ✅ Fixed: use s.cashier, s.date.startsWith(today), s.items for qty
  const todaySales = sales.filter(s => {
    const saleDate = s.date ? String(s.date).slice(0, 10) : ''
    return saleDate === today && !s.returned &&
      (isOwner || s.cashier === currentUser?.name)
  })

  const todayRevenue = todaySales.reduce((sum, s) => sum + (s.total || 0), 0)
  const todayItems   = todaySales.reduce((sum, s) =>
    sum + (s.items?.reduce((q, i) => q + i.qty, 0) || 0), 0)

  const allSales    = sales.filter(s => !s.returned && (isOwner || s.cashier === currentUser?.name))
  const allRevenue  = allSales.reduce((sum, s) => sum + (s.total || 0), 0)

  const validate = () => {
    const e = {}
    if (!form.productId) e.productId = 'Please select a product'
    if (!form.qty || Number(form.qty) <= 0) e.qty = 'Enter a valid quantity'
    if (selectedProduct && Number(form.qty) > selectedProduct.stock) {
      e.qty = `Only ${selectedProduct.stock} in stock`
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  // ✅ StockOut form redirects to Barcodes (POS Terminal) for actual selling
  // This page is kept for quick manual sale entry if needed
  const handleGoToPOS = () => navigate('/barcodes')

  // Today's sales log for display
  const salesLog = sales.filter(s => {
    const saleDate = s.date ? String(s.date).slice(0, 10) : ''
    return saleDate === today && (isOwner || s.cashier === currentUser?.name)
  })

  return (
    <div className="p-6 bg-gray-100 min-h-screen">
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-gray-800">Stock Out</h1>
        <p className="text-sm text-gray-500 mt-1">View today's sales · Use POS Terminal to record new sales</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          {
            label: isOwner ? 'Total sales today' : 'My sales today',
            value: `KSh ${todayRevenue.toLocaleString()}`,
            color: 'border-blue-800'
          },
          { label: 'Items sold today', value: todayItems, color: 'border-green-700' },
          {
            // ✅ Employee does NOT see revenue total — show transaction count instead
            label: isOwner ? 'All time revenue' : 'My transactions today',
            value: isOwner ? `KSh ${allRevenue.toLocaleString()}` : todaySales.length,
            color: 'border-yellow-700'
          },
        ].map((card, i) => (
          <div key={i} className={`bg-white border border-gray-200 rounded-lg p-4 ${card.color} border-l-4`}>
            <div className="text-xs text-gray-500 mb-1">{card.label}</div>
            <div className="text-xl font-semibold text-gray-800">{card.value}</div>
          </div>
        ))}
      </div>

      {/* POS redirect banner */}
      <div className="bg-blue-50 border border-blue-300 rounded-lg p-4 mb-6 flex justify-between items-center">
        <div>
          <div className="text-sm font-semibold text-blue-800">Record a Sale</div>
          <div className="text-xs text-blue-600 mt-1">Use the POS Terminal to scan or search products and process payment</div>
        </div>
        <button
          onClick={handleGoToPOS}
          className="bg-blue-800 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-900 transition flex items-center gap-2"
        >
          <MdPointOfSale /> Open POS Terminal
        </button>
      </div>

      {/* Today's sales log */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 overflow-x-auto">
        <h2 className="text-sm font-semibold text-gray-800 mb-4">
          {isOwner ? "Today's Sales Log" : "My Sales Today"}
        </h2>
        <table className="w-full border-collapse min-w-[500px] text-sm">
          <thead>
            <tr className="bg-gray-50">
              {['Receipt', 'Items', 'Payment', 'Total', isOwner ? 'Cashier' : 'Time', 'Time'].filter((h, i, arr) => arr.indexOf(h) === i).map(h => (
                <th key={h} className="text-xs text-gray-500 font-medium text-left px-3 py-2 border-b">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {salesLog.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-gray-400 text-sm">No sales recorded today yet.</td>
              </tr>
            ) : (
              salesLog.map((sale, i) => {
                const items = sale.items?.reduce((q, it) => q + it.qty, 0) || 0
                const pm    = sale.paymentInfo?.paymentMethod || 'cash'
                return (
                  <tr key={sale._id} className={`${sale.returned ? 'opacity-50' : ''} ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50 transition-colors duration-150`}>
                    <td className="px-3 py-2 text-xs font-bold text-blue-800">{sale.receiptId || '—'}</td>
                    <td className="px-3 py-2 text-gray-800">{items}</td>
                    <td className="px-3 py-2 text-gray-500 capitalize">{pm}</td>
                    <td className={`px-3 py-2 font-semibold text-blue-800 ${sale.returned ? 'line-through' : ''}`}>
                      KSh {(sale.total || 0).toLocaleString()}
                    </td>
                    {isOwner && <td className="px-3 py-2 text-gray-500">{sale.cashier}</td>}
                    <td className="px-3 py-2 text-gray-500">{sale.time || '—'}</td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
