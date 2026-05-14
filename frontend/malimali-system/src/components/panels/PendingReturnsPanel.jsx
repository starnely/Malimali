import { useState } from 'react'
import { MdWarning, MdCheckCircle } from 'react-icons/md'
import { useApp } from '@/context/AppContext'

const StatusBadge = ({ status }) => {
  const map = {
    approved: "bg-green-100 text-green-700 border border-green-400",
    rejected: "bg-red-100 text-red-700 border border-red-400",
  }
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${map[status] || "bg-yellow-100 text-yellow-700 border border-yellow-400"}`}>
      {status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Pending'}
    </span>
  )
}

export default function PendingReturnsPanel({ pendingReturns }) {
  const { approveReturn, rejectReturn } = useApp()
  const [loadingId, setLoadingId] = useState(null)

  if (!pendingReturns || pendingReturns.length === 0) return null

  const handleApprove = async (id) => {
    if (loadingId || !window.confirm("Approve return and restore stock?")) return;
    setLoadingId(id)
    await approveReturn(id)
    setLoadingId(null)
  }

  const handleReject = async (id) => {
    if (loadingId || !window.confirm("Reject return request?")) return
    setLoadingId(id)
    await rejectReturn(id)
    setLoadingId(null)
  }

  return (
    <div className="bg-orange-50 border border-orange-400 rounded-xl p-5 mb-4">
      <div className="text-sm font-bold text-orange-900 mb-4 flex items-center gap-2">
        <MdWarning className="text-lg text-orange-500" />
        {pendingReturns.length} Return Request{pendingReturns.length > 1 ? 's' : ''} Pending Approval
      </div>

      {pendingReturns.map(ret => (
        <div key={ret._id} className="bg-white border border-gray-200 rounded-lg p-4 mb-3 hover:shadow-md transition-shadow duration-200">
          <div className="flex justify-between flex-wrap gap-3">
            <div>
              <div className="flex items-center gap-2">
                <div className="text-sm font-semibold text-gray-800">
                  Return #{ret._id?.slice(-6).toUpperCase()}
                </div>
                <StatusBadge status={ret.status} />
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Sale: #{ret.saleId?.toString().slice(-6).toUpperCase()} · Requested by:{" "}
                <span className="font-medium text-gray-700">
                  {ret.requestedBy?.name || ret.requestedBy?.username || "Cashier"}
                </span>
              </div>
              <div className="text-xs text-gray-500">Reason: {ret.reason}</div>
              {ret.customerName && (
                <div className="text-xs text-gray-500">Customer: {ret.customerName}</div>
              )}
              <div className="mt-2">
                {ret.items?.map((item, i) => (
                  <div key={i} className="text-xs text-gray-600 mb-1">
                    • {item.productId?.name} × {item.qty} — KSh {(item.qty * (item.sellPrice || item.price || 0)).toLocaleString()}
                  </div>
                ))}
              </div>
            </div>

            <div className="text-right">
              <div className="text-lg font-bold text-red-700 mb-2">
                KSh {(ret.refundAmount || 0).toLocaleString()}
              </div>
              {ret.status === 'pending' && (
                <div className="flex gap-2">
                  <button
                    onClick={() => handleReject(ret._id)}
                    disabled={!!loadingId}
                    className="px-3 py-1 border border-gray-300 rounded text-xs text-gray-600 bg-white hover:bg-gray-100 hover:text-red-700 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loadingId === ret._id ? 'Rejecting...' : 'Reject'}
                  </button>
                  <button
                    onClick={() => handleApprove(ret._id)}
                    disabled={!!loadingId}
                    className="px-3 py-1 rounded text-xs font-semibold flex items-center gap-1 bg-green-700 text-white hover:bg-green-800 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <MdCheckCircle className="text-sm" />
                    {loadingId === ret._id ? 'Approving...' : 'Approve & Restore Stock'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}