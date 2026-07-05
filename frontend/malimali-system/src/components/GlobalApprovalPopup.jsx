import { useState, useEffect, useRef } from 'react'
import { MdBlock, MdWarning, MdClose, MdCheckCircle, MdCancel, MdLock } from 'react-icons/md'
import { useApp } from '@/context/AppContext'

export default function GlobalApprovalPopup() {
  const {
    currentUser,
    pendingVoidRequests,
    pendingReturns,
    approveVoidRequest,
    rejectVoidRequest,
    approveReturn,
    rejectReturn,
    approveReturnStage1,
  } = useApp()

  const [dismissed,      setDismissed]      = useState(false)
  const [loadingId,      setLoadingId]      = useState(null)
  // void PIN (owner approves void with PIN)
  const [pinVoidId,      setPinVoidId]      = useState(null)
  const [voidPin,        setVoidPin]        = useState('')
  const [pinError,       setPinError]       = useState('')
  // return PIN (manager stage-1 approve)
  const [pinReturnId,    setPinReturnId]    = useState(null)
  const [returnPin,      setReturnPin]      = useState('')
  const [returnPinError, setReturnPinError] = useState('')
  const prevCountRef = useRef(0)

  const role = currentUser?.role

  const relevantVoids = role === 'owner' ? pendingVoidRequests : []
  const relevantReturns = role === 'owner'
    ? pendingReturns.filter(r => r.status === 'pending_owner')
    : role === 'manager'
      ? pendingReturns.filter(r => r.status === 'pending_manager')
      : []

  const totalCount = relevantVoids.length + relevantReturns.length

  // Re-show when new items arrive
  useEffect(() => {
    if (totalCount > prevCountRef.current) setDismissed(false)
    prevCountRef.current = totalCount
  }, [totalCount])

  if (!currentUser || totalCount === 0) return null

  const handleApproveVoid = async (id) => {
    setLoadingId(id)
    await approveVoidRequest(id)
    setLoadingId(null)
  }

  const handleRejectVoid = async (id) => {
    setLoadingId(id)
    await rejectVoidRequest(id)
    setLoadingId(null)
  }

  const handleApproveReturn = async (id) => {
    setLoadingId(id)
    await approveReturn(id)
    setLoadingId(null)
  }

  const handleRejectReturn = async (id) => {
    setLoadingId(id)
    await rejectReturn(id)
    setLoadingId(null)
  }

  const handleApproveReturnStage1 = async (id) => {
    if (!/^\d{4,6}$/.test(returnPin)) { setReturnPinError('PIN must be 4–6 digits.'); return }
    setReturnPinError('')
    setLoadingId(id)
    const result = await approveReturnStage1(id, returnPin)
    setLoadingId(null)
    if (!result.success) {
      setReturnPinError(result.message || 'PIN incorrect.')
    } else {
      setPinReturnId(null)
      setReturnPin('')
    }
  }

  // Dismissed badge — small floating button showing count
  if (dismissed) {
    return (
      <button
        onClick={() => setDismissed(false)}
        style={{
          position: 'fixed', bottom: 20, right: 20, zIndex: 9990,
          background: '#dc2626', color: '#fff',
          borderRadius: '50px', border: 'none', cursor: 'pointer',
          padding: '10px 16px', fontSize: 13, fontWeight: 800,
          display: 'flex', alignItems: 'center', gap: 8,
          boxShadow: '0 4px 20px rgba(220,38,38,0.4)',
          fontFamily: 'inherit',
        }}
      >
        <MdWarning style={{ fontSize: 16 }} />
        {totalCount} pending approval{totalCount !== 1 ? 's' : ''}
      </button>
    )
  }

  return (
    <div style={{
      position: 'fixed', bottom: 20, right: 20, zIndex: 9990,
      width: 340, maxHeight: 'calc(100dvh - 100px)',
      display: 'flex', flexDirection: 'column',
      background: 'var(--bg-card)',
      borderRadius: 'var(--radius-xl)',
      boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
      border: '1.5px solid #fca5a5',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        background: '#7f1d1d', color: '#fff',
        padding: '12px 16px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <MdBlock style={{ fontSize: 18 }} />
          <span style={{ fontSize: 13, fontWeight: 800 }}>
            {totalCount} Approval{totalCount !== 1 ? 's' : ''} Pending
          </span>
        </div>
        <button onClick={() => setDismissed(true)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.6)', fontSize: 18, display: 'flex', padding: 0 }}>
          <MdClose />
        </button>
      </div>

      {/* Scrollable items */}
      <div style={{ overflowY: 'auto', flex: 1, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>

        {/* Void requests (owner only) */}
        {relevantVoids.map(vr => {
          const sale      = vr.saleId || {}
          const requester = vr.requestedBy || {}
          return (
            <div key={vr._id} style={{ background: 'var(--bg-muted)', borderRadius: 8, padding: '10px 12px', border: '1px solid var(--border-soft)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-primary)' }}>
                    🚫 Void Request
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                    {requester.fullname || requester.username || 'Manager'} · {vr.store || ''}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    Receipt #{sale.receiptId || '—'} · {vr.voidType === 'items' ? 'Item-level' : 'Full void'}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                    Reason: {vr.reason}
                  </div>
                </div>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#dc2626', flexShrink: 0 }}>
                  KSh {(sale.total || 0).toLocaleString()}
                </div>
              </div>

              {/* PIN input */}
              {pinVoidId === vr._id ? (
                <div>
                  <div style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
                    <input
                      type="tel" inputMode="numeric" pattern="[0-9]*" maxLength={6}
                      value={voidPin}
                      onChange={e => setVoidPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="Owner PIN"
                      autoComplete="off"
                      style={{ flex: 1, padding: '7px 10px', borderRadius: 6, border: '1.5px solid var(--border-medium)', fontSize: 16, letterSpacing: '0.2em', fontWeight: 800, textAlign: 'center', fontFamily: 'monospace', outline: 'none', background: 'var(--bg-card)', color: 'var(--text-primary)' }}
                    />
                    <button onClick={() => { setPinVoidId(null); setVoidPin(''); setPinError('') }}
                      style={{ padding: '7px 10px', borderRadius: 6, border: '1px solid var(--border-medium)', background: 'var(--bg-card)', fontSize: 11, fontWeight: 600, cursor: 'pointer', color: 'var(--text-secondary)', fontFamily: 'inherit' }}>
                      Cancel
                    </button>
                  </div>
                  {pinError && <p style={{ fontSize: 11, color: 'var(--danger-dark)', marginBottom: 4, fontWeight: 600 }}>{pinError}</p>}
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => handleRejectVoid(vr._id)} disabled={!!loadingId}
                    style={{ flex: 1, padding: '7px 0', borderRadius: 6, border: '1px solid var(--border-medium)', background: 'var(--bg-card)', fontSize: 11, fontWeight: 700, cursor: 'pointer', color: 'var(--text-secondary)', fontFamily: 'inherit' }}>
                    <MdCancel size={12} style={{ verticalAlign: 'middle', marginRight: 3 }} />
                    {loadingId === vr._id ? 'Processing…' : 'Reject'}
                  </button>
                  <button onClick={() => handleApproveVoid(vr._id)} disabled={!!loadingId}
                    style={{ flex: 1, padding: '7px 0', borderRadius: 6, border: 'none', background: '#dc2626', color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                    <MdCheckCircle size={12} style={{ verticalAlign: 'middle', marginRight: 3 }} />
                    {loadingId === vr._id ? 'Processing…' : 'Approve'}
                  </button>
                  <button onClick={() => { setPinVoidId(vr._id); setVoidPin(''); setPinError('') }} disabled={!!loadingId}
                    style={{ padding: '7px 10px', borderRadius: 6, border: '1px solid #dc2626', background: '#fef2f2', color: '#991b1b', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                    <MdLock size={12} />
                  </button>
                </div>
              )}
            </div>
          )
        })}

        {/* Return requests */}
        {relevantReturns.map(ret => {
          const stageLabel = ret.status === 'pending_manager' ? 'Manager approval' : 'Owner approval'
          const requester  = ret.requestedBy || {}
          return (
            <div key={ret._id} style={{ background: 'var(--bg-muted)', borderRadius: 8, padding: '10px 12px', border: '1px solid var(--border-soft)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-primary)' }}>
                    ↩️ Return Request <span style={{ fontSize: 10, color: 'var(--warning-dark)', fontWeight: 600 }}>({stageLabel})</span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                    {requester.fullname || requester.username || 'Cashier'}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 1 }}>
                    Reason: {ret.reason}
                  </div>
                </div>
                <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--warning-dark)', flexShrink: 0 }}>
                  KSh {(ret.refundAmount || 0).toLocaleString()}
                </div>
              </div>

              {role === 'owner' && ret.status === 'pending_owner' ? (
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => handleRejectReturn(ret._id)} disabled={!!loadingId}
                    style={{ flex: 1, padding: '7px 0', borderRadius: 6, border: '1px solid var(--border-medium)', background: 'var(--bg-card)', fontSize: 11, fontWeight: 700, cursor: 'pointer', color: 'var(--text-secondary)', fontFamily: 'inherit' }}>
                    {loadingId === ret._id ? 'Processing…' : 'Reject'}
                  </button>
                  <button onClick={() => handleApproveReturn(ret._id)} disabled={!!loadingId}
                    style={{ flex: 1, padding: '7px 0', borderRadius: 6, border: 'none', background: 'var(--success)', color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                    {loadingId === ret._id ? 'Processing…' : 'Approve'}
                  </button>
                </div>
              ) : role === 'manager' && ret.status === 'pending_manager' ? (
                pinReturnId === ret._id ? (
                  <div>
                    <div style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
                      <input
                        type="tel" inputMode="numeric" pattern="[0-9]*" maxLength={6}
                        value={returnPin}
                        onChange={e => setReturnPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        onKeyDown={e => e.key === 'Enter' && returnPin.length >= 4 && handleApproveReturnStage1(ret._id)}
                        placeholder="Your PIN"
                        autoComplete="off"
                        style={{ flex: 1, padding: '7px 10px', borderRadius: 6, border: '1.5px solid var(--border-medium)', fontSize: 16, letterSpacing: '0.2em', fontWeight: 800, textAlign: 'center', fontFamily: 'monospace', outline: 'none', background: 'var(--bg-card)', color: 'var(--text-primary)' }}
                      />
                      <button onClick={() => { setPinReturnId(null); setReturnPin(''); setReturnPinError('') }}
                        style={{ padding: '7px 10px', borderRadius: 6, border: '1px solid var(--border-medium)', background: 'var(--bg-card)', fontSize: 11, fontWeight: 600, cursor: 'pointer', color: 'var(--text-secondary)', fontFamily: 'inherit' }}>
                        Cancel
                      </button>
                      <button
                        onClick={() => handleApproveReturnStage1(ret._id)}
                        disabled={!!loadingId || returnPin.length < 4}
                        style={{ padding: '7px 12px', borderRadius: 6, border: 'none', background: loadingId || returnPin.length < 4 ? 'var(--border-medium)' : 'var(--success)', color: '#fff', fontSize: 11, fontWeight: 700, cursor: loadingId || returnPin.length < 4 ? 'not-allowed' : 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                        {loadingId === ret._id ? '…' : 'Approve'}
                      </button>
                    </div>
                    {returnPinError && <p style={{ fontSize: 11, color: 'var(--danger-dark)', marginBottom: 0, fontWeight: 600 }}>{returnPinError}</p>}
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => handleRejectReturn(ret._id)} disabled={!!loadingId}
                      style={{ flex: 1, padding: '7px 0', borderRadius: 6, border: '1px solid var(--border-medium)', background: 'var(--bg-card)', fontSize: 11, fontWeight: 700, cursor: 'pointer', color: 'var(--text-secondary)', fontFamily: 'inherit' }}>
                      <MdCancel size={12} style={{ verticalAlign: 'middle', marginRight: 3 }} />
                      {loadingId === ret._id ? 'Processing…' : 'Reject'}
                    </button>
                    <button onClick={() => { setPinReturnId(ret._id); setReturnPin(''); setReturnPinError('') }} disabled={!!loadingId}
                      style={{ flex: 1, padding: '7px 0', borderRadius: 6, border: 'none', background: 'var(--success)', color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                      <MdLock size={12} /> Approve with PIN
                    </button>
                  </div>
                )
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}
