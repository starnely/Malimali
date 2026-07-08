import { useState } from 'react'
import { MdWarning, MdCheckCircle, MdLock } from 'react-icons/md'
import { useApp } from '@/context/AppContext'

const isTouchDevice = () => window.matchMedia('(pointer: coarse)').matches

const StageBadge = ({ status }) => {
  const cfg = {
    pending_manager: { bg: 'var(--warning-light)', color: 'var(--badge-warning-text)', border: 'var(--warning)', label: 'Stage 1 — Manager' },
    pending_owner:   { bg: 'var(--accent-light)',    color: 'var(--badge-accent-text)',  border: 'var(--accent)',   label: 'Stage 2 — Owner'   },
    approved:        { bg: 'var(--success-light)',  color: 'var(--badge-success-text)', border: 'var(--success)', label: 'Approved'          },
    rejected:        { bg: 'var(--danger-light)',   color: 'var(--badge-danger-text)',  border: 'var(--danger)',  label: 'Rejected'          },
  }
  const c = cfg[status] || cfg.pending_manager
  return (
    <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700, background: c.bg, color: c.color, border: `1px solid ${c.border}` }}>
      {c.label}
    </span>
  )
}

function PinInput({ label, onSubmit, loading, error }) {
  const [pin, setPin] = useState('')
  return (
    <div style={{ marginTop: 10, padding: '12px 14px', borderRadius: 8, background: 'var(--bg-muted)', border: '1px solid var(--border-medium)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <MdLock style={{ color: 'var(--primary)', fontSize: 14 }} />
        <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-primary)' }}>{label}</span>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          type="tel"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={6}
          value={pin}
          onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
          placeholder="••••••"
          autoComplete="off"
          onKeyDown={e => e.key === 'Enter' && pin.length >= 4 && onSubmit(pin)}
          style={{ flex: 1, padding: '9px 12px', borderRadius: 6, border: '1.5px solid var(--border-medium)', fontSize: 18, letterSpacing: '0.2em', fontWeight: 800, textAlign: 'center', fontFamily: 'monospace', outline: 'none', background: 'var(--bg-card)', color: 'var(--text-primary)' }}
        />
        <button
          disabled={loading || pin.length < 4}
          onClick={() => onSubmit(pin)}
          style={{ padding: '9px 16px', borderRadius: 6, border: 'none', background: loading || pin.length < 4 ? 'var(--border-medium)' : 'var(--success)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: loading || pin.length < 4 ? 'not-allowed' : 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
          {loading ? 'Verifying…' : 'Approve'}
        </button>
      </div>
      {error && <p style={{ fontSize: 11, color: 'var(--badge-danger-text)', marginTop: 6, fontWeight: 600 }}>{error}</p>}
    </div>
  )
}

export default function PendingReturnsPanel({ pendingReturns }) {
  const { currentUser, approveReturn, rejectReturn, approveReturnStage1, approveReturnWithPin } = useApp()
  const role = currentUser?.role || 'cashier'

  const [loadingId,   setLoadingId]   = useState(null)
  const [confirmId,   setConfirmId]   = useState(null)
  const [confirmType, setConfirmType] = useState(null)
  const [pinId,       setPinId]       = useState(null)   // which return is showing PIN input
  const [pinStage,    setPinStage]    = useState(null)   // 'stage1' | 'owner_onsite'
  const [pinError,    setPinError]    = useState('')

  if (!pendingReturns || pendingReturns.length === 0) return null

  const handleOwnerApprove = async (id) => {
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

  const handlePinSubmit = async (pin, returnId, stage) => {
    if (!/^\d{4,6}$/.test(pin)) { setPinError('PIN must be 4–6 digits.'); return }
    setPinError('')
    setLoadingId(returnId)
    const fn = stage === 'stage1' ? approveReturnStage1 : approveReturnWithPin
    const result = await fn(returnId, pin)
    setLoadingId(null)
    if (!result.success) { setPinError(result.message || 'PIN incorrect or not authorized.') }
    else { setPinId(null); setPinStage(null) }
  }

  const panelCount = pendingReturns.length
  const stage1Count = pendingReturns.filter(r => r.status === 'pending_manager').length
  const stage2Count = pendingReturns.filter(r => r.status === 'pending_owner').length

  return (
    <div className="rounded-xl p-5 mb-4" style={{ background: 'var(--warning-light)', border: '1px solid var(--warning)' }}>
      <div className="flex items-center gap-2 mb-4">
        <MdWarning className="text-xl" style={{ color: 'var(--warning)' }} />
        <span className="text-sm font-bold" style={{ color: 'var(--badge-warning-text)' }}>
          {panelCount} Return Request{panelCount > 1 ? 's' : ''} Pending
          {stage1Count > 0 && stage2Count > 0 ? ` (${stage1Count} manager · ${stage2Count} owner)` :
           stage1Count > 0 ? ` — Manager Approval` : ` — Owner Approval`}
        </span>
      </div>

      {pendingReturns.map(ret => {
        const status = ret.status
        const isStage1 = status === 'pending_manager'
        const isStage2 = status === 'pending_owner'
        const showingPin = pinId === ret._id

        // What actions can this user take?
        const managerCanApproveStage1 = isStage1 && role === 'manager'
        const managerCanEnterOwnerPin = isStage2 && role === 'manager'
        const ownerCanApproveStage2   = isStage2 && role === 'owner'

        return (
          <div key={ret._id} className="rounded-xl p-4 mb-3" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-soft)', boxShadow: 'var(--shadow-card)' }}>
            <div className="flex justify-between flex-wrap gap-3">
              <div style={{ flex: 1 }}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                    Return #{ret._id?.slice(-6).toUpperCase()}
                  </span>
                  <StageBadge status={status} />
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
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Customer: {ret.customerName}</p>
                )}
                <div className="mt-2 space-y-0.5">
                  {ret.items?.map((item, i) => (
                    <div key={i} className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                      • {item.productId?.name} × {item.qty} — KSh {(item.qty * (item.sellPrice || item.price || 0)).toLocaleString()}
                    </div>
                  ))}
                </div>

                {/* Stage 1 PIN input — manager only */}
                {managerCanApproveStage1 && showingPin && pinStage === 'stage1' && (
                  <PinInput
                    label="Your Manager PIN"
                    loading={loadingId === ret._id}
                    error={pinError}
                    onSubmit={pin => handlePinSubmit(pin, ret._id, 'stage1')}
                  />
                )}

                {/* Owner on-site PIN — from manager's device */}
                {managerCanEnterOwnerPin && showingPin && pinStage === 'owner_onsite' && (
                  <PinInput
                    label="Owner PIN (on-site)"
                    loading={loadingId === ret._id}
                    error={pinError}
                    onSubmit={pin => handlePinSubmit(pin, ret._id, 'owner_onsite')}
                  />
                )}

                {/* Owner remote approval confirm */}
                {ownerCanApproveStage2 && confirmId === ret._id && (
                  <div className="rounded-lg p-3 mt-2" style={{ background: 'var(--bg-muted)', border: '1px solid var(--border-soft)' }}>
                    <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
                      {confirmType === 'approve' ? 'Approve return & restore stock?' : 'Reject this return request?'}
                    </p>
                    <div className="flex gap-2">
                      <button onClick={() => setConfirmId(null)}
                        className="flex-1 py-1.5 rounded-lg text-xs font-semibold"
                        style={{ border: '1px solid var(--border-medium)', color: 'var(--text-secondary)', background: 'var(--bg-card)', cursor: 'pointer' }}>
                        Cancel
                      </button>
                      <button
                        onClick={() => confirmType === 'approve' ? handleOwnerApprove(ret._id) : handleReject(ret._id)}
                        disabled={!!loadingId}
                        className="flex-1 py-1.5 rounded-lg text-xs font-bold text-white"
                        style={{ background: confirmType === 'approve' ? 'var(--success)' : 'var(--danger)', opacity: loadingId ? 0.6 : 1, cursor: loadingId ? 'not-allowed' : 'pointer' }}>
                        {loadingId === ret._id ? 'Processing…' : confirmType === 'approve' ? 'Yes, Approve' : 'Yes, Reject'}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Right: amount + action buttons */}
              <div className="text-right" style={{ flexShrink: 0 }}>
                <div className="text-lg font-black mb-2" style={{ color: 'var(--danger)' }}>
                  KSh {(ret.refundAmount || 0).toLocaleString()}
                </div>

                {/* Manager — stage 1: approve with PIN / reject */}
                {managerCanApproveStage1 && confirmId !== ret._id && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setConfirmId(ret._id); setConfirmType('reject') }}
                      disabled={!!loadingId}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                      style={{ border: '1px solid var(--border-medium)', color: 'var(--text-secondary)', background: 'var(--bg-card)', cursor: 'pointer' }}
                      onMouseEnter={e => { if (!isTouchDevice()) e.currentTarget.style.background = 'var(--danger-light)' }}
                      onMouseLeave={e => { if (!isTouchDevice()) e.currentTarget.style.background = 'var(--bg-card)' }}>
                      Reject
                    </button>
                    <button
                      onClick={() => { setPinId(ret._id); setPinStage('stage1'); setPinError(''); setConfirmId(null) }}
                      disabled={!!loadingId}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold text-white flex items-center gap-1"
                      style={{ background: 'var(--success)', cursor: 'pointer' }}
                      onMouseEnter={e => { if (!isTouchDevice()) e.currentTarget.style.background = 'var(--success-dark)' }}
                      onMouseLeave={e => { if (!isTouchDevice()) e.currentTarget.style.background = 'var(--success)' }}>
                      <MdLock size={12} /> Approve with PIN
                    </button>
                  </div>
                )}

                {/* Manager — stage 2: offer owner on-site PIN (can't approve remotely themselves) */}
                {managerCanEnterOwnerPin && !showingPin && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setPinId(ret._id); setPinStage('owner_onsite'); setPinError('') }}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold"
                      style={{ border: '1px solid var(--accent)', color: 'var(--badge-accent-text)', background: 'var(--accent-light)', cursor: 'pointer' }}>
                      <MdLock size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                      Enter Owner PIN
                    </button>
                    <span className="text-xs self-center" style={{ color: 'var(--text-muted)' }}>Awaiting owner</span>
                  </div>
                )}

                {/* Manager — stage 2: PIN input visible, show cancel */}
                {managerCanEnterOwnerPin && showingPin && (
                  <button onClick={() => { setPinId(null); setPinStage(null); setPinError('') }}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                    style={{ border: '1px solid var(--border-medium)', color: 'var(--text-secondary)', background: 'var(--bg-card)', cursor: 'pointer' }}>
                    Cancel
                  </button>
                )}

                {/* Owner — stage 1: read-only label */}
                {isStage1 && role === 'owner' && (
                  <span className="text-xs px-3 py-1.5 rounded-lg" style={{ background: 'var(--bg-muted)', color: 'var(--text-muted)', border: '1px solid var(--border-medium)' }}>
                    Awaiting manager
                  </span>
                )}

                {/* Owner — stage 2: approve/reject buttons */}
                {ownerCanApproveStage2 && confirmId !== ret._id && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setConfirmId(ret._id); setConfirmType('reject') }}
                      disabled={!!loadingId}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                      style={{ border: '1px solid var(--border-medium)', color: 'var(--text-secondary)', background: 'var(--bg-card)', cursor: 'pointer' }}
                      onMouseEnter={e => { if (!isTouchDevice()) e.currentTarget.style.background = 'var(--danger-light)' }}
                      onMouseLeave={e => { if (!isTouchDevice()) e.currentTarget.style.background = 'var(--bg-card)' }}>
                      Reject
                    </button>
                    <button
                      onClick={() => { setConfirmId(ret._id); setConfirmType('approve') }}
                      disabled={!!loadingId}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold text-white flex items-center gap-1"
                      style={{ background: 'var(--success)', cursor: 'pointer' }}
                      onMouseEnter={e => { if (!isTouchDevice()) e.currentTarget.style.background = 'var(--success-dark)' }}
                      onMouseLeave={e => { if (!isTouchDevice()) e.currentTarget.style.background = 'var(--success)' }}>
                      <MdCheckCircle size={13} /> Approve & Restore
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Manager reject confirm (re-used for stage 1) */}
            {managerCanApproveStage1 && confirmId === ret._id && (
              <div className="rounded-lg p-3 mt-2" style={{ background: 'var(--bg-muted)', border: '1px solid var(--border-soft)' }}>
                <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
                  Reject this return request?
                </p>
                <div className="flex gap-2">
                  <button onClick={() => setConfirmId(null)}
                    className="flex-1 py-1.5 rounded-lg text-xs font-semibold"
                    style={{ border: '1px solid var(--border-medium)', color: 'var(--text-secondary)', background: 'var(--bg-card)', cursor: 'pointer' }}>
                    Cancel
                  </button>
                  <button onClick={() => handleReject(ret._id)} disabled={!!loadingId}
                    className="flex-1 py-1.5 rounded-lg text-xs font-bold text-white"
                    style={{ background: 'var(--danger)', opacity: loadingId ? 0.6 : 1, cursor: loadingId ? 'not-allowed' : 'pointer' }}>
                    {loadingId === ret._id ? 'Processing…' : 'Yes, Reject'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
