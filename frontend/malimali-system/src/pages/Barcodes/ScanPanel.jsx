import { useEffect, useMemo, useRef, useState } from 'react'
import {
  MdPointOfSale, MdWarning, MdCheckCircle,
  MdRemove, MdAdd, MdDelete, MdSearch,
  MdShoppingCart, MdReceipt, MdClose,
  MdKeyboard, MdScale,
} from 'react-icons/md'
import p from '@/styles/POS.module.css'

// ── Detect variable weight barcode (EAN-13 starting with "2") ─────────
function isWeightBarcode(code) {
  const trimmed = String(code).trim()
  return trimmed.length === 13 && trimmed.startsWith('2') && /^\d+$/.test(trimmed)
}

export default function ScanPanel({
  cart = [], cartTotal = 0, cartCount = 0,
  scanError, lastScanned,
  scanInput, setScanInput,
  handleScanKeyDown,
  updateQty,
  removeFromCart, clearCart,
  setShowCheckout, scanInputRef,
  products = [],
  loadingProducts = false,
  addToCart,
  addWeighedItem,
  currentUser,
}) {
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('All')
  const [flashId, setFlashId] = useState(null)
  const [manualCode, setManualCode] = useState('')
  const [decodingManual, setDecodingManual] = useState(false)
  const manualRef = useRef(null)

  // Flash product card briefly when scanned/added
  useEffect(() => {
    if (!lastScanned?._id) return
    const t1 = setTimeout(() => setFlashId(lastScanned._id), 0)
    const t2 = setTimeout(() => setFlashId(null), 800)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [lastScanned])

  // Category pills
  const categories = useMemo(() => {
    const cats = [...new Set(products.map(pr => pr.category).filter(Boolean))].sort()
    return ['All', ...cats]
  }, [products])

  // Filter product grid
  const filteredProducts = useMemo(() => {
    return products
      .filter(prod => {
        const matchCat = activeCategory === 'All' || prod.category === activeCategory
        const matchSearch = !search.trim() ||
          prod.name?.toLowerCase().includes(search.toLowerCase())
        return matchCat && matchSearch
      })
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
  }, [products, activeCategory, search])

  // Manual entry live match — skips weight-barcodes (handled separately via decode API)
  const manualMatch = useMemo(() => {
    const code = manualCode.trim()
    if (!code) return null
    if (isWeightBarcode(code)) return null
    return products.find(prod =>
      String(prod.barcode || '').toLowerCase().includes(code.toLowerCase()) ||
      String(prod._id || '').toLowerCase().includes(code.toLowerCase()) ||
      prod.name?.toLowerCase().includes(code.toLowerCase())
    ) || null
  }, [manualCode, products])

  const stockBadge = (stock) => {
    if (stock <= 0) return { label: 'Out of stock', color: 'var(--danger-dark)', bg: 'var(--danger-light)' }
    if (stock <= 3) return { label: `${stock} left`, color: '#92400e', bg: '#fef3c7' }
    if (stock <= 6) return { label: `${stock} left`, color: '#854f0b', bg: '#faeeda' }
    return { label: `${stock} in stock`, color: 'var(--success-dark)', bg: 'var(--success-light)' }
  }

  const commitManual = async () => {
    const code = manualCode.trim()
    if (!code) return

    // ── Weighed item: digits printed under a weight-barcode sticker ────
    // If the scanner can't read the barcode image, the cashier can type
    // the exact digits printed underneath it. This routes through the
    // same decode endpoint the real scanner uses, so the weight and
    // price are read directly from the code — never guessed or assumed.
    if (isWeightBarcode(code)) {
      setDecodingManual(true)
      try {
        const token = currentUser?.token ||
          JSON.parse(localStorage.getItem('pos_system_user') || '{}')?.token
        const res = await fetch('http://localhost:5000/api/weigh-station/decode', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ barcode: code }),
        })
        const data = await res.json()
        if (!data.success) {
          setDecodingManual(false)
          return
        }
        const { product, weightKg, weightGrams, totalPrice, pricePerKg } = data
        addWeighedItem({
          _id: `weighed-${code}`,
          id: `weighed-${code}`,
          productId: product._id,
          name: product.name,
          category: product.category,
          sellPrice: pricePerKg,
          buyPrice: product.buyPrice || 0,
          stock: product.stock,
          qty: weightKg,
          total: totalPrice,
          isWeighed: true,
          weightKg,
          weightGrams,
          pricePerKg,
          barcode: code,
        })
      } catch {
        // Silent fail — error display handled by parent scanError state
      }
      setDecodingManual(false)
      setManualCode('')
      manualRef.current?.focus()
      return
    }

    // ── Normal product: existing name/barcode/ID match ─────────────────
    if (!manualMatch) return
    addToCart(manualMatch.barcode || manualMatch._id)
    setManualCode('')
    manualRef.current?.focus()
  }

  const handleManualKeyDown = (e) => {
    if (e.key === 'Enter') { commitManual(); return }
    if (e.key === 'Escape') { setManualCode(''); return }
  }

  const handleProductClick = (product) => {
    if ((product.stock ?? 0) < 1) return
    if (product.isWeighed) return  // weighed items must be scanned from label
    addToCart(product.barcode || product._id)
  }

  return (
    <div className={p.posTerminal}>

      {/* Hidden scanner input — Barcodes.jsx owns handleScanKeyDown */}
      <input
        ref={scanInputRef}
        type="text"
        value={scanInput}
        onChange={e => setScanInput(e.target.value)}
        onKeyDown={handleScanKeyDown}
        autoFocus
        autoComplete="off"
        className={p.hiddenScanInput}
        aria-label="Barcode scanner input"
      />

      {/* ══════════════════════════════════════════
          LEFT — Product browser
      ══════════════════════════════════════════ */}
      <div className={p.posLeft}>

        {/* Search bar */}
        <div className={p.posLeftHeader}>
          <div className={p.posSearchWrap}>
            <MdSearch className={p.posSearchIcon} />
            <input
              type="text"
              placeholder="Search products by name..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className={p.posSearchInput}
            />
            {search && (
              <button onClick={() => setSearch('')} className={p.posSearchClear} tabIndex={-1}>
                <MdClose size={13} />
              </button>
            )}
          </div>
          <div className={p.posScannerPill}>
            <span className={p.posScannerDot} />
            <span className={p.posScannerLabel}>Scanner active</span>
          </div>
        </div>

        {/* Manual entry bar */}
        <div className={p.posManualBar}>
          <MdKeyboard size={16} style={{ color: 'var(--primary)', flexShrink: 0 }} />
          <div className={p.posManualBarContent}>
            <input
              ref={manualRef}
              type="text"
              value={manualCode}
              onChange={e => setManualCode(e.target.value)}
              onKeyDown={handleManualKeyDown}
              placeholder="Type barcode, product ID, or weighed-label number..."
              className={p.posManualInput}
              autoComplete="off"
              spellCheck={false}
              disabled={decodingManual}
            />
            {manualCode.trim() && (
              <div className={p.posManualDropdown}>
                {isWeightBarcode(manualCode.trim()) ? (
                  <div className={p.posManualMatchRow} style={{ cursor: 'default' }}>
                    <div className={p.posManualMatchLeft}>
                      <MdScale size={15} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                      <div>
                        <div className={p.posManualMatchName}>Weighed item label</div>
                        <div className={p.posManualMatchMeta}>
                          {decodingManual ? 'Reading weight & price…' : 'Press Enter to decode and add'}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : manualMatch ? (
                  <button
                    className={p.posManualMatchRow}
                    onClick={commitManual}
                    disabled={(manualMatch.stock ?? 0) < 1}
                  >
                    <div className={p.posManualMatchLeft}>
                      <MdCheckCircle
                        size={15}
                        style={{
                          color: (manualMatch.stock ?? 0) < 1 ? 'var(--danger)' : 'var(--success)',
                          flexShrink: 0,
                        }}
                      />
                      <div>
                        <div className={p.posManualMatchName}>{manualMatch.name}</div>
                        <div className={p.posManualMatchMeta}>
                          {manualMatch.barcode ? `Barcode: ${manualMatch.barcode}` : `ID: ${manualMatch._id}`}
                          {' '}· KSh {Number(manualMatch.sellPrice || 0).toLocaleString()}
                        </div>
                      </div>
                    </div>
                    <div
                      className={p.posManualMatchStock}
                      style={{
                        color: stockBadge(manualMatch.stock ?? 0).color,
                        background: stockBadge(manualMatch.stock ?? 0).bg,
                      }}
                    >
                      {stockBadge(manualMatch.stock ?? 0).label}
                    </div>
                  </button>
                ) : (
                  <div className={p.posManualNoMatch}>
                    <MdWarning size={14} style={{ flexShrink: 0 }} />
                    No product found for "{manualCode}"
                  </div>
                )}
              </div>
            )}
          </div>
          <span className={p.posManualBarHint}>
            {isWeightBarcode(manualCode.trim()) || (manualMatch && (manualMatch.stock ?? 0) > 0)
              ? <><kbd className={p.posKbd}>Enter</kbd> to add</>
              : <><kbd className={p.posKbd}>Enter</kbd></>
            }
          </span>
        </div>

        {/* Error banner */}
        {scanError && (
          <div className={p.posErrorBanner}>
            <MdWarning size={15} style={{ flexShrink: 0 }} /> {scanError}
          </div>
        )}

        {/* Last scanned confirmation */}
        {lastScanned && !manualCode && (
          <div className={p.posLastScanned}>
            <MdCheckCircle size={15} style={{ color: 'var(--success)', flexShrink: 0 }} />
            <span className={p.posLastScannedName}>{lastScanned.name}</span>
            <span className={p.posLastScannedPrice}>
              KSh {Number(lastScanned.sellPrice).toLocaleString()}
            </span>
            <span className={p.posLastScannedStock}>{lastScanned.stock} left</span>
          </div>
        )}

        {/* Category pills */}
        <div className={p.posCatBar}>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`${p.posCatPill} ${activeCategory === cat ? p.posCatPillActive : ''}`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Product grid */}
        <div className={p.posProductGrid}>
          {loadingProducts ? (
            <div className={p.posGridEmpty}>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 500 }}>
                Loading products...
              </div>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className={p.posGridEmpty}>
              <MdPointOfSale size={32} style={{ color: 'var(--border-medium)', marginBottom: 8 }} />
              <div style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 500 }}>
                No products found
              </div>
            </div>
          ) : (
            filteredProducts.map(product => {
              const outOfStock = (product.stock ?? 0) < 1
              const inCart = cart.find(c => c.productId === product._id || c._id === product._id)
              const isFlashing = flashId === product._id
              const badge = stockBadge(product.stock ?? 0)

              return (
                <button
                  key={product._id}
                  onClick={() => handleProductClick(product)}
                  disabled={outOfStock || product.isWeighed}
                  className={[
                    p.posProductCard,
                    outOfStock || product.isWeighed ? p.posProductCardDisabled : '',
                    isFlashing ? p.posProductCardFlash : '',
                    inCart ? p.posProductCardInCart : '',
                  ].filter(Boolean).join(' ')}
                  title={
                    product.isWeighed
                      ? `${product.name} — scan label from weigh station`
                      : outOfStock ? `${product.name} — out of stock` : product.name
                  }
                >
                  {inCart && <div className={p.posCartBadge}>{inCart.qty}</div>}
                  <div className={p.posProductCardBody}>
                    <div className={p.posProductCat}>{product.category || 'General'}</div>
                    <div className={p.posProductName}>{product.name}</div>
                    {product.isWeighed ? (
                      <div style={{
                        fontSize: 11, color: 'var(--primary)', fontWeight: 700,
                        marginTop: 4, display: 'flex', alignItems: 'center', gap: 4,
                      }}>
                        <MdScale size={12} /> Scan label
                      </div>
                    ) : (
                      <div className={p.posProductPrice}>
                        KSh {Number(product.sellPrice || 0).toLocaleString()}
                      </div>
                    )}
                    <div
                      className={p.posStockBadge}
                      style={{ color: badge.color, background: badge.bg }}
                    >
                      {badge.label}
                    </div>
                  </div>
                </button>
              )
            })
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════
          RIGHT — Order + checkout
      ══════════════════════════════════════════ */}
      <div className={p.posRight}>

        <div className={p.posOrderHeader}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <MdShoppingCart size={17} style={{ color: 'rgba(255,255,255,0.75)' }} />
            <div>
              <div className={p.posOrderTitle}>Current Order</div>
              <div className={p.posOrderSub}>
                {cartCount > 0
                  ? `${cartCount} item${cartCount !== 1 ? 's' : ''} · ${cart.length} line${cart.length !== 1 ? 's' : ''}`
                  : 'No items yet'}
              </div>
            </div>
          </div>
          {cart.length > 0 && (
            <button onClick={clearCart} className={p.posClearBtn}>
              <MdDelete size={13} /> Clear
            </button>
          )}
        </div>

        <div className={p.posOrderItems}>
          {cart.length === 0 ? (
            <div className={p.posOrderEmpty}>
              <MdReceipt size={30} style={{ color: 'var(--border-medium)', marginBottom: 8 }} />
              <div style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 500 }}>
                Scan or tap a product to start
              </div>
            </div>
          ) : (
            cart.map((item, idx) => (
              <div
                key={item._id}
                className={p.posOrderRow}
                style={{ background: idx % 2 === 0 ? 'transparent' : 'var(--bg-muted)' }}
              >
                <div className={p.posOrderItemInfo}>
                  <div className={p.posOrderItemName}>
                    {item.name}
                    {/* Weighed item badge */}
                    {item.isWeighed && (
                      <span style={{
                        marginLeft: 6, fontSize: 10, fontWeight: 700,
                        padding: '1px 6px', borderRadius: 20,
                        background: 'var(--primary-light)', color: 'var(--primary)',
                        verticalAlign: 'middle', whiteSpace: 'nowrap',
                      }}>
                        ⚖ {item.weightGrams}g
                      </span>
                    )}
                  </div>
                  <div className={p.posOrderItemUnit}>
                    {item.isWeighed
                      ? `${item.weightKg?.toFixed(3)} kg × KSh ${Number(item.pricePerKg || 0).toLocaleString()}/kg`
                      : `KSh ${Number(item.sellPrice || 0).toLocaleString()} each`
                    }
                  </div>
                </div>

                {/* Qty controls — weighed items locked at ×1 */}
                {item.isWeighed ? (
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)', padding: '0 8px' }}>×1</span>
                  </div>
                ) : (
                  <div className={p.posQtyControls}>
                    <button
                      className={p.posQtyBtn}
                      onClick={() => item.qty > 1
                        ? updateQty(item._id, item.qty - 1)
                        : removeFromCart(item._id)}
                    >
                      <MdRemove size={14} />
                    </button>
                    <span className={p.posQtyValue}>{item.qty}</span>
                    <button
                      className={p.posQtyBtn}
                      onClick={() => updateQty(item._id, Math.min(item.stock, item.qty + 1))}
                      disabled={item.qty >= item.stock}
                      style={{ opacity: item.qty >= item.stock ? 0.35 : 1 }}
                    >
                      <MdAdd size={14} />
                    </button>
                  </div>
                )}

                <div className={p.posOrderItemTotal}>
                  KSh {Number(item.total || 0).toLocaleString()}
                </div>
                <button
                  className={p.posOrderDeleteBtn}
                  onClick={() => removeFromCart(item._id)}
                >
                  <MdDelete size={14} />
                </button>
              </div>
            ))
          )}
        </div>

        <div className={p.posCheckoutFooter}>
          {cart.length > 0 && (
            <div className={p.posTotalRow}>
              <span className={p.posTotalLabel}>TOTAL</span>
              <span className={p.posTotalValue}>
                KSh {Number(cartTotal).toLocaleString()}
              </span>
            </div>
          )}
          <button
            onClick={() => cart.length > 0 && setShowCheckout(true)}
            disabled={cart.length === 0}
            className={`${p.posChargeBtn} ${cart.length === 0 ? p.posChargeBtnDisabled : ''}`}
          >
            <MdReceipt size={19} />
            {cart.length === 0
              ? 'Charge Customer'
              : `Charge  KSh ${Number(cartTotal).toLocaleString()}`}
          </button>
          <div className={p.posChargeBtnHint}>
            {cart.length === 0 ? 'Add items to begin' : 'Opens payment options'}
          </div>
        </div>
      </div>
    </div>
  )
}
