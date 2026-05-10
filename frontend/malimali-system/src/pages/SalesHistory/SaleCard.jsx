import { MdUndo } from 'react-icons/md';

export default function SaleCard({ sale, onReturn, isOwner }) {
  const pm = sale.paymentInfo?.paymentMethod || 'cash';
  const pmLabel =
    pm === 'mpesa' ? '📱 M-Pesa' :
    pm === 'cash'  ? '💵 Cash' :
    pm === 'split' ? '💳 Split' :
                     '📋 Credit';

  return (
    <div className="bg-white border-b border-gray-100 last:border-b-0 hover:bg-blue-50 transition-colors duration-150 mx-3 my-2 rounded-lg overflow-hidden shadow-sm">
      {/* Receipt header */}
      <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 flex justify-between items-center flex-wrap gap-2">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs font-bold text-blue-800">#{sale.receiptId || 'N/A'}</span>
          <span className="text-xs text-gray-400 font-mono">{sale._id?.slice(-6)}</span>
          <span className="text-xs text-gray-500">
            {sale.date && !isNaN(new Date(sale.date))
              ? new Date(sale.date).toLocaleTimeString('en-KE')
              : ''}
          </span>
          <span className="text-xs text-gray-600">👤 {sale.cashier}</span>
          <span className="text-xs text-gray-500">{pmLabel}</span>
        </div>
        <span className="text-sm font-bold text-blue-800">KSh {(sale.total || 0).toLocaleString()}</span>
      </div>

      {/* Items table */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse min-w-[520px] text-sm">
          <thead>
            <tr className="bg-gray-50">
              {['Product', 'Category', 'Qty', 'Price', 'Total', 'Status', ''].map(h => (
                <th key={h} className="text-xs text-gray-400 font-medium text-left px-3 py-2 border-b">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sale.items?.map((item, i) => {
              const itemStatus = item.returnStatus || 'none';
              return (
                <tr
                  key={item._id || i}
                  className={`border-b border-gray-50 last:border-b-0 transition-colors duration-150 ${
                    itemStatus === 'approved' ? 'bg-green-50' :
                    itemStatus === 'pending'  ? 'bg-yellow-50' :
                    itemStatus === 'rejected' ? 'bg-red-50' : 'hover:bg-blue-50'
                  }`}
                >
                  <td className="px-3 py-2 font-medium text-gray-800">{item.productId?.name || '—'}</td>
                  <td className="px-3 py-2 text-gray-500 text-xs">{item.productId?.category || '—'}</td>
                  <td className="px-3 py-2 text-gray-800">{item.qty}</td>
                  <td className="px-3 py-2 text-gray-800">KSh {(item.price || 0).toLocaleString()}</td>
                  <td className="px-3 py-2 font-semibold text-blue-800">
                    KSh {((item.price || 0) * item.qty).toLocaleString()}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                      itemStatus === 'approved' ? 'bg-green-100 text-green-700' :
                      itemStatus === 'pending'  ? 'bg-yellow-100 text-yellow-700' :
                      itemStatus === 'rejected' ? 'bg-red-100 text-red-700' :
                                                  'bg-gray-100 text-gray-400'
                    }`}>
                      {itemStatus === 'none'     ? 'Sold' :
                       itemStatus === 'pending'  ? '⏳ Pending' :
                       itemStatus === 'approved' ? '✅ Approved, return the amount' :
                       itemStatus === 'rejected' ? '❌ Rejected' : itemStatus}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    {itemStatus === 'none' ? (
                      <button
                        onClick={() => onReturn(sale)}
                        className="px-2 py-1 border border-red-600 rounded text-xs bg-red-50 text-red-700
                                   flex items-center gap-1 hover:bg-red-600 hover:text-white
                                   transition-colors duration-150 whitespace-nowrap"
                      >
                        <MdUndo className="text-sm" /> Return
                      </button>
                    ) : itemStatus === 'pending' ? (
                      <span className="text-xs text-yellow-600 whitespace-nowrap">Owner notified</span>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
