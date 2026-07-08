import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { API_BASE_URL } from '@/config/api'
import { MdVisibility, MdVisibilityOff, MdErrorOutline } from 'react-icons/md'
import AuthLayout from '@/components/shared/AuthLayout'
import styles from '@/styles/SetupWizard.module.css'

// Password rules — same as AppContext.validatePassword but shown to user early
const PASS_RULES = [
  { test: v => v.length >= 6,   label: 'At least 6 characters' },
  { test: v => /[A-Z]/.test(v), label: 'One uppercase letter (A–Z)' },
  { test: v => /[0-9]/.test(v), label: 'One number (0–9)' },
]

const SetupWizard = () => {
  const navigate  = useNavigate()
  const location  = useLocation()
  const step      = location.state?.setupStep ?? 1

  const [loading,    setLoading]    = useState(false)
  const [uiError,    setUiError]    = useState('')
  const [storeError, setStoreError] = useState('')
  // Cached token after successful initialize + login; used for store-creation retry
  const [wizardToken, setWizardToken] = useState(null)

  const [showPassword,        setShowPassword]        = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [confirmPassword,     setConfirmPassword]     = useState('')

  const [formData, setFormData] = useState({
    // Step 1 — Business
    companyName: '', phone: '', email: '', location: '', logo: null,
    // Step 2 — Admin
    ownerName: '', ownerEmail: '', ownerPassword: '',
    // Step 3 — Store
    storeName: '', storeLocation: '', storePhone: '',
    // Step 4 — Activate
    activationCode: '',
  })

  const handleChange = (e) => {
    const { name, value, files } = e.target
    setFormData(prev => ({ ...prev, [name]: files && files[0] ? files[0] : files ? null : value }))
    if (uiError) setUiError('')
  }

  // Live password requirement checks (shown as checklist in Step 2)
  const passChecks = PASS_RULES.map(r => ({ label: r.label, ok: r.test(formData.ownerPassword) }))
  const passValid  = passChecks.every(c => c.ok)

  // ── Step navigation / validation ───────────────────────────────────
  const handleStepNavigation = (e) => {
    e.preventDefault()
    setUiError('')

    if (step === 1) {
      navigate(location.pathname, { state: { ...location.state, setupStep: 2 } })

    } else if (step === 2) {
      const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
      if (!emailRegex.test(formData.ownerEmail)) {
        setUiError('Please provide a valid email address (e.g., name@domain.com).')
        return
      }
      if (!passValid) {
        setUiError('Please meet all password requirements shown below the password field.')
        return
      }
      if (formData.ownerPassword !== confirmPassword) {
        setUiError('Password confirmation mismatch. Please check your entries.')
        return
      }
      navigate(location.pathname, { state: { ...location.state, setupStep: 3 } })

    } else if (step === 3) {
      if (!formData.storeName?.trim()) {
        setUiError('Store name is required.')
        return
      }
      navigate(location.pathname, { state: { ...location.state, setupStep: 4 } })

    } else if (step === 4) {
      handleFinalSubmit()
    }
  }

  // ── Store creation (used both on first attempt and on retry) ───────
  const createStore = async (token) => {
    try {
      const res  = await fetch(`${API_BASE_URL}/api/stores`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name:     formData.storeName.trim(),
          location: formData.storeLocation?.trim() || '',
          phone:    formData.storePhone?.trim()    || '',
        }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        window.location.href = '/login'
      } else {
        setStoreError(data.message || 'Store creation failed.')
        setLoading(false)
      }
    } catch {
      setStoreError('Store creation failed — could not reach the server.')
      setLoading(false)
    }
  }

  // ── Final submit: initialize → login → create store ────────────────
  const handleFinalSubmit = async () => {
    // Retry path: initialize already succeeded, just retry store creation
    if (wizardToken) {
      setLoading(true)
      setStoreError('')
      await createStore(wizardToken)
      return
    }

    setLoading(true)
    setUiError('')

    // Build multipart FormData for initialize — exclude the store-only fields
    const STORE_KEYS = new Set(['storeName', 'storeLocation', 'storePhone'])
    const initData   = new FormData()
    Object.entries(formData).forEach(([key, val]) => {
      if (!STORE_KEYS.has(key) && val !== null && val !== undefined) {
        initData.append(key, val)
      }
    })

    // 1. Create Setting doc + owner user
    // Called directly (not via AppContext.setupOwner) so that setIsSetupComplete
    // is never triggered mid-flow — calling it would unmount this component
    // before store creation finishes and wipe any error state we'd want to show.
    try {
      const res  = await fetch(`${API_BASE_URL}/api/setup/initialize`, { method: 'POST', body: initData })
      const data = await res.json()
      if (!res.ok || !data.success) {
        setUiError(data.message || 'Setup initialization failed.')
        setLoading(false)
        return
      }
    } catch {
      setUiError('Could not connect to the server during setup. Check your network and try again.')
      setLoading(false)
      return
    }

    // 2. Log in with the newly created owner to get a JWT
    // (username = ownerEmail, per setup/initialize's User creation at line 152)
    let token = null
    try {
      const res  = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ username: formData.ownerEmail, password: formData.ownerPassword }),
      })
      const data = await res.json()
      if (data.success) token = data.token
    } catch {}

    if (!token) {
      // Initialize succeeded but auto-login failed — redirect anyway; store
      // can be added from Settings after the owner logs in manually.
      window.location.href = '/login'
      return
    }

    // Cache token in state BEFORE the async createStore await so that if
    // store creation fails and the component re-renders, the retry path has it.
    setWizardToken(token)

    // 3. Create the first store
    await createStore(token)
  }

  // ── Style helpers ───────────────────────────────────────────────────
  const inputBase = {
    width: '100%', padding: '10px 16px',
    background: 'var(--bg-muted)', border: '1px solid var(--border-medium)',
    borderRadius: 'var(--radius-md)', outline: 'none', transition: 'all 0.15s',
    fontSize: '13px', color: 'var(--text-primary)', boxSizing: 'border-box',
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
  const getConfirmStyle = () => {
    if (!confirmPassword) return {}
    return formData.ownerPassword === confirmPassword
      ? { borderColor: 'var(--success)', background: 'var(--success-light)' }
      : { borderColor: 'var(--danger)',  background: 'var(--danger-light)'  }
  }

  const stepLabels = ['Business', 'Admin', 'Store', 'Activate']
  const heroPills  = [
    { label: 'Business details', icon: '🏪' },
    { label: 'Admin account',    icon: '🔐' },
    { label: 'First store',      icon: '🏬' },
    { label: 'Activation',       icon: '🔑' },
  ]

  return (
    <AuthLayout>
      <div
        className={`flex flex-col w-full max-w-lg rounded-2xl overflow-hidden shadow-xl border bg-white ${styles.card}`}
        style={{ borderColor: 'var(--border-soft)' }}
      >

        {/* ── Hero Banner ─────────────────────────────────────── */}
        <div className="px-6 pt-6 pb-5 flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%)' }}>
          <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-4"
            style={{ background: 'rgba(255,255,255,0.2)' }}>
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M9 17.25v1.007a3 3 0 0 1-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0 1 15 18.257V17.25m6-12V15a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 15V5.25m18 0A2.25 2.25 0 0 0 18.75 3H5.25A2.25 2.25 0 0 0 3 5.25m18 0H3" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-white leading-snug">Welcome to your POS setup</h1>
          <p className="text-sm mt-1.5 leading-relaxed" style={{ color: 'rgba(255,255,255,0.75)' }}>
            Let's get your workspace ready in just a few steps.
          </p>
          <div className="flex flex-wrap gap-2 mt-4">
            {heroPills.map(({ label, icon }) => (
              <span key={label} className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium"
                style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.9)' }}>
                <span>{icon}</span>{label}
              </span>
            ))}
          </div>
        </div>

        {/* ── Step Progress — 4 bars ──────────────────────────── */}
        <div className="px-6 pt-4 pb-3 flex-shrink-0"
          style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border-soft)' }}>
          <div className="flex gap-2 mb-2">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-1 flex-1 rounded-full transition-all"
                style={{ background: step >= i ? 'var(--primary)' : 'var(--border-medium)' }} />
            ))}
          </div>
          <div className="flex justify-between">
            {stepLabels.map((lbl, i) => (
              <span key={lbl} className="text-[11px] font-medium uppercase tracking-wider transition-colors"
                style={{ color: step === i + 1 ? 'var(--primary)' : step > i + 1 ? 'var(--text-muted)' : 'var(--border-medium)' }}>
                {lbl}
              </span>
            ))}
          </div>
        </div>

        {/* ── Scrollable Form Body ────────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-6" style={{ background: 'var(--bg-card)' }}>

          {uiError && (
            <div className="mb-5 flex items-start gap-2.5 p-3.5 rounded-xl text-xs font-medium"
              style={{ background: 'var(--danger-light)', border: '1px solid var(--danger)', color: 'var(--badge-danger-text)' }}>
              <MdErrorOutline className="flex-shrink-0 mt-0.5" size={16} />
              <span>{uiError}</span>
            </div>
          )}

          <form onSubmit={handleStepNavigation}>

            {/* ═══ STEP 1 — Business ═══════════════════════════ */}
            {step === 1 && (
              <div className="space-y-4">
                <div className="mb-5">
                  <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Tell us about your business</h2>
                  <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>This will appear across your point of sale interface.</p>
                </div>
                {[
                  { name: 'companyName', label: 'Company name *', placeholder: 'e.g. Maison Café',       required: true },
                  { name: 'phone',       label: 'Business phone',  placeholder: '+254 XX XXX XXX' },
                  { name: 'email',       label: 'Business email',  placeholder: 'info@company.com', type: 'email' },
                  { name: 'location',    label: 'Address / city',  placeholder: 'Nairobi, Kenya' },
                ].map(f => (
                  <div key={f.name} className="space-y-1">
                    <label className="text-xs font-semibold ml-0.5" style={{ color: 'var(--text-muted)' }}>{f.label}</label>
                    <input name={f.name} type={f.type || 'text'} value={formData[f.name]}
                      placeholder={f.placeholder} onChange={handleChange}
                      style={inputBase} onFocus={onFocus} onBlur={onBlur} required={f.required} />
                  </div>
                ))}
                <div className="space-y-1">
                  <label className="text-xs font-semibold ml-0.5" style={{ color: 'var(--text-muted)' }}>Business logo</label>
                  <div className="p-5 text-center rounded-xl transition-all"
                    style={{ border: '2px dashed var(--border-medium)', background: 'var(--bg-muted)' }}>
                    <div className="text-2xl mb-1">🖼️</div>
                    <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>PNG, JPG or SVG recommended</p>
                    <input name="logo" type="file" accept="image/*" onChange={handleChange}
                      className="text-xs file:mr-3 file:py-1.5 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold cursor-pointer" />
                  </div>
                </div>
                <button type="submit" className={styles.btnPrimary}>
                  Continue
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                  </svg>
                </button>
              </div>
            )}

            {/* ═══ STEP 2 — Admin ══════════════════════════════ */}
            {step === 2 && (
              <div className="space-y-4">
                <div className="mb-5">
                  <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Create administrator account</h2>
                  <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>This will be the primary owner account for the system.</p>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold ml-0.5" style={{ color: 'var(--text-muted)' }}>Full name *</label>
                  <input name="ownerName" value={formData.ownerName} placeholder="Your full name"
                    onChange={handleChange} style={inputBase} onFocus={onFocus} onBlur={onBlur} required />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold ml-0.5" style={{ color: 'var(--text-muted)' }}>Email address *</label>
                  <input name="ownerEmail" type="text" value={formData.ownerEmail} placeholder="owner@company.com"
                    onChange={handleChange} style={inputBase} onFocus={onFocus} onBlur={onBlur} required />
                </div>

                {/* Password + live requirement checklist */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold ml-0.5" style={{ color: 'var(--text-muted)' }}>Password *</label>
                  <div className="relative">
                    <input name="ownerPassword" type={showPassword ? 'text' : 'password'}
                      value={formData.ownerPassword}
                      placeholder="Min. 6 chars · 1 uppercase · 1 digit"
                      onChange={handleChange}
                      style={{ ...inputBase, paddingRight: '44px' }}
                      onFocus={onFocus} onBlur={onBlur} required />
                    <button type="button" tabIndex="-1" onClick={() => setShowPassword(v => !v)}
                      className={`absolute right-3.5 top-1/2 -translate-y-1/2 ${styles.visBtn}`}>
                      {showPassword ? <MdVisibilityOff size={19} /> : <MdVisibility size={19} />}
                    </button>
                  </div>
                  {/* Checklist appears as soon as the user starts typing */}
                  {formData.ownerPassword && (
                    <div className="mt-2 space-y-1 px-1">
                      {passChecks.map(({ ok, label }) => (
                        <div key={label} className="flex items-center gap-2 text-[11px] font-semibold">
                          <span style={{ color: ok ? 'var(--success)' : 'var(--border-medium)', minWidth: 12 }}>
                            {ok ? '✓' : '○'}
                          </span>
                          <span style={{ color: ok ? 'var(--success-dark)' : 'var(--text-muted)' }}>
                            {label}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between items-center ml-0.5">
                    <label className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Confirm password *</label>
                    {confirmPassword && (
                      <span className="text-[10px] font-bold uppercase tracking-wider"
                        style={{ color: formData.ownerPassword === confirmPassword ? 'var(--success-dark)' : 'var(--danger)' }}>
                        {formData.ownerPassword === confirmPassword ? '✓ Match' : '✗ Mismatch'}
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <input type={showConfirmPassword ? 'text' : 'password'} value={confirmPassword}
                      placeholder="Re-type your password"
                      onChange={e => { setConfirmPassword(e.target.value); if (uiError) setUiError('') }}
                      style={{ ...inputBase, paddingRight: '44px', ...getConfirmStyle() }}
                      onFocus={onFocus} onBlur={onBlur} required />
                    <button type="button" tabIndex="-1" onClick={() => setShowConfirmPassword(v => !v)}
                      className={`absolute right-3.5 top-1/2 -translate-y-1/2 ${styles.visBtn}`}>
                      {showConfirmPassword ? <MdVisibilityOff size={19} /> : <MdVisibility size={19} />}
                    </button>
                  </div>
                </div>

                <div className="flex gap-3 pt-1">
                  <button type="button" onClick={() => navigate(-1)} className={styles.btnSecondary} style={{ width: '33%' }}>Back</button>
                  <button type="submit" className={styles.btnPrimary} style={{ width: '67%' }}>Next step</button>
                </div>
              </div>
            )}

            {/* ═══ STEP 3 — First Store ════════════════════════ */}
            {step === 3 && (
              <div className="space-y-4">
                <div className="mb-5">
                  <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Set up your first store</h2>
                  <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    Staff, products, and sales are all linked to a store. You can add more stores later from Settings.
                  </p>
                </div>
                {[
                  { name: 'storeName',     label: 'Store name *', placeholder: 'e.g. Main Branch',         required: true },
                  { name: 'storeLocation', label: 'Location',     placeholder: 'e.g. Nairobi CBD, Kenya' },
                  { name: 'storePhone',    label: 'Store phone',  placeholder: '+254 XX XXX XXX' },
                ].map(f => (
                  <div key={f.name} className="space-y-1">
                    <label className="text-xs font-semibold ml-0.5" style={{ color: 'var(--text-muted)' }}>{f.label}</label>
                    <input name={f.name} type="text" value={formData[f.name]}
                      placeholder={f.placeholder} onChange={handleChange}
                      style={inputBase} onFocus={onFocus} onBlur={onBlur} required={f.required} />
                  </div>
                ))}
                <div className="flex gap-3 pt-1">
                  <button type="button" onClick={() => navigate(-1)} className={styles.btnSecondary} style={{ width: '33%' }}>Back</button>
                  <button type="submit" className={styles.btnPrimary} style={{ width: '67%' }}>Next step</button>
                </div>
              </div>
            )}

            {/* ═══ STEP 4 — Activate (normal state) ═══════════ */}
            {step === 4 && !wizardToken && (
              <div className="space-y-4 text-center">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-1"
                  style={{ background: 'var(--success-light)' }}>
                  <span className="text-3xl">🚀</span>
                </div>
                <div>
                  <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Activate your license</h2>
                  <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                    Enter your license key to complete setup and launch your workspace.
                  </p>
                </div>
                <input name="activationCode" value={formData.activationCode}
                  placeholder="XXXX-XXXX-XXXX" onChange={handleChange}
                  style={{ ...inputBase, textAlign: 'center', letterSpacing: '0.25em', fontFamily: 'monospace', textTransform: 'uppercase' }}
                  onFocus={onFocus} onBlur={onBlur} required />
                <div className="flex gap-3 pt-1">
                  <button type="button" disabled={loading} onClick={() => navigate(-1)}
                    className={styles.btnSecondary} style={{ width: '33%' }}>Back</button>
                  <button type="submit" disabled={loading} className={styles.btnSuccess} style={{ width: '67%' }}>
                    {loading
                      ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto" />
                      : <>Activate system ✓</>}
                  </button>
                </div>
              </div>
            )}

            {/* ═══ STEP 4 — Creating store (in-progress) ═══════ */}
            {step === 4 && wizardToken && !storeError && (
              <div className="py-10 text-center space-y-4">
                <div className="w-12 h-12 border-4 rounded-full animate-spin mx-auto"
                  style={{ borderColor: 'var(--primary)', borderTopColor: 'transparent' }} />
                <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Creating your first store…</p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Almost done — hang tight.</p>
              </div>
            )}

            {/* ═══ STEP 4 — Store creation failed (retry) ══════ */}
            {step === 4 && wizardToken && storeError && (
              <div className="space-y-4">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto"
                  style={{ background: 'var(--warning-light)' }}>
                  <span className="text-3xl">🏬</span>
                </div>
                <div className="text-center">
                  <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Almost there</h2>
                  <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                    Your account and license are active — but the first store could not be created.
                  </p>
                </div>
                <div className="flex items-start gap-2.5 p-3.5 rounded-xl text-xs font-medium"
                  style={{ background: 'var(--danger-light)', border: '1px solid var(--danger)', color: 'var(--badge-danger-text)' }}>
                  <MdErrorOutline className="flex-shrink-0 mt-0.5" size={16} />
                  <span>{storeError}</span>
                </div>
                <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>
                  You can retry now, or skip and add your first store from <strong>Settings → Stores</strong> after logging in.
                </p>
                <div className="flex gap-3 pt-1">
                  <button type="button" disabled={loading}
                    onClick={() => { window.location.href = '/login' }}
                    className={styles.btnSecondary} style={{ width: '40%' }}>
                    Skip → Login
                  </button>
                  <button type="submit" disabled={loading} className={styles.btnSuccess} style={{ width: '60%' }}>
                    {loading
                      ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto" />
                      : 'Retry store creation'}
                  </button>
                </div>
              </div>
            )}

          </form>
        </div>
      </div>
    </AuthLayout>
  )
}

export default SetupWizard
