import { useState, useRef, useCallback, useEffect } from 'react'
import JsBarcode from 'jsbarcode'
import w from '@/styles/WeighStation.module.css'
import {
  MdScale, MdPrint, MdDownload,
  MdSearch, MdCheckCircle, MdWarning,
  MdAdd, MdRemove, MdRefresh, MdSyncAlt,
  MdAttachMoney, MdFitnessCenter, MdContentCopy,
} from 'react-icons/md'
import { useApp } from '@/context/AppContext'
import { API_BASE_URL as API } from '@/config/api'


function formatWeight(grams) {
  if (grams >= 1000) return `${(grams / 1000).toFixed(3)} kg`
  return `${grams} g`
}

// ── Canvas built at 2x resolution (1200x680) for sharp print quality ──
// All coordinates/fonts are the original 600x340 layout scaled by SCALE.
function buildLabelCanvas({ productName, weightGrams, pricePerKg, totalPrice, barcode, store, currency = 'KSh', expiryDate, pluNumber }) {
  const SCALE = 2
  const W = 600 * SCALE, H = 340 * SCALE
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  const s = (n) => n * SCALE

  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, W, H)

  // ── Red header band ──────────────────────────────────────────────
  ctx.fillStyle = '#CC0000'
  ctx.fillRect(0, 0, W, s(56))
  ctx.fillStyle = '#fff'
  ctx.font = `bold ${s(20)}px sans-serif`
  ctx.textAlign = 'center'
  ctx.fillText((store || 'STORE').toUpperCase(), W / 2, s(36))

  // ── Product name — large, centered ───────────────────────────────
  ctx.fillStyle = '#111'
  ctx.font = `bold ${s(22)}px sans-serif`
  ctx.textAlign = 'center'
  const displayName = productName.length > 34 ? productName.slice(0, 34) + '…' : productName
  ctx.fillText(displayName.toUpperCase(), W / 2, s(94))

  // ── Divider ──────────────────────────────────────────────────────
  ctx.strokeStyle = '#EEEEEE'
  ctx.lineWidth = s(1)
  ctx.beginPath(); ctx.moveTo(s(20), s(106)); ctx.lineTo(W - s(20), s(106)); ctx.stroke()

  // ── Column headers ────────────────────────────────────────────────
  ctx.fillStyle = '#888'
  ctx.font = `${s(10)}px sans-serif`
  ctx.textAlign = 'left'
  ctx.fillText('NET WEIGHT (KG)', s(30), s(128))
  ctx.fillText('PRICE PER KG', s(220), s(128))
  ctx.fillText('TOTAL PRICE', s(430), s(128))

  // ── Values ────────────────────────────────────────────────────────
  ctx.fillStyle = '#111'
  ctx.font = `bold ${s(24)}px sans-serif`
  ctx.textAlign = 'left'
  ctx.fillText((weightGrams / 1000).toFixed(3), s(30), s(160))
  ctx.fillText(Number(pricePerKg).toFixed(2), s(220), s(160))
  ctx.fillStyle = '#CC0000'
  ctx.fillText(`${currency} ${Number(totalPrice).toFixed(2)}`, s(430), s(160))

  // ── Divider ──────────────────────────────────────────────────────
  ctx.strokeStyle = '#EEEEEE'
  ctx.lineWidth = s(1)
  ctx.beginPath(); ctx.moveTo(s(20), s(174)); ctx.lineTo(W - s(20), s(174)); ctx.stroke()

  // ── Meta row ──────────────────────────────────────────────────────
  const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' }).replace(/\//g, '-')
  ctx.fillStyle = '#888'
  ctx.font = `${s(10)}px sans-serif`
  ctx.textAlign = 'left'
  ctx.fillText(`Packed on: ${today}`, s(30), s(196))
  ctx.fillText(`PLU: ${pluNumber || '—'}`, s(240), s(196))
  if (expiryDate) {
    const exp = new Date(expiryDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' }).replace(/\//g, '-')
    ctx.fillText(`Best Before: ${exp}`, s(390), s(196))
  }

  // ── Full-width barcode band ───────────────────────────────────────
  ctx.strokeStyle = '#DDDDDD'
  ctx.lineWidth = s(1)
  ctx.beginPath(); ctx.moveTo(0, s(208)); ctx.lineTo(W, s(208)); ctx.stroke()

  const barcodeCanvas = document.createElement('canvas')
  try {
    JsBarcode(barcodeCanvas, barcode, {
      format: 'EAN13',
      width: 2.8 * SCALE,
      height: s(88),
      displayValue: false,
      margin: 0,
      background: '#ffffff',
      lineColor: '#000000',
    })
    const bw = Math.min(barcodeCanvas.width, W - s(60))
    const bh = Math.min(barcodeCanvas.height, s(88))
    const bx = (W - bw) / 2
    ctx.drawImage(barcodeCanvas, bx, s(216), bw, bh)

    // Digits spaced across full barcode width — sized to guarantee
    // all 13 characters fit without overlapping, regardless of barcode length
    const charWidth = bw / barcode.length
    const digitFontSize = Math.min(s(13), charWidth * 0.75)
    ctx.font = `${digitFontSize}px monospace`
    ctx.fillStyle = '#333'
    ctx.textAlign = 'center'
    barcode.split('').forEach((digit, i) => {
      ctx.fillText(digit, bx + i * charWidth + charWidth / 2, s(320))
    })
  } catch (e) {
    console.error('Barcode render error', e)
  }

  return canvas.toDataURL('image/png')
}

export default function WeighStation() {
  const { currentUser, settings } = useApp()
  const token = currentUser?.token

  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [weightGrams, setWeightGrams] = useState('')
  const [generating, setGenerating] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [exportingPLU, setExportingPLU] = useState(false)

  // ── Reverse-weight (amount → grams) mode ──────────────────────────
  const [inputMode, setInputMode] = useState('weight') // 'weight' | 'amount'
  const [amountInput, setAmountInput] = useState('')

  // ── Number of identical label copies to print ─────────────────────
  const [copies, setCopies] = useState(1)

  const weightInputRef = useRef(null)
  const amountInputRef = useRef(null)

  // Derived grams when in amount mode
  const derivedGrams = inputMode === 'amount' && amountInput && selectedProduct
    ? Math.round((Number(amountInput) / (selectedProduct.pricePerKg || selectedProduct.sellPrice || 1)) * 1000)
    : null

  const effectiveGrams = inputMode === 'amount' ? derivedGrams : Number(weightGrams)

  const loadProducts = useCallback(async () => {
    setLoading(true)
    try {
      const store = currentUser?.role === 'owner' ? '' : (currentUser?.store || '')
      const params = store ? `?store=${encodeURIComponent(store)}` : ''
      const res = await fetch(`${API}/api/weigh-station/products${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      const freshProducts = data.success ? data.products : []
      setProducts(freshProducts)

      setSelectedProduct(prev => {
        if (!prev) return prev
        const updated = freshProducts.find(p => p._id === prev._id)
        if (!updated) {
          setResult(null)
          setWeightGrams('')
          setAmountInput('')
          setError('This product was removed or is no longer available. Please select another.')
          return null
        }
        return updated
      })
    } catch {
      setProducts([])
    }
    setLoading(false)
  }, [token, currentUser?.role, currentUser?.store])

  useEffect(() => {
    loadProducts()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!selectedProduct) return
    setTimeout(() => {
      if (inputMode === 'amount') amountInputRef.current?.focus()
      else weightInputRef.current?.focus()
    }, 100)
  }, [selectedProduct, inputMode])

  const filtered = products.filter(p =>
    !search.trim() ||
    p.name?.toLowerCase().includes(search.toLowerCase()) ||
    String(p.pluNumber || '').includes(search)
  )

  const adjustWeight = (delta) => {
    const current = Number(weightGrams) || 0
    const next = Math.max(1, current + delta)
    setWeightGrams(String(next))
    setResult(null)
    setError('')
  }

  const handleGenerate = async () => {
    if (!selectedProduct) { setError('Select a product first.'); return }
    const grams = effectiveGrams
    if (!grams || grams <= 0 || grams > 9999) {
      setError(inputMode === 'amount'
        ? 'Amount results in an invalid weight. Please enter a smaller amount (max 9,999g).'
        : 'Enter a valid weight between 1g and 9,999g.')
      return
    }
    setGenerating(true)
    setError('')
    setResult(null)
    try {
      const res = await fetch(`${API}/api/weigh-station/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ productId: selectedProduct._id, weightGrams: grams }),
      })
      const data = await res.json()
      if (data.success) { setResult(data) }
      else { setError(data.message || 'Failed to generate barcode.') }
    } catch {
      setError('Server connection failed.')
    }
    setGenerating(false)
  }

  const buildDataUrl = () => {
    const currency = settings?.currency || 'KSh'
    const store = currentUser?.store || settings?.businessName || 'Store'
    return buildLabelCanvas({
      ...result, store, currency,
      expiryDate: selectedProduct?.expiryDate,
      pluNumber: selectedProduct?.pluNumber,
    })
  }

  const clearAfterAction = () => {
    setTimeout(() => {
      setResult(null)
      setWeightGrams('')
      setAmountInput('')
      setError('')
      setCopies(1)
      setTimeout(() => {
        if (inputMode === 'amount') amountInputRef.current?.focus()
        else weightInputRef.current?.focus()
      }, 50)
    }, 2000)
  }

  const handlePrint = () => {
    if (!result) return
    const dataUrl = buildDataUrl()
    const numCopies = Math.max(1, Math.min(200, Number(copies) || 1))
    const win = window.open('', '_blank', 'width=700,height=500')

    // Repeat the image tag for each copy — each lands on its own printed page
    const imgTags = Array.from({ length: numCopies })
      .map(() => `<img src="${dataUrl}" style="width:600px; height:auto; page-break-after: always;" />`)
      .join('')

    win.document.write(`
      <html><head><title>Weight Label${numCopies > 1 ? ` (${numCopies} copies)` : ''}</title>
      <style>
        body { margin: 0; background: #f5f5f5; display: flex; flex-direction: column; align-items: center; gap: 20px; padding: 20px; min-height: 100vh; box-sizing: border-box; }
        img  { box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
        @media print {
          body { background: #fff; padding: 0; gap: 0; }
          img { box-shadow: none; }
        }
      </style></head>
      <body>${imgTags}</body></html>
    `)
    win.document.close()
    setTimeout(() => win.print(), 400)
    clearAfterAction()
  }

  const handleDownload = () => {
    if (!result) return
    const dataUrl = buildDataUrl()
    const link = document.createElement('a')
    link.download = `label-${result.productName.replace(/\s+/g, '-')}-${result.weightGrams}g.png`
    link.href = dataUrl
    link.click()
    clearAfterAction()
  }

  const handlePLUExport = async () => {
    setExportingPLU(true)
    try {
      const store = currentUser?.role === 'owner' ? '' : (currentUser?.store || '')
      const params = store ? `?store=${encodeURIComponent(store)}` : ''
      const res = await fetch(`${API}/api/weigh-station/plu-export${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (!res.ok) { setError('Failed to export PLU file.'); setExportingPLU(false); return }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'plu-list.csv'
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      setError('Failed to export PLU file.')
    }
    setExportingPLU(false)
  }

  const handleReset = () => {
    setSelectedProduct(null)
    setWeightGrams('')
    setAmountInput('')
    setResult(null)
    setError('')
    setInputMode('weight')
    setCopies(1)
  }

  const switchMode = (mode) => {
    setInputMode(mode)
    setWeightGrams('')
    setAmountInput('')
    setResult(null)
    setError('')
  }

  const currency = settings?.currency || 'KSh'

  // Preview label data
  const previewStore = (currentUser?.store || settings?.businessName || 'STORE').toUpperCase()
  const todayFormatted = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' }).replace(/\//g, '-')
  const expiryFormatted = selectedProduct?.expiryDate
    ? new Date(selectedProduct.expiryDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' }).replace(/\//g, '-')
    : null

  const canGenerate = selectedProduct && (
    inputMode === 'weight'
      ? (Number(weightGrams) > 0)
      : (derivedGrams && derivedGrams > 0 && derivedGrams <= 9999)
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%', background: 'var(--bg-page)', padding: '24px 28px 48px', gap: 20 }}>

      {/* ── Page Header ─────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: 4 }}>
            Weigh Station
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', margin: 0, lineHeight: 1.2 }}>
            Weigh &amp; Print Labels
          </h1>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
            Weigh an item → generate EAN-13 sticker → scan at checkout
          </div>
        </div>
        <button
          onClick={loadProducts}
          className={w.ctaBtn}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 16px', borderRadius: 'var(--radius-md)',
            background: 'var(--bg-card)', border: '1px solid var(--border-soft)',
            color: 'var(--text-secondary)', fontWeight: 600, fontSize: 13,
            cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          <MdRefresh size={16} /> Refresh
        </button>
      </div>

      <div className={w.mainGrid}>

        {/* ── LEFT: Product Selector ─────────────────────────────── */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-soft)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-card)', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-soft)' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10 }}>
              Select Product to Weigh
            </div>
            <div style={{ position: 'relative' }}>
              <MdSearch style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: 18 }} />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by name or PLU number..."
                style={{
                  width: '100%', padding: '8px 12px 8px 36px', borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-medium)', background: 'var(--bg-muted)',
                  color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box',
                }}
              />
            </div>
          </div>

          <div className={w.productScroll}>
            {loading ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                Loading weighed products...
              </div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center' }}>
                <MdScale size={36} style={{ color: 'var(--border-medium)', marginBottom: 10, display: 'block', margin: '0 auto 10px' }} />
                <div style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 500 }}>
                  {products.length === 0
                    ? 'No weighed products found. Edit a product and enable "Sold by Weight".'
                    : 'No products match your search.'}
                </div>
              </div>
            ) : (
              filtered.map(p => {
                const isSelected = selectedProduct?._id === p._id
                return (
                  <button
                    key={p._id}
                    onClick={() => { setSelectedProduct(p); setResult(null); setError(''); setWeightGrams(''); setAmountInput('') }}
                    className={w.productBtn}
                    style={{
                      width: '100%', textAlign: 'left', padding: '12px 20px',
                      borderBottom: '1px solid var(--border-soft)',
                      background: isSelected ? 'var(--primary-light)' : 'transparent',
                      border: 'none', borderLeft: isSelected ? '4px solid var(--primary)' : '4px solid transparent',
                      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                      fontFamily: 'inherit',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: isSelected ? 'var(--primary)' : 'var(--text-primary)' }}>
                        {p.name}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                        PLU: {p.pluNumber || '—'} · {p.category} · {p.store}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--primary)' }}>
                        {currency} {Number(p.pricePerKg || p.sellPrice || 0).toLocaleString()}/kg
                      </div>
                      {!p.pluNumber && (
                        <div style={{ fontSize: 10, color: 'var(--warning-dark)', background: 'var(--warning-light)', padding: '2px 6px', borderRadius: 4, marginTop: 2 }}>
                          No PLU set
                        </div>
                      )}
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>

        {/* ── RIGHT: Weight Input + Label Preview ────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-soft)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-card)', padding: 20 }}>

            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16 }}>
              {selectedProduct ? `Weigh: ${selectedProduct.name}` : 'Select a product first'}
            </div>

            {/* PLU + Price summary */}
            {selectedProduct && (
              <div style={{ background: 'var(--primary-light)', borderRadius: 'var(--radius-md)', padding: '10px 14px', marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>PLU Number</div>
                  <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--primary)' }}>{selectedProduct.pluNumber || '—'}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Price / KG</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--primary)' }}>
                    {currency} {Number(selectedProduct.pricePerKg || selectedProduct.sellPrice || 0).toLocaleString()}
                  </div>
                </div>
              </div>
            )}

            {/* ── Mode toggle ──────────────────────────────────────── */}
            {selectedProduct && (
              <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                {[
                  { key: 'weight', label: 'Enter Weight', icon: <MdFitnessCenter size={14} /> },
                  { key: 'amount', label: 'Enter Amount', icon: <MdAttachMoney size={14} /> },
                ].map(opt => (
                  <button
                    key={opt.key}
                    onClick={() => switchMode(opt.key)}
                    className={w.modeToggleBtn}
                    style={{
                      border: `1.5px solid ${inputMode === opt.key ? 'var(--primary)' : 'var(--border-medium)'}`,
                      background: inputMode === opt.key ? 'var(--primary)' : 'var(--bg-muted)',
                      color: inputMode === opt.key ? '#fff' : 'var(--text-secondary)',
                    }}
                  >
                    {opt.icon} {opt.label}
                  </button>
                ))}
              </div>
            )}

            {/* ── Weight mode input ────────────────────────────────── */}
            {inputMode === 'weight' && (
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 6 }}>
                  Weight (grams)
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button
                    onClick={() => adjustWeight(-10)}
                    disabled={!selectedProduct}
                    className={w.ctaBtn}
                    style={{ width: 36, height: 44, borderRadius: 'var(--radius-md)', border: '1px solid var(--border-medium)', background: 'var(--bg-muted)', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, opacity: selectedProduct ? 1 : 0.4 }}
                  ><MdRemove size={16} /></button>
                  <input
                    ref={weightInputRef}
                    type="number"
                    value={weightGrams}
                    onChange={e => { setWeightGrams(e.target.value); setResult(null); setError('') }}
                    onKeyDown={e => e.key === 'Enter' && handleGenerate()}
                    placeholder="e.g. 432"
                    min={1} max={9999}
                    disabled={!selectedProduct}
                    style={{ flex: 1, height: 44, textAlign: 'center', fontSize: 24, fontWeight: 800, borderRadius: 'var(--radius-md)', border: '2px solid var(--border-medium)', background: 'var(--bg-muted)', color: 'var(--text-primary)', outline: 'none', opacity: selectedProduct ? 1 : 0.4 }}
                  />
                  <button
                    onClick={() => adjustWeight(10)}
                    disabled={!selectedProduct}
                    className={w.ctaBtn}
                    style={{ width: 36, height: 44, borderRadius: 'var(--radius-md)', border: '1px solid var(--border-medium)', background: 'var(--bg-muted)', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, opacity: selectedProduct ? 1 : 0.4 }}
                  ><MdAdd size={16} /></button>
                </div>
                {selectedProduct && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                    {[50, 100, 200, 250, 500, 750, 1000].map(g => (
                      <button
                        key={g}
                        onClick={() => { setWeightGrams(String(g)); setResult(null); setError('') }}
                        className={w.presetBtn}
                        style={{
                          background: Number(weightGrams) === g ? 'var(--primary)' : 'var(--bg-muted)',
                          color: Number(weightGrams) === g ? '#fff' : 'var(--text-secondary)',
                        }}
                      >
                        {g >= 1000 ? `${g / 1000}kg` : `${g}g`}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── Amount mode input ────────────────────────────────── */}
            {inputMode === 'amount' && (
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 6 }}>
                  Customer's Budget ({currency})
                </label>
                <input
                  ref={amountInputRef}
                  type="number"
                  value={amountInput}
                  onChange={e => { setAmountInput(e.target.value); setResult(null); setError('') }}
                  onKeyDown={e => e.key === 'Enter' && handleGenerate()}
                  placeholder="e.g. 500"
                  min={1}
                  disabled={!selectedProduct}
                  style={{
                    width: '100%', height: 44, textAlign: 'center', fontSize: 24, fontWeight: 800,
                    borderRadius: 'var(--radius-md)', border: '2px solid var(--border-medium)',
                    background: 'var(--bg-muted)', color: 'var(--text-primary)',
                    outline: 'none', boxSizing: 'border-box', opacity: selectedProduct ? 1 : 0.4,
                  }}
                />
                {selectedProduct && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                    {[50, 100, 200, 500, 1000, 2000].map(amt => (
                      <button
                        key={amt}
                        onClick={() => { setAmountInput(String(amt)); setResult(null); setError('') }}
                        className={w.presetBtn}
                        style={{
                          background: Number(amountInput) === amt ? 'var(--primary)' : 'var(--bg-muted)',
                          color: Number(amountInput) === amt ? '#fff' : 'var(--text-secondary)',
                        }}
                      >
                        {currency} {amt.toLocaleString()}
                      </button>
                    ))}
                  </div>
                )}
                {/* Derived weight feedback */}
                {derivedGrams && derivedGrams > 0 && derivedGrams <= 9999 && (
                  <div style={{ marginTop: 8, padding: '8px 12px', borderRadius: 'var(--radius-md)', background: 'var(--primary-light)', fontSize: 13, fontWeight: 700, color: 'var(--primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Weight to cut / pack:</span>
                    <span>{derivedGrams}g &nbsp;({(derivedGrams / 1000).toFixed(3)} kg)</span>
                  </div>
                )}
                {derivedGrams && derivedGrams > 9999 && (
                  <div style={{ marginTop: 8, fontSize: 12, color: 'var(--danger-dark)', fontWeight: 600 }}>
                    Amount too large — result exceeds 9,999g limit. Enter a smaller amount.
                  </div>
                )}
              </div>
            )}

            {/* ── Live price preview ───────────────────────────────── */}
            {selectedProduct && effectiveGrams && effectiveGrams > 0 && (
              <div style={{ background: 'var(--bg-muted)', borderRadius: 'var(--radius-md)', padding: '10px 14px', marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {formatWeight(effectiveGrams)} × {currency} {(selectedProduct.pricePerKg || selectedProduct.sellPrice || 0).toLocaleString()}/kg
                </div>
                <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--primary)' }}>
                  {currency} {(effectiveGrams / 1000 * (selectedProduct.pricePerKg || selectedProduct.sellPrice || 0)).toFixed(2)}
                </div>
              </div>
            )}

            {/* Error */}
            {error && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 'var(--radius-md)', background: 'var(--danger-light)', color: 'var(--danger-dark)', fontSize: 12, fontWeight: 600, marginBottom: 12 }}>
                <MdWarning size={14} /> {error}
              </div>
            )}

            <button
              onClick={handleGenerate}
              disabled={!canGenerate || generating}
              className={w.ctaBtn}
              style={{
                width: '100%', padding: '12px', borderRadius: 'var(--radius-md)',
                background: (!canGenerate || generating) ? 'var(--border-medium)' : 'var(--primary)',
                color: '#fff', fontWeight: 800, fontSize: 15, border: 'none',
                cursor: (!canGenerate || generating) ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              <MdScale size={18} />
              {generating ? 'Generating...' : 'Generate Label'}
            </button>

            {result && (
              <button
                onClick={handleReset}
                className={w.ctaBtn}
                style={{ width: '100%', padding: '8px', borderRadius: 'var(--radius-md)', background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border-soft)', fontSize: 12, fontWeight: 600, cursor: 'pointer', marginTop: 8, fontFamily: 'inherit' }}
              >
                Weigh Another Item
              </button>
            )}
          </div>

          {/* ── Label Preview ────────────────────────────────────── */}
          {result && (
            <div style={{ background: 'var(--bg-card)', border: '2px solid var(--success)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-card)', padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14 }}>
                <MdCheckCircle size={18} style={{ color: 'var(--success)' }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--success-dark)' }}>Label Ready</span>
              </div>

              {/* Preview — mirrors buildLabelCanvas layout */}
              <div style={{ background: '#fff', border: '1px dashed #ccc', borderRadius: 8, overflow: 'hidden', marginBottom: 14 }}>
                {/* Red header */}
                <div style={{ background: '#CC0000', padding: '10px 16px', textAlign: 'center' }}>
                  <div style={{ fontWeight: 900, fontSize: 13, color: '#fff', letterSpacing: 3, fontFamily: 'sans-serif' }}>
                    {previewStore}
                  </div>
                </div>

                <div style={{ padding: '10px 14px 8px', fontFamily: 'sans-serif' }}>
                  {/* Product name */}
                  <div style={{ fontSize: 15, fontWeight: 900, color: '#111', textAlign: 'center', marginBottom: 8, letterSpacing: 1 }}>
                    {result.productName.toUpperCase()}
                  </div>

                  {/* Columns */}
                  <div style={{ borderTop: '1px solid #eee', paddingTop: 8, marginBottom: 6 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4, marginBottom: 3 }}>
                      <div style={{ fontSize: 9, color: '#888', letterSpacing: 0.5 }}>NET WEIGHT (KG)</div>
                      <div style={{ fontSize: 9, color: '#888', letterSpacing: 0.5 }}>PRICE PER KG</div>
                      <div style={{ fontSize: 9, color: '#888', letterSpacing: 0.5 }}>TOTAL PRICE</div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4 }}>
                      <div style={{ fontSize: 16, fontWeight: 900, color: '#111' }}>{result.weightKg.toFixed(3)}</div>
                      <div style={{ fontSize: 16, fontWeight: 900, color: '#111' }}>{Number(result.pricePerKg).toFixed(2)}</div>
                      <div style={{ fontSize: 16, fontWeight: 900, color: '#CC0000' }}>{currency} {Number(result.totalPrice).toFixed(2)}</div>
                    </div>
                  </div>

                  {/* Meta row */}
                  <div style={{ borderTop: '1px solid #eee', paddingTop: 5, marginBottom: 6, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{ fontSize: 9, color: '#888' }}>Packed on: {todayFormatted}</div>
                    <div style={{ fontSize: 9, color: '#888' }}>PLU: {selectedProduct?.pluNumber || '—'}</div>
                    {expiryFormatted && (
                      <div style={{ fontSize: 9, color: '#888' }}>Best Before: {expiryFormatted}</div>
                    )}
                  </div>

                  {/* Barcode text */}
                  <div style={{ borderTop: '1px solid #eee', paddingTop: 6, textAlign: 'center' }}>
                    <div style={{ fontSize: 10, fontFamily: 'monospace', color: '#333', letterSpacing: 3 }}>
                      {result.barcode}
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Number of copies ─────────────────────────────────── */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, padding: '8px 12px', borderRadius: 'var(--radius-md)', background: 'var(--bg-muted)', border: '1px solid var(--border-soft)' }}>
                <MdContentCopy size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', flexShrink: 0 }}>
                  Copies to print
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>
                  <button
                    onClick={() => setCopies(c => Math.max(1, Number(c) - 1))}
                    className={w.copiesBtn}
                  ><MdRemove size={13} /></button>
                  <input
                    type="number"
                    min={1}
                    max={200}
                    value={copies}
                    onChange={e => setCopies(Math.max(1, Math.min(200, Number(e.target.value) || 1)))}
                    className={w.copiesInput}
                  />
                  <button
                    onClick={() => setCopies(c => Math.min(200, Number(c) + 1))}
                    className={w.copiesBtn}
                  ><MdAdd size={13} /></button>
                </div>
              </div>
              {Number(copies) > 1 && (
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10, marginTop: -6 }}>
                  Use this when pre-weighing several identical packets (e.g. 10 × 500g sugar) on a normal scale — print one label per packet in a single batch.
                </div>
              )}

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={handlePrint}
                  className={w.ctaBtn}
                  style={{ flex: 1, padding: '10px', borderRadius: 'var(--radius-md)', background: 'var(--primary)', color: '#fff', fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontFamily: 'inherit' }}
                >
                  <MdPrint size={16} /> Print {Number(copies) > 1 ? `${copies} Labels` : 'Label'}
                </button>
                <button
                  onClick={handleDownload}
                  className={w.ctaBtn}
                  style={{ flex: 1, padding: '10px', borderRadius: 'var(--radius-md)', background: 'var(--bg-muted)', color: 'var(--text-secondary)', fontWeight: 700, fontSize: 13, border: '1px solid var(--border-soft)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontFamily: 'inherit' }}
                >
                  <MdDownload size={16} /> Download
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Info box ────────────────────────────────────────────────── */}
      <div style={{ background: 'var(--primary-light)', border: '1px solid var(--primary)', borderRadius: 'var(--radius-md)', padding: '14px 18px' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary)', marginBottom: 6 }}>How this works</div>
        <div style={{ fontSize: 12, color: 'var(--primary)', lineHeight: 1.8, opacity: 0.85 }}>
          1. Select a weighed product (e.g. Sugar, Rice, Meat, Tomatoes)<br />
          2a. <strong>Enter Weight</strong> — type the grams read from your scale → system calculates price<br />
          2b. <strong>Enter Amount</strong> — type the customer's budget (e.g. KSh 500) → system tells you how many grams to cut<br />
          3. Click Generate Label → set Copies if printing identical pre-weighed packets → Print<br />
          4. Stick the label on the package. At checkout, scan the barcode → price is calculated automatically<br />
          <br />
          <strong>Using a DIGI SM-500 scale:</strong> export the PLU file below and load it onto the scale via USB — the scale then prints its own labels directly at the counter, with no need for this page at all.<br />
          <strong>Using a normal scale (no smart scale):</strong> use this page to weigh manually and print labels on any regular printer — for identical pre-packed items, set "Copies" to print several at once.<br />
          <strong>Barcode format:</strong> EAN-13 starting with "2" (DIGI SM-500 compatible) &nbsp;·&nbsp;
          <strong>To add weighed products:</strong> Products → Edit → enable "Sold by Weight" and set PLU number
        </div>

        {/* PLU Export */}
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 600 }}>
            <strong>DIGI SM-500 Scale Setup:</strong> Download the PLU file and load it onto your scale via USB to sync all product prices automatically.
          </div>
          <button
            onClick={handlePLUExport}
            disabled={exportingPLU}
            className={w.ctaBtn}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 'var(--radius-md)', background: exportingPLU ? 'var(--border-medium)' : 'var(--primary)', color: '#fff', fontWeight: 700, fontSize: 12, border: 'none', cursor: exportingPLU ? 'not-allowed' : 'pointer', fontFamily: 'inherit', flexShrink: 0 }}
          >
            <MdSyncAlt size={15} />
            {exportingPLU ? 'Exporting...' : 'Download PLU File for Scale'}
          </button>
        </div>
      </div>
    </div>
  )
}
