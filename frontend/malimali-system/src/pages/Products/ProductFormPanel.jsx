import { useMemo, useEffect } from 'react'
import { MdClose, MdQrCodeScanner, MdKeyboard, MdPrint, MdScale } from 'react-icons/md'
import FormInput from './FormInput'
import FormInputDropdown from './FormInputDropdown'
import { API_BASE_URL } from '@/config/api'
import styles from '@/styles/Products.module.css'

export default function ProductFormPanel({
  showModal, editProduct, mode, setMode,
  barcode, setBarcode, savedBarcode,
  error, success, form, setForm,
  categories, suppliers, stores,
  handleScan, saveProduct,
  closeModal, printBarcode,
  products = [],
}) {

  // ── Category list filtered by selected store ──────────────────────
  const filteredCategories = useMemo(() => {
    const selectedStore = form.store
    if (!selectedStore) {
      return categories
        .filter(c => !c.store)
        .map(c => c.name || c)
    }
    return categories
      .filter(c => !c.store || c.store === selectedStore)
      .map(c => c.name || c)
  }, [form.store, categories])

  const filteredSuppliers = useMemo(() => {
    const selectedStore = form.store
    const active = suppliers.filter(s => s.isActive !== false)
    if (!selectedStore) return active
    return active.filter(s => {
      const supStores = Array.isArray(s.stores) && s.stores.length > 0
        ? s.stores
        : s.store ? [s.store] : []
      return supStores.length === 0 || supStores.includes(selectedStore)
    })
  }, [form.store, suppliers])

  const handleStoreChange = (newStore) => {
    const validCategories = categories
      .filter(c => !c.store || c.store === newStore)
      .map(c => c.name || c)

    const validSuppliers = suppliers.filter(s => {
      if (s.isActive === false) return false
      const supStores = Array.isArray(s.stores) && s.stores.length > 0
        ? s.stores
        : s.store ? [s.store] : []
      return supStores.length === 0 || supStores.includes(newStore)
    })
    const validSupplierNames = validSuppliers.map(s => s.name || s)

    setForm({
      ...form,
      store: newStore,
      category: validCategories.includes(form.category) ? form.category : '',
      supplier: validSupplierNames.includes(form.supplier) ? form.supplier : '',
    })
  }

  // ── PLU auto-suggest + duplicate detection ────────────────────────
  const usedPLUs = useMemo(() => {
    return products
      .filter(p => p.isWeighed && p.pluNumber && (!editProduct || p._id !== editProduct._id))
      .map(p => Number(p.pluNumber))
      .filter(n => n > 0)
  }, [products, editProduct])

  const suggestedPLU = useMemo(() => {
    if (!form.isWeighed) return null
    let candidate = 1
    const sorted = [...usedPLUs].sort((a, b) => a - b)
    for (const used of sorted) {
      if (used === candidate) candidate++
      else break
    }
    return candidate
  }, [form.isWeighed, usedPLUs])

  // Auto-fill PLU when weighed is first enabled and no PLU set yet
  useEffect(() => {
    if (form.isWeighed && !form.pluNumber && suggestedPLU) {
      setForm(prev => {
        // Only fill if still empty — never overwrite what the manager typed
        if (prev.pluNumber) return prev
        return { ...prev, pluNumber: String(suggestedPLU) }
      })
    }
    // Intentionally only runs when isWeighed is first toggled on
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.isWeighed])

  const pluConflict = useMemo(() => {
    if (!form.isWeighed || !form.pluNumber) return null
    const entered = Number(form.pluNumber)
    if (!entered || entered <= 0) return null
    const conflict = products.find(p =>
      p.isWeighed &&
      Number(p.pluNumber) === entered &&
      (!editProduct || p._id !== editProduct._id)
    )
    return conflict || null
  }, [form.pluNumber, form.isWeighed, products, editProduct])

  // ── Toggle weighed item on/off ────────────────────────────────────
  const handleWeighedToggle = (checked) => {
    setForm({
      ...form,
      isWeighed: checked,
      // When enabling, copy sellPrice into pricePerKg as a starting point
      pricePerKg: checked ? (form.sellPrice || '') : '',
      // When disabling, clear PLU
      pluNumber: checked ? form.pluNumber : '',
      // Weighed items are always tracked in kg
      unit: checked ? 'kg' : form.unit,
    })
  }

  return (
    <div
      className={`fixed top-0 right-0 h-full w-full md:w-[480px] z-40 flex flex-col transition-transform duration-300 ease-out
        ${showModal ? 'translate-x-0' : 'translate-x-full'}`}
      style={{
        background: 'var(--bg-card)',
        boxShadow: '-4px 0 32px rgba(15,23,42,0.12)',
        borderLeft: '1px solid var(--border-soft)',
      }}
    >
      {/* ── Header ─────────────────────────────────────────────── */}
      <div
        className="flex-shrink-0 flex justify-between items-center px-5 py-4"
        style={{ background: 'var(--sidebar-bg)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}
      >
        <h3 className="text-sm font-bold text-white truncate pr-2">
          {editProduct ? `Edit — ${editProduct.name}` : 'Add New Product'}
        </h3>
        <button
          onClick={closeModal}
          className={`w-8 h-8 flex items-center justify-center rounded-lg transition flex-shrink-0 ${styles.formCloseBtn}`}
        >
          <MdClose size={18} />
        </button>
      </div>

      {/* ── Mode Toggle (Add only) ──────────────────────────────── */}
      {!editProduct && (
        <div
          className="flex-shrink-0 flex gap-2 px-5 pt-4 pb-2"
          style={{ borderBottom: '1px solid var(--border-soft)' }}
        >
          {[
            { key: 'scan', label: 'Scan Product', icon: <MdQrCodeScanner /> },
            { key: 'manual', label: 'Manual Entry', icon: <MdKeyboard /> },
          ].map(m => (
            <button
              key={m.key}
              onClick={() => setMode(m.key)}
              className="flex-1 py-2 rounded-lg flex items-center justify-center gap-2 text-sm font-semibold transition"
              style={mode === m.key
                ? { background: 'var(--primary)', color: '#fff' }
                : { background: 'var(--bg-muted)', color: 'var(--text-secondary)' }
              }
            >
              {m.icon} {m.label}
            </button>
          ))}
        </div>
      )}

      {/* ── Scanner Input ───────────────────────────────────────── */}
      {mode === 'scan' && !editProduct && (
        <div
          className="flex-shrink-0 px-5 py-3"
          style={{ borderBottom: '1px solid var(--border-soft)', background: 'var(--bg-muted)' }}
        >
          <div className="flex items-center gap-2 mb-2">
            <span className="relative flex h-2.5 w-2.5">
              <span
                className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
                style={{ background: 'var(--success)' }}
              />
              <span
                className="relative inline-flex rounded-full h-2.5 w-2.5"
                style={{ background: 'var(--success)' }}
              />
            </span>
            <span className="text-xs font-bold" style={{ color: 'var(--success-dark)' }}>
              Scanner Ready
            </span>
          </div>
          <input
            autoFocus
            type="text"
            value={barcode}
            onChange={e => setBarcode(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && barcode.trim()) handleScan(barcode) }}
            className="w-full px-3 py-2 rounded-lg text-sm outline-none"
            placeholder="Waiting for scan..."
            style={{
              border: '1px solid var(--success)',
              background: 'var(--success-light)',
              color: 'var(--success-dark)',
            }}
          />
        </div>
      )}

      {/* ── Form Fields ─────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-5 pb-6 pt-4">
        <div className="grid grid-cols-2 gap-x-4">

          <FormInput
            label="Product Batch"
            placeholder="e.g Jan-2026 Batch"
            value={form.batch || ''}
            onChange={v => setForm({ ...form, batch: v })}
          />
          <FormInput
            label="Product Name"
            placeholder="e.g T-Shirt"
            value={form.name || ''}
            onChange={v => setForm({ ...form, name: v })}
          />

          <div className="col-span-2">
            <FormInput
              label="Description"
              placeholder="Detailed description..."
              value={form.description || ''}
              onChange={v => setForm({ ...form, description: v })}
            />
          </div>

          <FormInput
            label="Cost Price"
            placeholder="0.00"
            value={form.buyPrice || ''}
            onChange={v => setForm({ ...form, buyPrice: v })}
          />
          <FormInput
            label={form.isWeighed ? 'Selling Price (per kg)' : 'Selling Price'}
            placeholder="0.00"
            value={form.sellPrice || ''}
            onChange={v => setForm({ ...form, sellPrice: v, pricePerKg: form.isWeighed ? v : form.pricePerKg })}
          />

          <div className="col-span-2 md:col-span-1">
            <FormInput
              label={`Qty${form.unit ? ` (${form.unit})` : ''}`}
              placeholder="0"
              value={form.stock || ''}
              onChange={v => setForm({ ...form, stock: v })}
            />
          </div>

          <div className="col-span-2 md:col-span-1">
            <FormInputDropdown
              label="Unit"
              value={form.unit || ''}
              onChange={v => setForm({ ...form, unit: v })}
              options={['kg', 'g', 'l', 'ml', 'pcs', 'box', 'carton', 'pack', 'dozen', 'crate', 'bag', 'bale', 'tray', 'roll', 'bottle', 'set']}
            />
          </div>

          <FormInputDropdown
            label={form.store ? `Supplier (${filteredSuppliers.length} available)` : 'Supplier'}
            value={form.supplier || ''}
            onChange={v => setForm({ ...form, supplier: v })}
            options={filteredSuppliers}
          />

          {/* Store must come BEFORE category so filter works */}
          <div className="col-span-2 md:col-span-1">
            <FormInputDropdown
              label="Warehouse / Store"
              value={form.store || ''}
              onChange={handleStoreChange}
              options={stores}
            />
          </div>

          {/* Category — filtered by selected store */}
          <div className="col-span-2 md:col-span-1">
            <FormInputDropdown
              label={
                form.store
                  ? `Category (${filteredCategories.length} available)`
                  : 'Category'
              }
              value={form.category || ''}
              onChange={v => setForm({ ...form, category: v })}
              options={filteredCategories}
            />
            {form.store && (
              <div style={{
                fontSize: 10, color: 'var(--text-muted)',
                marginTop: 3, fontWeight: 600,
              }}>
                Showing global + {form.store} categories
              </div>
            )}
          </div>

          <FormInput
            label="MFT Date"
            type="date"
            value={form.mftDate || ''}
            onChange={v => setForm({ ...form, mftDate: v })}
          />
          <FormInput
            label="Expiry Date"
            type="date"
            value={form.expiryDate || ''}
            onChange={v => setForm({ ...form, expiryDate: v })}
          />

          {/* ── Weighed Item Toggle ─────────────────────────────── */}
          <div className="col-span-2 mt-2">
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                cursor: 'pointer',
                padding: '10px 14px',
                borderRadius: 'var(--radius-md)',
                border: `1.5px solid ${form.isWeighed ? 'var(--primary)' : 'var(--border-soft)'}`,
                background: form.isWeighed ? 'var(--primary-light)' : 'var(--bg-muted)',
                transition: 'all 0.15s',
              }}
            >
              <input
                type="checkbox"
                checked={!!form.isWeighed}
                onChange={e => handleWeighedToggle(e.target.checked)}
                style={{ accentColor: 'var(--primary)', width: 16, height: 16, flexShrink: 0 }}
              />
              <MdScale
                size={16}
                style={{ color: form.isWeighed ? 'var(--primary)' : 'var(--text-muted)', flexShrink: 0 }}
              />
              <div>
                <div style={{
                  fontSize: 13, fontWeight: 700,
                  color: form.isWeighed ? 'var(--primary)' : 'var(--text-primary)',
                }}>
                  Sold by Weight
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>
                  Sugar, rice, meat, tomatoes — price calculated per kg at weigh station
                </div>
              </div>
            </label>
          </div>

          {/* ── PLU + Price per KG — shown only when isWeighed ── */}
          {form.isWeighed && (
            <>
              <FormInput
                label="Price per KG (KSh)"
                placeholder="e.g. 100"
                value={form.pricePerKg || ''}
                onChange={v => setForm({ ...form, pricePerKg: v, sellPrice: v })}
              />
              <div>
                <FormInput
                  label="PLU Number (1–99999)"
                  placeholder={suggestedPLU ? `Suggested: ${suggestedPLU}` : 'e.g. 1'}
                  value={form.pluNumber || ''}
                  onChange={v => setForm({ ...form, pluNumber: v })}
                />
                {/* Duplicate warning */}
                {pluConflict ? (
                  <div style={{
                    fontSize: 11, marginTop: 4, fontWeight: 700,
                    color: 'var(--danger-dark)',
                    background: 'var(--danger-light)',
                    border: '1px solid var(--danger)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '5px 8px',
                  }}>
                    PLU {form.pluNumber} is already assigned to <strong>{pluConflict.name}</strong> ({pluConflict.store}). Choose a different number.
                  </div>
                ) : form.pluNumber && Number(form.pluNumber) > 0 ? (
                  <div style={{ fontSize: 10, color: 'var(--success-dark)', marginTop: 3, fontWeight: 600 }}>
                    ✓ PLU {form.pluNumber} is available
                  </div>
                ) : (
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3, fontWeight: 600 }}>
                    Program this number on your DIGI SM-500 scale
                    {suggestedPLU && ` · Next available: ${suggestedPLU}`}
                  </div>
                )}
              </div>

              {/* Price preview */}
              {form.pricePerKg && Number(form.pricePerKg) > 0 && (
                <div
                  className="col-span-2"
                  style={{
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--primary-light)',
                    border: '1px solid var(--primary)',
                    fontSize: 12,
                    color: 'var(--primary)',
                    fontWeight: 600,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>500g would cost:</span>
                    <span>KSh {(Number(form.pricePerKg) * 0.5).toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                    <span>250g would cost:</span>
                    <span>KSh {(Number(form.pricePerKg) * 0.25).toFixed(2)}</span>
                  </div>
                </div>
              )}
            </>
          )}

        </div>

        {/* Feedback messages */}
        {error && (
          <div
            className="text-sm mt-3 px-3 py-2 rounded-lg"
            style={{
              borderLeft: '3px solid var(--danger)',
              background: 'var(--danger-light)',
              color: 'var(--danger-dark)',
            }}
          >
            {error}
          </div>
        )}
        {success && (
          <div
            className="text-sm mt-3 px-3 py-2 rounded-lg"
            style={{
              borderLeft: '3px solid var(--success)',
              background: 'var(--success-light)',
              color: 'var(--success-dark)',
            }}
          >
            {success}
          </div>
        )}

        {/* Save / Cancel */}
        {!savedBarcode && (
          <div className="flex gap-2.5 mt-6">
            <button
              onClick={saveProduct}
              disabled={!!pluConflict}
              className={`flex-1 py-2.5 rounded-lg text-sm font-bold text-white transition ${pluConflict ? styles.formSaveBtnDisabled : styles.formSaveBtn}`}
            >
              {editProduct ? 'Update Product' : 'Save Product'}
            </button>
            <button
              onClick={closeModal}
              className={`py-2.5 px-4 rounded-lg text-sm font-semibold transition ${styles.formCancelBtn}`}
            >
              Cancel
            </button>
          </div>
        )}

        {/* Barcode display after save */}
        {savedBarcode && (
          <div
            className="mt-6 pt-5 text-center"
            style={{ borderTop: '1px solid var(--border-soft)' }}
          >
            <p
              className="text-xs font-bold uppercase tracking-wider mb-3"
              style={{ color: 'var(--text-muted)' }}
            >
              Product Barcode
            </p>
            <img
              src={`${API_BASE_URL}/api/products/barcode/${savedBarcode}`}
              alt="Barcode"
              className="mx-auto mb-3 rounded-lg"
              style={{
                border: '1px solid var(--border-soft)',
                padding: '8px',
                background: '#fff',
              }}
            />
            <button
              onClick={printBarcode}
              className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold text-white transition ${styles.formPrintBtn}`}
            >
              <MdPrint /> Print Barcode Label
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
