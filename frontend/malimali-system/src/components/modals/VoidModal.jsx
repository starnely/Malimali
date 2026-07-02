import { useState } from 'react'
import {
  MdClose, MdWarning, MdLock, MdVisibility,
  MdVisibilityOff, MdBlock, MdRemoveCircle,
  MdCheckCircle, MdShoppingCart,
} from 'react-icons/md'

const isTouchDevice = () => window.matchMedia('(pointer: coarse)').matches

export default function VoidModal({ sale, onClose, onVoid }) {
  const [mode, setMode] = useState('items')  // 'items' | 'whole'
  const [selectedItems, setSelectedItems] = useState({})       // { itemId: voidQty }
  const [reason, setReason] = useState('')
  const [managerUsername, setManagerUsername] = useState('')
  const [managerPassword, setManagerPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const total = sale?.paymentInfo?.finalTotal || sale?.total || 0
  const pm = sale?.paymentInfo?.paymentMethod || 'cash'

  // Only items that are not already fully voided
  const voidableItems = sale?.items?.filter(item =>
    item.voidStatus !== 'voided' && (item.voidedQty || 0) < item.qty
  ) || []

  const toggleItem = (itemId, maxQty, alreadyVoided) => {
    const remaining = maxQty - (alreadyVoided || 0)
    setSelectedItems(prev => {
      if (prev[itemId] !== undefined) {
        const { [itemId]: _, ...rest } = prev
        return rest
      }
      return { ...prev, [itemId]: remaining }
    })
  }

  const setItemQty = (itemId, qty, maxQty, alreadyVoided) => {
    const remaining = maxQty - (alreadyVoided || 0)
    const clamped = Math.max(1, Math.min(Number(qty) || 1, remaining))
    setSelectedItems(prev => ({ ...prev, [itemId]: clamped }))
  }

  const selectedCount = Object.keys(selectedItems).length
  const voidedValue = voidableItems.reduce((sum, item) => {
    const qty = selectedItems[item._id]
    return qty ? sum + qty * item.price : sum
  }, 0)

  const handleVoid = async () => {
    if (!reason.trim()) { setError('Please enter a void reason.'); return }
    if (!managerUsername.trim()) { setError('Manager username is required.'); return }
    if (!managerPassword) { setError('Manager password is required.'); return }

    if (mode === 'items') {
      if (selectedCount === 0) { setError('Select at least one item to void.'); return }
    }

    setError(''); setLoading(true)

    let result
    if (mode === 'whole') {
      // Existing whole-sale void
      result = await onVoid({
        saleId: sale._id,
        managerUsername: managerUsername.trim(),
        managerPassword,
        reason: reason.trim(),
        voidType: 'whole',
      })
    } else {
      // New per-item void
      result = await onVoid({
        saleId: sale._id,
        managerUsername: managerUsername.trim(),
        managerPassword,
        reason: reason.trim(),
        voidType: 'items',
        items: Object.entries(selectedItems).map(([itemId, voidQty]) => ({ itemId, voidQty })),
      })
    }

    setLoading(false)
    if (!result.success) {
      setError(result.message || 'Failed to void. Check credentials and try again.')
    }
  }

  const inp = (val, onChange, opts = {}) => (
    <input
      type={opts.type || 'text'}
      value={val}
      onChange={e => onChange(e.target.value)}
      placeholder={opts.placeholder}
      autoComplete={opts.autoComplete || 'off'}
      onKeyDown={opts.onKeyDown}
      style={{ width: '100%', padding: '10px 12px', borderRadius: 'var(--radius-md)', border: '1.5px solid var(--border-medium)', fontSize: 13, outline: 'none', background: 'var(--bg-muted)', color: 'var(--text-primary)', boxSizing: 'border-box', fontFamily: 'inherit' }}
      onFocus={e => { e.target.style.borderColor = 'var(--danger)'; e.target.style.boxShadow = '0 0 0 3px var(--danger-light)' }}
      onBlur={e => { e.target.style.borderColor = 'var(--border-medium)'; e.target.style.boxShadow = 'none' }}
    />
  )

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'rgba(15,23,42,0.65)', backdropFilter: 'blur(4px)' }}>
      <div style={{ width: '100%', maxWidth: 520, background: 'var(--bg-card)', borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-dropdown)', overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '90dvh' }}>

        {/* Header */}
        <div style={{ padding: '16px 20px', background: '#7f1d1d', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 'var(--radius-sm)', background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <MdBlock style={{ color: '#fff', fontSize: 18 }} />
            </div>
            <div>
              <div style={{ color: '#fff', fontSize: 15, fontWeight: 800 }}>Void Sale</div>
              <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, marginTop: 1 }}>Requires manager authorization</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.6)', fontSize: 22, display: 'flex', alignItems: 'center', padding: 0 }}><MdClose /></button>
        </div>

        {/* Scrollable body */}
        <div style={{ overflowY: 'auto', flex: 1 }}>

          {/* Sale summary */}
          <div style={{ padding: '14px 20px', background: 'var(--bg-muted)', borderBottom: '1px solid var(--border-soft)' }}>
            <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)', marginBottom: 8 }}>Sale to Void</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              {[
                { label: 'Receipt', value: sale?.receiptId || 'N/A', mono: true },
                { label: 'Total', value: `KSh ${total.toLocaleString()}`, danger: true },
                { label: 'Cashier', value: sale?.cashier || '—' },
                { label: 'Payment', value: pm.charAt(0).toUpperCase() + pm.slice(1) },
                { label: 'Date', value: sale?.date || '—' },
                { label: 'Items', value: `${voidableItems.length} voidable` },
              ].map(r => (
                <div key={r.label}>
                  <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 2 }}>{r.label}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: r.danger ? 'var(--danger-dark)' : 'var(--text-primary)', fontFamily: r.mono ? 'monospace' : 'inherit' }}>{r.value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Mode selector */}
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-soft)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)', marginBottom: 8 }}>Void Type</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {[
                { value: 'items', label: '📦 Specific Items', desc: 'Void selected items or partial quantities' },
                { value: 'whole', label: '🚫 Entire Sale', desc: 'Void all items in this sale at once' },
              ].map(opt => (
                <button key={opt.value} onClick={() => { setMode(opt.value); setSelectedItems({}) }}
                  style={{ padding: '10px 12px', borderRadius: 'var(--radius-md)', border: `2px solid ${mode === opt.value ? 'var(--danger)' : 'var(--border-medium)'}`, background: mode === opt.value ? 'var(--danger-light)' : 'var(--bg-muted)', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: mode === opt.value ? 'var(--danger-dark)' : 'var(--text-primary)', marginBottom: 3 }}>{opt.label}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Item selection */}
          {mode === 'items' && (
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-soft)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)', marginBottom: 8 }}>
                Select Items to Void
              </div>

              {voidableItems.length === 0 ? (
                <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>All items in this sale have already been voided.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {voidableItems.map(item => {
                    const isSelected = selectedItems[item._id] !== undefined
                    const alreadyVoided = item.voidedQty || 0
                    const remaining = item.qty - alreadyVoided

                    return (
                      <div key={item._id}
                        style={{ padding: '10px 12px', borderRadius: 'var(--radius-md)', border: `1.5px solid ${isSelected ? 'var(--danger)' : 'var(--border-medium)'}`, background: isSelected ? 'var(--danger-light)' : 'var(--bg-muted)', cursor: 'pointer', transition: 'all 0.15s' }}
                        onClick={() => toggleItem(item._id, item.qty, alreadyVoided)}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
                            {/* Checkbox */}
                            <div style={{ width: 18, height: 18, borderRadius: 4, border: `2px solid ${isSelected ? 'var(--danger)' : 'var(--border-medium)'}`, background: isSelected ? 'var(--danger)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              {isSelected && <MdCheckCircle style={{ color: '#fff', fontSize: 14 }} />}
                            </div>
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                                {item.productId?.name || 'Product'}
                              </div>
                              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                                {item.productId?.category || '—'} ·
                                KSh {item.price?.toLocaleString()} each ·
                                {alreadyVoided > 0 && <span style={{ color: 'var(--danger)' }}> {alreadyVoided} already voided ·</span>}
                                {' '}{remaining} {item.unit || 'pcs'} remaining
                              </div>
                            </div>
                          </div>

                          {/* Qty selector — only show when selected */}
                          {isSelected && (
                            <div onClick={e => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                              <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Void qty:</span>
                              <button
                                onClick={() => setItemQty(item._id, (selectedItems[item._id] || 1) - 1, item.qty, alreadyVoided)}
                                style={{ width: 24, height: 24, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-medium)', background: 'var(--bg-card)', cursor: 'pointer', fontWeight: 900, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-primary)' }}>−</button>
                              <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--danger-dark)', minWidth: 20, textAlign: 'center' }}>
                                {selectedItems[item._id]}
                              </span>
                              <button
                                onClick={() => setItemQty(item._id, (selectedItems[item._id] || 1) + 1, item.qty, alreadyVoided)}
                                style={{ width: 24, height: 24, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-medium)', background: 'var(--bg-card)', cursor: 'pointer', fontWeight: 900, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-primary)' }}>+</button>
                              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>/ {remaining}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Void summary */}
              {selectedCount > 0 && (
                <div style={{ marginTop: 10, padding: '10px 12px', borderRadius: 'var(--radius-md)', background: 'var(--danger-light)', border: '1px solid var(--danger)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: 12, color: 'var(--danger-dark)', fontWeight: 600 }}>
                    <MdShoppingCart style={{ verticalAlign: 'middle', marginRight: 4 }} />
                    {selectedCount} item line{selectedCount !== 1 ? 's' : ''} selected
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 900, color: 'var(--danger)' }}>
                    KSh {voidedValue.toLocaleString()} to void
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Whole sale warning */}
          {mode === 'whole' && (
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-soft)' }}>
              <div style={{ padding: '12px 14px', borderRadius: 'var(--radius-md)', background: 'var(--danger-light)', border: '1px solid var(--danger)', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <MdWarning style={{ color: 'var(--danger)', fontSize: 18, flexShrink: 0, marginTop: 1 }} />
                <div style={{ fontSize: 12, color: 'var(--danger-dark)', lineHeight: 1.5 }}>
                  Voiding the entire sale will <strong>return all {sale?.items?.length} items to stock</strong> and cannot be undone. The owner will be notified immediately.
                </div>
              </div>
            </div>
          )}

          {/* Form */}
          <div style={{ padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Reason */}
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                Void Reason *
              </label>
              {inp(reason, setReason, { placeholder: 'e.g. Wrong item scanned, Customer short of cash' })}
            </div>

            {/* Manager credentials */}
            <div style={{ padding: 14, borderRadius: 'var(--radius-md)', background: 'var(--bg-muted)', border: '1px solid var(--border-soft)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <MdLock style={{ color: 'var(--primary)', fontSize: 15 }} />
                <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-primary)' }}>Manager Authorization</span>
              </div>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12 }}>
                A manager or owner must enter their credentials to authorize this void.
              </p>
              <div style={{ marginBottom: 10 }}>
                <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', display: 'block', marginBottom: 5 }}>Username</label>
                {inp(managerUsername, setManagerUsername, { placeholder: 'Manager username', autoComplete: 'off' })}
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', display: 'block', marginBottom: 5 }}>Password</label>
                <div style={{ position: 'relative' }}>
                  {inp(managerPassword, setManagerPassword, {
                    type: showPassword ? 'text' : 'password',
                    placeholder: 'Manager password',
                    autoComplete: 'new-password',
                    onKeyDown: e => e.key === 'Enter' && handleVoid(),
                  })}
                  <button type="button" onClick={() => setShowPassword(v => !v)}
                    style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', padding: 0 }}>
                    {showPassword ? <MdVisibilityOff size={17} /> : <MdVisibility size={17} />}
                  </button>
                </div>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div style={{ padding: '10px 12px', borderRadius: 'var(--radius-md)', background: 'var(--danger-light)', border: '1px solid var(--danger)', color: 'var(--danger-dark)', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                <MdWarning style={{ flexShrink: 0 }} /> {error}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border-soft)', display: 'flex', gap: 10, flexShrink: 0, background: 'var(--bg-card)' }}>
          <button onClick={onClose}
            style={{ flex: 1, padding: '11px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-medium)', background: 'var(--bg-card)', color: 'var(--text-secondary)', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
            Cancel
          </button>
          <button onClick={handleVoid} disabled={loading}
            style={{ flex: 2, padding: '11px', borderRadius: 'var(--radius-md)', border: 'none', background: loading ? 'var(--border-medium)' : 'var(--danger)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
            onMouseEnter={e => { if (!loading && !isTouchDevice()) e.currentTarget.style.background = 'var(--danger-dark)' }}
            onMouseLeave={e => { if (!loading && !isTouchDevice()) e.currentTarget.style.background = loading ? 'var(--border-medium)' : 'var(--danger)' }}>
            <MdBlock size={16} />
            {loading ? 'Verifying…' : mode === 'whole' ? 'Void Entire Sale' : `Void ${selectedCount > 0 ? selectedCount + ' Item(s)' : 'Selected Items'}`}
          </button>
        </div>
      </div>
    </div>
  )
}
