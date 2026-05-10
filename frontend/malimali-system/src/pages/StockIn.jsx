import { useState } from 'react'
import { MdAdd, MdCheckCircle } from 'react-icons/md'
import { useApp } from '@/context/AppContext'

const categories = ['Furniture', 'Bedding', 'Utensils', 'Cleaning']

export default function StockIn() {
  const { stockInLog, addStockIn } = useApp()
  const [form, setForm] = useState({ name: '', category: 'Furniture', qty: '', buyPrice: '' })
  const [success, setSuccess] = useState(false)
  const [errors, setErrors] = useState({})

  const validate = () => {
    const e = {}
    if (!form.name) e.name = 'Product name is required'
    if (!form.qty || form.qty <= 0) e.qty = 'Enter a valid quantity'
    if (!form.buyPrice || form.buyPrice <= 0) e.buyPrice = 'Enter a valid price'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleAdd = () => {
    if (!validate()) return
    addStockIn(form)
    setForm({ name: '', category: 'Furniture', qty: '', buyPrice: '' })
    setErrors({})
    setSuccess(true)
    setTimeout(() => setSuccess(false), 3000)
  }

  const totalSpent = stockInLog.reduce((sum, item) => sum + item.total, 0)
  const totalItems = stockInLog.reduce((sum, item) => sum + item.qty, 0)

  return (
    <div style={{ padding: '1.5rem', background: '#f4f6f9', minHeight: '100vh' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '20px', fontWeight: '600', color: '#333' }}>Stock In</h1>
        <p style={{ fontSize: '13px', color: '#888', marginTop: '2px' }}>Record products added to stock</p>
      </div>

      <div className="grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: '12px', marginBottom: '1.5rem' }}>
        {[
          { label: 'Total stock entries', value: stockInLog.length, color: '#185FA5' },
          { label: 'Total items added', value: totalItems, color: '#3B6D11' },
          { label: 'Total amount spent', value: `KSh ${totalSpent.toLocaleString()}`, color: '#BA7517' },
        ].map((card, i) => (
          <div key={i} style={{ background: '#fff', border: '0.5px solid #e0e0e0', borderLeft: `3px solid ${card.color}`, borderRadius: '12px', padding: '1rem 1.25rem' }}>
            <div style={{ fontSize: '12px', color: '#888', marginBottom: '4px' }}>{card.label}</div>
            <div style={{ fontSize: '22px', fontWeight: '600', color: '#333' }}>{card.value}</div>
          </div>
        ))}
      </div>

      <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: '1rem' }}>
        <div style={{ background: '#fff', border: '0.5px solid #e0e0e0', borderRadius: '12px', padding: '1.5rem' }}>
          <h2 style={{ fontSize: '15px', fontWeight: '600', color: '#333', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <MdAdd style={{ color: '#185FA5' }} /> Add Stock Entry
          </h2>
          {success && (
            <div style={{ background: '#EAF3DE', color: '#27500A', padding: '10px 12px', borderRadius: '8px', fontSize: '13px', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <MdCheckCircle /> Product added to stock successfully!
            </div>
          )}
          {[
            { label: 'Product Name', key: 'name', type: 'text', placeholder: 'e.g. Plastic Chair (Blue)' },
            { label: 'Quantity', key: 'qty', type: 'number', placeholder: 'e.g. 10' },
            { label: 'Buy Price per item (KSh)', key: 'buyPrice', type: 'number', placeholder: 'e.g. 700' },
          ].map(field => (
            <div key={field.key} style={{ marginBottom: '1rem' }}>
              <label style={{ fontSize: '13px', color: '#555', display: 'block', marginBottom: '6px' }}>{field.label}</label>
              <input type={field.type} placeholder={field.placeholder} value={form[field.key]} onChange={e => setForm({ ...form, [field.key]: e.target.value })} style={{ width: '100%', padding: '10px', border: `0.5px solid ${errors[field.key] ? '#E24B4A' : '#ddd'}`, borderRadius: '8px', fontSize: '14px', outline: 'none' }} />
              {errors[field.key] && <p style={{ fontSize: '12px', color: '#E24B4A', marginTop: '4px' }}>{errors[field.key]}</p>}
            </div>
          ))}
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ fontSize: '13px', color: '#555', display: 'block', marginBottom: '6px' }}>Category</label>
            <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} style={{ width: '100%', padding: '10px', border: '0.5px solid #ddd', borderRadius: '8px', fontSize: '14px', outline: 'none', background: '#fff' }}>
              {categories.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          {form.qty && form.buyPrice && (
            <div style={{ background: '#E6F1FB', borderRadius: '8px', padding: '10px 14px', marginBottom: '1rem', fontSize: '13px', color: '#0C447C' }}>
              Total cost: <strong>KSh {(Number(form.qty) * Number(form.buyPrice)).toLocaleString()}</strong>
            </div>
          )}
          <button onClick={handleAdd} style={{ width: '100%', padding: '11px', background: '#185FA5', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '500', cursor: 'pointer' }}>
            Add to Stock
          </button>
        </div>

        <div style={{ background: '#fff', border: '0.5px solid #e0e0e0', borderRadius: '12px', padding: '1.5rem' }}>
          <h2 style={{ fontSize: '15px', fontWeight: '600', color: '#333', marginBottom: '1rem' }}>Stock In Log</h2>
          <div className="table-wrapper">
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '500px' }}>
              <thead>
                <tr style={{ background: '#f9f9f9' }}>
                  {['Product', 'Category', 'Qty', 'Buy Price', 'Total', 'Date', 'Time'].map(h => (
                    <th key={h} style={{ fontSize: '12px', color: '#aaa', fontWeight: '500', textAlign: 'left', padding: '10px 12px', borderBottom: '0.5px solid #eee' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {stockInLog.map((entry, i) => (
                  <tr key={entry.id} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                    <td style={{ padding: '10px 12px', fontSize: '13px', color: '#333', fontWeight: '500' }}>{entry.name}</td>
                    <td style={{ padding: '10px 12px', fontSize: '13px', color: '#888' }}>{entry.category}</td>
                    <td style={{ padding: '10px 12px', fontSize: '13px', color: '#333' }}>{entry.qty}</td>
                    <td style={{ padding: '10px 12px', fontSize: '13px', color: '#333' }}>KSh {entry.buyPrice.toLocaleString()}</td>
                    <td style={{ padding: '10px 12px', fontSize: '13px', color: '#185FA5', fontWeight: '500' }}>KSh {entry.total.toLocaleString()}</td>
                    <td style={{ padding: '10px 12px', fontSize: '13px', color: '#888' }}>{entry.date}</td>
                    <td style={{ padding: '10px 12px', fontSize: '13px', color: '#888' }}>{entry.time}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}