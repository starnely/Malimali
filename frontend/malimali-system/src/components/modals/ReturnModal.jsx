import { useState } from 'react'
import { MdClose, MdUndo } from 'react-icons/md'

export default function ReturnModal({ sale, onClose, onSuccess }) {
  // ✅ Fixed: was "currentUser" — correct key is "malimali_current_user"
  const currentUser = JSON.parse(localStorage.getItem("malimali_current_user"))

  const [selectedItems, setSelectedItems] = useState(
    sale.items.map(i => ({ ...i, returnQty: 0, selected: false }))
  )
  const [reason, setReason] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  const toggleItem = (id) => {
    setSelectedItems(prev =>
      prev.map(i => i._id === id
        ? { ...i, selected: !i.selected, returnQty: !i.selected ? i.qty : 0 }
        : i
      )
    )
  }

  const updateReturnQty = (id, qty) => {
    setSelectedItems(prev =>
      prev.map(i => i._id === id
        ? { ...i, returnQty: Math.min(Math.max(0, qty), i.qty) }
        : i
      )
    )
  }

  const itemsToReturn = selectedItems.filter(i => i.selected && i.returnQty > 0)
  const refundTotal = itemsToReturn.reduce((sum, i) => sum + i.returnQty * i.price, 0)
  const canConfirm = itemsToReturn.length > 0 && reason.trim().length > 0

  const handleConfirm = async () => {
    if (!canConfirm || submitting) return
    setSubmitting(true)
    setSubmitError('')

    try {
      const res = await fetch("http://localhost:5000/returns", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // ✅ Include auth token — returns route now requires authMiddleware
          Authorization: `Bearer ${currentUser?.token}`
        },
        body: JSON.stringify({
          saleId: sale._id,
          items: itemsToReturn.map(i => ({
            productId: i.productId?._id || i.productId,
            qty: i.returnQty,
            price: i.price  // backend maps this to sellPrice
          })),
          reason,
          customerName,
          // ✅ cashierId no longer needed in body — backend reads from JWT
        })
      })

      const data = await res.json()

      if (res.ok) {
        // ✅ Tell employee: owner has been notified, item is pending
        onSuccess(`Return request submitted. Owner has been notified — awaiting approval.`)
        onClose()
      } else {
        setSubmitError(data.error || "Failed to submit return")
      }
    } catch (err) {
      console.error("Error submitting return:", err)
      setSubmitError("Network error — please try again")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/55 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="bg-red-700 px-5 py-4 flex justify-between items-center">
          <div>
            <h3 className="text-white text-base font-bold">Process Return / Refund</h3>
            <p className="text-white/70 text-xs mt-1">Select items the customer is returning</p>
          </div>
          <button onClick={onClose} className="text-white text-xl hover:text-gray-200 transition-colors duration-200">
            <MdClose />
          </button>
        </div>

        {/* Body */}
        <div className="p-5">
          <label className="text-xs text-gray-500 font-medium mb-2 block">Select items to return</label>

          {sale.items.map(item => {
            const sel = selectedItems.find(i => i._id === item._id)
            return (
              <div
                key={item._id}
                onClick={() => toggleItem(item._id)}
                className={`border rounded-lg p-3 mb-2 cursor-pointer transition-colors duration-200 ${
                  sel?.selected
                    ? 'border-red-700 bg-red-50 hover:bg-red-100'
                    : 'border-gray-200 bg-gray-50 hover:bg-gray-100'
                }`}
              >
                <div className="flex justify-between items-center">
                  <div>
                    <div className="text-sm font-semibold text-gray-800">{item.productId?.name}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      Sold qty: {item.qty} · KSh {item.price.toLocaleString()} each
                    </div>
                  </div>
                  <div className="text-sm font-bold text-blue-800">
                    KSh {(item.qty * item.price).toLocaleString()}
                  </div>
                </div>

                {sel?.selected && (
                  <div className="mt-2 flex items-center gap-2" onClick={e => e.stopPropagation()}>
                    <label className="text-xs text-gray-600">Return qty:</label>
                    <input
                      type="number" min="1" max={item.qty}
                      value={sel.returnQty || 0}
                      onChange={e => updateReturnQty(item._id, Number(e.target.value))}
                      className="w-16 p-1 border border-gray-300 rounded text-center text-sm font-semibold focus:ring-2 focus:ring-red-500"
                    />
                    <span className="text-xs text-gray-500">of {item.qty} max</span>
                  </div>
                )}
              </div>
            )
          })}

          {/* Customer name */}
          <div className="mb-4">
            <label className="text-xs text-gray-500 font-medium mb-1 block">Customer Name (optional)</label>
            <input
              type="text" placeholder="e.g. John Kamau"
              value={customerName} onChange={e => setCustomerName(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Reason */}
          <div className="mb-4">
            <label className="text-xs text-gray-500 font-medium mb-1 block">
              Reason for return <span className="text-red-600">*</span>
            </label>
            <input
              type="text" placeholder="Enter reason..."
              value={reason} onChange={e => setReason(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Refund total */}
          {refundTotal > 0 && (
            <div className="bg-red-50 border border-red-500 rounded-lg p-3 mb-4 flex justify-between items-center">
              <div>
                <div className="text-sm font-semibold text-red-700">Refund Amount</div>
                <div className="text-xs text-gray-400">Pending owner approval · stock restored after approval</div>
              </div>
              <div className="text-xl font-bold text-red-700">KSh {refundTotal.toLocaleString()}</div>
            </div>
          )}

          {/* Error */}
          {submitError && (
            <div className="bg-red-50 border border-red-300 text-red-700 text-sm p-2 rounded mb-3">
              {submitError}
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm text-gray-600 bg-white hover:bg-gray-100 transition-colors duration-200"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={!canConfirm || submitting}
              className={`flex-1 px-3 py-2 rounded text-sm font-bold flex items-center justify-center gap-2 transition-colors duration-200 ${
                canConfirm && !submitting
                  ? 'bg-red-700 text-white hover:bg-red-800'
                  : 'bg-gray-300 text-white cursor-not-allowed'
              }`}
            >
              <MdUndo className="text-base" />
              {submitting ? 'Submitting...' : 'Submit Return Request'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
