import { MdWarning, MdCheckCircle } from 'react-icons/md'

export default function PendingReturnsPanel({ pendingReturns, refreshReturns }) {
  if (!pendingReturns || pendingReturns.length === 0) return null

  // ✅ Read token for auth headers
  const currentUser = JSON.parse(localStorage.getItem("malimali_current_user"))
  const token = currentUser?.token

  const handleApprove = async (id) => {
    try {
      await fetch(`http://localhost:5000/returns/${id}/approve`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` }
      })
      refreshReturns()
    } catch (err) {
      console.error("Error approving return:", err)
    }
  }

  const handleReject = async (id) => {
    try {
      await fetch(`http://localhost:5000/returns/${id}/reject`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` }
      })
      refreshReturns()
    } catch (err) {
      console.error("Error rejecting return:", err)
    }
  }

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
                <div className="text-sm font-semibold text-gray-800">Return #{ret._id}</div>
                <StatusBadge status={ret.status} />
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Sale: {ret.saleId} · Requested by:{" "}
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
                    {/* ✅ item.price used in display — schema stores as sellPrice */}
                    • {item.productId?.name} × {item.qty} — KSh {((item.qty * (item.sellPrice || item.price || 0))).toLocaleString()}
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
                    className="px-3 py-1 border border-gray-300 rounded text-xs text-gray-600 bg-white hover:bg-gray-100 hover:text-red-700 transition-colors duration-200"
                  >
                    Reject
                  </button>
                  <button
                    onClick={() => handleApprove(ret._id)}
                    className="px-3 py-1 rounded text-xs font-semibold flex items-center gap-1 bg-green-700 text-white hover:bg-green-800 transition-colors duration-200"
                  >
                    <MdCheckCircle className="text-sm" /> Approve & Restore Stock
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
