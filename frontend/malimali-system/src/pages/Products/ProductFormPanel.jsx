import { useMemo } from 'react'
import { MdClose, MdQrCodeScanner, MdKeyboard, MdPrint } from 'react-icons/md'
import FormInput from './FormInput'
import FormInputDropdown from './FormInputDropdown'

export default function ProductFormPanel({
  showModal, editProduct, mode, setMode,
  barcode, setBarcode, savedBarcode,
  error, success, form, setForm,
  categories, suppliers, stores,
  handleScan, saveProduct,
  closeModal, printBarcode,
}) {

  // ── Category list filtered by selected store ──────────────────────
  // Derived during render — no useEffect needed
  const filteredCategories = useMemo(() => {
    const selectedStore = form.store
    if (!selectedStore) {
      // No store selected — show only global categories
      return categories
        .filter(c => !c.store)
        .map(c => c.name || c)
    }
    // Show global + this store's categories
    return categories
      .filter(c => !c.store || c.store === selectedStore)
      .map(c => c.name || c)
  }, [form.store, categories])

  const filteredSuppliers = useMemo(() => {
    const selectedStore = form.store
    if (!selectedStore) return suppliers
    return suppliers.filter(s => {
      const supStores = Array.isArray(s.stores) && s.stores.length > 0
        ? s.stores
        : s.store ? [s.store] : []
      return supStores.length === 0 || supStores.includes(selectedStore)
    })
  }, [form.store, suppliers])

  // When store changes, clear category if it's no longer in the filtered list
  const handleStoreChange = (newStore) => {
    const validCategories = categories
      .filter(c => !c.store || c.store === newStore)
      .map(c => c.name || c)

    const validSuppliers = suppliers.filter(s => {
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

  return (
    <div
      className={`fixed top-0 right-0 h-full w-[480px] z-40 flex flex-col transition-transform duration-300 ease-out
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
          className="w-8 h-8 flex items-center justify-center rounded-lg transition flex-shrink-0"
          style={{ color: 'rgba(255,255,255,0.6)' }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
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
            label="Selling Price"
            placeholder="0.00"
            value={form.sellPrice || ''}
            onChange={v => setForm({ ...form, sellPrice: v })}
          />

          <div className="col-span-2 md:col-span-1">
            <FormInput
              label="Qty (Cartons/Units)"
              placeholder="0"
              value={form.stock || ''}
              onChange={v => setForm({ ...form, stock: v })}
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
              className="flex-1 py-2.5 rounded-lg text-sm font-bold text-white transition"
              style={{ background: 'var(--primary)' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--primary-dark)'}
              onMouseLeave={e => e.currentTarget.style.background = 'var(--primary)'}
            >
              {editProduct ? 'Update Product' : 'Save Product'}
            </button>
            <button
              onClick={closeModal}
              className="py-2.5 px-4 rounded-lg text-sm font-semibold transition"
              style={{
                background: 'var(--bg-muted)',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border-soft)',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--border-soft)'}
              onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-muted)'}
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
              src={`http://localhost:5000/api/products/barcode/${savedBarcode}`}
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
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold text-white transition"
              style={{ background: 'var(--primary)' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--primary-dark)'}
              onMouseLeave={e => e.currentTarget.style.background = 'var(--primary)'}
            >
              <MdPrint /> Print Barcode Label
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
