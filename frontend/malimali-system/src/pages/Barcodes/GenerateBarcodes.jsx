import { useRef } from 'react'
import { MdDownload, MdPrint, MdQrCodeScanner, MdScale } from 'react-icons/md'
import BarcodeImage from './BarcodeImage'
import s from '@/styles/Barcodes.module.css'
import { fmtQty } from '@/utils/utils'

export default function GenerateBarcodes({ products = [], searchQuery = '', setSearchQuery, handleDownload }) {
  const labelPrintRef = useRef(null)

  // ── Separate weighed from standard products ───────────────────────
  const standardProducts = products.filter(p => p && !p.isWeighed)
  const weighedCount = products.filter(p => p && p.isWeighed).length

  const filteredProducts = standardProducts.filter(p => {
    const name = (p.name || '').toLowerCase()
    const category = (p.category || 'General').toLowerCase()
    const query = (searchQuery || '').toLowerCase()
    return name.includes(query) || category.includes(query)
  })

  const handlePrintAllVisible = () => {
    if (!labelPrintRef.current) return
    const gridContents = labelPrintRef.current.innerHTML
    const win = window.open('', '_blank')
    win.document.write(`
      <html>
      <head>
        <title>Print Product Labels</title>
        <style>
          body { font-family: system-ui, sans-serif; margin: 0; padding: 20px; background: #fff; }
          .print-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 16px; }
          .label-card { border: 1px dashed #bbb; padding: 12px; text-align: center; border-radius: 6px; page-break-inside: avoid; background: #fff; }
          .title { font-size: 12px; font-weight: bold; margin: 6px 0 2px 0; color: #111; }
          .meta { font-size: 10px; color: #555; margin-bottom: 4px; }
          .price { font-size: 13px; font-weight: 800; color: #000; margin: 4px 0; }
          .barcode-text { font-family: monospace; font-size: 10px; color: #444; }
          button, .action-btn, input, p { display: none !important; }
          @media print { body { padding: 0; } .label-card { border: 1px solid #ddd; } }
        </style>
      </head>
      <body>
        <div class="print-grid">${gridContents}</div>
      </body>
      </html>
    `)
    win.document.close()
    setTimeout(() => win.print(), 300)
  }

  return (
    <div className={s.generateWrap}>

      {/* ── Toolbar ── */}
      <div className={s.generateToolbar}>
        <div className={s.generateToolbarLeft}>
          <p className={s.generateHint}>Print these labels and stick them directly on your products.</p>
          <span className={s.generateCount}>Found {filteredProducts.length} matching items</span>
        </div>
        <div className={s.generateToolbarRight}>
          <input
            type="text"
            placeholder="Filter by name or category..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className={s.generateSearch}
          />
          {filteredProducts.length > 0 && (
            <button onClick={handlePrintAllVisible} className={s.printBtn}>
              <MdPrint style={{ fontSize: '16px' }} /> Print Grid Sheets
            </button>
          )}
        </div>
      </div>

      {/* ── Weighed products notice ── */}
      {weighedCount > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 16px', marginBottom: 12,
          borderRadius: 'var(--radius-md)',
          background: 'var(--primary-light)',
          border: '1px solid var(--primary)',
          fontSize: 13, color: 'var(--primary)', fontWeight: 600,
        }}>
          <MdScale size={16} style={{ flexShrink: 0 }} />
          {weighedCount} weighed product{weighedCount !== 1 ? 's are' : ' is'} not shown here.
          Use the <strong style={{ marginLeft: 4 }}>Weigh Station</strong> page to print their labels.
        </div>
      )}

      {/* ── Empty state ── */}
      {filteredProducts.length === 0 ? (
        <div className={s.generateEmptyState}>
          <MdQrCodeScanner className={s.generateEmptyIcon} />
          <h3 className={s.generateEmptyTitle}>No matching stock items found</h3>
          <p className={s.generateEmptyDesc}>Try adjusting your search criteria.</p>
        </div>
      ) : (
        <div ref={labelPrintRef} className={s.barcodeGrid}>
          {filteredProducts.map(product => {
            const displayBarcode = product.barcode || product._id || '—'
            return (
              <div key={product._id} className={`${s.barcodeCard} label-card`}>
                <div className={s.barcodeImgWrap}>
                  <BarcodeImage value={displayBarcode} />
                </div>
                <div className={s.barcodeCardInfo}>
                  <div className={`${s.barcodeCardName} title`}>
                    {product.name || 'Unnamed Item'}
                  </div>
                  <div className={`${s.barcodeCardCat} meta`}>
                    {product.category || 'General'}
                  </div>
                  <div className={`${s.barcodeCardPrice} price`}>
                    KSh {Number(product.sellPrice || 0).toLocaleString()}
                  </div>
                  <div className={`${s.barcodeCardStock} ${product.stock <= 5 ? s.barcodeCardStockLow : s.barcodeCardStockOk}`}>
                    Stock: {fmtQty(product.stock ?? 0)} {product.unit || 'pcs'}
                  </div>
                  <div className={`${s.barcodeCardBarcode} barcode-text`}>
                    BC: {product.barcode || 'System Assigned'}
                  </div>
                </div>
                <button
                  onClick={() => handleDownload(product)}
                  className={`${s.downloadBtn} action-btn`}
                >
                  <MdDownload style={{ fontSize: '16px' }} /> Download Label
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
