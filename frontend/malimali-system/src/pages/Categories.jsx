import { useState, useEffect, useCallback } from 'react'
import {
  MdAdd, MdEdit, MdDelete, MdClose, MdCategory,
  MdStorefront, MdPublic, MdInventory2,
} from 'react-icons/md'
import { useApp } from '@/context/AppContext'
import { useHistoryModal } from '@/hooks/useHistoryModal'
import { API_BASE_URL } from '@/config/api'
import styles from '@/styles/Categories.module.css'

const isTouchDevice = () => window.matchMedia('(pointer: coarse)').matches

export default function Categories() {
  const { currentUser, stores, isOwner } = useApp()

  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [storeFilter, setStoreFilter] = useState('all') // 'all' | 'global' | store name
  const [showModal, openModal, closeModal] = useHistoryModal('category-form')
  const [editingCat, setEditingCat] = useState(null)
  const [confirmId, setConfirmId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState(null)

  // Form state
  const [name, setName] = useState('')
  const [catStore, setCatStore] = useState('') // '' = global
  const [description, setDescription] = useState('')

  const token = currentUser?.token

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type }); setTimeout(() => setToast(null), 3000)
  }

  const load = useCallback(async () => {
    if (!token) return
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (storeFilter !== 'all') params.set('store', storeFilter === 'global' ? '' : storeFilter)
      const res = await fetch(`${API_BASE_URL}/api/categories?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      setCategories(data.success ? data.categories : [])
    } catch { setCategories([]) }
    setLoading(false)
  }, [token, storeFilter])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    if (!showModal) { setEditingCat(null); setName(''); setCatStore(''); setDescription(''); setError('') }
  }, [showModal])

  const openAdd = () => {
    setEditingCat(null)
    setName('')
    setCatStore(storeFilter === 'all' || storeFilter === 'global' ? '' : storeFilter)
    setDescription('')
    setError('')
    openModal()
  }

  const openEdit = (cat) => {
    setEditingCat(cat)
    setName(cat.name)
    setCatStore(cat.store || '')
    setDescription(cat.description || '')
    setError('')
    openModal()
  }

  const handleSave = async () => {
    if (!name.trim()) { setError('Category name is required'); return }
    setSaving(true); setError('')
    try {
      const url = editingCat
        ? `${API_BASE_URL}/api/categories/${editingCat._id}`
        : `${API_BASE_URL}/api/categories`
      const method = editingCat ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: name.trim(), store: catStore || null, description }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) { setError(data.message || 'Failed to save'); return }
      closeModal()
      showToast(editingCat ? 'Category updated' : 'Category created')
      load()
    } catch { setError('Network error') }
    setSaving(false)
  }

  const handleDelete = async (id) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/categories/${id}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      if (!res.ok || !data.success) { showToast(data.message || 'Failed to delete', 'error'); return }
      setConfirmId(null)
      showToast('Category deleted')
      load()
    } catch { showToast('Network error', 'error') }
  }

  // Derived
  const globalCats = categories.filter(c => !c.store)
  const storeCats = categories.filter(c => !!c.store)
  const storeNames = [...new Set(categories.filter(c => c.store).map(c => c.store))]

  // Filter tabs
  const tabs = [
    { value: 'all', label: 'All', count: categories.length },
    { value: 'global', label: '🌐 Global', count: globalCats.length },
    ...stores.map(s => ({
      value: s.name,
      label: `🏪 ${s.name}`,
      count: categories.filter(c => c.store === s.name).length
    }))
  ]

  const displayed = storeFilter === 'all' ? categories
    : storeFilter === 'global' ? globalCats
      : categories.filter(c => c.store === storeFilter)

  return (
    <div style={{ padding: '24px 28px 48px', background: 'var(--bg-page)', minHeight: '100%' }}>

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 9999, padding: '10px 18px', borderRadius: 'var(--radius-md)', background: toast.type === 'error' ? 'var(--danger)' : 'var(--success)', color: '#fff', fontWeight: 700, fontSize: 13, boxShadow: 'var(--shadow-dropdown)' }}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <MdCategory style={{ color: 'var(--primary)', fontSize: 24 }} /> Product Categories
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
            Global categories apply to all stores · Store-specific categories appear only in that store
          </p>
        </div>
        {isOwner && (
          <button
            onClick={openAdd}
            className={styles.btnAdd}
          >
            <MdAdd style={{ fontSize: 18 }} /> Add Category
          </button>
        )}
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Total Categories', value: categories.length, icon: <MdCategory />, color: 'var(--primary)', bg: 'var(--primary-light)' },
          { label: 'Global', value: globalCats.length, icon: <MdPublic />, color: 'var(--info-dark)', bg: 'var(--info-light)' },
          { label: 'Store-Specific', value: storeCats.length, icon: <MdStorefront />, color: 'var(--success-dark)', bg: 'var(--success-light)' },
          { label: 'Stores Covered', value: storeNames.length, icon: <MdInventory2 />, color: 'var(--warning-dark)', bg: 'var(--warning-light)' },
        ].map(s => (
          <div key={s.label} style={{ background: s.bg, borderRadius: 'var(--radius-lg)', padding: '14px 16px', boxShadow: 'var(--shadow-card)', border: '1px solid rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <span style={{ fontSize: 16, color: s.color }}>{s.icon}</span>
              <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em', color: s.color }}>{s.label}</span>
            </div>
            <div style={{ fontSize: 24, fontWeight: 900, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Store filter tabs */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        {tabs.map(t => (
          <button key={t.value} onClick={() => setStoreFilter(t.value)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700, border: `1px solid ${storeFilter === t.value ? 'var(--primary)' : 'var(--border-medium)'}`, background: storeFilter === t.value ? 'var(--primary)' : 'var(--bg-card)', color: storeFilter === t.value ? '#fff' : 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' }}>
            {t.label}
            <span style={{ fontSize: 10, fontWeight: 900, padding: '1px 6px', borderRadius: 10, background: storeFilter === t.value ? 'rgba(255,255,255,0.25)' : 'var(--bg-muted)', color: storeFilter === t.value ? '#fff' : 'var(--text-muted)' }}>
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {/* Categories table */}
      <div className={styles.tableCard}>
        <div className={styles.tableScroll}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--sidebar-bg)', position: 'sticky', top: 0, zIndex: 1 }}>
                {['#', 'Category Name', 'Scope', 'Products', 'Description', 'Created', 'Actions'].map((h, i) => (
                  <th key={h} style={{
                    padding: '12px 16px', fontSize: 10, fontWeight: 800, textTransform: 'uppercase',
                    letterSpacing: '0.08em', color: '#fff', textAlign: i === 0 || i === 6 ? 'center' : 'left',
                    whiteSpace: 'nowrap',
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="7" style={{ padding: '48px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Loading categories...</td></tr>
              ) : displayed.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ padding: '48px 20px', textAlign: 'center' }}>
                    <div style={{ fontSize: 40, marginBottom: 10 }}>📂</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>No categories yet</div>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                      {storeFilter === 'all' ? 'Click "Add Category" to create your first category.' : `No categories for this filter yet.`}
                    </div>
                  </td>
                </tr>
              ) : displayed.map((cat, i) => (
                <tr key={cat._id}
                  className={styles.rowHover}
                  style={{ borderBottom: '1px solid var(--border-soft)', background: i % 2 === 0 ? 'transparent' : 'var(--bg-muted)' }}
                >
                  {/* # */}
                  <td style={{ padding: '12px 16px', textAlign: 'center', fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>{i + 1}</td>

                  {/* Name */}
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', textTransform: 'capitalize' }}>
                      {cat.name}
                    </span>
                  </td>

                  {/* Scope badge */}
                  <td style={{ padding: '12px 16px' }}>
                    {cat.store ? (
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: 'var(--success-light)', color: 'var(--success-dark)', display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
                        <MdStorefront style={{ fontSize: 12 }} /> {cat.store}
                      </span>
                    ) : (
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: 'var(--info-light)', color: 'var(--info-dark)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <MdPublic style={{ fontSize: 12 }} /> Global
                      </span>
                    )}
                  </td>

                  {/* Product count */}
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ fontSize: 12, fontWeight: 700, padding: '2px 9px', borderRadius: 12, background: cat.productCount > 0 ? 'var(--primary-light)' : 'var(--bg-muted)', color: cat.productCount > 0 ? 'var(--primary)' : 'var(--text-muted)' }}>
                      {cat.productCount || 0} product{cat.productCount !== 1 ? 's' : ''}
                    </span>
                  </td>

                  {/* Description */}
                  <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-muted)', fontStyle: cat.description ? 'normal' : 'italic', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {cat.description || 'No description'}
                  </td>

                  {/* Created */}
                  <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    {cat.createdAt ? new Date(cat.createdAt).toLocaleDateString('en-KE') : '—'}
                  </td>

                  {/* Actions */}
                  <td style={{ padding: '12px 16px' }}>
                    {confirmId === cat._id ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--danger-dark)' }}>Delete?</span>
                        <button onClick={() => setConfirmId(null)}
                          style={{ padding: '3px 9px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-medium)', background: 'var(--bg-card)', color: 'var(--text-secondary)', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                          Cancel
                        </button>
                        <button onClick={() => handleDelete(cat._id)}
                          style={{ padding: '3px 9px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--danger)', color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                          Delete
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', justifyContent: 'center', gap: 6 }}>
                        {isOwner && (
                          <>
                            <button onClick={() => openEdit(cat)} title="Edit"
                              className={styles.iconEdit}>
                              <MdEdit size={16} />
                            </button>
                            <button
                              onClick={() => {
                                if (cat.productCount > 0) {
                                  showToast(`Cannot delete — ${cat.productCount} product${cat.productCount !== 1 ? 's' : ''} use this category`, 'error')
                                } else {
                                  setConfirmId(cat._id)
                                }
                              }}
                              title="Delete"
                              disabled={cat.productCount > 0}
                              className={styles.iconDelete}
                              style={{ color: cat.productCount > 0 ? 'var(--text-muted)' : 'var(--danger)', cursor: cat.productCount > 0 ? 'not-allowed' : 'pointer' }}
                            >
                              <MdDelete size={16} />
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Add / Edit Modal ─────────────────────────────────────────── */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', width: '100%', maxWidth: 460, boxShadow: 'var(--shadow-dropdown)', overflow: 'hidden' }}>

            {/* Header */}
            <div style={{ padding: '16px 20px', background: 'var(--sidebar-bg)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#fff', fontSize: 14, fontWeight: 800 }}>
                {editingCat ? 'Edit Category' : 'Add New Category'}
              </span>
              <button onClick={closeModal}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.6)', fontSize: 22, display: 'flex', alignItems: 'center', padding: 0 }}>
                <MdClose />
              </button>
            </div>

            <div style={{ padding: 20 }}>

              {/* Category name */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)', display: 'block', marginBottom: 7 }}>
                  Category Name *
                </label>
                <input
                  type="text" placeholder="e.g. Beverages, Hardware, Wines..."
                  value={name} onChange={e => { setName(e.target.value); setError('') }}
                  onKeyDown={e => e.key === 'Enter' && handleSave()}
                  autoFocus={!isTouchDevice()}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 'var(--radius-md)', border: `1.5px solid ${error ? 'var(--danger)' : 'var(--border-medium)'}`, background: 'var(--bg-muted)', fontSize: 14, color: 'var(--text-primary)', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
                  onFocus={e => { e.target.style.borderColor = 'var(--primary)'; e.target.style.background = 'var(--bg-card)' }}
                  onBlur={e => { e.target.style.borderColor = error ? 'var(--danger)' : 'var(--border-medium)'; e.target.style.background = 'var(--bg-muted)' }}
                />
              </div>

              {/* Store scope */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)', display: 'block', marginBottom: 7 }}>
                  Scope
                </label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {/* Global option */}
                  <button onClick={() => setCatStore('')}
                    style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '8px 14px', borderRadius: 'var(--radius-md)', border: `2px solid ${catStore === '' ? 'var(--info)' : 'var(--border-medium)'}`, background: catStore === '' ? 'var(--info-light)' : 'var(--bg-muted)', color: catStore === '' ? 'var(--info-dark)' : 'var(--text-secondary)', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                    <MdPublic style={{ fontSize: 16 }} /> Global (all stores)
                  </button>
                  {/* Per-store options */}
                  {stores.map(s => (
                    <button key={s._id} onClick={() => setCatStore(s.name)}
                      style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '8px 14px', borderRadius: 'var(--radius-md)', border: `2px solid ${catStore === s.name ? 'var(--success)' : 'var(--border-medium)'}`, background: catStore === s.name ? 'var(--success-light)' : 'var(--bg-muted)', color: catStore === s.name ? 'var(--success-dark)' : 'var(--text-secondary)', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                      <MdStorefront style={{ fontSize: 16 }} /> {s.name}
                    </button>
                  ))}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.5 }}>
                  {catStore === ''
                    ? '🌐 This category will be visible when adding products to any store.'
                    : `🏪 This category will only appear when adding products to "${catStore}".`
                  }
                </div>
              </div>

              {/* Description */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)', display: 'block', marginBottom: 7 }}>
                  Description (optional)
                </label>
                <input type="text" placeholder="e.g. Alcoholic beverages and spirits"
                  value={description} onChange={e => setDescription(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-medium)', background: 'var(--bg-muted)', fontSize: 13, color: 'var(--text-primary)', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
                  onFocus={e => { e.target.style.borderColor = 'var(--primary)'; e.target.style.background = 'var(--bg-card)' }}
                  onBlur={e => { e.target.style.borderColor = 'var(--border-medium)'; e.target.style.background = 'var(--bg-muted)' }}
                />
              </div>

              {error && (
                <div style={{ padding: '10px 14px', borderRadius: 'var(--radius-md)', background: 'var(--danger-light)', border: '1px solid var(--danger)', color: 'var(--danger-dark)', fontSize: 13, fontWeight: 600, marginBottom: 16 }}>
                  ❌ {error}
                </div>
              )}

              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={closeModal}
                  style={{ flex: 1, padding: '10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-medium)', background: 'var(--bg-muted)', fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'inherit' }}>
                  Cancel
                </button>
                <button onClick={handleSave} disabled={saving || !name.trim()}
                  style={{ flex: 2, padding: '10px', borderRadius: 'var(--radius-md)', border: 'none', background: saving || !name.trim() ? 'var(--bg-muted)' : 'var(--primary)', fontSize: 13, fontWeight: 700, color: saving || !name.trim() ? 'var(--text-muted)' : '#fff', cursor: saving || !name.trim() ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
                  {saving ? 'Saving...' : editingCat ? 'Update Category' : 'Create Category'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
