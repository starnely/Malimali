import { useState, useEffect, useCallback } from 'react'
import { MdAdd } from 'react-icons/md'
import { useLocation, useNavigate } from 'react-router-dom'
import { useApp } from '@/context/AppContext'
import { useWindowSize } from '@/hooks/useWindowSize'
import { useHistoryModal } from '@/hooks/useHistoryModal'
import styles from '@/styles/Products.module.css'

import ProductFilters from './ProductFilters'
import ProductList from './ProductList'
import ProductFormPanel from './ProductFormPanel'
import RestockModal from './RestockModal'
import DeleteConfirmModal from './DeleteConfirmModal'
import { API_BASE_URL } from '@/config/api'

const emptyForm = {
  name: '', category: '', supplier: '', store: '',
  buyPrice: '', sellPrice: '', stock: '',
  batch: '', description: '', mftDate: '', expiryDate: '',
  isWeighed: false, pricePerKg: '', pluNumber: '',
  unit: 'pcs',
}

export default function Products() {
  const {
    products: contextProducts,
    fetchProducts,
    currentUser,
    categories,
    suppliers,
    stores,
    settings
  } = useApp()

  const { isMobile } = useWindowSize()
  const products = Array.isArray(contextProducts) ? contextProducts : []
  const location = useLocation()
  const navigate = useNavigate()

  // ── State ──────────────────────────────────────────────
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('All')
  const [storeFilter, setStoreFilter] = useState('All')
  const [showModal, openModal, closeModalHistory] = useHistoryModal('products-form')
  const [editProduct, setEditProduct] = useState(null)
  const [showRestock, openRestock, closeRestock] = useHistoryModal('restock')
  const [restockProduct, setRestockProduct] = useState(null)
  const [restockQty, setRestockQty] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [mode, setMode] = useState('manual')
  const [barcode, setBarcode] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [savedBarcode, setSavedBarcode] = useState('')

  const showLowStockOnly = location.state?.filter === 'lowStock'

  // ── Helpers ────────────────────────────────────────────
  const closeModal = useCallback(() => {
    setEditProduct(null)
    setError('')
    setSuccess('')
    setSavedBarcode('')
    closeModalHistory()
  }, [setEditProduct, closeModalHistory])

  // ── Build a fresh form pre-filled with the active store filter's
  //    batch (current month/year) and store name ───────────────────
  const buildAutoFilledForm = useCallback(() => {
    const now = new Date()
    const monthYear = now.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }).replace(' ', '-')
    // e.g. "Jun-2026"
    return {
      ...emptyForm,
      batch: storeFilter !== 'All' ? `${monthYear} Batch` : '',
      store: storeFilter !== 'All' ? storeFilter : '',
    }
  }, [storeFilter])

  const openEdit = useCallback((product) => {
    setEditProduct(product)
    setForm({
      name: product.name || '',
      category: product.category || '',
      unit: product.unit || 'pcs',
      supplier: product.supplier || '',
      store: product.store || '',
      buyPrice: product.buyPrice || '',
      sellPrice: product.sellPrice || '',
      stock: product.stock || '',
      batch: product.batch || '',
      description: product.description || '',
      mftDate: product.mftDate ? product.mftDate.split('T')[0] : '',
      expiryDate: product.expiryDate ? product.expiryDate.split('T')[0] : '',
      isWeighed: product.isWeighed || false,
      pricePerKg: product.pricePerKg || '',
      pluNumber: product.pluNumber || '',
    })
    setMode('manual')
    setBarcode('')
    setSavedBarcode('')
    setError('')
    setSuccess('')
    openModal()
  }, [setEditProduct, setForm, setMode, setBarcode, setSavedBarcode, setError, setSuccess, openModal])

  const openAdd = () => {
    setEditProduct(null)
    setForm(buildAutoFilledForm())
    setMode('manual')
    setBarcode('')
    setSavedBarcode('')
    setError('')
    setSuccess('')
    openModal()
  }

  const handleScan = useCallback((barcodeValue) => {
    const code = barcodeValue || barcode
    if (!code.trim()) return
    setBarcode(code.trim())
    setSuccess('Barcode captured!')
    setError('')
  }, [barcode, setBarcode, setError, setSuccess])

  const printBarcode = useCallback(() => {
    if (savedBarcode) {
      window.open(`${API_BASE_URL}/api/products/barcode/${savedBarcode}`, '_blank')
    }
  }, [savedBarcode])

  const saveProduct = async () => {
    if (!form.name || !form.buyPrice || !form.sellPrice || !form.stock || !form.category || !form.supplier) {
      setError('Missing required fields (Name, Prices, Stock, Category, Supplier)')
      return
    }

    // Extra validation for weighed items
    // Extra validation for weighed items
    if (form.isWeighed && !form.pluNumber) {
      setError('Weighed items require a PLU Number for the scale.')
      return
    }
    if (form.isWeighed && !form.pricePerKg) {
      setError('Weighed items require a Price per KG.')
      return
    }
    if (form.isWeighed && form.pluNumber) {
      const enteredPLU = Number(form.pluNumber)
      const conflict = products.find(p =>
        p.isWeighed &&
        Number(p.pluNumber) === enteredPLU &&
        (!editProduct || p._id !== editProduct._id)
      )
      if (conflict) {
        setError(`PLU ${form.pluNumber} is already assigned to "${conflict.name}" (${conflict.store}). Choose a different PLU number.`)
        return
      }
    }

    const data = {
      ...form,
      buyPrice: Number(form.buyPrice),
      sellPrice: Number(form.sellPrice),
      stock: Number(form.stock),
      isWeighed: !!form.isWeighed,
      pricePerKg: Number(form.pricePerKg) || 0,
      pluNumber: form.pluNumber ? Number(form.pluNumber) : null,
      barcode: barcode.trim() || editProduct?.barcode || undefined,
    }

    try {
      const url = editProduct
        ? `${API_BASE_URL}/api/products/${editProduct._id}`
        : `${API_BASE_URL}/api/products`
      const method = editProduct ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${currentUser?.token}` },
        body: JSON.stringify(data),
      })
      const result = await res.json()
      if (result.success) {
        setSuccess(editProduct ? 'Product updated!' : 'Product saved!')
        fetchProducts()
        if (editProduct) {
          setTimeout(() => closeModal(), 1000)
        } else {
          if (result.product?.barcode) setSavedBarcode(result.product.barcode)
          setTimeout(() => {
            setForm(buildAutoFilledForm())
            setBarcode('')
            setSavedBarcode('')
            setSuccess('')
          }, 3000)
        }
      } else {
        setError(result.message || 'Error saving product')
      }
    } catch (err) {
      console.error('Save product error:', err)
      setError('Server connection failed')
    }
  }

  const confirmRestock = async () => {
    const qty = Number(restockQty)
    if (!restockProduct || isNaN(qty) || qty <= 0) {
      alert('Please enter a valid quantity')
      return
    }
    try {
      const res = await fetch(`${API_BASE_URL}/api/products/${restockProduct._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${currentUser?.token}`
        },
        body: JSON.stringify({
          name: restockProduct.name,
          category: restockProduct.category || '',
          supplier: restockProduct.supplier || '',
          store: restockProduct.store || 'Main Store',
          unit: restockProduct.unit || 'pcs',
          buyPrice: restockProduct.buyPrice || 0,
          sellPrice: restockProduct.sellPrice || 0,
          batch: restockProduct.batch || '',
          description: restockProduct.description || '',
          mftDate: restockProduct.mftDate || null,
          expiryDate: restockProduct.expiryDate || null,
          isWeighed: restockProduct.isWeighed || false,
          pricePerKg: restockProduct.pricePerKg || 0,
          pluNumber: restockProduct.pluNumber || null,
          stock: Number(restockProduct.stock) + qty,
        }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        fetchProducts()
        closeRestock()
        setRestockQty('')
      } else {
        console.error('Restock failed:', data.message)
        alert(data.message || 'Failed to update stock')
      }
    } catch (err) {
      console.error('Restock error:', err)
      alert('Server connection failed')
    }
  }

  const handleDeleteConfirmed = async () => {
    if (!deleteConfirm) return
    try {
      await fetch(`${API_BASE_URL}/api/products/${deleteConfirm._id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${currentUser?.token}` }
      })
      fetchProducts()
    } catch (err) { console.error('Delete error:', err) }
    setDeleteConfirm(null)
  }

  useEffect(() => { if (!showRestock) setRestockProduct(null) }, [showRestock])

  // ── Effects ────────────────────────────────────────────
  useEffect(() => {
    const productToEdit = location.state?.productToEdit
    if (productToEdit) {
      const timeoutId = setTimeout(() => {
        openEdit(productToEdit)
        navigate(location.pathname, { replace: true, state: {} })
      }, 0)
      return () => clearTimeout(timeoutId)
    }
  }, [location.state, location.pathname, openEdit, navigate])

  // ── Filtering ──────────────────────────────────────────
  const filtered = [...products]
    .filter(p => {
      const matchSearch = p.name?.toLowerCase().includes(search.toLowerCase())
      const matchCat = categoryFilter === 'All' || p.category === categoryFilter
      const matchStore = storeFilter === 'All' || p.store === storeFilter
      const matchLow = showLowStockOnly ? p.stock <= (settings?.lowStockThreshold || 5) : true
      return matchSearch && matchCat && matchStore && matchLow
    })
    .sort((a, b) => a.stock - b.stock)

  const isOverlay = isMobile

  return (
    <div className="flex min-h-screen md:h-screen md:overflow-hidden" style={{ background: 'var(--bg-page)' }}>

      {/* ── Main Content ─────────────────────────────────── */}
      <div
        className={`flex flex-col md:flex-1 md:min-w-0 md:min-h-0 md:overflow-hidden transition-all duration-300
          ${showModal && !isOverlay ? 'mr-[480px]' : ''}`}
      >
        {/* Header — title + button (scrolls away on mobile) */}
        <div className="flex-shrink-0 px-6 pt-6">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
                Products
              </h1>
              <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
                {filtered.length} {filtered.length === 1 ? 'item' : 'items'}
                {showLowStockOnly && (
                  <span
                    className="ml-2 text-xs font-bold px-2 py-0.5 rounded-full"
                    style={{ background: 'var(--warning-light)', color: 'var(--warning-dark)' }}
                  >
                    Low Stock Filter Active
                  </span>
                )}
              </p>
            </div>
            <button
              onClick={openAdd}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold text-white transition ${styles.addBtn}`}
            >
              <MdAdd className="text-lg" /> Add Product
            </button>
          </div>
        </div>

        {/* Filter section — sticky on mobile, static on desktop */}
        <div
          className="flex-shrink-0 px-6 pb-3 sticky top-0 z-20 md:static"
          style={{ background: 'var(--bg-page)' }}
        >
          <ProductFilters
            search={search} setSearch={setSearch}
            categoryFilter={categoryFilter} setCategoryFilter={setCategoryFilter}
            categories={categories.map(c => c.name || c)}
            storeFilter={storeFilter} setStoreFilter={setStoreFilter}
            stores={stores}
          />
        </div>

        {/* Product Table */}
        <ProductList
          filtered={filtered}
          openEdit={openEdit}
          setRestockProduct={(p) => { setRestockProduct(p); openRestock() }}
          setDeleteConfirm={setDeleteConfirm}
        />
      </div>

      {/* ── Mobile Overlay Backdrop ───────────────────────── */}
      {showModal && isOverlay && (
        <div
          className="fixed inset-0 z-30"
          style={{ background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(2px)' }}
          onClick={closeModal}
        />
      )}

      {/* ── Form Panel ───────────────────────────────────── */}
      <ProductFormPanel
        showModal={showModal}
        editProduct={editProduct}
        products={products}
        mode={mode} setMode={setMode}
        barcode={barcode} setBarcode={setBarcode}
        savedBarcode={savedBarcode}
        error={error} success={success}
        form={form} setForm={setForm}
        categories={categories}
        suppliers={suppliers}
        stores={stores}
        handleScan={handleScan}
        saveProduct={saveProduct}
        closeModal={closeModal}
        printBarcode={printBarcode}
      />

      {/* ── Modals ───────────────────────────────────────── */}
      {showRestock && restockProduct && (
        <RestockModal
          restockProduct={restockProduct}
          restockQty={restockQty} setRestockQty={setRestockQty}
          confirmRestock={confirmRestock}
          onClose={closeRestock}
        />
      )}
      <DeleteConfirmModal
        deleteConfirm={deleteConfirm}
        handleDeleteConfirmed={handleDeleteConfirmed}
        setDeleteConfirm={setDeleteConfirm}
      />
    </div>
  )
}
