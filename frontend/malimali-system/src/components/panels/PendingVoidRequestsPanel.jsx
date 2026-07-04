import { useState } from 'react'
import { MdBlock, MdCheckCircle, MdClose, MdPerson, MdStore } from 'react-icons/md'
import { useApp } from '@/context/AppContext'

const isTouchDevice = () => window.matchMedia('(pointer: coarse)').matches

export default function PendingVoidRequestsPanel() {
  const { pendingVoidRequests, approveVoidRequest, rejectVoidRequest } = useApp()
  const [loadingId,   setLoadingId]   = useState(null)
  const [confirmId,   setConfirmId]   = useState(null)
  const [confirmType, setConfirmType] = useState(null)

  if (!pendingVoidRequests || pendingVoidRequests.length === 0) return null

  const handleApprove = async (id) => {
    setLoadingId(id)
    await approveVoidRequest(id)
    setLoadingId(null)
    setConfirmId(null)
  }

  const handleReject = async (id) => {
    setLoadingId(id)
    await rejectVoidRequest(id)
    setLoadingId(null)
    setConfirmId(null)
  }

  return (
    <div className="rounded-xl p-5 mb-4" style={{ background: '#fef2f2', border: '1px solid #fca5a5' }}>
      <div className="flex items-center gap-2 mb-4">
        <MdBlock className="text-xl" style={{ color: '#dc2626' }} />
        <span className="text-sm font-bold" style={{ color: '#991b1b' }}>
          {pendingVoidRequests.length} Void Request{pendingVoidRequests.length > 1 ? 's' : ''} Awaiting Your Approval
        </span>
      </div>

      {pendingVoidRequests.map(req => {
        const sale = req.saleId || {}
        const requester = req.requestedBy || {}
        const total = sale.total || 0

        return (
          <div key={req._id} className="rounded-xl p-4 mb-3" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-soft)', boxShadow: 'var(--shadow-card)' }}>
            <div className="flex justify-between flex-wrap gap-3">
              <div style={{ flex: 1 }}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                    Void #{req._id?.slice(-6).toUpperCase()}
                  </span>
                  <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700, background: '#fef2f2', color: '#991b1b', border: '1px solid #fca5a5' }}>
                    Remote Request
                  </span>
                </div>

                <div className="flex flex-wrap gap-x-4 gap-y-0.5 mb-1">
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    <MdPerson style={{ verticalAlign: 'middle', marginRight: 3 }} />
                    {requester.fullname || requester.username || 'Manager'}
                  </p>
                  {req.store && (
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      <MdStore style={{ verticalAlign: 'middle', marginRight: 3 }} />
                      {req.store}
                    </p>
                  )}
                  {sale.receiptId && (
                    <p className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
                      Receipt #{sale.receiptId}
                    </p>
                  )}
                </div>

                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Reason: <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{req.reason}</span>
                </p>

                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                  Type: {req.voidType === 'items' ? 'Item-level void' : 'Full sale void'}
                </p>

                {/* Inline confirm */}
                {confirmId === req._id && (
                  <div className="rounded-lg p-3 mt-2" style={{ background: 'var(--bg-muted)', border: '1px solid var(--border-soft)' }}>
                    <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
                      {confirmType === 'approve'
                        ? `Approve void of Sale #${sale.receiptId || '—'}? This will reverse the sale and restock items.`
                        : 'Reject this void request?'}
                    </p>
                    <div className="flex gap-2">
                      <button onClick={() => setConfirmId(null)}
                        className="flex-1 py-1.5 rounded-lg text-xs font-semibold"
                        style={{ border: '1px solid var(--border-medium)', color: 'var(--text-secondary)', background: 'var(--bg-card)', cursor: 'pointer' }}>
                        Cancel
                      </button>
                      <button
                        onClick={() => confirmType === 'approve' ? handleApprove(req._id) : handleReject(req._id)}
                        disabled={!!loadingId}
                        className="flex-1 py-1.5 rounded-lg text-xs font-bold text-white"
                        style={{ background: confirmType === 'approve' ? '#dc2626' : 'var(--border-medium)', cursor: loadingId ? 'not-allowed' : 'pointer', opacity: loadingId ? 0.6 : 1 }}>
                        {loadingId === req._id
                          ? 'Processing…'
                          : confirmType === 'approve' ? 'Yes, Approve Void' : 'Yes, Reject'}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Amount + buttons */}
              <div className="text-right" style={{ flexShrink: 0 }}>
                <div className="text-lg font-black mb-2" style={{ color: '#dc2626' }}>
                  KSh {total.toLocaleString()}
                </div>

                {confirmId !== req._id && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setConfirmId(req._id); setConfirmType('reject') }}
                      disabled={!!loadingId}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                      style={{ border: '1px solid var(--border-medium)', color: 'var(--text-secondary)', background: 'var(--bg-card)', cursor: 'pointer' }}
                      onMouseEnter={e => { if (!isTouchDevice()) e.currentTarget.style.background = 'var(--danger-light)' }}
                      onMouseLeave={e => { if (!isTouchDevice()) e.currentTarget.style.background = 'var(--bg-card)' }}>
                      <MdClose size={12} style={{ verticalAlign: 'middle', marginRight: 2 }} />
                      Reject
                    </button>
                    <button
                      onClick={() => { setConfirmId(req._id); setConfirmType('approve') }}
                      disabled={!!loadingId}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold text-white flex items-center gap-1"
                      style={{ background: '#dc2626', cursor: 'pointer' }}
                      onMouseEnter={e => { if (!isTouchDevice()) e.currentTarget.style.background = '#991b1b' }}
                      onMouseLeave={e => { if (!isTouchDevice()) e.currentTarget.style.background = '#dc2626' }}>
                      <MdCheckCircle size={13} /> Approve Void
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
