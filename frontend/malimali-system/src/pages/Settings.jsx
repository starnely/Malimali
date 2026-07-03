import { useState } from 'react'
import { useApp } from '@/context/AppContext'
import styles from '@/styles/Settings.module.css'
import { API_BASE_URL as backendUrl } from '@/config/api'
import {
  MdSave, MdStore, MdPayments, MdInventory,
  MdCloudUpload, MdCheckCircle, MdPhone, MdEmail,
  MdLocationOn, MdReceipt, MdPercent, MdPrint,
  MdSecurity, MdBadge, MdMarkEmailRead, MdLanguage,
  MdPalette,
} from 'react-icons/md'

const isTouchDevice = () => window.matchMedia('(pointer: coarse)').matches

const PAYMENT_METHODS = ['cash', 'mpesa', 'card', 'credit', 'split', 'bank']
const PRINTER_TYPES   = [
  { value: 'usb',     label: 'USB Printer',    desc: 'Direct USB connection to this PC'   },
  { value: 'network', label: 'Network Printer', desc: 'IP-based printer on local network'  },
  { value: 'browser', label: 'Browser Print',   desc: 'Print via browser (any device)'     },
]

export default function Settings() {
  const { settings, updateSettings, currentUser } = useApp()

  const defaultForm = {
    companyName: '', phone: '', email: '', location: '',
    currency: 'KSh', lowStockThreshold: 5,
    receiptPrefix: 'RCP', receiptFooter: 'Thank you for your business!',
    taxRate: 0, kraPin: '',
    paymentMethods: ['cash', 'mpesa'],
    printerType: 'browser', printerIp: '',
    logo: '',
    // Phase 6 — email & document
    businessAddress: '', businessWebsite: '',
    smtpHost: '', smtpPort: 587, smtpUser: '',
    smtpPassword: '', smtpFromName: '', smtpSecure: false,
    // Appearance
    brandColors: { primary: '', secondary: '', accent: '' },
  }

  const mergeWithDefaults = (s) => s ? {
    ...defaultForm, ...s,
    // Flatten nested smtp object for form
    smtpHost:        s.smtp?.host     || '',
    smtpPort:        s.smtp?.port     || 587,
    smtpUser:        s.smtp?.user     || '',
    smtpPassword:    '',              // never pre-fill password from server
    smtpFromName:    s.smtp?.fromName || '',
    smtpSecure:      s.smtp?.secure   || false,
    businessAddress: s.businessAddress || '',
    businessWebsite: s.businessWebsite || '',
    brandColors: {
      primary:   s.brandColors?.primary   || '',
      secondary: s.brandColors?.secondary || '',
      accent:    s.brandColors?.accent    || '',
    },
  } : defaultForm

  const [form,     setForm]    = useState(() => mergeWithDefaults(settings))
  const [logoFile, setLogoFile] = useState(null)
  const [preview,  setPreview]  = useState(settings?.logo || '')
  const [saved,    setSaved]    = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState('')
  const [loadedId, setLoadedId] = useState(settings?._id || null)
  const [testStatus, setTestStatus] = useState(null) // { type: 'success'|'error', msg }

  if (settings?._id && settings._id !== loadedId) {
    setForm(mergeWithDefaults(settings))
    setPreview(settings.logo || '')
    setLoadedId(settings._id)
  }

  const handleChange = (key, value) => setForm(prev => ({ ...prev, [key]: value }))

  const handleLogoChange = (e) => {
    const file = e.target.files[0]
    if (file) { setLogoFile(file); setPreview(URL.createObjectURL(file)) }
  }

  const togglePayment = (method) => {
    const exists = form.paymentMethods?.includes(method)
    handleChange('paymentMethods',
      exists
        ? form.paymentMethods.filter(m => m !== method)
        : [...(form.paymentMethods || []), method]
    )
  }

  const handleSave = async () => {
    setError('')
    setSaving(true)
    const payload = {
      ...form,
      paymentMethods: JSON.stringify(form.paymentMethods || []),
      smtpSecure: String(form.smtpSecure),
      brandColors: JSON.stringify(form.brandColors || {}),
      logoFile,
    }
    const result = await updateSettings(payload)
    setSaving(false)
    if (result.success) {
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } else {
      setError(result.message || 'Failed to save settings. Please try again.')
    }
  }

  const handleTestEmail = async () => {
    setTestStatus(null)
    setError('')
    // Save first so SMTP settings are persisted before testing
    const saveResult = await updateSettings({
      ...form,
      paymentMethods: JSON.stringify(form.paymentMethods || []),
      smtpSecure: String(form.smtpSecure),
      brandColors: JSON.stringify(form.brandColors || {}),
      logoFile,
    })
    if (!saveResult.success) { setError('Save failed before test. Check your settings.'); return }

    try {
      const res  = await fetch(`${backendUrl}/api/setup/test-email`, {
        method:  'POST',
        headers: { Authorization: `Bearer ${currentUser?.token}` },
      })
      const data = await res.json()
      setTestStatus({ type: data.success ? 'success' : 'error', msg: data.message })
    } catch {
      setTestStatus({ type: 'error', msg: 'Could not reach server' })
    }
  }

  // ── Shared styles ──────────────────────────────────────────────────
  const section = {
    background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)',
    padding: '1.5rem', marginBottom: '1.25rem',
    border: '1px solid var(--border-soft)', boxShadow: 'var(--shadow-card)',
  }
  const sectionTitle = {
    display: 'flex', alignItems: 'center', gap: '8px',
    marginBottom: '1.25rem', fontSize: '13px', fontWeight: '700',
    color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.06em',
  }
  const titleIcon = {
    width: '28px', height: '28px', borderRadius: 'var(--radius-sm)',
    background: 'var(--primary-light)', color: 'var(--primary)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '15px', flexShrink: 0,
  }
  const label = {
    fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)',
    marginBottom: '6px', display: 'block',
    textTransform: 'uppercase', letterSpacing: '0.06em',
  }
  const inputBase = {
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
  const grid2 = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }
  const grid3 = { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1.25rem' }

  return (
    <div className="flex flex-col min-h-full md:h-full md:overflow-hidden" style={{ background: 'var(--bg-page)' }}>

      {/* ── Fixed header ──────────────────────────────────────────── */}
      <div className="flex-shrink-0 px-6 pt-6 pb-4" style={{ borderBottom: '1px solid var(--border-soft)', background: 'var(--bg-card)' }}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Settings</h1>
            <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
              Configure your POS system — changes apply across all terminals
            </p>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              background: saving ? 'var(--primary-muted)' : 'var(--primary)',
              color: '#fff', border: 'none',
              padding: '10px 24px', borderRadius: 'var(--radius-md)',
              cursor: saving ? 'not-allowed' : 'pointer',
              fontWeight: '700', fontSize: '13px',
              display: 'flex', alignItems: 'center', gap: '6px',
              transition: 'background 0.15s', flexShrink: 0, fontFamily: 'inherit',
            }}
            onMouseEnter={e => { if (!saving && !isTouchDevice()) e.currentTarget.style.background = 'var(--primary-dark)' }}
            onMouseLeave={e => { if (!saving && !isTouchDevice()) e.currentTarget.style.background = 'var(--primary)' }}
          >
            <MdSave size={16} />
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* ── Scrollable content ───────────────────────────────────── */}
      <div className="md:flex-1 md:overflow-y-auto px-6 py-5">

        {/* Toast messages */}
        {saved && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl mb-4 text-sm font-medium"
            style={{ background: 'var(--success-light)', color: 'var(--success-dark)', border: '1px solid var(--success)' }}>
            <MdCheckCircle /> Settings saved successfully
          </div>
        )}
        {error && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl mb-4 text-sm font-medium"
            style={{ background: 'var(--danger-light)', color: 'var(--danger-dark)', border: '1px solid var(--danger)' }}>
            {error}
          </div>
        )}

        {/* ── 1. Branding & Identity ─────────────────────────────── */}
        <div style={section}>
          <div style={sectionTitle}>
            <span style={titleIcon}><MdStore /></span>
            Branding &amp; Identity
          </div>
          <div className={styles.grid2} style={{ marginBottom: '1.25rem' }}>
            <div>
              <span style={label}>Business Name</span>
              <input style={inputBase} value={form.companyName || ''} onChange={e => handleChange('companyName', e.target.value)} onFocus={onFocus} onBlur={onBlur} placeholder="e.g. Family Stores Ltd" />
            </div>
            <div>
              <span style={label}>Currency Symbol</span>
              <input style={inputBase} value={form.currency || ''} onChange={e => handleChange('currency', e.target.value)} onFocus={onFocus} onBlur={onBlur} placeholder="KSh" />
            </div>
          </div>
          <div>
            <span style={label}>Business Logo</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '4px' }}>
              {(preview || form.logo) && (
                <img src={preview || `${backendUrl}${form.logo}`} alt="Logo"
                  style={{ width: '52px', height: '52px', objectFit: 'contain', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-soft)', background: 'var(--bg-muted)', padding: '4px' }} />
              )}
              <label style={{ padding: '9px 16px', background: 'var(--primary-light)', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontSize: '12px', fontWeight: '600', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '5px', border: '1px solid var(--primary-muted)' }}>
                <MdCloudUpload /> {preview || form.logo ? 'Change Logo' : 'Upload Logo'}
                <input type="file" hidden onChange={handleLogoChange} accept="image/*" />
              </label>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>JPEG, PNG or WebP · max 2MB</span>
            </div>
          </div>
        </div>

        {/* ── 2. Contact Details ─────────────────────────────────── */}
        <div style={section}>
          <div style={sectionTitle}>
            <span style={titleIcon}><MdPhone /></span>
            Contact Details
          </div>
          <div className={styles.grid3}>
            <div>
              <span style={label}>Phone Number</span>
              <input style={inputBase} value={form.phone || ''} onChange={e => handleChange('phone', e.target.value)} onFocus={onFocus} onBlur={onBlur} placeholder="e.g. 0700 123 456" />
            </div>
            <div>
              <span style={label}>Email Address</span>
              <input type="email" style={inputBase} value={form.email || ''} onChange={e => handleChange('email', e.target.value)} onFocus={onFocus} onBlur={onBlur} placeholder="info@business.co.ke" />
            </div>
            <div>
              <span style={label}>Business Address</span>
              <input style={inputBase} value={form.location || ''} onChange={e => handleChange('location', e.target.value)} onFocus={onFocus} onBlur={onBlur} placeholder="e.g. Nairobi, Kenya" />
            </div>
          </div>
        </div>

        {/* ── 3. Payment Methods ─────────────────────────────────── */}
        <div style={section}>
          <div style={sectionTitle}>
            <span style={titleIcon}><MdPayments /></span>
            Payment Methods
          </div>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px', marginTop: '-8px' }}>
            Select which payment methods appear at checkout
          </p>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {PAYMENT_METHODS.map(method => {
              const active = form.paymentMethods?.includes(method)
              const labels = { cash: 'Cash', mpesa: 'M-Pesa', card: 'Card (EDC)', credit: 'Credit', split: 'Split Pay', bank: 'Bank Transfer' }
              return (
                <div key={method} onClick={() => togglePayment(method)} style={{
                  padding: '8px 18px', borderRadius: '20px', cursor: 'pointer',
                  fontSize: '13px', fontWeight: active ? '700' : '500',
                  border: `1px solid ${active ? 'var(--primary)' : 'var(--border-medium)'}`,
                  background: active ? 'var(--primary-light)' : 'var(--bg-muted)',
                  color:      active ? 'var(--primary)'       : 'var(--text-secondary)',
                  transition: 'all 0.15s', userSelect: 'none',
                }}>
                  {active && <span style={{ marginRight: '5px' }}>✓</span>}
                  {labels[method]}
                </div>
              )
            })}
          </div>
        </div>

        {/* ── 4. Receipt & Inventory ─────────────────────────────── */}
        <div style={section}>
          <div style={sectionTitle}>
            <span style={titleIcon}><MdReceipt /></span>
            Receipt &amp; Inventory
          </div>
          <div className={styles.grid3} style={{ marginBottom: '1.25rem' }}>
            <div>
              <span style={label}>Receipt ID Prefix</span>
              <input style={inputBase} value={form.receiptPrefix || ''} onChange={e => handleChange('receiptPrefix', e.target.value)} onFocus={onFocus} onBlur={onBlur} placeholder="RCP" />
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>e.g. RCP → RCP-123456-001</span>
            </div>
            <div>
              <span style={label}>Low Stock Alert Level</span>
              <input type="number" min="0" style={inputBase} value={form.lowStockThreshold ?? 5} onChange={e => handleChange('lowStockThreshold', Number(e.target.value))} onFocus={onFocus} onBlur={onBlur} />
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>Alert when stock falls below this</span>
            </div>
            <div>
              <span style={label}>Tax Rate (%)</span>
              <input type="number" min="0" max="100" step="0.1" style={inputBase}
                value={form.taxRate != null ? (form.taxRate * 100).toFixed(1) : '0'}
                onChange={e => handleChange('taxRate', Number(e.target.value) / 100)}
                onFocus={onFocus} onBlur={onBlur} placeholder="0" />
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>0% until VAT registration</span>
            </div>
          </div>
          <div>
            <span style={label}>Receipt Footer Message</span>
            <input style={inputBase} value={form.receiptFooter || ''} onChange={e => handleChange('receiptFooter', e.target.value)} onFocus={onFocus} onBlur={onBlur} placeholder="Thank you for shopping with us!" />
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>Printed at the bottom of every receipt</span>
          </div>
        </div>

        {/* ── 5. KRA Compliance ─────────────────────────────────── */}
        <div style={section}>
          <div style={sectionTitle}>
            <span style={titleIcon}><MdSecurity /></span>
            KRA Compliance
          </div>
          <div style={{ padding: '10px 14px', borderRadius: 'var(--radius-md)', background: 'var(--info-light)', border: '1px solid var(--info)', marginBottom: '1.25rem', fontSize: '12px', color: 'var(--info-dark)', display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
            <MdBadge style={{ flexShrink: 0, marginTop: '1px', fontSize: '15px' }} />
            <div><strong>eTIMS Preparation Mode</strong> — KRA PIN saved here will be used when eTIMS integration is activated. No data is currently submitted to KRA.</div>
          </div>
          <div style={{ maxWidth: '320px' }}>
            <span style={label}>KRA PIN</span>
            <input style={inputBase} value={form.kraPin || ''} onChange={e => handleChange('kraPin', e.target.value.toUpperCase())} onFocus={onFocus} onBlur={onBlur} placeholder="e.g. P051234567A" maxLength={11} />
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>Format: P + 9 digits + letter (e.g. P051234567A)</span>
          </div>
        </div>

        {/* ── 6. Printer Configuration ──────────────────────────── */}
        <div style={section}>
          <div style={sectionTitle}>
            <span style={titleIcon}><MdPrint /></span>
            Receipt Printer
          </div>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px', marginTop: '-8px' }}>
            Choose how receipts are printed after each sale
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '1.25rem' }}>
            {PRINTER_TYPES.map(pt => {
              const active = (form.printerType || 'browser') === pt.value
              return (
                <div key={pt.value} onClick={() => handleChange('printerType', pt.value)} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', borderRadius: 'var(--radius-md)', border: `1.5px solid ${active ? 'var(--primary)' : 'var(--border-medium)'}`, background: active ? 'var(--primary-light)' : 'var(--bg-muted)', cursor: 'pointer', transition: 'all 0.15s' }}>
                  <div style={{ width: '18px', height: '18px', borderRadius: '50%', flexShrink: 0, border: `2px solid ${active ? 'var(--primary)' : 'var(--border-medium)'}`, background: active ? 'var(--primary)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {active && <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#fff' }} />}
                  </div>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: '600', color: active ? 'var(--primary)' : 'var(--text-primary)' }}>{pt.label}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '1px' }}>{pt.desc}</div>
                  </div>
                </div>
              )
            })}
          </div>
          {form.printerType === 'network' && (
            <div style={{ maxWidth: '320px' }}>
              <span style={label}>Printer IP Address</span>
              <input style={inputBase} value={form.printerIp || ''} onChange={e => handleChange('printerIp', e.target.value)} onFocus={onFocus} onBlur={onBlur} placeholder="e.g. 192.168.1.100" />
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>Port 9100 is used by default for ESC/POS network printers</span>
            </div>
          )}
          {form.printerType === 'usb' && (
            <div style={{ padding: '10px 14px', borderRadius: 'var(--radius-md)', background: 'var(--warning-light)', border: '1px solid var(--warning)', fontSize: '12px', color: 'var(--warning-dark)' }}>
              USB printing requires the POS backend to be running on the same PC as the printer. Ensure the thermal printer driver is installed.
            </div>
          )}
        </div>

        {/* ── 7. Email & Document Settings ──────────────────────── */}
        <div style={section}>
          <div style={sectionTitle}>
            <span style={titleIcon}><MdMarkEmailRead /></span>
            Email &amp; Document Settings
          </div>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px', marginTop: '-8px' }}>
            Configure SMTP to send Purchase Orders by email directly to suppliers.
          </p>

          {/* Gmail tip banner */}
          <div style={{ padding: '12px 16px', borderRadius: 'var(--radius-md)', background: 'var(--info-light)', border: '1px solid var(--info)', marginBottom: '1.25rem', fontSize: '12px', color: 'var(--info-dark)', lineHeight: 1.6 }}>
            <strong>Gmail users:</strong> Go to <em>Google Account → Security → 2-Step Verification → App Passwords</em>.
            Generate a password for "Mail" and paste it in the App Password field below.
            Do <strong>not</strong> use your regular Gmail password.
          </div>

          <div className={styles.grid2} style={{ marginBottom: '1.25rem' }}>
            <div>
              <span style={label}>SMTP Host</span>
              <input style={inputBase} value={form.smtpHost || ''} onChange={e => handleChange('smtpHost', e.target.value)} onFocus={onFocus} onBlur={onBlur} placeholder="smtp.gmail.com" />
            </div>
            <div>
              <span style={label}>SMTP Port</span>
              <input type="number" style={inputBase} value={form.smtpPort || 587} onChange={e => handleChange('smtpPort', e.target.value)} onFocus={onFocus} onBlur={onBlur} placeholder="587" />
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>587 for TLS (recommended) · 465 for SSL</span>
            </div>
            <div>
              <span style={label}>Sender Email Address</span>
              <input type="email" style={inputBase} value={form.smtpUser || ''} onChange={e => handleChange('smtpUser', e.target.value)} onFocus={onFocus} onBlur={onBlur} placeholder="orders@yourbusiness.co.ke" />
            </div>
            <div>
              <span style={label}>Display Name (From)</span>
              <input style={inputBase} value={form.smtpFromName || ''} onChange={e => handleChange('smtpFromName', e.target.value)} onFocus={onFocus} onBlur={onBlur} placeholder="Nthiga Stores Ltd" />
            </div>
            <div>
              <span style={label}>App Password</span>
              <input type="password" style={inputBase} value={form.smtpPassword || ''} onChange={e => handleChange('smtpPassword', e.target.value)} onFocus={onFocus} onBlur={onBlur} placeholder="••••••••••••••••" autoComplete="new-password" />
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>Leave blank to keep existing password unchanged</span>
            </div>
            {/* SSL/TLS toggle */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingTop: '24px' }}>
              <div
                onClick={() => handleChange('smtpSecure', !form.smtpSecure)}
                role="switch"
                aria-checked={form.smtpSecure}
                style={{ width: 42, height: 24, borderRadius: 12, cursor: 'pointer', background: form.smtpSecure ? 'var(--primary)' : 'var(--border-medium)', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}
              >
                <div style={{ width: 18, height: 18, borderRadius: '50%', background: 'white', position: 'absolute', top: 3, left: form.smtpSecure ? 21 : 3, transition: 'left 0.2s', boxShadow: '0 1px 4px rgba(0,0,0,0.2)' }} />
              </div>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Use SSL / TLS (Port 465)</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Off = STARTTLS on port 587 (most common)</div>
              </div>
            </div>
          </div>

          {/* Document info for PDF letterhead */}
          <div style={{ borderTop: '1px solid var(--border-soft)', paddingTop: '1.25rem', marginBottom: '1.25rem' }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: 6 }}>
              <MdLanguage size={14} /> PDF Letterhead Details
            </div>
            <div className={styles.grid2}>
              <div>
                <span style={label}>Full Business Address (for PDF)</span>
                <input style={inputBase} value={form.businessAddress || ''} onChange={e => handleChange('businessAddress', e.target.value)} onFocus={onFocus} onBlur={onBlur} placeholder="123 Kimathi St, Nairobi, Kenya" />
              </div>
              <div>
                <span style={label}>Website (optional)</span>
                <input style={inputBase} value={form.businessWebsite || ''} onChange={e => handleChange('businessWebsite', e.target.value)} onFocus={onFocus} onBlur={onBlur} placeholder="www.yourbusiness.co.ke" />
              </div>
            </div>
          </div>

          {/* Test email button */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
            <button
              onClick={handleTestEmail}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '9px 18px', background: 'var(--bg-muted)', border: '1px solid var(--border-medium)', borderRadius: 'var(--radius-md)', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' }}
              onMouseEnter={e => { if (!isTouchDevice()) { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.color = 'var(--primary)' } }}
              onMouseLeave={e => { if (!isTouchDevice()) { e.currentTarget.style.borderColor = 'var(--border-medium)'; e.currentTarget.style.color = 'var(--text-secondary)' } }}
            >
              <MdMarkEmailRead size={16} /> Send Test Email
            </button>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Saves settings then sends a test to your sender address
            </span>
          </div>

          {/* Test result */}
          {testStatus && (
            <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 600, background: testStatus.type === 'success' ? 'var(--success-light)' : 'var(--danger-light)', color: testStatus.type === 'success' ? 'var(--success-dark)' : 'var(--danger-dark)', border: `1px solid ${testStatus.type === 'success' ? 'var(--success)' : 'var(--danger)'}` }}>
              {testStatus.type === 'success' ? '✅ ' : '❌ '}{testStatus.msg}
            </div>
          )}
        </div>

        {/* ── 8. Appearance ─────────────────────────────────── */}
        <div style={section}>
          <div style={sectionTitle}>
            <span style={titleIcon}><MdPalette /></span>
            Appearance &amp; Brand Colors
          </div>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px', marginTop: '-8px' }}>
            Customize the brand colors used across all terminals. Leave blank to use the default theme.
          </p>
          <div className={styles.grid3} style={{ marginBottom: '1.25rem' }}>
            {[
              { key: 'primary',   label: 'Primary Color',  fallback: '#1E5FA5', hint: 'Buttons, links, active states'      },
              { key: 'secondary', label: 'Sidebar Color',  fallback: '#0C3660', hint: 'Navigation sidebar background'      },
              { key: 'accent',    label: 'Accent Color',   fallback: '#7C3AED', hint: 'VAT tags, highlights, badges'       },
            ].map(({ key, label: lbl, fallback, hint }) => {
              const currentVal = form.brandColors?.[key] || fallback
              return (
                <div key={key}>
                  <span style={label}>{lbl}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                    <input
                      type="color"
                      value={currentVal}
                      onChange={e => handleChange('brandColors', { ...form.brandColors, [key]: e.target.value })}
                      style={{ width: 44, height: 36, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-medium)', cursor: 'pointer', padding: '2px', background: 'var(--bg-card)' }}
                    />
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>{currentVal}</span>
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>{hint}</span>
                </div>
              )
            })}
          </div>
          <div style={{ padding: '10px 14px', borderRadius: 'var(--radius-md)', background: 'var(--info-light)', border: '1px solid var(--info)', fontSize: '12px', color: 'var(--info-dark)' }}>
            Color changes take effect after saving and refreshing all open terminals.
          </div>
        </div>

        {/* Bottom save button */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', paddingBottom: '1rem' }}>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{ background: saving ? 'var(--primary-muted)' : 'var(--primary)', color: '#fff', border: 'none', padding: '12px 28px', borderRadius: 'var(--radius-md)', cursor: saving ? 'not-allowed' : 'pointer', fontWeight: '700', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px', transition: 'background 0.15s', fontFamily: 'inherit' }}
            onMouseEnter={e => { if (!saving && !isTouchDevice()) e.currentTarget.style.background = 'var(--primary-dark)' }}
            onMouseLeave={e => { if (!saving && !isTouchDevice()) e.currentTarget.style.background = 'var(--primary)' }}
          >
            <MdSave /> {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}
