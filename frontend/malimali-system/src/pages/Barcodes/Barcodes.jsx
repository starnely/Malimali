import { useState, useEffect, useRef, useCallback } from 'react'
import { MdPointOfSale, MdTableChart, MdBarChart, MdStorefront } from 'react-icons/md'
import JsBarcode from 'jsbarcode'
import { useApp } from '@/context/AppContext'
import { useHistoryModal } from '@/hooks/useHistoryModal'
import p from '@/styles/POS.module.css'
import { isWeightBarcode } from '@/utils/barcodeUtils'

import Receipt from './Receipt'
import CheckoutModal from './CheckoutModal'
import ProductBarcodesTable from './ProductBarcodesTable'
import ScanPanel from './ScanPanel'
import GenerateBarcodes from './GenerateBarcodes'
import { API_BASE_URL as API } from '@/config/api'

const isTouchDevice = () => window.matchMedia('(pointer: coarse)').matches

export default function Barcodes() {
  const {
    products: contextProducts,
    recordMultipleSales,
    currentUser,
    fetchProducts,
    stores,
    isOwner,
  } = useApp()

  const [tab, setTab] = useState('scan')
  const [scanInput, setScanInput] = useState('')
  const [cart, setCart] = useState([])
  const [scanError, setScanError] = useState('')
  const [lastScanned, setLastScanned] = useState(null)
  const [receipt, setReceipt] = useState(null)
  const [showCheckout, openCheckout, closeCheckout] = useHistoryModal('checkout')
  const [searchQuery, setSearchQuery] = useState('')
  const scanInputRef = useRef(null)

  // ── Store selection (owner only) ──────────────────────────────────
  const defaultStore = currentUser?.store || 'Main Store'
  const [selectedStore, setSelectedStore] = useState(isOwner ? 'All Stores' : defaultStore)
  const [storeProducts, setStoreProducts] = useState([])
  const [loadingProducts, setLoadingProducts] = useState(false)

  // On mount — load context products for cashier/manager
  useEffect(() => {
    if (fetchProducts) fetchProducts()
  }, [fetchProducts])

  // When owner changes store — fetch products for that store
  const loadStoreProducts = useCallback(async (storeName) => {
    if (!isOwner) return
    setLoadingProducts(true)
    setScanError('')
    setCart([])
    setLastScanned(null)
    try {
      const token = currentUser?.token
      const params = new URLSearchParams()
      if (storeName && storeName !== 'All Stores') {
        params.set('store', storeName)
      }
      const res = await fetch(
        `${API}/api/products?${params}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      const data = await res.json()
      const sorted = (data.success && Array.isArray(data.products) ? data.products : [])
        .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
      setStoreProducts(sorted)
    } catch {
      setStoreProducts([])
    }
    setLoadingProducts(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOwner, currentUser?.token])

  // Load on mount for owner
  useEffect(() => {
    if (isOwner) loadStoreProducts(selectedStore)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleStoreChange = (storeName) => {
    setSelectedStore(storeName)
    loadStoreProducts(storeName)
  }

  // Products to use — owner uses store-fetched, cashier uses context
  const products = isOwner ? storeProducts : contextProducts

  // Keep scanner focused
  useEffect(() => {
    if (tab === 'scan' && !showCheckout && !receipt && !isTouchDevice()) {
      scanInputRef.current?.focus()
    }
  }, [tab, showCheckout, receipt, cart])

  const findProduct = useCallback((code) => {
    const trimmed = String(code).trim()
    return products.find(prod =>
      String(prod.barcode) === trimmed || String(prod._id) === trimmed
    )
  }, [products])

  // ── Standard product add to cart ──────────────────────────────────
  const addToCart = useCallback((code) => {
    const trimmed = String(code).trim()
    if (!trimmed) return
    const product = findProduct(trimmed)
    if (!product) {
      setScanError(`No product found for: "${trimmed}"`)
      setLastScanned(null)
      return
    }
    setScanError('')
    setLastScanned(product)
    setCart(prev => {
      const existing = prev.find(item => item._id === product._id)
      if (existing) {
        if (existing.qty >= product.stock) {
          setScanError(`Max stock reached for ${product.name} (${product.stock} items)`)
          return prev
        }
        return prev.map(item =>
          item._id === product._id
            ? { ...item, qty: item.qty + 1, total: (item.qty + 1) * item.sellPrice }
            : item
        )
      }
      if (product.stock < 1) {
        setScanError(`${product.name} is out of stock!`)
        return prev
      }
      return [...prev, {
        _id: product._id,
        id: product._id,
        name: product.name,
        category: product.category,
        sellPrice: product.sellPrice,
        stock: product.stock,
        unit: product.unit || 'pcs',
        qty: 1,
        total: product.sellPrice,
      }]
    })
  }, [findProduct])

  // ── NEW: Add a weighed item decoded from a variable weight barcode ─
  // Called by ScanPanel after /api/weigh-station/decode succeeds
  const addWeighedItem = useCallback((weighedCartItem) => {
    setCart(prev => {
      // Prevent duplicate labels — same barcode already in cart
      if (prev.find(item => item._id === weighedCartItem._id)) {
        setScanError(`This label is already in the cart (${weighedCartItem.weightGrams}g)`)
        return prev
      }
      setScanError('')
      setLastScanned({
        _id: weighedCartItem.productId,
        name: weighedCartItem.name,
        sellPrice: weighedCartItem.pricePerKg,
        stock: weighedCartItem.stock,
      })
      return [...prev, weighedCartItem]
    })
  }, [])

  // ── Shared scan commit — called by physical scanner, manual entry, and camera ──
  const processScan = useCallback(async (code) => {
    const trimmed = String(code).trim()
    if (!trimmed) return
    if (isWeightBarcode(trimmed)) {
      setScanInput('')
      try {
        const token = currentUser?.token ||
          JSON.parse(localStorage.getItem('pos_system_user') || '{}')?.token
        const res = await fetch(`${API}/api/weigh-station/decode`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ barcode: trimmed }),
        })
        const data = await res.json()
        if (!data.success) {
          setScanError(data.message || `Cannot decode weight barcode: ${trimmed}`)
          return
        }
        const { product, weightKg, weightGrams, totalPrice, pricePerKg } = data
        addWeighedItem({
          _id: `weighed-${trimmed}`,
          id: `weighed-${trimmed}`,
          productId: product._id,
          name: product.name,
          category: product.category,
          sellPrice: pricePerKg,
          stock: product.stock,
          qty: weightKg,
          total: totalPrice,
          isWeighed: true,
          weightKg,
          weightGrams,
          pricePerKg,
          barcode: trimmed,
        })
      } catch {
        setScanError('Server error decoding weight barcode.')
      }
    } else {
      addToCart(trimmed)
      setScanInput('')
    }
  }, [currentUser?.token, addWeighedItem, addToCart])

  const handleScanKeyDown = useCallback((e) => {
    if (e.key !== 'Enter') return
    const code = scanInput.trim()
    if (!code) return
    processScan(code)
  }, [scanInput, processScan])

  const updateQty = (id, newQty) => {
    const item = cart.find(c => c._id === id)
    if (item?.isWeighed) return  // qty is weightKg — locked to the scanned portion

    const product = products.find(prod => prod._id === id)
    if (!product) return
    if (newQty < 1) { removeFromCart(id); return }
    if (newQty > product.stock) return
    setCart(prev => prev.map(i =>
      i._id === id ? { ...i, qty: newQty, total: newQty * i.sellPrice } : i
    ))
  }

  const removeFromCart = (id) => setCart(prev => prev.filter(item => item._id !== id))
  const clearCart = () => { setCart([]); setScanError(''); setLastScanned(null) }

  const cartTotal = cart.reduce((sum, item) => sum + item.total, 0)
  const cartCount = cart.reduce((sum, item) => sum + item.qty, 0)

  const handleCheckoutConfirm = async (paymentDetails) => {
    const saleStore = isOwner
      ? (selectedStore === 'All Stores' ? defaultStore : selectedStore)
      : (currentUser?.store || 'Main Store')

    // M-Pesa real flow: sale was already created and confirmed on the backend.
    // Skip recordMultipleSales and build the receipt from the confirmed sale object.
    if (paymentDetails.confirmedSale) {
      const sale = paymentDetails.confirmedSale
      setReceipt({
        receiptId:          sale.receiptId           || '',
        date:               paymentDetails.date       || sale.date  || '',
        time:               paymentDetails.time       || sale.time  || '',
        items:              cart,
        total:              cartTotal,
        finalTotal:         paymentDetails.finalTotal,
        discount:           paymentDetails.discount,
        paymentMethod:      'mpesa',
        cashGiven:          0,
        change:             0,
        customerName:       paymentDetails.customerName,
        customerPhone:      '',
        promiseDate:        '',
        mpesaPhone:         paymentDetails.mpesaPhone,
        mpesaReceiptNumber: paymentDetails.mpesaReceiptNumber || '',
        cashPart:           0,
        mpesaPart:          paymentDetails.finalTotal,
        cardApprovalCode:   '',
        bankReference:      '',
        soldBy:             sale.cashier || currentUser?.fullname || 'Owner',
        store:              sale.store   || saleStore,
        address:            currentUser?.address || '',
        phone:              currentUser?.phone   || '',
      })
      setCart([])
      setLastScanned(null)
      setScanError('')
      closeCheckout()
      if (isOwner) loadStoreProducts(selectedStore)
      return
    }

    const paymentInfo = {
      paymentMethod: paymentDetails.paymentMethod,
      mpesaPhone: paymentDetails.mpesaPhone,
      customerName: paymentDetails.customerName,
      cashPart: paymentDetails.cashPart,
      mpesaPart: paymentDetails.mpesaPart,
      store: saleStore,
      cashier: currentUser?.fullname || currentUser?.name || 'Unknown',
      customerPhone: paymentDetails.customerPhone || '',
      promiseDate: paymentDetails.promiseDate || '',
      cardApprovalCode: paymentDetails.cardApprovalCode || '',
      bankReference: paymentDetails.bankReference || '',
      mpesaReceiptNumber: paymentDetails.splitMpesaReceiptNumber || '',
    }

    const result = await recordMultipleSales(cart, paymentInfo)

    if (result.success) {
      setReceipt({
        receiptId: result.sale.receiptId,
        date: result.sale.date,
        time: result.sale.time,
        items: cart,
        total: cartTotal,
        finalTotal: paymentDetails.finalTotal,
        discount: paymentDetails.discount,
        paymentMethod: paymentDetails.paymentMethod,
        cashGiven: paymentDetails.cashGiven,
        change: paymentDetails.change,
        customerName: paymentDetails.customerName,
        customerPhone: paymentDetails.customerPhone || '',
        promiseDate: paymentDetails.promiseDate || '',
        mpesaPhone: paymentDetails.mpesaPhone,
        cashPart: paymentDetails.cashPart,
        mpesaPart: paymentDetails.mpesaPart,
        cardApprovalCode: paymentDetails.cardApprovalCode || '',
        bankReference: paymentDetails.bankReference || '',
        soldBy: result.sale.cashier || currentUser?.fullname || 'Owner',
        store: saleStore,
        address: currentUser?.address || '',
        phone: currentUser?.phone || '',
      })
      setCart([])
      setLastScanned(null)
      setScanError('')
      closeCheckout()
      if (isOwner) loadStoreProducts(selectedStore)
    } else {
      setScanError(result.error || 'Failed to record sale')
      closeCheckout()
    }
  }

  // ── Download barcode label ─────────────────────────────────────────
  const handleDownload = (product) => {
    const displayBarcode = product.barcode || product._id || ''
    if (!displayBarcode) return

    const barcodeCanvas = document.createElement('canvas')
    try {
      JsBarcode(barcodeCanvas, displayBarcode, {
        format: 'CODE128',
        width: 3,
        height: 100,
        displayValue: false,
        margin: 10,
        background: '#ffffff',
        lineColor: '#000000',
      })
    } catch (e) {
      console.error('Barcode render error:', e)
      return
    }

    const canvas = document.createElement('canvas')
    canvas.width = 600
    canvas.height = 300
    const ctx = canvas.getContext('2d')

    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, 600, 300)

    const bw = Math.min(barcodeCanvas.width, 560)
    const bh = Math.min(barcodeCanvas.height, 140)
    const bx = (600 - bw) / 2
    ctx.drawImage(barcodeCanvas, bx, 10, bw, bh)

    ctx.letterSpacing = '0px'
    ctx.fillStyle = '#222222'
    ctx.font = 'bold 16px monospace'
    ctx.textAlign = 'left'
    const digits = displayBarcode.split('')
    const totalWidth = bw - 20
    const charWidth = totalWidth / digits.length
    digits.forEach((digit, i) => {
      ctx.fillText(digit, bx + 10 + i * charWidth + charWidth / 2 - 5, bh + 28)
    })
    ctx.textAlign = 'center'

    ctx.strokeStyle = '#dddddd'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(30, bh + 38)
    ctx.lineTo(570, bh + 38)
    ctx.stroke()

    ctx.letterSpacing = '0px'
    ctx.fillStyle = '#111111'
    ctx.font = 'bold 20px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(
      product.name
        ? product.name.length > 35 ? product.name.slice(0, 35) + '…' : product.name
        : '',
      300, bh + 62
    )

    ctx.fillStyle = '#185FA5'
    ctx.font = 'bold 18px sans-serif'
    ctx.fillText(`KSh ${Number(product.sellPrice || 0).toLocaleString()}`, 300, bh + 88)

    const link = document.createElement('a')
    link.download = `${(product.name || 'product').replace(/\s+/g, '-')}-barcode.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
  }

  // Store options for owner dropdown
  const storeOptions = [
    'All Stores',
    ...(Array.isArray(stores) && stores.length > 0
      ? stores.map(s => typeof s === 'string' ? s : s.name).filter(Boolean)
      : [defaultStore]),
  ]

  return (
    <div className={p.posPage}>

      {/* ── Modals ── */}
      {receipt && (
        <Receipt receipt={receipt} onClose={() => {
          setReceipt(null)
          setTimeout(() => { if (!isTouchDevice()) scanInputRef.current?.focus() }, 100)
        }} />
      )}
      {showCheckout && (
        <CheckoutModal
          cartTotal={cartTotal}
          cart={cart}
          onConfirm={handleCheckoutConfirm}
          onCancel={() => {
            closeCheckout()
            setTimeout(() => { if (!isTouchDevice()) scanInputRef.current?.focus() }, 100)
          }}
        />
      )}

      {/* ── Tab bar ── */}
      <div className={p.posTabBar}>
        <div className={p.posTabBarLeft}>
          <span className={p.posTabBarTitle}>POS Terminal</span>

          {isOwner ? (
            <div className={p.posStoreSelector}>
              <MdStorefront size={13} style={{ color: 'var(--primary)', flexShrink: 0 }} />
              <select
                value={selectedStore}
                onChange={e => handleStoreChange(e.target.value)}
                className={p.posStoreSelectorSelect}
              >
                {storeOptions.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              {loadingProducts && (
                <span className={p.posStoreLoading}>loading...</span>
              )}
            </div>
          ) : (
            <span className={p.posTabBarStore}>
              {currentUser?.store || 'Main Store'}
            </span>
          )}
        </div>

        <div className={p.posTabBarTabs}>
          {[
            { id: 'scan', label: 'Scan to Sell', icon: <MdPointOfSale size={15} /> },
            { id: 'barcodes', label: 'Product Barcodes', icon: <MdTableChart size={15} /> },
            { id: 'generate', label: 'Generate Barcodes', icon: <MdBarChart size={15} /> },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`${p.posTabBtn} ${tab === t.id ? p.posTabBtnActive : ''}`}
              aria-label={t.label}
              title={t.label}
            >
              {t.icon}
              <span className={p.posTabBtnLabel}>{t.label}</span>
              {t.id === 'scan' && cartCount > 0 && (
                <span className={p.posTabCartBadge}>{cartCount}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab content ── */}
      <div className={p.posTabContent}>
        {tab === 'scan' && (
          <ScanPanel
            cart={cart}
            cartTotal={cartTotal}
            cartCount={cartCount}
            scanError={scanError}
            lastScanned={lastScanned}
            scanInput={scanInput}
            setScanInput={setScanInput}
            handleScanKeyDown={handleScanKeyDown}
            processScan={processScan}
            updateQty={updateQty}
            removeFromCart={removeFromCart}
            clearCart={clearCart}
            setShowCheckout={openCheckout}
            scanInputRef={scanInputRef}
            products={products}
            addToCart={addToCart}
            addWeighedItem={addWeighedItem}
            loadingProducts={loadingProducts}
            currentUser={currentUser}
          />
        )}

        {tab === 'barcodes' && (
          <div className={p.posSubPage}>
            <ProductBarcodesTable
              products={products}
              onGoToScan={() => setTab('scan')}
            />
          </div>
        )}

        {tab === 'generate' && (
          <div className={p.posSubPage}>
            <GenerateBarcodes
              products={products}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              handleDownload={handleDownload}
            />
          </div>
        )}
      </div>
    </div>
  )
}
