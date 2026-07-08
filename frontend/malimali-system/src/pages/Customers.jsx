import { useState, useEffect, useCallback } from 'react'
import {
  MdSearch, MdPhone, MdCheckCircle, MdStore, MdRefresh,
  MdPayment, MdClose, MdBlock, MdWarning, MdPeopleAlt,
  MdCalendarToday, MdTrendingDown, MdReceiptLong,
  MdAccessTime, MdExpandMore, MdExpandLess, MdCall, MdFilterList,
} from 'react-icons/md'
import { useApp } from '@/context/AppContext'
import { useHistoryModal } from '@/hooks/useHistoryModal'
import s from '@/styles/Customers.module.css'

// ── Helpers ───────────────────────────────────────────────────────────
function daysUntil(dateStr) {
  if (!dateStr) return null
  const today   = new Date(); today.setHours(0, 0, 0, 0)
  const promise = new Date(dateStr + 'T00:00:00')
  return Math.ceil((promise - today) / 86400000)
}

function formatDate(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-KE', {
    day: 'numeric', month: 'short', year: 'numeric'
  })
}

function timeAgo(dateStr) {
  if (!dateStr) return '—'
  const ms   = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(ms / 86400000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7)  return `${days} days ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  return `${Math.floor(days / 30)}mo ago`
}

const isTouchDevice = () => window.matchMedia('(pointer: coarse)').matches

// ── Promise pill ──────────────────────────────────────────────────────
function PromisePill({ dateStr, size = 'sm' }) {
  const days = daysUntil(dateStr)
  if (days === null) return null
  const overdue  = days < 0
  const dueSoon  = !overdue && days <= 3
  const color    = overdue ? 'var(--danger-dark)' : dueSoon ? 'var(--warning-dark)'  : 'var(--success-dark)'
  const bg       = overdue ? 'var(--danger-light)' : dueSoon ? 'var(--orange-light)' : 'var(--success-light)'
  const label    = overdue
    ? `${Math.abs(days)}d overdue`
    : days === 0 ? 'Due TODAY'
    : `${days}d left`
  const fontSize = size === 'lg' ? 12 : 11
  return (
    <span style={{ fontSize, fontWeight: 800, padding: '3px 10px', borderRadius: 20, background: bg, color, display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
      <MdCalendarToday style={{ fontSize: fontSize - 1 }} />
      {label} · {formatDate(dateStr)}
    </span>
  )
}

// ── Status badge ──────────────────────────────────────────────────────
function StatusBadge({ customer }) {
  const base = { fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 20, letterSpacing: '0.04em', whiteSpace: 'nowrap' }
  if (customer.blacklisted)   return <span style={{ ...base, background: 'var(--danger-light)', color: 'var(--badge-danger-text)' }}>🚫 BLACKLISTED</span>
  if (customer.overdue)       return <span style={{ ...base, background: 'var(--orange-light)', color: 'var(--badge-warning-text)' }}>⚠️ OVERDUE</span>
  if (customer.balance === 0) return <span style={{ ...base, background: 'var(--success-light)', color: 'var(--badge-success-text)' }}>✅ SETTLED</span>
  return                             <span style={{ ...base, background: 'var(--primary-light)', color: 'var(--primary)' }}>📋 ACTIVE</span>
}

// ── Repayment Modal ───────────────────────────────────────────────────
function RepaymentModal({ customer, onClose, onSubmit, loading }) {
  const { settings } = useApp()
  const currency = settings?.currency || 'KSh'
  const [amount, setAmount] = useState('')
  const [notes,  setNotes]  = useState('')
  const [error,  setError]  = useState('')

  const handleSubmit = () => {
    const amt = Number(amount)
    if (!amt || amt <= 0)       return setError('Enter a valid amount')
    if (amt > customer.balance) return setError(`Max payable: ${currency} ${customer.balance.toLocaleString()}`)
    setError(''); onSubmit(amt, notes)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'var(--overlay-bg)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', width: '100%', maxWidth: 420, boxShadow: 'var(--shadow-dropdown)', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', background: 'var(--primary-light)', borderBottom: '1px solid var(--border-soft)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)' }}>Record Payment</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              {customer.name} · Balance: <strong style={{ color: 'var(--danger)' }}>{currency} {customer.balance?.toLocaleString()}</strong>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 20 }}><MdClose /></button>
        </div>
        <div style={{ padding: 20 }}>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Amount ({currency}) *</label>
            <input type="number" min="1" max={customer.balance}
              placeholder={`Max ${currency} ${customer.balance?.toLocaleString()}`}
              value={amount} onChange={e => { setAmount(e.target.value); setError('') }} autoFocus={!isTouchDevice()}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 'var(--radius-md)', border: `1.5px solid ${error ? 'var(--danger)' : 'var(--border-medium)'}`, background: 'var(--bg-muted)', fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
              onFocus={e => e.target.style.borderColor = 'var(--primary)'}
              onBlur={e => e.target.style.borderColor = error ? 'var(--danger)' : 'var(--border-medium)'}
            />
            {error && <div style={{ fontSize: 11, color: 'var(--danger)', marginTop: 4, fontWeight: 600 }}>{error}</div>}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
            {[500, 1000, 2000, 5000].filter(a => a <= customer.balance).map(a => (
              <button key={a} onClick={() => setAmount(String(a))}
                style={{ padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700, border: `1px solid ${Number(amount) === a ? 'var(--primary)' : 'var(--border-medium)'}`, background: Number(amount) === a ? 'var(--primary)' : 'var(--bg-muted)', color: Number(amount) === a ? '#fff' : 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'inherit' }}>
                {a.toLocaleString()}
              </button>
            ))}
            <button onClick={() => setAmount(String(customer.balance))}
              style={{ padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700, border: `1px solid ${Number(amount) === customer.balance ? 'var(--success)' : 'var(--border-medium)'}`, background: Number(amount) === customer.balance ? 'var(--success)' : 'var(--bg-muted)', color: Number(amount) === customer.balance ? '#fff' : 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'inherit' }}>
              Full · {currency} {customer.balance?.toLocaleString()}
            </button>
          </div>
          <div style={{ marginBottom: 18 }}>
            <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Notes (optional)</label>
            <input type="text" placeholder="e.g. Paid via M-Pesa" value={notes} onChange={e => setNotes(e.target.value)}
              style={{ width: '100%', padding: '9px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-medium)', background: 'var(--bg-muted)', fontSize: 13, color: 'var(--text-primary)', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onClose} style={{ flex: 1, padding: 10, borderRadius: 'var(--radius-md)', border: '1px solid var(--border-medium)', background: 'var(--bg-muted)', fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
            <button onClick={handleSubmit} disabled={loading || !amount}
              style={{ flex: 2, padding: 10, borderRadius: 'var(--radius-md)', border: 'none', background: !amount || loading ? 'var(--bg-muted)' : 'var(--primary)', fontSize: 13, fontWeight: 700, color: !amount || loading ? 'var(--text-muted)' : '#fff', cursor: !amount || loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
              {loading ? 'Recording...' : `💰 Record ${currency} ${Number(amount || 0).toLocaleString()}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Blacklist Modal ───────────────────────────────────────────────────
function BlacklistModal({ customer, onClose, onSubmit, loading }) {
  const [reason, setReason] = useState('')
  const isBlacklisting = !customer.blacklisted
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'var(--overlay-bg)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', width: '100%', maxWidth: 380, boxShadow: 'var(--shadow-dropdown)', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-soft)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)' }}>{isBlacklisting ? '🚫 Blacklist Customer' : '✅ Remove Blacklist'}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 20 }}><MdClose /></button>
        </div>
        <div style={{ padding: 20 }}>
          <div style={{ padding: '12px 14px', borderRadius: 'var(--radius-md)', background: isBlacklisting ? 'var(--danger-light)' : 'var(--success-light)', border: `1px solid ${isBlacklisting ? 'var(--danger)' : 'var(--success)'}`, fontSize: 13, color: isBlacklisting ? 'var(--danger-dark)' : 'var(--success-dark)', fontWeight: 600, marginBottom: 16 }}>
            {isBlacklisting ? `${customer.name} will be blocked from future credit sales.` : `${customer.name} will be allowed credit sales again.`}
          </div>
          {isBlacklisting && (
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Reason (optional)</label>
              <input type="text" placeholder="e.g. Failed to pay previous debt" value={reason} onChange={e => setReason(e.target.value)} autoFocus={!isTouchDevice()}
                style={{ width: '100%', padding: '9px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-medium)', background: 'var(--bg-muted)', fontSize: 13, color: 'var(--text-primary)', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
            </div>
          )}
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onClose} style={{ flex: 1, padding: 10, borderRadius: 'var(--radius-md)', border: '1px solid var(--border-medium)', background: 'var(--bg-muted)', fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
            <button onClick={() => onSubmit(!customer.blacklisted, reason)} disabled={loading}
              style={{ flex: 1, padding: 10, borderRadius: 'var(--radius-md)', border: 'none', background: isBlacklisting ? 'var(--danger)' : 'var(--success)', fontSize: 13, fontWeight: 700, color: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>
              {loading ? 'Saving...' : isBlacklisting ? 'Confirm' : 'Remove'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Expanded inline detail ────────────────────────────────────────────
function CustomerExpanded({ customerId, customer, onRecord, onBlacklist, isOwner }) {
  const { fetchCustomer, settings } = useApp()
  const currency = settings?.currency || 'KSh'
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    fetchCustomer(customerId).then(d => { if (active) { setData(d); setLoading(false) } })
    return () => { active = false }
  }, [customerId, fetchCustomer])

  if (loading) return (
    <div style={{ padding: '20px 24px', color: 'var(--text-muted)', fontSize: 13, borderTop: '1px solid var(--border-soft)' }}>
      Loading details...
    </div>
  )
  if (!data) return null

  const { sales, repayments } = data
  const totalCredit = sales?.reduce((s, sale) => s + (sale.paymentInfo?.finalTotal || sale.total || 0), 0) || 0
  const totalPaid   = repayments?.reduce((s, r) => s + r.amount, 0) || 0

  return (
    <div style={{ borderTop: '2px solid var(--border-soft)' }}>

      {/* Financial summary bar */}
      <div className={s.statGrid} style={{ background: 'var(--bg-muted)' }}>
        {[
          { label: 'Total Borrowed', value: `${currency} ${totalCredit.toLocaleString()}`,                           color: 'var(--text-primary)'  },
          { label: 'Total Paid',     value: `${currency} ${totalPaid.toLocaleString()}`,                              color: 'var(--badge-success-text)'  },
          { label: 'Balance Due',    value: `${currency} ${(customer.balance || 0).toLocaleString()}`,                color: customer.balance > 0 ? 'var(--danger)' : 'var(--success-dark)' },
          { label: 'Credit Sales',   value: `${sales?.length || 0} sale${sales?.length !== 1 ? 's' : ''}`,   color: 'var(--primary)'       },
          { label: 'Payments Made',  value: `${repayments?.length || 0} payment${repayments?.length !== 1 ? 's' : ''}`, color: 'var(--badge-success-text)' },
        ].map((s, i) => (
          <div key={s.label} style={{ padding: '10px 14px' }}>
            <div style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)', marginBottom: 3 }}>{s.label}</div>
            <div style={{ fontSize: 13, fontWeight: 900, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Sales + Payments side by side */}
      <div className={s.salesPayGrid}>

        {/* Credit Sales */}
        <div className={s.creditSalesCol}>
          <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border-soft)', background: 'var(--bg-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <MdReceiptLong style={{ color: 'var(--primary)', fontSize: 14 }} />
            <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-secondary)' }}>
              Credit Sales ({sales?.length || 0})
            </span>
          </div>
          {!sales?.length ? (
            <div style={{ padding: '20px 16px', fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>No credit sales</div>
          ) : (
            <div style={{ maxHeight: 280, overflowY: 'auto' }}>
              {sales.map((sale, idx) => (
                <div key={sale._id} style={{ padding: '12px 16px', borderBottom: idx < sales.length - 1 ? '1px solid var(--border-soft)' : 'none' }}>
                  {/* Amount + promise pill */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 5 }}>
                    <span style={{ fontSize: 16, fontWeight: 900, color: 'var(--text-primary)' }}>
                      {currency} {(sale.paymentInfo?.finalTotal || sale.total)?.toLocaleString()}
                    </span>
                    {sale.paymentInfo?.promiseDate && <PromisePill dateStr={sale.paymentInfo.promiseDate} size="sm" />}
                  </div>
                  {/* Date + cashier + receipt */}
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 5 }}>
                    📅 <strong>{formatDate(sale.date)}</strong> · by <strong>{sale.cashier}</strong>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 5 }}>
                    Receipt: <strong>{sale.receiptId}</strong>
                  </div>
                  {/* Promised payment date */}
                  {sale.paymentInfo?.promiseDate && (
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 5 }}>
                      Promised to pay by: <strong>{formatDate(sale.paymentInfo.promiseDate)}</strong>
                    </div>
                  )}
                  {/* Items */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                    {sale.items?.map((item, i) => (
                      <span key={i} style={{ fontSize: 10, padding: '1px 7px', borderRadius: 10, background: 'var(--bg-card)', border: '1px solid var(--border-soft)', color: 'var(--text-secondary)', fontWeight: 600 }}>
                        {item.qty}× {item.productId?.name || 'Product'}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Payments */}
        <div>
          <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border-soft)', background: 'var(--bg-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <MdPayment style={{ color: 'var(--success)', fontSize: 14 }} />
            <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-secondary)' }}>
              Payments ({repayments?.length || 0})
            </span>
          </div>
          {!repayments?.length ? (
            <div style={{ padding: '20px 16px', fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
              No payments recorded yet
            </div>
          ) : (
            <div style={{ maxHeight: 280, overflowY: 'auto' }}>
              {repayments.map((rep, idx) => (
                <div key={rep._id} style={{ padding: '12px 16px', borderBottom: idx < repayments.length - 1 ? '1px solid var(--border-soft)' : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 900, color: 'var(--badge-success-text)', marginBottom: 3 }}>
                      + {currency} {rep.amount?.toLocaleString()}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      📅 {formatDate(rep.date)}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      by <strong>{rep.recordedBy}</strong>
                      {rep.notes && <span> · <em>{rep.notes}</em></span>}
                    </div>
                  </div>
                  <MdCheckCircle style={{ color: 'var(--success)', fontSize: 22, flexShrink: 0 }} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border-soft)', display: 'flex', gap: 8, background: 'var(--bg-card)' }}>
        {customer.balance > 0 && (
          <button className={s.actionBtn} onClick={() => onRecord(customer)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px', borderRadius: 'var(--radius-md)', border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
            <MdPayment /> Record Payment
          </button>
        )}
        {isOwner && (
          <button className={s.actionBtn} onClick={() => onBlacklist(customer)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px', borderRadius: 'var(--radius-md)', border: 'none', background: customer.blacklisted ? 'var(--success)' : 'var(--danger)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
            {customer.blacklisted ? <><MdCheckCircle /> Remove Blacklist</> : <><MdBlock /> Blacklist</>}
          </button>
        )}
      </div>
    </div>
  )
}

// ── Customer row ──────────────────────────────────────────────────────
function CustomerRow({ customer, isOwner, onRecord, onBlacklist, defaultOpen }) {
  const { settings } = useApp()
  const currency = settings?.currency || 'KSh'
  const [open, setOpen] = useState(defaultOpen || false)

  const days         = daysUntil(customer.nextPromiseDate)
  const isUrgent     = days !== null && days <= 3
  const borderColor  = customer.blacklisted ? 'var(--danger)' : customer.overdue ? 'var(--danger)' : isUrgent ? 'var(--warning)' : customer.balance === 0 ? 'var(--success)' : 'var(--primary)'
  const headerBg     = open ? 'var(--primary-light)' : customer.blacklisted ? 'var(--danger-light)' : customer.overdue ? 'var(--orange-light)' : 'var(--bg-card)'

  return (
    <div style={{ borderRadius: 'var(--radius-lg)', border: `1px solid ${customer.blacklisted ? 'var(--danger-light)' : customer.overdue ? 'var(--warning-light)' : 'var(--border-soft)'}`, borderLeft: `4px solid ${borderColor}`, background: 'var(--bg-card)', boxShadow: 'var(--shadow-card)', overflow: 'hidden' }}>

      {/* ── Collapsed header — all key info visible ──────────────── */}
      <div
        onClick={() => setOpen(o => !o)}
        style={{ padding: '14px 18px', cursor: 'pointer', background: headerBg, transition: 'background 0.15s' }}
      >
        {/* Row 1: Avatar + Name + Status + Balance */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
          {/* Avatar */}
          <div style={{ width: 42, height: 42, borderRadius: '50%', background: customer.blacklisted ? 'var(--danger-light)' : customer.overdue ? 'var(--warning-light)' : 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: customer.blacklisted ? 'var(--danger)' : customer.overdue ? 'var(--danger)' : 'var(--primary)', fontWeight: 900, fontSize: 18, flexShrink: 0 }}>
            {customer.name?.charAt(0).toUpperCase()}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>{customer.name}</span>
              <StatusBadge customer={customer} />
            </div>
            {customer.blacklisted && customer.blacklistReason && (
              <div style={{ fontSize: 11, color: 'var(--danger)', fontWeight: 600, marginTop: 2 }}>
                Blacklisted: {customer.blacklistReason} · by {customer.blacklistedBy}
              </div>
            )}
          </div>

          {/* Balance — big and clear */}
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontSize: 20, fontWeight: 900, color: customer.balance === 0 ? 'var(--success-dark)' : customer.overdue ? 'var(--danger)' : 'var(--primary)', lineHeight: 1 }}>
              {currency} {customer.balance?.toLocaleString()}
            </div>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginTop: 2 }}>
              {customer.balance === 0 ? 'Settled' : 'Outstanding'}
            </div>
          </div>

          {/* Chevron */}
          <div style={{ color: 'var(--text-muted)', fontSize: 22, flexShrink: 0 }}>
            {open ? <MdExpandLess /> : <MdExpandMore />}
          </div>
        </div>

        {/* Row 2: All key details inline */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', paddingLeft: 54 }}>

          {/* Phone — most important for reminders */}
          {customer.phone ? (
            <a
              href={`tel:${customer.phone}`}
              onClick={e => e.stopPropagation()}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 13, fontWeight: 800, color: 'var(--primary)', textDecoration: 'none', padding: '3px 10px', borderRadius: 20, background: 'var(--primary-light)', border: '1px solid var(--primary-muted)' }}
            >
              <MdCall style={{ fontSize: 14 }} /> {customer.phone}
            </a>
          ) : (
            <span style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>No phone saved</span>
          )}

          {/* Store */}
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text-muted)' }}>
            <MdStore style={{ fontSize: 13 }} /> {customer.store}
          </span>

          {/* Last purchased */}
          {customer.lastSaleDate && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text-muted)' }}>
              <MdAccessTime style={{ fontSize: 13 }} /> Last bought: <strong>{timeAgo(customer.lastSaleDate)}</strong>
            </span>
          )}

          {/* Total sales count */}
          {customer.totalSales > 0 && (
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {customer.totalSales} credit sale{customer.totalSales !== 1 ? 's' : ''}
            </span>
          )}

          {/* Promise date — the most critical info for reminders */}
          {customer.nextPromiseDate ? (
            <PromisePill dateStr={customer.nextPromiseDate} size="lg" />
          ) : customer.balance > 0 ? (
            <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: 'var(--warning-light)', color: 'var(--badge-warning-text)' }}>
              ⚠️ No promise date set
            </span>
          ) : null}
        </div>
      </div>

      {/* Expanded detail */}
      {open && (
        <CustomerExpanded
          customerId={customer._id}
          customer={customer}
          onRecord={onRecord}
          onBlacklist={onBlacklist}
          isOwner={isOwner}
        />
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ══════════════════════════════════════════════════════════════════════
export default function Customers() {
  const { fetchCustomers, recordRepayment, blacklistCustomer, stores, currentUser, isOwner, settings } = useApp()
  const currency = settings?.currency || 'KSh'

  const [filtersOpen,  setFiltersOpen]  = useState(false)
  const [customers,    setCustomers]    = useState([])
  const [search,       setSearch]       = useState('')
  const [storeFilter,  setStoreFilter]  = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [loading,      setLoading]      = useState(false)
  const [showRepay, openRepay, closeRepay] = useHistoryModal('customer-repay')
  const [repayCust, setRepayCust] = useState(null)
  const [showBlk, openBlk, closeBlk] = useHistoryModal('customer-bl')
  const [blkCust, setBlkCust] = useState(null)
  const [repLoading,   setRepLoading]   = useState(false)
  const [blkLoading,   setBlkLoading]   = useState(false)
  const [toast,        setToast]        = useState(null)

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type }); setTimeout(() => setToast(null), 3500)
  }

  const load = useCallback(async () => {
    setLoading(true)
    const data = await fetchCustomers({
      store:       storeFilter || (isOwner ? '' : currentUser?.store),
      search,
      overdue:     statusFilter === 'overdue',
      blacklisted: statusFilter === 'blacklisted',
    })
    setCustomers(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [fetchCustomers, storeFilter, search, statusFilter, currentUser, isOwner])

  useEffect(() => {
    let active = true
    const t = setTimeout(() => { if (active) load() }, 300)
    return () => { active = false; clearTimeout(t) }
  }, [load])

  useEffect(() => { if (!showRepay) setRepayCust(null) }, [showRepay])
  useEffect(() => { if (!showBlk) setBlkCust(null) }, [showBlk])

  const handleRepayment = async (amount, notes) => {
    setRepLoading(true)
    const res = await recordRepayment(repayCust._id, amount, notes)
    setRepLoading(false)
    if (res.success) {
      closeRepay()
      showToast(`${currency} ${amount.toLocaleString()} recorded for ${repayCust.name}`)
      load()
    } else {
      showToast(res.message || 'Failed to record payment', 'error')
    }
  }

  const handleBlacklist = async (blacklisted, reason) => {
    setBlkLoading(true)
    const res = await blacklistCustomer(blkCust._id, blacklisted, reason)
    setBlkLoading(false)
    if (res.success) {
      closeBlk()
      showToast(blacklisted ? `${blkCust.name} blacklisted` : 'Blacklist removed')
      load()
    } else {
      showToast(res.message || 'Failed', 'error')
    }
  }

  const totalDebt        = customers.reduce((s, c) => s + (c.balance || 0), 0)
  const overdueCount     = customers.filter(c => c.overdue).length
  const blacklistedCount = customers.filter(c => c.blacklisted).length
  const activeCount      = customers.filter(c => c.balance > 0).length
  const dueSoonCount     = customers.filter(c => {
    const d = daysUntil(c.nextPromiseDate); return d !== null && d >= 0 && d <= 3
  }).length

  // Sort: overdue → due soon → active → settled → blacklisted
  const sorted = [...customers].sort((a, b) => {
    const rank = c => {
      if (c.overdue)       return 0
      const d = daysUntil(c.nextPromiseDate)
      if (d !== null && d <= 3 && d >= 0) return 1
      if (c.balance > 0)   return 2
      if (c.balance === 0) return 3
      if (c.blacklisted)   return 4
      return 5
    }
    return rank(a) - rank(b) || b.balance - a.balance
  })

  return (
    <div style={{ padding: '24px 28px 48px', background: 'var(--bg-page)', minHeight: '100%' }}>

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 9999, padding: '10px 18px', borderRadius: 'var(--radius-md)', background: toast.type === 'error' ? 'var(--danger)' : 'var(--success)', color: '#fff', fontWeight: 700, fontSize: 13, boxShadow: 'var(--shadow-dropdown)' }}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Debtor Tracker</h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
            Click any customer to see full credit history · Phone numbers are clickable to call directly
          </p>
        </div>
        <button
          className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex-shrink-0"
          style={{
            background: filtersOpen ? 'var(--primary)' : 'var(--bg-card)',
            color: filtersOpen ? '#fff' : 'var(--text-secondary)',
            border: '1px solid var(--border-medium)',
          }}
          onClick={() => setFiltersOpen(o => !o)}
        >
          <MdFilterList /> {filtersOpen ? 'Hide Filters' : 'Filters'}
        </button>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 18 }}>
        {[
          { label: 'Outstanding',  value: `${currency} ${totalDebt.toLocaleString()}`, icon: <MdTrendingDown />, color: 'var(--primary)',   bg: 'var(--primary-light)', border: 'var(--primary-muted)' },
          { label: 'Active',       value: activeCount,                          icon: <MdPeopleAlt />,   color: 'var(--primary)',   bg: 'var(--primary-light)', border: 'var(--primary-muted)' },
          { label: 'Due Soon',     value: dueSoonCount,                         icon: <MdCalendarToday />, color: dueSoonCount > 0 ? 'var(--warning-dark)' : 'var(--text-muted)', bg: dueSoonCount > 0 ? 'var(--warning-light)' : 'var(--bg-card)', border: dueSoonCount > 0 ? 'var(--warning)' : 'var(--border-soft)' },
          { label: 'Overdue',      value: overdueCount,                         icon: <MdWarning />,     color: overdueCount > 0 ? 'var(--danger)' : 'var(--text-muted)', bg: overdueCount > 0 ? 'var(--danger-light)' : 'var(--bg-card)', border: overdueCount > 0 ? 'var(--danger-light)' : 'var(--border-soft)' },
          { label: 'Blacklisted',  value: blacklistedCount,                     icon: <MdBlock />,       color: blacklistedCount > 0 ? 'var(--danger)' : 'var(--text-muted)', bg: blacklistedCount > 0 ? 'var(--danger-light)' : 'var(--bg-card)', border: blacklistedCount > 0 ? 'var(--danger-light)' : 'var(--border-soft)' },
        ].map(s => (
          <div key={s.label} style={{ background: s.bg, border: `1px solid ${s.border}`, borderRadius: 'var(--radius-lg)', padding: '14px 16px', boxShadow: 'var(--shadow-card)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <span style={{ fontSize: 16, color: s.color }}>{s.icon}</span>
              <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em', color: s.color }}>{s.label}</span>
            </div>
            <div style={{ fontSize: 22, fontWeight: 900, color: s.color, lineHeight: 1 }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className={`${s.filterRow}${filtersOpen ? '' : ' md:hidden'}`} style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-soft)', marginBottom: 16, boxShadow: 'var(--shadow-card)' }}>
        <div className={s.filterSearch}>
          <MdSearch style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: 18 }} />
          <input type="text" placeholder="Search name or phone..." value={search} onChange={e => setSearch(e.target.value)}
            style={{ width: '100%', paddingLeft: 34, paddingRight: search ? 32 : 12, paddingTop: 8, paddingBottom: 8, borderRadius: 'var(--radius-md)', border: '1px solid var(--border-medium)', background: 'var(--bg-muted)', fontSize: 13, color: 'var(--text-primary)', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
            onFocus={e => { e.target.style.borderColor = 'var(--primary)'; e.target.style.background = 'var(--bg-card)' }}
            onBlur={e => { e.target.style.borderColor = 'var(--border-medium)'; e.target.style.background = 'var(--bg-muted)' }}
          />
          {search && <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 18 }}><MdClose /></button>}
        </div>

        <div className={s.filterControls}>
          {isOwner && stores.length > 0 && (
            <select className={s.storeSelect} value={storeFilter} onChange={e => setStoreFilter(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-medium)', background: 'var(--bg-muted)', fontSize: 13, color: 'var(--text-primary)', outline: 'none', fontFamily: 'inherit' }}>
              <option value="">All Stores</option>
              {stores.map(st => <option key={st._id} value={st.name}>{st.name}</option>)}
            </select>
          )}
          <button className={s.refreshBtn} onClick={load} disabled={loading}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '8px 13px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-medium)', background: 'var(--bg-muted)', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'inherit' }}>
            <MdRefresh style={{ fontSize: 16 }} /> Refresh
          </button>
        </div>

        <div className={s.filterPills}>
          {[
            { value: 'all',         label: 'All'             },
            { value: 'overdue',     label: '⚠️ Overdue'      },
            { value: 'blacklisted', label: '🚫 Blacklisted'  },
          ].map(f => (
            <button key={f.value} className={s.filterPill} onClick={() => setStatusFilter(f.value)}
              style={{ padding: '6px 13px', borderRadius: 20, fontSize: 12, fontWeight: 700, border: `1px solid ${statusFilter === f.value ? 'var(--primary)' : 'var(--border-medium)'}`, background: statusFilter === f.value ? 'var(--primary)' : 'var(--bg-muted)', color: statusFilter === f.value ? '#fff' : 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'inherit' }}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Customer list */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)', fontSize: 13 }}>Loading customers...</div>
      ) : sorted.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-soft)' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>👥</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>No customers found</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', maxWidth: 340, margin: '0 auto', lineHeight: 1.6 }}>
            Credit customers appear automatically when a cashier makes a credit sale. Select "Credit" as payment method at checkout.
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {sorted.map(customer => (
            <CustomerRow
              key={customer._id}
              customer={customer}
              isOwner={isOwner}
              defaultOpen={customer.overdue || (daysUntil(customer.nextPromiseDate) !== null && daysUntil(customer.nextPromiseDate) <= 1)}
              onRecord={c => { setRepayCust(c); openRepay() }}
              onBlacklist={c => { setBlkCust(c); openBlk() }}
            />
          ))}
        </div>
      )}

      {showRepay && <RepaymentModal customer={repayCust} onClose={closeRepay} onSubmit={handleRepayment} loading={repLoading} />}
      {showBlk   && <BlacklistModal customer={blkCust}   onClose={closeBlk}  onSubmit={handleBlacklist}  loading={blkLoading} />}
    </div>
  )
}
