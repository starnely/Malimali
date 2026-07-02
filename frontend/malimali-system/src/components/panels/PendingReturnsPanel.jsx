import { useState } from 'react'
import { MdWarning, MdCheckCircle, MdClose } from 'react-icons/md'
import { useApp } from '@/context/AppContext'

const isTouchDevice = () => window.matchMedia('(pointer: coarse)').matches

const StatusBadge = ({ status }) => {
  const config = {
    approved: { bg: 'var(--success-light)', color: 'var(--success-dark)', border: 'var(--success)' },
    rejected: { bg: 'var(--danger-light)',  color: 'var(--danger-dark)',  border: 'var(--danger)'  },
    pending:  { bg: 'var(--warning-light)', color: 'var(--warning-dark)', border: 'var(--warning)' },
  }
  const cfg = config[status] || config.pending
  return (
    <span
      className="px-2 py-0.5 rounded text-xs font-bold"
      style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}
    >
      {status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Pending'}
    </span>
  )
}

export default function PendingReturnsPanel({ pendingReturns }) {
  const { approveReturn, rejectReturn } = useApp()
  const [loadingId,   setLoadingId]   = useState(null)
  const [confirmId,   setConfirmId]   = useState(null)  // inline confirm state
  const [confirmType, setConfirmType] = useState(null)  // 'approve' | 'reject'

  if (!pendingReturns || pendingReturns.length === 0) return null

  const handleApprove = async (id) => {
    setLoadingId(id)
    await approveReturn(id)
    setLoadingId(null)
    setConfirmId(null)
  }

  const handleReject = async (id) => {
    setLoadingId(id)
    await rejectReturn(id)
    setLoadingId(null)
    setConfirmId(null)
  }

  return (
    <div
      className="rounded-xl p-5 mb-4"
      style={{
        background: 'var(--warning-light)',
        border: '1px solid var(--warning)',
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <MdWarning className="text-xl" style={{ color: 'var(--warning)' }} />
        <span className="text-sm font-bold" style={{ color: 'var(--warning-dark)' }}>
          {pendingReturns.length} Return Request{pendingReturns.length > 1 ? 's' : ''} Pending Approval
        </span>
      </div>

      {pendingReturns.map(ret => (
        <div
          key={ret._id}
          className="rounded-xl p-4 mb-3 transition-shadow duration-200"
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-soft)',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <div className="flex justify-between flex-wrap gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                  Return #{ret._id?.slice(-6).toUpperCase()}
                </span>
                <StatusBadge status={ret.status} />
              </div>
              <p className="text-xs mb-0.5" style={{ color: 'var(--text-muted)' }}>
                Sale: #{ret.saleId?.toString().slice(-6).toUpperCase()} · By:{' '}
                <span className="font-semibold" style={{ color: 'var(--text-secondary)' }}>
                  {ret.requestedBy?.name || ret.requestedBy?.username || 'Cashier'}
                </span>
              </p>
              <p className="text-xs mb-0.5" style={{ color: 'var(--text-muted)' }}>
                Reason: {ret.reason}
              </p>
              {ret.customerName && (
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Customer: {ret.customerName}
                </p>
              )}
              <div className="mt-2 space-y-0.5">
                {ret.items?.map((item, i) => (
                  <div key={i} className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                    • {item.productId?.name} × {item.qty} —{' '}
                    KSh {(item.qty * (item.sellPrice || item.price || 0)).toLocaleString()}
                  </div>
                ))}
              </div>
            </div>

            <div className="text-right">
              <div className="text-lg font-black mb-2" style={{ color: 'var(--danger)' }}>
                KSh {(ret.refundAmount || 0).toLocaleString()}
              </div>

              {ret.status === 'pending' && (
                <>
                  {/* Inline confirm UI */}
                  {confirmId === ret._id ? (
                    <div
                      className="rounded-lg p-3 mb-2"
                      style={{ background: 'var(--bg-muted)', border: '1px solid var(--border-soft)' }}
                    >
                      <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
                        {confirmType === 'approve'
                          ? 'Approve return & restore stock?'
                          : 'Reject this return request?'}
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setConfirmId(null)}
                          className="flex-1 py-1.5 rounded-lg text-xs font-semibold transition"
                          style={{ border: '1px solid var(--border-medium)', color: 'var(--text-secondary)', background: 'var(--bg-card)' }}
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => confirmType === 'approve' ? handleApprove(ret._id) : handleReject(ret._id)}
                          disabled={!!loadingId}
                          className="flex-1 py-1.5 rounded-lg text-xs font-bold text-white transition"
                          style={{
                            background: confirmType === 'approve' ? 'var(--success)' : 'var(--danger)',
                            opacity: loadingId ? 0.6 : 1,
                          }}
                        >
                          {loadingId === ret._id
                            ? 'Processing...'
                            : confirmType === 'approve' ? 'Yes, Approve' : 'Yes, Reject'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setConfirmId(ret._id); setConfirmType('reject') }}
                        disabled={!!loadingId}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold transition"
                        style={{
                          border: '1px solid var(--border-medium)',
                          color: 'var(--text-secondary)',
                          background: 'var(--bg-card)',
                        }}
                        onMouseEnter={e => { if (!isTouchDevice()) e.currentTarget.style.background = 'var(--danger-light)' }}
                        onMouseLeave={e => { if (!isTouchDevice()) e.currentTarget.style.background = 'var(--bg-card)' }}
                      >
                        Reject
                      </button>
                      <button
                        onClick={() => { setConfirmId(ret._id); setConfirmType('approve') }}
                        disabled={!!loadingId}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold text-white flex items-center gap-1 transition"
                        style={{ background: 'var(--success)' }}
                        onMouseEnter={e => { if (!isTouchDevice()) e.currentTarget.style.background = 'var(--success-dark)' }}
                        onMouseLeave={e => { if (!isTouchDevice()) e.currentTarget.style.background = 'var(--success)' }}
                      >
                        <MdCheckCircle className="text-sm" /> Approve & Restore
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
