import { useState, useEffect } from 'react'
import { MdClose, MdUndo } from 'react-icons/md'
import { useApp } from '@/context/AppContext'
import { API_BASE_URL } from '@/config/api'

const isTouchDevice = () => window.matchMedia('(pointer: coarse)').matches

export default function ReturnModal({ sale, onClose, onSuccess }) {
  const { currentUser } = useApp()

  const [selectedItems, setSelectedItems] = useState(
    sale.items.map(i => ({ ...i, returnQty: 0, selected: false }))
  )
  const [reason,       setReason]       = useState('')
  const [customerName, setCustomerName] = useState('')
  const [submitting,   setSubmitting]   = useState(false)
  const [submitError,  setSubmitError]  = useState('')

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = 'unset' }
  }, [])

  // ── Max returnable qty for an item ───────────────────────────────
  const maxReturnable = (item) =>
    Math.max(0, item.qty - (item.voidedQty || 0) - (item.returnedQty || 0))

  const toggleItem = (id) => {
    setSelectedItems(prev =>
      prev.map(i => {
        if (i._id !== id) return i
        const max = maxReturnable(i)
        return { ...i, selected: !i.selected, returnQty: !i.selected ? max : 0 }
      })
    )
  }

  const updateReturnQty = (id, qty) => {
    setSelectedItems(prev =>
      prev.map(i => {
        if (i._id !== id) return i
        const max = maxReturnable(i)
        return { ...i, returnQty: Math.min(Math.max(0, qty), max) }
      })
    )
  }

  const itemsToReturn = selectedItems.filter(i => i.selected && i.returnQty > 0)
  const refundTotal   = itemsToReturn.reduce((sum, i) => sum + i.returnQty * i.price, 0)
  const canConfirm    = itemsToReturn.length > 0 && reason.trim().length > 0

  // Only show items that still have returnable qty
  const returnableItems = sale.items.filter(item => maxReturnable(item) > 0)

  const handleConfirm = async () => {
    if (!canConfirm || submitting) return
    setSubmitting(true)
    setSubmitError('')
    try {
      const res = await fetch(`${API_BASE_URL}/api/returns`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${currentUser?.token}`
        },
        body: JSON.stringify({
          saleId: sale._id,
          items: itemsToReturn.map(i => ({
            saleItemId: i._id,
            productId:  i.productId?._id || i.productId,
            qty:        i.returnQty,
            price:      i.price,
          })),
          reason,
          customerName,
        })
      })
      const data = await res.json()
      if (res.ok) {
        if (onSuccess) {
          onSuccess(`Return request for KSh ${refundTotal.toLocaleString()} submitted. Waiting for owner approval.`)
        }
        onClose()
      } else {
        setSubmitError(data.error || 'Failed to submit return')
      }
    } catch (err) {
      console.error('Error submitting return:', err)
      setSubmitError('Network error — please try again')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(15,23,42,0.6)', WebkitBackdropFilter: 'blur(3px)', backdropFilter: 'blur(3px)' }}
    >
      <div
        className="w-full max-w-md rounded-xl overflow-hidden"
        style={{ background: 'var(--bg-card)', boxShadow: 'var(--shadow-dropdown)', maxHeight: '90dvh', display: 'flex', flexDirection: 'column' }}
      >
        {/* Header */}
        <div
          className="px-5 py-4 flex justify-between items-center flex-shrink-0"
          style={{ background: 'var(--danger)' }}
        >
          <div>
            <h3 className="text-white text-base font-bold">Process Return / Refund</h3>
            <p className="text-white/70 text-xs mt-0.5">Select items the customer is returning</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 [@media(pointer:coarse)]:w-11 [@media(pointer:coarse)]:h-11 flex items-center justify-center rounded-lg transition"
            style={{ color: 'rgba(255,255,255,0.7)' }}
            onMouseEnter={e => { if (!isTouchDevice()) e.currentTarget.style.background = 'rgba(255,255,255,0.15)' }}
            onMouseLeave={e => { if (!isTouchDevice()) e.currentTarget.style.background = 'transparent' }}
          >
            <MdClose className="text-xl" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto flex-1">
          <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>
            Select items to return
          </p>

          {returnableItems.length === 0 ? (
            <div className="text-center py-6 text-sm" style={{ color: 'var(--text-muted)' }}>
              No returnable items — all items have been voided or already returned.
            </div>
          ) : (
            returnableItems.map(item => {
              const sel = selectedItems.find(i => i._id === item._id)
              const max = maxReturnable(item)
              return (
                <div
                  key={item._id}
                  onClick={() => toggleItem(item._id)}
                  className="rounded-lg p-3 mb-2 cursor-pointer transition-all"
                  style={sel?.selected
                    ? { border: '1px solid var(--danger)', background: 'var(--danger-light)' }
                    : { border: '1px solid var(--border-soft)', background: 'var(--bg-muted)' }
                  }
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                        {item.productId?.name}
                      </div>
                      <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                        Qty: {max} {item.unit || 'pcs'} · KSh {item.price.toLocaleString()} each
                      </div>
                    </div>
                    <div className="text-sm font-bold" style={{ color: 'var(--primary)' }}>
                      KSh {(max * item.price).toLocaleString()}
                    </div>
                  </div>

                  {sel?.selected && (
                    <div className="mt-2 flex items-center gap-2" onClick={e => e.stopPropagation()}>
                      <label className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                        Return qty:
                      </label>
                      <input
                        type="number"
                        min="1"
                        max={max}
                        value={sel.returnQty || 0}
                        onBlur={e => { if (Number(e.target.value) > max) updateReturnQty(item._id, max) }}
                        onChange={e => updateReturnQty(item._id, Number(e.target.value))}
                        className="w-16 p-1 text-center text-sm font-bold rounded-lg outline-none"
                        style={{ border: '1px solid var(--danger)', background: 'var(--bg-card)', color: 'var(--text-primary)' }}
                      />
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>of {max} max</span>
                    </div>
                  )}
                </div>
              )
            })
          )}

          {/* Customer name */}
          <div className="mb-4 mt-2">
            <label className="text-xs font-bold uppercase tracking-wider mb-1.5 block" style={{ color: 'var(--text-muted)' }}>
              Customer Name (optional)
            </label>
            <input
              type="text"
              placeholder="e.g. John Kamau"
              value={customerName}
              onChange={e => setCustomerName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none"
              style={{ border: '1px solid var(--border-medium)', background: 'var(--bg-muted)', color: 'var(--text-primary)' }}
            />
          </div>

          {/* Reason */}
          <div className="mb-4">
            <label className="text-xs font-bold uppercase tracking-wider mb-1.5 block" style={{ color: 'var(--text-muted)' }}>
              Reason for return <span style={{ color: 'var(--danger)' }}>*</span>
            </label>
            <input
              type="text"
              placeholder="Enter reason..."
              value={reason}
              onChange={e => setReason(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none"
              style={{ border: '1px solid var(--border-medium)', background: 'var(--bg-muted)', color: 'var(--text-primary)' }}
            />
          </div>

          {/* Refund total */}
          {refundTotal > 0 && (
            <div
              className="rounded-lg p-3 mb-4 flex justify-between items-center"
              style={{ background: 'var(--danger-light)', border: '1px solid var(--danger)' }}
            >
              <div>
                <div className="text-sm font-bold" style={{ color: 'var(--danger-dark)' }}>Refund Amount</div>
                <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  Pending owner approval · stock restored after approval
                </div>
              </div>
              <div className="text-xl font-black" style={{ color: 'var(--danger)' }}>
                KSh {refundTotal.toLocaleString()}
              </div>
            </div>
          )}

          {submitError && (
            <div
              className="text-sm p-3 rounded-lg mb-3"
              style={{ background: 'var(--danger-light)', color: 'var(--danger-dark)', border: '1px solid var(--danger)' }}
            >
              {submitError}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2.5">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-lg text-sm font-semibold transition"
              style={{ border: '1px solid var(--border-medium)', color: 'var(--text-secondary)', background: 'var(--bg-card)' }}
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={!canConfirm || submitting}
              className="flex-1 py-2.5 rounded-lg text-sm font-bold text-white flex items-center justify-center gap-2 transition"
              style={{
                background: canConfirm && !submitting ? 'var(--danger)' : 'var(--border-medium)',
                cursor: canConfirm && !submitting ? 'pointer' : 'not-allowed',
              }}
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
