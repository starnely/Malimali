import { useState, useEffect } from 'react'
import { MdLock, MdPerson, MdVisibility, MdVisibilityOff, MdClose, MdStore, MdTrendingUp, MdInventory, MdPeople } from 'react-icons/md'
import { useApp } from '@/context/AppContext'
import { useSocketActions } from '@/context/SocketContext'
import styles from '@/styles/Login.module.css'

const API_BASE_URL = 'http://localhost:5000'

// ── Animated counter ──────────────────────────────────────────────────
function Counter({ target, suffix = '' }) {
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (target <= 0) return
    const step = Math.ceil(target / 40)
    let current = 0
    let cancelled = false
    const tick = () => {
      if (cancelled) return
      current = Math.min(current + step, target)
      setCount(current)
      if (current < target) setTimeout(tick, 30)
    }
    const t = setTimeout(tick, 30)
    return () => { cancelled = true; clearTimeout(t) }
  }, [target])
  return <span>{count.toLocaleString()}{suffix}</span>
}

export default function Login({ onLogin }) {
  const { login, settings } = useApp()
  const { refreshSocket } = useSocketActions()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [imgError, setImgError] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const expired = localStorage.getItem('pos_session_expired')
    const t = setTimeout(() => {
      if (expired) {
        localStorage.removeItem('pos_session_expired')
        setError('session_expired')
      }
      setMounted(true)
    }, 50)
    return () => clearTimeout(t)
  }, [])

  const handleLogin = async () => {
    if (!username || !password) { setError('Please enter username and password'); return }
    setLoading(true); setError('')
    const result = await login(username, password)
    setLoading(false)
    if (result.success) { refreshSocket(); if (onLogin) onLogin() }
    else setError('Invalid credentials or account suspended')
  }

  const getLogoSrc = (logoPath) => {
    if (!logoPath) return null
    if (logoPath.startsWith('http')) return logoPath
    return `${API_BASE_URL}${logoPath.startsWith('/') ? logoPath : `/${logoPath}`}`
  }

  const companyName = settings?.companyName || settings?.businessName || 'POS System'
  const location = settings?.location || 'Kenya'

  const stats = [
    { icon: <MdTrendingUp />, label: 'Sales Tracked', value: 24000, suffix: '+' },
    { icon: <MdInventory />, label: 'Products Managed', value: 1200, suffix: '+' },
    { icon: <MdPeople />, label: 'Staff Managed', value: 50, suffix: '+' },
    { icon: <MdStore />, label: 'Stores Supported', value: 10, suffix: '+' },
  ]

  return (
    <>
      {/* ── Full page split layout ────────────────────────────────── */}
      <div style={{
        minHeight: '100vh', display: 'flex',
        fontFamily: "'DM Sans', system-ui, sans-serif",
      }}>

        {/* ── LEFT — brand panel ──────────────────────────────────── */}
        <div style={{
          flex: '0 0 52%',
          background: `linear-gradient(145deg, var(--sidebar-bg) 0%, var(--primary) 60%, var(--primary-dark) 100%)`,
          display: 'flex', flexDirection: 'column', justifyContent: 'center',
          padding: '60px 64px', position: 'relative', overflow: 'hidden',
        }}>
          {/* Decorative circles */}
          <div style={{ position: 'absolute', top: -80, right: -80, width: 320, height: 320, borderRadius: '50%', background: 'rgba(255,255,255,0.04)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', bottom: -60, left: -60, width: 240, height: 240, borderRadius: '50%', background: 'rgba(255,255,255,0.04)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', top: '40%', right: '10%', width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,255,255,0.03)', pointerEvents: 'none' }} />

          {/* Logo + company */}
          <div style={{
            opacity: mounted ? 1 : 0, transform: mounted ? 'translateY(0)' : 'translateY(20px)',
            transition: 'opacity 0.6s ease, transform 0.6s ease', marginBottom: 48,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
              <div className={styles.logoWrap} style={{ width: 56, height: 56, borderRadius: 16, flexShrink: 0 }}>
                {settings?.logo && !imgError ? (
                  <img src={getLogoSrc(settings.logo)} alt="Logo" onError={() => setImgError(true)} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 4 }} />
                ) : (
                  <span style={{ fontSize: 22, fontWeight: 900, color: '#fff' }}>{companyName.charAt(0)}</span>
                )}
              </div>
              <div>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#fff', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
                  {companyName}
                </div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 3, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <MdStore style={{ fontSize: 12 }} /> {location}
                </div>
              </div>
            </div>

            <h1 style={{ fontSize: 38, fontWeight: 900, color: '#fff', lineHeight: 1.15, letterSpacing: '-0.03em', margin: '0 0 14px' }}>
              Smart POS for<br />
              <span style={{ color: 'rgba(255,255,255,0.5)' }}>Kenyan Business</span>
            </h1>
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', lineHeight: 1.7, margin: 0, maxWidth: 360 }}>
              Manage sales, inventory, staff, suppliers and credit customers — all from one place.
            </p>
          </div>

          {/* Animated stats grid */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12,
            opacity: mounted ? 1 : 0, transform: mounted ? 'translateY(0)' : 'translateY(20px)',
            transition: 'opacity 0.7s ease 0.15s, transform 0.7s ease 0.15s',
          }}>
            {stats.map((s, i) => (
              <div key={i} style={{
                background: 'rgba(255,255,255,0.07)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 'var(--radius-lg)', padding: '16px 18px',
                backdropFilter: 'blur(8px)',
              }}>
                <div style={{ fontSize: 20, color: 'rgba(255,255,255,0.45)', marginBottom: 6 }}>{s.icon}</div>
                <div style={{ fontSize: 24, fontWeight: 900, color: '#fff', letterSpacing: '-0.02em', lineHeight: 1 }}>
                  {mounted ? <Counter target={s.value} suffix={s.suffix} /> : '0'}
                </div>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.35)', marginTop: 4 }}>
                  {s.label}
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div style={{
            marginTop: 44, fontSize: 10, color: 'rgba(255,255,255,0.25)',
            fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
            opacity: mounted ? 1 : 0, transition: 'opacity 0.8s ease 0.3s',
          }}>
            StanTech POS v3.0. All rights reserved.
          </div>
        </div>

        {/* ── RIGHT — form panel ───────────────────────────────────── */}
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          padding: '40px 48px', background: 'var(--bg-page)',
        }}>
          <div style={{
            width: '100%', maxWidth: 400,
            opacity: mounted ? 1 : 0, transform: mounted ? 'translateX(0)' : 'translateX(20px)',
            transition: 'opacity 0.6s ease 0.1s, transform 0.6s ease 0.1s',
          }}>

            {/* Welcome heading */}
            <div style={{ marginBottom: 32 }}>
              <h2 style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.02em' }}>
                Welcome back 👋
              </h2>
              <p style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 6, margin: '6px 0 0' }}>
                Sign in to continue to {companyName}
              </p>
            </div>

            {/* Session expired banner */}
            {error === 'session_expired' && (
              <div style={{ padding: '11px 14px', borderRadius: 'var(--radius-md)', background: 'var(--warning-light)', border: '1px solid var(--warning)', fontSize: 13, color: 'var(--warning-dark)', fontWeight: 600, marginBottom: 20 }}>
                ⏰ Your session expired. Please log in again.
              </div>
            )}

            {/* Username */}
            <div style={{ marginBottom: 14 }}>
              <label className={styles.label} style={{ color: 'var(--text-muted)', marginBottom: 7, display: 'block' }}>Username</label>
              <div className={styles.inputWrap}>
                <MdPerson className={styles.inputIcon} style={{ color: 'var(--text-muted)' }} />
                <input
                  className={styles.input}
                  style={{
                    background: 'var(--bg-card)',
                    border: '1.5px solid var(--border-medium)',
                    color: 'var(--text-primary)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: 14,
                  }}
                  placeholder="Enter your username"
                  value={username}
                  onChange={e => { setUsername(e.target.value); if (error !== 'session_expired') setError('') }}
                  onKeyDown={e => e.key === 'Enter' && handleLogin()}
                  onFocus={e => { e.target.style.borderColor = 'var(--primary)'; e.target.style.boxShadow = '0 0 0 3px var(--primary-light)' }}
                  onBlur={e => { e.target.style.borderColor = 'var(--border-medium)'; e.target.style.boxShadow = 'none' }}
                  autoComplete="username"
                />
              </div>
            </div>

            {/* Password */}
            <div style={{ marginBottom: 10 }}>
              <label className={styles.label} style={{ color: 'var(--text-muted)', marginBottom: 7, display: 'block' }}>Password</label>
              <div className={styles.inputWrap}>
                <MdLock className={styles.inputIcon} style={{ color: 'var(--text-muted)' }} />
                <input
                  className={styles.input}
                  style={{
                    background: 'var(--bg-card)',
                    border: '1.5px solid var(--border-medium)',
                    color: 'var(--text-primary)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: 14,
                  }}
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={password}
                  onChange={e => { setPassword(e.target.value); if (error !== 'session_expired') setError('') }}
                  onKeyDown={e => e.key === 'Enter' && handleLogin()}
                  onFocus={e => { e.target.style.borderColor = 'var(--primary)'; e.target.style.boxShadow = '0 0 0 3px var(--primary-light)' }}
                  onBlur={e => { e.target.style.borderColor = 'var(--border-medium)'; e.target.style.boxShadow = 'none' }}
                  autoComplete="current-password"
                />
                <button className={styles.eyeBtn} style={{ color: 'var(--text-muted)' }} onClick={() => setShowPassword(v => !v)} type="button">
                  {showPassword ? <MdVisibilityOff /> : <MdVisibility />}
                </button>
              </div>
            </div>

            {/* Forgot */}
            <div style={{ textAlign: 'right', marginBottom: 24 }}>
              <button className={styles.forgotBtn} onClick={() => setShowHelp(true)} type="button"
                style={{ color: 'var(--primary)', fontSize: 13 }}>
                Forgot credentials?
              </button>
            </div>

            {/* Error */}
            {error && error !== 'session_expired' && (
              <div className={styles.errorBox} style={{
                background: 'var(--danger-light)',
                border: '1px solid var(--danger)',
                color: 'var(--danger-dark)',
                borderRadius: 'var(--radius-md)',
                marginBottom: 16,
              }}>
                ❌ {error}
              </div>
            )}

            {/* Sign In button */}
            <button
              className={styles.loginBtn}
              onClick={handleLogin}
              disabled={loading}
              type="button"
              style={{
                background: `linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%)`,
                boxShadow: '0 4px 16px rgba(30,95,165,0.35)',
                borderRadius: 'var(--radius-md)',
                fontSize: 15, padding: '14px',
              }}
            >
              {loading ? (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <span style={{ width: 15, height: 15, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} />
                  Signing in...
                </span>
              ) : 'Sign In →'}
            </button>

            {/* Footer brand */}
            <p className={styles.brand} style={{ color: 'var(--text-muted)', marginTop: 28, opacity: 0.6 }}>
              POS System · Secure Access · v3.0
            </p>
          </div>
        </div>
      </div>

      {/* ── Help / Recovery Modal ─────────────────────────────────── */}
      {showHelp && (
        <div className={styles.modalBackdrop}>
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-soft)',
            borderRadius: 'var(--radius-xl)',
            width: '100%', maxWidth: 380,
            boxShadow: 'var(--shadow-dropdown)',
            overflow: 'hidden',
          }}>
            {/* Header */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-soft)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-muted)' }}>
              <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)' }}>Account Recovery</span>
              <button onClick={() => setShowHelp(false)} type="button"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 22, display: 'flex', alignItems: 'center', padding: 0 }}>
                <MdClose />
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: '24px' }}>
              <div style={{ width: 52, height: 52, borderRadius: 'var(--radius-md)', background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, marginBottom: 16 }}>
                🔐
              </div>
              <h3 style={{ fontSize: 17, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 10px' }}>
                Contact Your Manager
              </h3>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.7, margin: '0 0 16px' }}>
                For security, staff credentials are managed exclusively by the store owner or manager. Please contact them directly to reset your username or password.
              </p>
              <div style={{ padding: '12px 14px', borderRadius: 'var(--radius-md)', background: 'var(--bg-muted)', border: '1px solid var(--border-soft)', fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 20 }}>
                <strong style={{ color: 'var(--text-primary)' }}>Owner / Manager</strong> can reset via:<br />
                Settings → Staff Management → Edit Staff
              </div>
              <button
                onClick={() => setShowHelp(false)}
                className={styles.loginBtn}
                type="button"
                style={{
                  background: `linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%)`,
                  borderRadius: 'var(--radius-md)',
                }}
              >
                Got it, back to login
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </>
  )
}
