import { useState } from 'react'
import { useApp } from '@/context/AppContext'
import styles from '@/styles/Profile.module.css'
import { API_BASE_URL } from '@/config/api'
import { fmtQty } from '@/utils/utils'
import {
  MdPerson, MdLock, MdVisibility, MdVisibilityOff,
  MdCheckCircle, MdError, MdStorefront, MdBadge,
  MdCalendarToday, MdShield, MdKey, MdPointOfSale,
  MdTrendingUp, MdInventory, MdLockClock, MdAccessTime
} from 'react-icons/md'

// ── Role config ────────────────────────────────────────────────────────────
const ROLE_CONFIG = {
  owner:    { label: 'Owner',    color: 'var(--primary)',  bg: 'var(--primary-light)'  },
  manager:  { label: 'Manager',  color: 'var(--warning)',  bg: 'var(--warning-light)'  },
  cashier:  { label: 'Cashier',  color: 'var(--success)',  bg: 'var(--success-light)'  },
  employee: { label: 'Employee', color: 'var(--success)',  bg: 'var(--success-light)'  },
}

function Toast({ toast }) {
  if (!toast) return null
  const isSuccess = toast.type === 'success'
  return (
    <div
      className="flex items-center gap-2 px-4 py-3 rounded-xl mb-5 text-sm font-medium"
      style={isSuccess
        ? { background: 'var(--success-light)', color: 'var(--success-dark)', border: '1px solid var(--success)' }
        : { background: 'var(--danger-light)',  color: 'var(--danger-dark)',  border: '1px solid var(--danger)'  }
      }
    >
      {isSuccess ? <MdCheckCircle size={18} /> : <MdError size={18} />}
      {toast.text}
    </div>
  )
}

function PasswordInput({ value, onChange, placeholder, inputStyle, onFocus, onBlur }) {
  const [show, setShow] = useState(false)
  return (
    <div style={{ position: 'relative' }}>
      <MdLock style={{
        position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)',
        color: 'var(--text-muted)', fontSize: '16px', pointerEvents: 'none'
      }} />
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        onFocus={onFocus}
        onBlur={onBlur}
        style={{ ...inputStyle, paddingLeft: '36px', paddingRight: '40px' }}
      />
      <button
        type="button"
        onClick={() => setShow(s => !s)}
        style={{
          position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--text-muted)', display: 'flex', alignItems: 'center',
        }}
      >
        {show ? <MdVisibilityOff size={17} /> : <MdVisibility size={17} />}
      </button>
    </div>
  )
}

export default function Profile() {
  const {
    currentUser, isOwner, sales, today,
    hasClosedShiftToday, stores
  } = useApp()

  const [toast,           setToast]           = useState(null)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword,     setNewPassword]     = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [saving,          setSaving]          = useState(false)

  const roleConfig = ROLE_CONFIG[currentUser?.role] || ROLE_CONFIG.cashier
  const initial    = (currentUser?.fullname || currentUser?.username || 'U').charAt(0).toUpperCase()
  const joinedDate = currentUser?._id
    ? new Date(parseInt(currentUser._id.toString().substring(0, 8), 16) * 1000)
        .toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : 'Unknown'

  // ── Employee today stats ───────────────────────────────────────────
  const empName = currentUser?.fullname || currentUser?.username || ''
  const empTodaySales = sales?.filter(s => {
    const saleDate = new Date(s.date).toLocaleDateString('en-CA')
    return saleDate === today && s.cashier === empName && !s.returned && !s.voided
  }) || []

  const todayRevenue      = empTodaySales.reduce((sum, s) => sum + (s.total || 0), 0)
  const todayTransactions = empTodaySales.length
  const todayItems        = empTodaySales.reduce((sum, s) => sum + (s.items?.reduce((q, i) => q + i.qty, 0) || 0), 0)

  const alreadyClosed = hasClosedShiftToday?.() || false

  // ── Matched store details ──────────────────────────────────────────
  const matchedStore = stores?.find(st =>
    st._id === currentUser?.store || st.name === currentUser?.store
  )

  const showToast = (type, text) => {
    setToast({ type, text })
    setTimeout(() => setToast(null), 4000)
  }

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      showToast('error', 'Please fill in all password fields.')
      return
    }
    if (newPassword !== confirmPassword) {
      showToast('error', 'New passwords do not match.')
      return
    }
    if (newPassword.length < 6) {
      showToast('error', 'New password must be at least 6 characters.')
      return
    }
    if (currentPassword === newPassword) {
      showToast('error', 'New password must be different from your current password.')
      return
    }
    setSaving(true)
    try {
      const res  = await fetch(`${API_BASE_URL}/api/auth/change-password`, {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${currentUser?.token}` },
        body:    JSON.stringify({ currentPassword, newPassword }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        showToast('success', 'Password changed successfully.')
        setCurrentPassword(''); setNewPassword(''); setConfirmPassword('')
      } else {
        showToast('error', data.message || 'Failed to change password.')
      }
    } catch {
      showToast('error', 'Network error. Please try again.')
    }
    setSaving(false)
  }

  const inputStyle = {
    width: '100%', padding: '10px 12px', borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border-medium)', fontSize: '13px', outline: 'none',
    background: 'var(--bg-muted)', color: 'var(--text-primary)',
    boxSizing: 'border-box', transition: 'all 0.15s', fontFamily: 'inherit',
  }
  const onFocus = (e) => {
    e.target.style.borderColor = 'var(--primary)'
    e.target.style.boxShadow   = '0 0 0 3px var(--primary-light)'
    e.target.style.background  = 'var(--bg-card)'
  }
  const onBlur = (e) => {
    e.target.style.borderColor = 'var(--border-medium)'
    e.target.style.boxShadow   = 'none'
    e.target.style.background  = 'var(--bg-muted)'
  }
  const label = {
    fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)',
    marginBottom: '6px', display: 'block',
    textTransform: 'uppercase', letterSpacing: '0.06em',
  }

  // ── Shared identity card ───────────────────────────────────────────
  const identityCard = (
    <div style={{
      background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)',
      border: '1px solid var(--border-soft)', boxShadow: 'var(--shadow-card)',
      overflow: 'hidden',
    }}>
      {/* Color band */}
      <div style={{ height: '80px', background: roleConfig.color, position: 'relative' }}>
        <div style={{
          position: 'absolute', bottom: '-32px', left: '50%',
          transform: 'translateX(-50%)',
          width: '64px', height: '64px', borderRadius: '50%',
          background: roleConfig.color, border: '4px solid var(--bg-card)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '26px', fontWeight: '900', color: '#fff',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        }}>
          {initial}
        </div>
      </div>

      <div className="text-center" style={{ paddingTop: '44px', paddingBottom: '24px', paddingLeft: '24px', paddingRight: '24px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '4px' }}>
          {currentUser?.fullname || currentUser?.username || 'Staff Member'}
        </h2>
        <span style={{
          display: 'inline-block', fontSize: '11px', fontWeight: '800',
          textTransform: 'uppercase', letterSpacing: '0.1em',
          padding: '3px 12px', borderRadius: '20px',
          background: roleConfig.bg, color: roleConfig.color,
        }}>
          {roleConfig.label}
        </span>

        <div style={{ marginTop: '24px', textAlign: 'left', borderTop: '1px solid var(--border-soft)', paddingTop: '20px' }}>
          {[
            { icon: <MdBadge />,        label: 'Username',       value: currentUser?.username || '—', mono: true },
            { icon: <MdStorefront />,   label: 'Assigned Store', value: currentUser?.store || 'Not assigned' },
            { icon: <MdShield />,       label: 'Account Status', value: (
              <span style={{ color: 'var(--success-dark)', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'var(--success)', display: 'inline-block' }} />
                Active
              </span>
            )},
            { icon: <MdCalendarToday />, label: 'Member Since', value: joinedDate },
          ].map((row, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'flex-start', gap: '10px',
              padding: '10px 0',
              borderBottom: i < 3 ? '1px solid var(--border-soft)' : 'none',
            }}>
              <span style={{ color: 'var(--primary)', fontSize: '16px', flexShrink: 0, marginTop: '1px' }}>
                {row.icon}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>
                  {row.label}
                </div>
                <div style={{
                  fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)',
                  fontFamily: row.mono ? 'monospace' : 'inherit', wordBreak: 'break-all',
                }}>
                  {row.value}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )

  return (
    <div className="flex flex-col min-h-full md:h-full md:overflow-hidden" style={{ background: 'var(--bg-page)' }}>

      {/* ── Header ──────────────────────────────────────────────── */}
      <div
        className="flex-shrink-0 px-6 pt-6 pb-4"
        style={{ borderBottom: '1px solid var(--border-soft)', background: 'var(--bg-card)' }}
      >
        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>My Profile</h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
          Your account information and security settings
        </p>
      </div>

      {/* ── Content ─────────────────────────────────────────────── */}
      <div className="md:flex-1 md:overflow-y-auto px-6 py-6">

        <Toast toast={toast} />

        <div className={styles.grid2} style={{ alignItems: 'start' }}>

          {/* ── LEFT — Identity card (same for all roles) ─────── */}
          {identityCard}

          {/* ── RIGHT — Role-specific panel ───────────────────── */}
          {isOwner ? (

            /* ── OWNER — Change password ── */
            <div style={{
              background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-soft)', boxShadow: 'var(--shadow-card)',
              padding: '1.5rem',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.25rem' }}>
                <div style={{
                  width: '28px', height: '28px', borderRadius: 'var(--radius-sm)',
                  background: 'var(--primary-light)', color: 'var(--primary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '15px',
                }}>
                  <MdKey />
                </div>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Security</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '1px' }}>Password management</div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <span style={label}>Current Password</span>
                  <PasswordInput value={currentPassword} onChange={e => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password" inputStyle={inputStyle} onFocus={onFocus} onBlur={onBlur} />
                </div>
                <div>
                  <span style={label}>New Password</span>
                  <PasswordInput value={newPassword} onChange={e => setNewPassword(e.target.value)}
                    placeholder="At least 6 characters" inputStyle={inputStyle} onFocus={onFocus} onBlur={onBlur} />
                </div>
                <div>
                  <span style={label}>Confirm New Password</span>
                  <PasswordInput value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="Repeat new password" inputStyle={inputStyle} onFocus={onFocus} onBlur={onBlur} />
                </div>

                {newPassword && confirmPassword && (
                  <div style={{
                    fontSize: '12px', fontWeight: '600', padding: '8px 12px',
                    borderRadius: 'var(--radius-sm)',
                    background: newPassword === confirmPassword ? 'var(--success-light)' : 'var(--danger-light)',
                    color:      newPassword === confirmPassword ? 'var(--success-dark)'  : 'var(--danger-dark)',
                  }}>
                    {newPassword === confirmPassword ? '✓ Passwords match' : '✗ Passwords do not match'}
                  </div>
                )}

                <button
                  onClick={handleChangePassword}
                  disabled={saving}
                  style={{
                    background: saving ? 'var(--primary-muted)' : 'var(--primary)',
                    color: '#fff', border: 'none', borderRadius: 'var(--radius-md)',
                    padding: '11px', fontSize: '13px', fontWeight: '700',
                    cursor: saving ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                    transition: 'background 0.15s', marginTop: '4px',
                  }}
                  onMouseEnter={e => { if (!saving) e.currentTarget.style.background = 'var(--primary-dark)' }}
                  onMouseLeave={e => { if (!saving) e.currentTarget.style.background = saving ? 'var(--primary-muted)' : 'var(--primary)' }}
                >
                  <MdLock size={16} />
                  {saving ? 'Saving…' : 'Update Password'}
                </button>
              </div>

              {/* Security tips */}
              <div style={{
                marginTop: '20px', padding: '14px', borderRadius: 'var(--radius-md)',
                background: 'var(--info-light)', border: '1px solid var(--info)',
              }}>
                <p style={{ fontSize: '11px', fontWeight: '700', color: 'var(--info-dark)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Security Tips
                </p>
                {[
                  'Never share your login credentials',
                  'Always log out when leaving the terminal',
                  'Report suspicious activity to the owner',
                ].map((tip, i) => (
                  <p key={i} style={{ fontSize: '11px', color: 'var(--info-dark)', marginTop: '4px', display: 'flex', gap: '6px' }}>
                    <span style={{ flexShrink: 0 }}>•</span> {tip}
                  </p>
                ))}
              </div>
            </div>

          ) : (

            /* ── STAFF/MANAGER — Today's stats + shift ── */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

              {/* Today's performance */}
              <div style={{
                background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border-soft)', boxShadow: 'var(--shadow-card)',
                padding: '1.5rem',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.25rem' }}>
                  <div style={{
                    width: '28px', height: '28px', borderRadius: 'var(--radius-sm)',
                    background: 'var(--success-light)', color: 'var(--success)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '15px',
                  }}>
                    <MdTrendingUp />
                  </div>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      Today's Performance
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '1px' }}>{today}</div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '1.25rem' }}>
                  {[
                    { icon: <MdPointOfSale />,  label: 'Sales',         value: todayTransactions, color: 'var(--primary)' },
                    { icon: <MdInventory />,    label: 'Items Sold',    value: fmtQty(todayItems), color: 'var(--info)'    },
                    { icon: <MdTrendingUp />,   label: 'Revenue',       value: `KSh ${todayRevenue.toLocaleString()}`, color: 'var(--success)' },
                  ].map((stat, i) => (
                    <div key={i} style={{
                      padding: '12px', borderRadius: 'var(--radius-md)',
                      background: 'var(--bg-muted)', border: '1px solid var(--border-soft)',
                      textAlign: 'center',
                    }}>
                      <div style={{ color: stat.color, fontSize: '20px', marginBottom: '4px' }}>{stat.icon}</div>
                      <div style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text-primary)' }}>{stat.value}</div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: '600', marginTop: '2px', textTransform: 'uppercase' }}>{stat.label}</div>
                    </div>
                  ))}
                </div>

                {/* Shift status */}
                <div style={{
                  padding: '14px', borderRadius: 'var(--radius-md)',
                  background: alreadyClosed ? 'var(--success-light)' : 'var(--warning-light)',
                  border: `1px solid ${alreadyClosed ? 'var(--success)' : 'var(--warning)'}`,
                  display: 'flex', alignItems: 'center', gap: '10px',
                }}>
                  <MdLockClock style={{ fontSize: '20px', color: alreadyClosed ? 'var(--success-dark)' : 'var(--warning-dark)', flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: '700', color: alreadyClosed ? 'var(--success-dark)' : 'var(--warning-dark)' }}>
                      {alreadyClosed ? 'Shift Closed for Today' : 'Shift Still Open'}
                    </div>
                    <div style={{ fontSize: '11px', color: alreadyClosed ? 'var(--success-dark)' : 'var(--warning-dark)', opacity: 0.8, marginTop: '2px' }}>
                      {alreadyClosed
                        ? 'Your shift has been closed and reported to the owner.'
                        : 'Use the Close Shift button in the top navigation bar to close your shift.'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Store details */}
              <div style={{
                background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border-soft)', boxShadow: 'var(--shadow-card)',
                padding: '1.5rem',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.25rem' }}>
                  <div style={{
                    width: '28px', height: '28px', borderRadius: 'var(--radius-sm)',
                    background: 'var(--primary-light)', color: 'var(--primary)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '15px',
                  }}>
                    <MdStorefront />
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Store Details
                  </div>
                </div>

                {[
                  { label: 'Store Name',     value: matchedStore?.name     || currentUser?.store || 'Not assigned' },
                  { label: 'Location',       value: matchedStore?.location || '—' },
                  { label: 'Store Phone',    value: matchedStore?.phone    || '—' },
                  { label: 'Working Hours',  value: <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><MdAccessTime style={{ fontSize: '13px' }} /> Active Terminal</span> },
                ].map((row, i, arr) => (
                  <div key={i} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '10px 0',
                    borderBottom: i < arr.length - 1 ? '1px solid var(--border-soft)' : 'none',
                  }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600' }}>{row.label}</span>
                    <span style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: '600', textAlign: 'right', maxWidth: '60%' }}>{row.value}</span>
                  </div>
                ))}
              </div>

              {/* Password note */}
              <div style={{
                padding: '14px', borderRadius: 'var(--radius-md)',
                background: 'var(--bg-muted)', border: '1px solid var(--border-soft)',
                display: 'flex', alignItems: 'flex-start', gap: '10px',
              }}>
                <MdShield style={{ color: 'var(--primary)', fontSize: '18px', flexShrink: 0, marginTop: '1px' }} />
                <div>
                  <p style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '3px' }}>
                    Password Reset
                  </p>
                  <p style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                    Contact your store owner or manager to reset your password.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

