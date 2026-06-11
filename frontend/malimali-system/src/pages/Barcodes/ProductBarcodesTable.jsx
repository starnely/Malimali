import { useState, useRef } from 'react'
import { MdSearch, MdPrint, MdQrCodeScanner } from 'react-icons/md'
import { useApp } from '@/context/AppContext'
import s from '@/styles/Barcodes.module.css'

export default function ProductBarcodesTable({ products = [], onGoToScan }) {
  const { settings } = useApp()
  const [search, setSearch] = useState('')
  const printRef = useRef(null)

  const filtered = products.filter(p => {
    if (!p) return false
    const nameMatch    = (p.name     || '').toLowerCase().includes(search.toLowerCase())
    const barcodeMatch = (p.barcode  || '').toLowerCase().includes(search.toLowerCase())
    const idMatch      = (p._id      || '').toLowerCase().includes(search.toLowerCase())
    const catMatch     = (p.category || '').toLowerCase().includes(search.toLowerCase())
    return nameMatch || barcodeMatch || idMatch || catMatch
  })

  const handlePrintTable = () => {
    if (!printRef.current) return
    const printContents = printRef.current.innerHTML
    const win = window.open('', '_blank')
    win.document.write(`
      <html>
      <head>
        <title>Product Barcodes Catalog</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 24px; color: #222; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 10px; }
          th { background: #185FA5 !important; color: #ffffff !important; padding: 10px 12px; text-align: left; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          td { padding: 8px 12px; border-bottom: 1px solid #e5e7eb; }
          tr:nth-child(even) td { background: #f9fafb; }
          @media print { th { background: #185FA5 !important; color: #fff !important; } body { padding: 0; } }
        </style>
      </head>
      <body>
        <h2 style="margin: 0 0 4px 0; color: #111827;">${settings?.businessName || 'POS System'}</h2>
        <p style="margin: 0 0 20px 0; font-size: 13px; color: #4b5563;">
          Product Barcodes Index &bull; Count: ${filtered.length} items &bull; Printed: ${new Date().toLocaleDateString()}
        </p>
        ${printContents}
      </body>
      </html>
    `)
    win.document.close()
    win.print()
  }

  return (
    <div className={s.barcodeTableWrap}>
      {/* Toolbar */}
      <div className={s.barcodeTableToolbar}>
        <div>
          <div className={s.barcodeTableTitle}>All Product Barcodes</div>
          <div className={s.barcodeTableSub}>
            {filtered.length} product{filtered.length !== 1 ? 's' : ''} · scan or type barcode/ID at POS to sell
          </div>
        </div>
        <div className={s.barcodeTableSearch}>
          <div className={s.searchWrap}>
            <MdSearch className={s.searchIcon} />
            <input
              type="text"
              placeholder="Search name, barcode, ID..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className={s.searchInput}
            />
          </div>
          <button onClick={handlePrintTable} className={s.printBtn}>
            <MdPrint style={{ fontSize: '16px' }} /> Print List
          </button>
        </div>
      </div>

      {/* Table */}
      <div className={s.tableCard}>
        <div ref={printRef}>
          <table className={s.barcodeTable}>
            <thead>
              <tr>
                {['#', 'Product Name', 'Category', 'Barcode', 'Product ID', 'Type', 'Stock', 'Sell Price'].map(h => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan="8" className={s.tableEmpty}>No products found</td>
                </tr>
              ) : (
                filtered.map((p, i) => {
                  if (!p) return null
                  const isGenerated  = /^\d{13}$/.test(p.barcode || '') || /^\d{10,}$/.test(p.barcode || '')
                  const currentStock = p.stock || 0
                  const stockClass   = currentStock <= 3
                    ? s.stockBadgeCritical
                    : currentStock <= 6
                      ? s.stockBadgeLow
                      : s.stockBadgeOk

                  return (
                    <tr key={p._id || i}>
                      <td className={s.tdNum}>{i + 1}</td>
                      <td className={s.tdName}><strong>{p.name || 'Unnamed Product'}</strong></td>
                      <td className={s.tdCat}>{p.category || 'General'}</td>
                      <td><span className={s.barcodeChip}>{p.barcode || '—'}</span></td>
                      <td><span className={s.idChip}>{p._id || '—'}</span></td>
                      <td>
                        <span className={`${s.typeBadge} ${isGenerated ? s.typeBadgeGenerated : s.typeBadgeIndustry}`}>
                          {isGenerated ? 'Generated' : 'Industry'}
                        </span>
                      </td>
                      <td><span className={`${s.stockBadge} ${stockClass}`}>{currentStock}</span></td>
                      <td className={s.tdPrice}>KSh {Number(p.sellPrice || 0).toLocaleString()}</td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Hint */}
      <div className={s.tableHint}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1 }}>
          <MdQrCodeScanner className={s.tableHintIcon} />
          <span>
            At the POS terminal, scan the barcode or type the <strong>Barcode</strong> value.
            If unreadable, type the <strong>Product ID</strong> instead.
          </span>
        </div>
        {onGoToScan && (
          <button onClick={onGoToScan} className={s.scannerLinkBtn}>
            Open Live Scanner →
          </button>
        )}
      </div>
    </div>
  )
}
