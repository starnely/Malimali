import { useState, useEffect } from 'react'
import { MdAdd, MdEdit, MdDelete, MdClose, MdStorefront } from 'react-icons/md'
import { useApp } from '@/context/AppContext'
import { useHistoryModal } from '@/hooks/useHistoryModal'
import { API_BASE_URL } from '@/config/api'
import styles from '@/styles/Stores.module.css'

const isTouchDevice = () => window.matchMedia('(pointer: coarse)').matches

const emptyForm = { name: '', location: '', phone: '' }

export default function Stores() {
  const { stores, fetchStores, fetchProducts, currentUser } = useApp()

  const [showModal, openModal, closeModal] = useHistoryModal('store-form')
  const [loading,        setLoading]        = useState(false)
  const [editingId,      setEditingId]      = useState(null)
  const [confirmId,      setConfirmId]      = useState(null)
  const [formData,       setFormData]       = useState(emptyForm)
  const [cascadeWarning, setCascadeWarning] = useState(false)

  useEffect(() => {
    if (currentUser?.token) fetchStores()
  }, [currentUser?.token, fetchStores])
  useEffect(() => { if (!showModal) { setEditingId(null); setFormData(emptyForm) } }, [showModal])

  const handleSubmit = async () => {
    if (!formData.name.trim()) return
    setLoading(true)
    setCascadeWarning(false)
    try {
      const url    = editingId
        ? `${API_BASE_URL}/api/stores/${editingId}`
        : `${API_BASE_URL}/api/stores`
      const method = editingId ? 'PUT' : 'POST'
      const res    = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${currentUser?.token}`,
        },
        body: JSON.stringify(formData),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Failed to save store')
      closeModal()
      setFormData(emptyForm)
      setEditingId(null)
      await fetchStores()
      await fetchProducts()
      if (data.cascadeWarning) setCascadeWarning(true)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id) => {
    try {
      await fetch(`${API_BASE_URL}/api/stores/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${currentUser?.token}` },
      })
      setConfirmId(null)
      await fetchStores()
    } catch (err) {
      console.error(err)
    }
  }

  const openEditModal = (store) => {
    setFormData({ name: store.name, location: store.location || '', phone: store.phone || '' })
    setEditingId(store._id)
    openModal()
  }

  const openAddModal = () => {
    setFormData(emptyForm)
    setEditingId(null)
    openModal()
  }

  return (
    <div className="flex flex-col min-h-full md:h-full md:overflow-hidden" style={{ background: 'var(--bg-page)' }}>

      {/* ── Cascade warning banner ─────────────────────── */}
      {cascadeWarning && (
        <div className="flex-shrink-0 mx-6 mt-4 flex items-start gap-2.5 p-3.5 rounded-xl text-xs font-medium"
          style={{ background: 'var(--warning-light)', border: '1px solid var(--warning-dark)', color: 'var(--warning-dark)' }}>
          <span className="flex-shrink-0 mt-0.5">⚠️</span>
          <span>Store renamed, but some linked records (products, sales, expenses) may not have updated. Please contact your administrator to run a data repair.</span>
          <button onClick={() => setCascadeWarning(false)} className="ml-auto flex-shrink-0 font-bold opacity-60 hover:opacity-100">✕</button>
        </div>
      )}

      {/* ── Fixed header ───────────────────────────────── */}
      <div className="flex-shrink-0 px-6 pt-6 pb-4 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
            <MdStorefront style={{ color: 'var(--primary)' }} /> Store Management
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Add and manage your company's branches and retail terminals
          </p>
        </div>
        <button
          onClick={openAddModal}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold text-white transition ${styles.btnAdd}`}
        >
          <MdAdd /> Add Branch
        </button>
      </div>

      {/* ── Scrollable content ──────────────────────────── */}
      <div className="md:flex-1 md:overflow-y-auto px-6 pb-6">
        <div
          className="rounded-xl overflow-hidden"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-soft)', boxShadow: 'var(--shadow-card)' }}
        >
          <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr style={{ background: 'var(--sidebar-bg)' }}>
                {['S/N', 'Branch Name', 'Location', 'Phone', 'Actions'].map(h => (
                  <th
                    key={h}
                    className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-white"
                    style={{ textAlign: h === 'S/N' || h === 'Actions' ? 'center' : 'left' }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {!stores || stores.length === 0 ? (
                <tr>
                  <td colSpan="5" className="py-12 text-center">
                    <div className="text-4xl mb-2">🏢</div>
                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                      No branches yet. Click "Add Branch" to get started.
                    </p>
                  </td>
                </tr>
              ) : (
                stores.map((store, i) => (
                  <tr
                    key={store._id || i}
                    className={styles.rowHover}
                    style={{
                      borderBottom: '1px solid var(--border-soft)',
                      background: i % 2 === 0 ? 'transparent' : 'var(--bg-muted)',
                    }}
                  >
                    <td className="px-4 py-3 text-center text-sm font-medium" style={{ color: 'var(--text-muted)' }}>
                      {i + 1}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-bold" style={{ color: 'var(--text-primary)' }}>{store.name}</div>
                      <div
                        className="text-[10px] font-black uppercase tracking-widest mt-0.5"
                        style={{ color: 'var(--success-dark)' }}
                      >
                        Active Unit
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm italic" style={{ color: 'var(--text-secondary)' }}>
                      {store.location || 'No location set'}
                    </td>
                    <td className="px-4 py-3 font-mono text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {store.phone || '—'}
                    </td>
                    <td className="px-4 py-3">
                      {confirmId === store._id ? (
                        <div className="flex items-center gap-2 justify-center">
                          <span className="text-xs font-semibold" style={{ color: 'var(--danger-dark)' }}>Delete?</span>
                          <button
                            onClick={() => setConfirmId(null)}
                            className="px-2 py-1 rounded text-xs font-semibold transition"
                            style={{ border: '1px solid var(--border-medium)', color: 'var(--text-secondary)', background: 'var(--bg-card)' }}
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleDelete(store._id)}
                            className="px-2 py-1 rounded text-xs font-bold text-white transition"
                            style={{ background: 'var(--danger)' }}
                          >
                            Yes
                          </button>
                        </div>
                      ) : (
                        <div className="flex justify-center gap-3">
                          <button
                            onClick={() => openEditModal(store)}
                            className={styles.iconEdit}
                          >
                            <MdEdit size={17} />
                          </button>
                          <button
                            onClick={() => setConfirmId(store._id)}
                            className={styles.iconDelete}
                          >
                            <MdDelete size={17} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          </div>
        </div>
      </div>

      {/* ── Modal ───────────────────────────────────────── */}
      {showModal && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50 p-4"
          style={{ background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)' }}
        >
          <div
            className="w-full max-w-md rounded-xl overflow-hidden"
            style={{ background: 'var(--bg-card)', boxShadow: 'var(--shadow-dropdown)' }}
          >
            <div
              className="px-5 py-4 flex items-center justify-between"
              style={{ background: 'var(--sidebar-bg)' }}
            >
              <span className="text-white text-sm font-bold">
                {editingId ? 'Edit Branch' : 'Add New Branch'}
              </span>
              <button
                onClick={closeModal}
                className="w-7 h-7 flex items-center justify-center rounded-lg transition"
                style={{ color: 'rgba(255,255,255,0.6)' }}
                onMouseEnter={e => { if (!isTouchDevice()) e.currentTarget.style.background = 'rgba(255,255,255,0.1)' }}
                onMouseLeave={e => { if (!isTouchDevice()) e.currentTarget.style.background = 'transparent' }}
              >
                <MdClose size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {[
                { label: 'Branch / Store Name *', key: 'name',     placeholder: 'e.g. Mombasa Branch' },
                { label: 'Location / Address',    key: 'location', placeholder: 'e.g. Moi Avenue, Nairobi' },
                { label: 'Contact Phone',         key: 'phone',    placeholder: 'e.g. +254 712 345 678' },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    {f.label}
                  </label>
                  <input
                    type="text"
                    placeholder={f.placeholder}
                    value={formData[f.key]}
                    onChange={e => setFormData({ ...formData, [f.key]: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none transition-all"
                    style={{ border: '1px solid var(--border-medium)', background: 'var(--bg-muted)', color: 'var(--text-primary)' }}
                    onFocus={e => { e.target.style.borderColor = 'var(--primary)'; e.target.style.boxShadow = '0 0 0 3px var(--primary-light)'; e.target.style.background = 'var(--bg-card)' }}
                    onBlur={e  => { e.target.style.borderColor = 'var(--border-medium)'; e.target.style.boxShadow = 'none'; e.target.style.background = 'var(--bg-muted)' }}
                  />
                </div>
              ))}

              <div className="flex justify-end gap-2.5 pt-2" style={{ borderTop: '1px solid var(--border-soft)' }}>
                <button
                  onClick={closeModal}
                  className="px-4 py-2 rounded-lg text-sm font-semibold transition"
                  style={{ border: '1px solid var(--border-medium)', color: 'var(--text-secondary)', background: 'var(--bg-card)' }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={loading || !formData.name.trim()}
                  className="px-5 py-2 rounded-lg text-sm font-bold text-white transition"
                  style={{
                    background: loading || !formData.name.trim() ? 'var(--border-medium)' : 'var(--primary)',
                    cursor: loading || !formData.name.trim() ? 'not-allowed' : 'pointer',
                  }}
                >
                  {loading ? 'Saving...' : editingId ? 'Update' : 'Add Branch'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
