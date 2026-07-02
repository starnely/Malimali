import { useState, useEffect } from 'react'
import {
  MdAdd, MdEdit, MdDelete, MdClose, MdLocalShipping,
  MdArchive, MdUnarchive, MdShoppingCart, MdFilterList,
  MdPublic, MdStorefront,
} from 'react-icons/md'
import { useApp } from '@/context/AppContext'
import { useNavigate } from 'react-router-dom'
import styles from '@/styles/Suppliers.module.css'
import { API_BASE_URL } from '@/config/api'

const emptyForm = {
  name: '', company: '', email: '', phone: '', address: '', notes: '', stores: []
}

export default function Suppliers() {
  const { suppliers, fetchSuppliers, currentUser, isOwner, stores } = useApp()
  const navigate = useNavigate()

  const [showModal,    setShowModal]    = useState(false)
  const [loading,      setLoading]      = useState(false)
  const [editingId,    setEditingId]    = useState(null)
  const [confirmId,    setConfirmId]    = useState(null)
  const [archiveId,    setArchiveId]    = useState(null)
  const [formData,     setFormData]     = useState(emptyForm)
  const [showArchived, setShowArchived] = useState(false)
  const [toast,        setToast]        = useState(null)

  useEffect(() => { fetchSuppliers() }, [fetchSuppliers])

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type }); setTimeout(() => setToast(null), 3000)
  }

  const storeNames  = stores?.map(s => s.name).filter(Boolean) || []
  const displayed   = showArchived ? suppliers : suppliers.filter(s => s.isActive !== false)

  // ── Toggle a store in the stores array ────────────────────────────
  const toggleStore = (storeName) => {
    setFormData(prev => ({
      ...prev,
      stores: prev.stores.includes(storeName)
        ? prev.stores.filter(s => s !== storeName)
        : [...prev.stores, storeName]
    }))
  }

  // ── Submit ────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!formData.name || !formData.company) return
    setLoading(true)
    try {
      const url    = editingId
        ? `${API_BASE_URL}/api/suppliers/${editingId}`
        : `${API_BASE_URL}/api/suppliers`
      const method = editingId ? 'PUT' : 'POST'
      const res    = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${currentUser?.token}` },
        body: JSON.stringify(formData),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Failed to save supplier')
      setShowModal(false); setFormData(emptyForm); setEditingId(null)
      await fetchSuppliers()
      showToast(editingId ? 'Supplier updated' : 'Supplier added')
    } catch (err) { showToast(err.message || 'Failed to save', 'error') }
    setLoading(false)
  }

  const handleDelete = async (id) => {
    try {
      const res  = await fetch(`${API_BASE_URL}/api/suppliers/${id}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${currentUser?.token}` }
      })
      const data = await res.json()
      if (!res.ok) { showToast(data.message || 'Cannot delete', 'error'); setConfirmId(null); return }
      setConfirmId(null); await fetchSuppliers(); showToast('Supplier deleted')
    } catch { showToast('Failed to delete', 'error') }
  }

  const handleArchive = async (id) => {
    try {
      const res  = await fetch(`${API_BASE_URL}/api/suppliers/${id}/archive`, {
        method: 'PATCH', headers: { Authorization: `Bearer ${currentUser?.token}` }
      })
      const data = await res.json()
      if (!res.ok) { showToast(data.message || 'Failed', 'error'); return }
      setArchiveId(null); await fetchSuppliers(); showToast(data.message || 'Done')
    } catch { showToast('Failed to archive', 'error') }
  }

  const openEditModal = (sup) => {
    setFormData({
      name:    sup.name    || '',
      company: sup.company || '',
      email:   sup.email   || '',
      phone:   sup.phone   || '',
      address: sup.address || '',
      notes:   sup.notes   || '',
      // Support old single `store` field for existing records
      stores:  Array.isArray(sup.stores) ? sup.stores
               : sup.store ? [sup.store] : [],
    })
    setEditingId(sup._id)
    setShowModal(true)
  }

  const openAddModal = () => {
    setFormData(emptyForm); setEditingId(null); setShowModal(true)
  }

  // ── Input helper ──────────────────────────────────────────────────
  const inp = (label, key, opts = {}) => (
    <div key={key} className={opts.span2 ? 'md:col-span-2' : ''}>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)', marginBottom: 6 }}>
        {label}
      </label>
      {opts.textarea ? (
        <textarea rows={2} value={formData[key]} onChange={e => setFormData({ ...formData, [key]: e.target.value })}
          placeholder={opts.placeholder || ''} style={{ width: '100%', padding: '9px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-medium)', background: 'var(--bg-muted)', color: 'var(--text-primary)', fontSize: 13, fontFamily: 'inherit', outline: 'none', resize: 'none', boxSizing: 'border-box' }}
          onFocus={e => { e.target.style.borderColor = 'var(--primary)'; e.target.style.background = 'var(--bg-card)' }}
          onBlur={e => { e.target.style.borderColor = 'var(--border-medium)'; e.target.style.background = 'var(--bg-muted)' }} />
      ) : (
        <input type={opts.type || 'text'} value={formData[key]} onChange={e => setFormData({ ...formData, [key]: e.target.value })}
          placeholder={opts.placeholder || ''} style={{ width: '100%', padding: '9px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-medium)', background: 'var(--bg-muted)', color: 'var(--text-primary)', fontSize: 13, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
          onFocus={e => { e.target.style.borderColor = 'var(--primary)'; e.target.style.background = 'var(--bg-card)' }}
          onBlur={e => { e.target.style.borderColor = 'var(--border-medium)'; e.target.style.background = 'var(--bg-muted)' }} />
      )}
    </div>
  )

  return (
    <div className="flex flex-col min-h-full md:h-full md:overflow-hidden" style={{ background: 'var(--bg-page)' }}>

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 9999, padding: '10px 18px', borderRadius: 'var(--radius-md)', background: toast.type === 'error' ? 'var(--danger)' : 'var(--success)', color: 'white', fontWeight: 700, fontSize: 13, boxShadow: 'var(--shadow-dropdown)' }}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex-shrink-0 px-6 pt-6 pb-4 flex justify-between items-center flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
            <MdLocalShipping style={{ color: 'var(--primary)' }} /> Suppliers
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
            One supplier can supply multiple stores · assign stores per supplier
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowArchived(v => !v)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition"
            style={{ border: '1px solid var(--border-medium)', background: showArchived ? 'var(--warning-light)' : 'var(--bg-card)', color: showArchived ? 'var(--warning-dark)' : 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'inherit' }}>
            <MdFilterList size={16} /> {showArchived ? 'Showing All' : 'Show Archived'}
          </button>
          <button onClick={openAddModal}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold text-white transition ${styles.btnAdd}`}
          >
            <MdAdd /> Add Supplier
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="flex-shrink-0 px-6 pb-4 flex gap-3 flex-wrap">
        {[
          { label: 'Total',    value: suppliers.length },
          { label: 'Active',   value: suppliers.filter(s => s.isActive !== false).length, color: 'var(--success-dark)' },
          { label: 'Archived', value: suppliers.filter(s => s.isActive === false).length, color: 'var(--text-muted)'   },
        ].map(s => (
          <div key={s.label} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-soft)', borderRadius: 'var(--radius-md)', padding: '10px 16px', minWidth: 100 }}>
            <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: s.color || 'var(--text-primary)' }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="md:flex-1 md:overflow-y-auto px-6 pb-6">
        <div className="rounded-xl overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-soft)', boxShadow: 'var(--shadow-card)' }}>
          <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr style={{ background: 'var(--sidebar-bg)' }}>
                {['S/N', 'Supplier / Company', 'Contact', 'Stores Supplied', 'Notes', 'Status', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-white"
                    style={{ textAlign: h === 'S/N' || h === 'Actions' ? 'center' : 'left' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayed.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-12 text-center">
                    <div className="text-4xl mb-2">🚚</div>
                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                      {showArchived ? 'No suppliers found.' : 'No active suppliers. Click "Add Supplier" to start.'}
                    </p>
                  </td>
                </tr>
              ) : displayed.map((sup, i) => {
                const isArchived  = sup.isActive === false
                // Support both old `store` string and new `stores` array
                const supStores   = Array.isArray(sup.stores) && sup.stores.length > 0
                  ? sup.stores
                  : sup.store ? [sup.store] : []
                const isGlobal    = supStores.length === 0

                return (
                  <tr key={sup._id}
                    className={styles.rowHover}
                    style={{ borderBottom: '1px solid var(--border-soft)', background: isArchived ? 'var(--bg-muted)' : i % 2 === 0 ? 'transparent' : 'var(--bg-muted)', opacity: isArchived ? 0.65 : 1 }}
                  >
                    <td className="px-4 py-3 text-center text-sm font-medium" style={{ color: 'var(--text-muted)' }}>{i + 1}</td>

                    <td className="px-4 py-3">
                      <div className="font-bold" style={{ color: 'var(--text-primary)' }}>{sup.name}</div>
                      <div className="text-xs font-bold uppercase tracking-wider mt-0.5" style={{ color: 'var(--primary)' }}>{sup.company}</div>
                    </td>

                    <td className="px-4 py-3">
                      <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>{sup.phone || '—'}</div>
                      <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{sup.email || '—'}</div>
                    </td>

                    {/* Stores supplied — key column */}
                    <td className="px-4 py-3">
                      {isGlobal ? (
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 20, background: 'var(--info-light)', color: 'var(--info-dark)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <MdPublic style={{ fontSize: 12 }} /> All Stores
                        </span>
                      ) : (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {supStores.map(s => (
                            <span key={s} style={{ fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 20, background: 'var(--success-light)', color: 'var(--success-dark)', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                              <MdStorefront style={{ fontSize: 11 }} /> {s}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>

                    <td className="px-4 py-3" style={{ maxWidth: 160 }}>
                      <div className="text-xs" style={{ color: 'var(--text-muted)', fontStyle: sup.notes ? 'normal' : 'italic' }}>
                        {sup.notes || 'No notes'}
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700, background: isArchived ? 'var(--bg-muted)' : 'var(--success-light)', color: isArchived ? 'var(--text-muted)' : 'var(--success-dark)' }}>
                        {isArchived ? '📦 Archived' : '✅ Active'}
                      </span>
                    </td>

                    <td className="px-4 py-3">
                      {confirmId === sup._id ? (
                        <div className="flex items-center gap-2 justify-center">
                          <span className="text-xs font-semibold" style={{ color: 'var(--danger-dark)' }}>Delete?</span>
                          <button onClick={() => setConfirmId(null)} style={{ padding: '3px 8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-medium)', background: 'var(--bg-card)', color: 'var(--text-secondary)', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>No</button>
                          <button onClick={() => handleDelete(sup._id)} style={{ padding: '3px 8px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--danger)', color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Yes</button>
                        </div>
                      ) : archiveId === sup._id ? (
                        <div className="flex items-center gap-2 justify-center">
                          <span className="text-xs font-semibold" style={{ color: 'var(--warning-dark)' }}>{isArchived ? 'Restore?' : 'Archive?'}</span>
                          <button onClick={() => setArchiveId(null)} style={{ padding: '3px 8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-medium)', background: 'var(--bg-card)', color: 'var(--text-secondary)', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>No</button>
                          <button onClick={() => handleArchive(sup._id)} style={{ padding: '3px 8px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--warning-dark)', color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Yes</button>
                        </div>
                      ) : (
                        <div className="flex justify-center gap-2">
                          {!isArchived && (
                            <button onClick={() => navigate('/purchase-orders', { state: { supplierId: sup._id, supplierName: sup.name } })}
                              title="Create PO"
                              className={`${styles.iconBtn} ${styles.iconBtnSuccess}`}>
                              <MdShoppingCart size={16} />
                            </button>
                          )}
                          <button onClick={() => openEditModal(sup)} title="Edit"
                            className={`${styles.iconBtn} ${styles.iconBtnPrimary}`}>
                            <MdEdit size={16} />
                          </button>
                          {isOwner && (
                            <button onClick={() => setArchiveId(sup._id)} title={isArchived ? 'Restore' : 'Archive'}
                              className={`${styles.iconBtn} ${styles.iconBtnWarning}`}>
                              {isArchived ? <MdUnarchive size={16} /> : <MdArchive size={16} />}
                            </button>
                          )}
                          {isOwner && (
                            <button onClick={() => setConfirmId(sup._id)} title="Delete"
                              className={`${styles.iconBtn} ${styles.iconBtnDanger}`}>
                              <MdDelete size={16} />
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          </div>
        </div>
      </div>

      {/* ── Modal ───────────────────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4"
          style={{ background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(3px)' }}>
          <div className="w-full max-w-lg rounded-xl overflow-hidden" style={{ background: 'var(--bg-card)', boxShadow: 'var(--shadow-dropdown)', maxHeight: '90vh', overflowY: 'auto' }}>

            <div className="px-5 py-4 flex items-center justify-between" style={{ background: 'var(--sidebar-bg)', position: 'sticky', top: 0, zIndex: 1 }}>
              <span className="text-white text-sm font-bold">{editingId ? 'Update Supplier' : 'Add New Supplier'}</span>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.6)', fontSize: 22, display: 'flex', padding: 0 }}><MdClose /></button>
            </div>

            <div className="p-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                {inp('Supplier Name *', 'name',    { placeholder: 'e.g. Nthiga Mukundi' })}
                {inp('Company *',       'company', { placeholder: 'e.g. NthigaERPTech Ltd' })}
                {inp('Email Address',   'email',   { type: 'email', span2: true, placeholder: 'supplier@company.com' })}
                {inp('Phone Number',    'phone',   { placeholder: '0712 345 678' })}
                {inp('Full Address',    'address', { placeholder: 'e.g. Moi Ave, Nairobi' })}
              </div>

              {/* ── Stores supplied — multi-select checkboxes ───────── */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)', marginBottom: 8 }}>
                  Stores Supplied
                </label>

                {/* Global (all stores) option */}
                <div style={{ marginBottom: 8 }}>
                  <button
                    onClick={() => setFormData(prev => ({ ...prev, stores: [] }))}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '10px 14px', borderRadius: 'var(--radius-md)', border: `2px solid ${formData.stores.length === 0 ? 'var(--info)' : 'var(--border-medium)'}`, background: formData.stores.length === 0 ? 'var(--info-light)' : 'var(--bg-muted)', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
                    <div style={{ width: 18, height: 18, borderRadius: 4, border: `2px solid ${formData.stores.length === 0 ? 'var(--info)' : 'var(--border-medium)'}`, background: formData.stores.length === 0 ? 'var(--info)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {formData.stores.length === 0 && <span style={{ color: '#fff', fontSize: 12, fontWeight: 900 }}>✓</span>}
                    </div>
                    <MdPublic style={{ fontSize: 16, color: formData.stores.length === 0 ? 'var(--info-dark)' : 'var(--text-muted)' }} />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: formData.stores.length === 0 ? 'var(--info-dark)' : 'var(--text-primary)' }}>All Stores (Global)</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Supplier appears in every store's dropdown</div>
                    </div>
                  </button>
                </div>

                {/* Per-store checkboxes */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {storeNames.map(storeName => {
                    const checked = formData.stores.includes(storeName)
                    return (
                      <button key={storeName} onClick={() => toggleStore(storeName)}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 'var(--radius-md)', border: `2px solid ${checked ? 'var(--success)' : 'var(--border-medium)'}`, background: checked ? 'var(--success-light)' : 'var(--bg-muted)', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
                        <div style={{ width: 18, height: 18, borderRadius: 4, border: `2px solid ${checked ? 'var(--success)' : 'var(--border-medium)'}`, background: checked ? 'var(--success)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          {checked && <span style={{ color: '#fff', fontSize: 11, fontWeight: 900 }}>✓</span>}
                        </div>
                        <MdStorefront style={{ fontSize: 15, color: checked ? 'var(--success-dark)' : 'var(--text-muted)', flexShrink: 0 }} />
                        <span style={{ fontSize: 12, fontWeight: 700, color: checked ? 'var(--success-dark)' : 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {storeName}
                        </span>
                      </button>
                    )
                  })}
                </div>

                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
                  {formData.stores.length === 0
                    ? '🌐 This supplier will appear in all stores.'
                    : `🏪 This supplier will only appear in: ${formData.stores.join(', ')}`
                  }
                </div>
              </div>

              {/* Notes */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)', marginBottom: 6 }}>Notes</label>
                <textarea rows={2} value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Payment terms, delivery schedule, special instructions..."
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-medium)', background: 'var(--bg-muted)', color: 'var(--text-primary)', fontSize: 13, fontFamily: 'inherit', outline: 'none', resize: 'none', boxSizing: 'border-box' }}
                  onFocus={e => { e.target.style.borderColor = 'var(--primary)'; e.target.style.background = 'var(--bg-card)' }}
                  onBlur={e => { e.target.style.borderColor = 'var(--border-medium)'; e.target.style.background = 'var(--bg-muted)' }} />
              </div>

              <div className="flex justify-end gap-2.5 pt-4" style={{ borderTop: '1px solid var(--border-soft)' }}>
                <button onClick={() => setShowModal(false)}
                  style={{ padding: '9px 18px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-medium)', background: 'var(--bg-card)', color: 'var(--text-secondary)', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                  Cancel
                </button>
                <button onClick={handleSubmit} disabled={loading || !formData.name || !formData.company}
                  style={{ padding: '9px 24px', borderRadius: 'var(--radius-md)', border: 'none', background: loading || !formData.name || !formData.company ? 'var(--border-medium)' : 'var(--primary)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: loading || !formData.name || !formData.company ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
                  {loading ? 'Saving...' : editingId ? 'Update Supplier' : 'Save Supplier'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
