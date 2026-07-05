import { useState } from 'react'
import { MdBlock, MdCheckCircle, MdClose, MdPerson, MdStore, MdLock } from 'react-icons/md'
import { useApp } from '@/context/AppContext'

const isTouchDevice = () => window.matchMedia('(pointer: coarse)').matches

export default function PendingVoidRequestsPanel() {
  const { pendingVoidRequests, approveVoidRequest, rejectVoidRequest, approveVoidRequestWithPin } = useApp()
  const [loadingId,   setLoadingId]   = useState(null)
  const [confirmId,   setConfirmId]   = useState(null)
  const [confirmType, setConfirmType] = useState(null)
  const [pinId,       setPinId]       = useState(null)
  const [pin,         setPin]         = useState('')
  const [pinError,    setPinError]    = useState('')

  if (!pendingVoidRequests || pendingVoidRequests.length === 0) return null

  const handleApprove = async (id) => {
    setLoadingId(id)
    await approveVoidRequest(id)
    setLoadingId(null)
    setConfirmId(null)
  }

  const handleApproveWithPin = async (id) => {
    if (!/^\d{4,6}$/.test(pin)) { setPinError('PIN must be 4–6 digits.'); return }
    setPinError('')
    setLoadingId(id)
    const result = await approveVoidRequestWithPin(id, pin)
    setLoadingId(null)
    if (!result.success) {
      setPinError(result.message || 'PIN incorrect.')
    } else {
      setPinId(null)
      setPin('')
    }
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

                {/* Inline PIN input */}
                {pinId === req._id && (
                  <div className="rounded-lg p-3 mt-2" style={{ background: 'var(--bg-muted)', border: '1px solid var(--border-medium)' }}>
                    <div className="flex items-center gap-2 mb-2">
                      <MdLock style={{ color: 'var(--primary)', fontSize: 14 }} />
                      <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-primary)' }}>Owner PIN</span>
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="tel" inputMode="numeric" pattern="[0-9]*" maxLength={6}
                        value={pin}
                        onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="••••••"
                        autoComplete="off"
                        onKeyDown={e => e.key === 'Enter' && pin.length >= 4 && handleApproveWithPin(req._id)}
                        style={{ flex: 1, padding: '8px 12px', borderRadius: 6, border: '1.5px solid var(--border-medium)', fontSize: 18, letterSpacing: '0.2em', fontWeight: 800, textAlign: 'center', fontFamily: 'monospace', outline: 'none', background: 'var(--bg-card)', color: 'var(--text-primary)' }}
                      />
                      <button onClick={() => { setPinId(null); setPin(''); setPinError('') }}
                        style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border-medium)', background: 'var(--bg-card)', cursor: 'pointer', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', fontFamily: 'inherit' }}>
                        Cancel
                      </button>
                      <button
                        onClick={() => handleApproveWithPin(req._id)}
                        disabled={!!loadingId || pin.length < 4}
                        style={{ padding: '8px 14px', borderRadius: 6, border: 'none', background: loadingId || pin.length < 4 ? 'var(--border-medium)' : '#dc2626', color: '#fff', fontSize: 12, fontWeight: 700, cursor: loadingId || pin.length < 4 ? 'not-allowed' : 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                        {loadingId === req._id ? 'Verifying…' : 'Approve'}
                      </button>
                    </div>
                    {pinError && <p style={{ fontSize: 11, color: 'var(--danger-dark)', marginTop: 5, fontWeight: 600 }}>{pinError}</p>}
                  </div>
                )}

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

                {confirmId !== req._id && pinId !== req._id && (
                  <div className="flex flex-col gap-2">
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
                    <button
                      onClick={() => { setPinId(req._id); setPin(''); setPinError(''); setConfirmId(null) }}
                      disabled={!!loadingId}
                      className="w-full px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1"
                      style={{ border: '1px solid #dc2626', color: '#991b1b', background: '#fef2f2', cursor: 'pointer' }}>
                      <MdLock size={12} /> Approve with Owner PIN
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
