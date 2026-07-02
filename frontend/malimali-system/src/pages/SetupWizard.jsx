import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useApp } from '@/context/AppContext'
import { MdVisibility, MdVisibilityOff, MdErrorOutline } from 'react-icons/md'
import AuthLayout from '@/components/shared/AuthLayout'
import styles from '@/styles/SetupWizard.module.css'

const SetupWizard = () => {
  const { setupOwner } = useApp()
  const navigate = useNavigate()
  const location = useLocation()
  const step = location.state?.setupStep ?? 1
  const [loading, setLoading] = useState(false)
  const [uiError, setUiError] = useState('')

  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [confirmPassword, setConfirmPassword] = useState('')

  const [formData, setFormData] = useState({
    companyName: '', phone: '', email: '', location: '', logo: null,
    ownerName: '', ownerEmail: '', ownerPassword: '', activationCode: ''
  })

  const handleChange = (e) => {
    const { name, value, files } = e.target
    setFormData({ ...formData, [name]: files ? files[0] : value })
    if (uiError) setUiError('')
  }

  const handleStepNavigation = (e) => {
    e.preventDefault()
    setUiError('')
    if (step === 1) {
      navigate(location.pathname, { state: { ...location.state, setupStep: 2 } })
    } else if (step === 2) {
      const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
      if (!emailRegex.test(formData.ownerEmail)) { setUiError('Please provide a valid email address (e.g., name@domain.com).'); return }
      if (formData.ownerPassword.length < 6) { setUiError('For your security, the password must be at least 6 characters long.'); return }
      if (formData.ownerPassword !== confirmPassword) { setUiError('Password confirmation mismatch. Please check your entries.'); return }
      navigate(location.pathname, { state: { ...location.state, setupStep: 3 } })
    } else if (step === 3) {
      handleFinalSubmit()
    }
  }

  const handleFinalSubmit = async () => {
    setLoading(true); setUiError('')
    const data = new FormData()
    Object.entries(formData).forEach(([key, val]) => data.append(key, val))
    const result = await setupOwner(data)
    if (result.success) {
      window.location.href = '/login'
    } else {
      setUiError(result.error || result.message || 'An error occurred during setup.')
      setLoading(false)
    }
  }

  // Input base style using theme variables
  const inputBase = {
    width: '100%', padding: '10px 16px',
    background: 'var(--bg-muted)', border: '1px solid var(--border-medium)',
    borderRadius: 'var(--radius-md)', outline: 'none', transition: 'all 0.15s',
    fontSize: '13px', color: 'var(--text-primary)', boxSizing: 'border-box',
  }
  const onFocus = (e) => { e.target.style.borderColor = 'var(--primary)'; e.target.style.boxShadow = '0 0 0 3px var(--primary-light)'; e.target.style.background = 'var(--bg-card)' }
  const onBlur = (e) => { e.target.style.borderColor = 'var(--border-medium)'; e.target.style.boxShadow = 'none'; e.target.style.background = 'var(--bg-muted)' }

  const getConfirmBorderStyle = () => {
    if (!confirmPassword) return {}
    return formData.ownerPassword === confirmPassword
      ? { borderColor: 'var(--success)', background: 'var(--success-light)' }
      : { borderColor: 'var(--danger)', background: 'var(--danger-light)' }
  }

  const stepLabels = ['Business', 'Admin', 'Activate']

  return (
    <AuthLayout>
      <div className={`flex flex-col w-full max-w-lg rounded-2xl overflow-hidden shadow-xl border bg-white ${styles.card}`}
        style={{ borderColor: 'var(--border-soft)' }}>

        {/* Hero Banner */}
        <div className="px-6 pt-6 pb-5 flex-shrink-0" style={{ background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%)' }}>
          <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-4" style={{ background: 'rgba(255,255,255,0.2)' }}>
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 0 1-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0 1 15 18.257V17.25m6-12V15a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 15V5.25m18 0A2.25 2.25 0 0 0 18.75 3H5.25A2.25 2.25 0 0 0 3 5.25m18 0H3" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-white leading-snug">Welcome to your POS setup</h1>
          <p className="text-sm mt-1.5 leading-relaxed" style={{ color: 'rgba(255,255,255,0.75)' }}>
            Let's get your workspace ready in just a few steps.
          </p>
          <div className="flex flex-wrap gap-2 mt-4">
            {[{ label: 'Business details', icon: '🏪' }, { label: 'Admin account', icon: '🔐' }, { label: 'Activation', icon: '🔑' }].map(({ label, icon }) => (
              <span key={label} className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium"
                style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.9)' }}>
                <span>{icon}</span>{label}
              </span>
            ))}
          </div>
        </div>

        {/* Step Progress */}
        <div className="px-6 pt-4 pb-3 flex-shrink-0" style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border-soft)' }}>
          <div className="flex gap-2 mb-2">
            {[1, 2, 3].map(i => (
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

        {/* Scrollable Form Body */}
        <div className="flex-1 overflow-y-auto p-6" style={{ background: 'var(--bg-card)' }}>
          {uiError && (
            <div className="mb-5 flex items-start gap-2.5 p-3.5 rounded-xl text-xs font-medium"
              style={{ background: 'var(--danger-light)', border: '1px solid var(--danger)', color: 'var(--danger-dark)' }}>
              <MdErrorOutline className="flex-shrink-0 mt-0.5" size={16} />
              <span>{uiError}</span>
            </div>
          )}

          <form onSubmit={handleStepNavigation}>

            {/* Step 1 — Business */}
            {step === 1 && (
              <div className="space-y-4">
                <div className="mb-5">
                  <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Tell us about your business</h2>
                  <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>This will appear across your point of sale interface.</p>
                </div>
                {[
                  { name: 'companyName', label: 'Company name *', placeholder: 'e.g. Maison Café', required: true },
                  { name: 'phone', label: 'Business phone', placeholder: '+254 XX XXX XXX' },
                  { name: 'email', label: 'Business email', placeholder: 'info@company.com', type: 'email' },
                  { name: 'location', label: 'Address / city', placeholder: 'Nairobi, Kenya' },
                ].map(f => (
                  <div key={f.name} className="space-y-1">
                    <label className="text-xs font-semibold ml-0.5" style={{ color: 'var(--text-muted)' }}>{f.label}</label>
                    <input name={f.name} type={f.type || 'text'} value={formData[f.name]} placeholder={f.placeholder}
                      onChange={handleChange} style={inputBase} onFocus={onFocus} onBlur={onBlur} required={f.required} />
                  </div>
                ))}
                <div className="space-y-1">
                  <label className="text-xs font-semibold ml-0.5" style={{ color: 'var(--text-muted)' }}>Business logo</label>
                  <div className="p-5 text-center rounded-xl transition-all"
                    style={{ border: '2px dashed var(--border-medium)', background: 'var(--bg-muted)' }}>
                    <div className="text-2xl mb-1">🖼️</div>
                    <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>PNG, JPG or SVG recommended</p>
                    <input name="logo" type="file" accept="image/*" onChange={handleChange}
                      className="text-xs file:mr-3 file:py-1.5 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold cursor-pointer"
                      style={{ '--file-bg': 'var(--primary-light)', '--file-color': 'var(--primary)' }} />
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

            {/* Step 2 — Admin */}
            {step === 2 && (
              <div className="space-y-4">
                <div className="mb-5">
                  <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Create administrator account</h2>
                  <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>This will be the primary owner account for the system.</p>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold ml-0.5" style={{ color: 'var(--text-muted)' }}>Full name *</label>
                  <input name="ownerName" value={formData.ownerName} placeholder="Your full name" onChange={handleChange}
                    style={inputBase} onFocus={onFocus} onBlur={onBlur} required />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold ml-0.5" style={{ color: 'var(--text-muted)' }}>Email address *</label>
                  <input name="ownerEmail" type="text" value={formData.ownerEmail} placeholder="owner@company.com" onChange={handleChange}
                    style={inputBase} onFocus={onFocus} onBlur={onBlur} required />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold ml-0.5" style={{ color: 'var(--text-muted)' }}>Password *</label>
                  <div className="relative">
                    <input name="ownerPassword" type={showPassword ? 'text' : 'password'} value={formData.ownerPassword}
                      placeholder="Min. 6 characters" onChange={handleChange}
                      style={{ ...inputBase, paddingRight: '44px' }} onFocus={onFocus} onBlur={onBlur} required />
                    <button type="button" tabIndex="-1" onClick={() => setShowPassword(!showPassword)}
                      className={`absolute right-3.5 top-1/2 -translate-y-1/2 ${styles.visBtn}`}>
                      {showPassword ? <MdVisibilityOff size={19} /> : <MdVisibility size={19} />}
                    </button>
                  </div>
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
                      style={{ ...inputBase, paddingRight: '44px', ...getConfirmBorderStyle() }}
                      onFocus={onFocus} onBlur={onBlur} required />
                    <button type="button" tabIndex="-1" onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className={`absolute right-3.5 top-1/2 -translate-y-1/2 ${styles.visBtn}`}>
                      {showConfirmPassword ? <MdVisibilityOff size={19} /> : <MdVisibility size={19} />}
                    </button>
                  </div>
                </div>

                <div className="flex gap-3 pt-1">
                  <button type="button" onClick={() => navigate(-1)} className={styles.btnSecondary} style={{ width: '33%' }}>Back</button>
                  <button type="submit" className={styles.btnPrimary} style={{ width: '67%' }}>
                    Next step
                  </button>
                </div>
              </div>
            )}

            {/* Step 3 — Activate */}
            {step === 3 && (
              <div className="space-y-4 text-center">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-1"
                  style={{ background: 'var(--success-light)' }}>
                  <span className="text-3xl">🚀</span>
                </div>
                <div>
                  <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Activate your license</h2>
                  <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Enter your license key to complete setup and launch your workspace.</p>
                </div>
                <input name="activationCode" value={formData.activationCode} placeholder="XXXX-XXXX-XXXX" onChange={handleChange}
                  style={{ ...inputBase, textAlign: 'center', letterSpacing: '0.25em', fontFamily: 'monospace', textTransform: 'uppercase' }}
                  onFocus={onFocus} onBlur={onBlur} required />
                <div className="flex gap-3 pt-1">
                  <button type="button" disabled={loading} onClick={() => navigate(-1)} className={styles.btnSecondary} style={{ width: '33%' }}>Back</button>
                  <button type="submit" disabled={loading} className={styles.btnSuccess} style={{ width: '67%' }}>
                    {loading ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : <>Activate system ✓</>}
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
