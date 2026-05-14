import { useState, useEffect } from 'react'
import { useApp } from '@/context/AppContext'
import { MdSave, MdStore, MdPayments, MdInventory, MdCloudUpload } from 'react-icons/md'

export default function Settings() {
  const { settings, updateSettings } = useApp()

  // Use || to prevent "uncontrolled input" errors if settings are still loading
  const [form, setForm] = useState(settings || {
    companyName: '',
    currency: 'KSh',
    paymentMethods: ['cash', 'mpesa'],
    lowStockThreshold: 5,
    receiptPrefix: 'INV',
    logo: ''
  })

  const [logoFile, setLogoFile] = useState(null)
  const [preview, setPreview] = useState(settings?.logo || '')
  const [saved, setSaved] = useState(false)

  // Update local form if global settings change
  useEffect(() => {
    if (settings) {
      setForm(settings)
      setPreview(settings.logo)
    }
  }, [settings])

  const handleChange = (key, value) => {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  const handleLogoChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      setLogoFile(file)
      setPreview(URL.createObjectURL(file)) // Show instant preview
    }
  }

  const togglePayment = (method) => {
    const exists = form.paymentMethods.includes(method)
    const newMethods = exists
      ? form.paymentMethods.filter(m => m !== method)
      : [...form.paymentMethods, method]
    handleChange('paymentMethods', newMethods)
  }

  const handleSave = async () => {
    // If you have a logo file, you'd usually use FormData here
    // For now, we call your global updateSettings
    const result = await updateSettings({ ...form, logoFile })
    if (result.success) {
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } else {
      alert("Failed to save settings. Please check your connection.")
    }
  }

  // Styles (same as your original)
  const sectionStyle = { background: '#fff', borderRadius: '14px', padding: '20px', marginBottom: '20px', boxShadow: '0 4px 14px rgba(0,0,0,0.05)' }
  const labelStyle = { fontSize: '13px', fontWeight: '600', color: '#444', marginBottom: '6px' }
  const inputStyle = { width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', outline: 'none' }

  return (
    <div style={{ padding: '20px', maxWidth: '900px' }}>
      <div style={{ marginBottom: '20px' }}>
        <h2 style={{ margin: 0, color: '#333' }}>Settings</h2>
        <p style={{ fontSize: '13px', color: '#888' }}>Configure your white-label POS system</p>
      </div>

      {saved && (
        <div style={{ background: '#EAF3DE', color: '#27500A', padding: '10px 14px', borderRadius: '8px', marginBottom: '15px', fontSize: '13px' }}>
          ✅ Settings saved successfully
        </div>
      )}

      {/* BRANDING & LOGO */}
      <div style={sectionStyle}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
          <MdStore style={{ marginRight: '8px' }} />
          <strong>Branding & Identity</strong>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <div>
            <div style={labelStyle}>Business Name (shown in Sidebar/Login)</div>
            <input
              style={inputStyle}
              value={form.companyName}
              onChange={(e) => handleChange('companyName', e.target.value)}
            />
          </div>
          <div>
            <div style={labelStyle}>Business Logo</div>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              {preview && <img src={preview} style={{ width: '40px', height: '40px', objectFit: 'contain', border: '1px solid #eee' }} />}
              <label style={{
                padding: '8px 12px', background: '#f0f0f0', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '5px'
              }}>
                <MdCloudUpload /> Change Logo
                <input type="file" hidden onChange={handleLogoChange} accept="image/*" />
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* PAYMENTS */}
      <div style={sectionStyle}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
          <MdPayments style={{ marginRight: '8px' }} />
          <strong>Payment Methods</strong>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {['cash', 'mpesa', 'card', 'credit', 'split'].map(method => {
            const active = form.paymentMethods?.includes(method)
            return (
              <div
                key={method}
                onClick={() => togglePayment(method)}
                style={{
                  padding: '8px 14px', borderRadius: '20px', cursor: 'pointer', fontSize: '13px',
                  border: active ? '1px solid #185FA5' : '1px solid #ddd',
                  background: active ? '#E6F1FB' : '#f9f9f9',
                  color: active ? '#185FA5' : '#555',
                  fontWeight: active ? '600' : '400'
                }}
              >
                {method.toUpperCase()}
              </div>
            )
          })}
        </div>
      </div>

      {/* INVENTORY */}
      <div style={sectionStyle}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
          <MdInventory style={{ marginRight: '8px' }} />
          <strong>Inventory & Receipts</strong>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <div>
            <div style={labelStyle}>Currency Symbol</div>
            <input style={inputStyle} value={form.currency} onChange={(e) => handleChange('currency', e.target.value)} />
          </div>
          <div>
            <div style={labelStyle}>Low Stock Alert Level</div>
            <input type="number" style={inputStyle} value={form.lowStockThreshold} onChange={(e) => handleChange('lowStockThreshold', Number(e.target.value))} />
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={handleSave} style={{ background: '#185FA5', color: '#fff', border: 'none', padding: '12px 24px', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <MdSave /> Save Changes
        </button>
      </div>
    </div>
  )
}