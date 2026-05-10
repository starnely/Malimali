import { useState } from 'react'
import { useApp } from '@/context/AppContext'
import { MdSave, MdStore, MdPayments, MdInventory } from 'react-icons/md'

export default function Settings() {
  const { settings, setSettings } = useApp()

  const [form, setForm] = useState(settings)
  const [saved, setSaved] = useState(false)

  const handleChange = (key, value) => {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  const togglePayment = (method) => {
    const exists = form.paymentMethods.includes(method)
    if (exists) {
      handleChange('paymentMethods', form.paymentMethods.filter(m => m !== method))
    } else {
      handleChange('paymentMethods', [...form.paymentMethods, method])
    }
  }

  const handleSave = () => {
    setSettings(form)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  const sectionStyle = {
    background: '#fff',
    borderRadius: '14px',
    padding: '20px',
    marginBottom: '20px',
    boxShadow: '0 4px 14px rgba(0,0,0,0.05)'
  }

  const labelStyle = {
    fontSize: '13px',
    fontWeight: '600',
    color: '#444',
    marginBottom: '6px'
  }

  const inputStyle = {
    width: '100%',
    padding: '10px 12px',
    borderRadius: '8px',
    border: '1px solid #ddd',
    fontSize: '14px',
    outline: 'none'
  }

  return (
    <div style={{ padding: '20px', maxWidth: '900px' }}>
      
      {/* Header */}
      <div style={{ marginBottom: '20px' }}>
        <h2 style={{ margin: 0, color: '#333' }}>Settings</h2>
        <p style={{ fontSize: '13px', color: '#888' }}>
          Configure how your POS system works
        </p>
      </div>

      {/* Save success */}
      {saved && (
        <div style={{
          background: '#EAF3DE',
          color: '#27500A',
          padding: '10px 14px',
          borderRadius: '8px',
          marginBottom: '15px',
          fontSize: '13px'
        }}>
          ✅ Settings saved successfully
        </div>
      )}

      {/* BUSINESS INFO */}
      <div style={sectionStyle}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
          <MdStore style={{ marginRight: '8px' }} />
          <strong>Business Info</strong>
        </div>

        <div style={{ marginBottom: '12px' }}>
          <div style={labelStyle}>Business Name</div>
          <input
            style={inputStyle}
            value={form.businessName}
            onChange={(e) => handleChange('businessName', e.target.value)}
          />
        </div>

        <div>
          <div style={labelStyle}>Currency</div>
          <input
            style={inputStyle}
            value={form.currency}
            onChange={(e) => handleChange('currency', e.target.value)}
          />
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
            const active = form.paymentMethods.includes(method)
            return (
              <div
                key={method}
                onClick={() => togglePayment(method)}
                style={{
                  padding: '8px 14px',
                  borderRadius: '20px',
                  cursor: 'pointer',
                  fontSize: '13px',
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
          <strong>Inventory Settings</strong>
        </div>

        <div>
          <div style={labelStyle}>Low Stock Threshold</div>
          <input
            type="number"
            style={inputStyle}
            value={form.lowStockThreshold}
            onChange={(e) => handleChange('lowStockThreshold', Number(e.target.value))}
          />
        </div>
      </div>

      {/* RECEIPTS */}
      <div style={sectionStyle}>
        <strong>Receipt Settings</strong>

        <div style={{ marginTop: '12px' }}>
          <div style={labelStyle}>Receipt Prefix</div>
          <input
            style={inputStyle}
            value={form.receiptPrefix}
            onChange={(e) => handleChange('receiptPrefix', e.target.value)}
          />
        </div>
      </div>

      {/* SAVE BUTTON */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          onClick={handleSave}
          style={{
            background: '#185FA5',
            color: '#fff',
            border: 'none',
            padding: '10px 18px',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <MdSave />
          Save Settings
        </button>
      </div>

    </div>
  )
}