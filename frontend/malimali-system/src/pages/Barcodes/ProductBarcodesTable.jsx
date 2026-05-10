import { useState, useRef } from 'react';
import { MdSearch, MdPrint, MdQrCodeScanner } from 'react-icons/md';
import s from '@/styles/Barcodes.module.css';

/* ── PRODUCT BARCODES TABLE ─────────────────────────────────────────────── */
export default function ProductBarcodesTable({ products, onGoToScan }) {
  const [search, setSearch] = useState('')
  const printRef = useRef(null)

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.barcode && p.barcode.toLowerCase().includes(search.toLowerCase())) ||
    (p._id && p._id.toLowerCase().includes(search.toLowerCase())) ||
    (p.category && p.category.toLowerCase().includes(search.toLowerCase()))
  )

  const handlePrintTable = () => {
    const printContents = printRef.current.innerHTML
    const win = window.open('', '_blank')
    win.document.write(`
      <html><head><title>Product Barcodes</title>
      <style>
        body { font-family: sans-serif; padding: 24px; }
        table { width: 100%; border-collapse: collapse; font-size: 13px; }
        th { background: #185FA5; color: #fff; padding: 10px 12px; text-align: left; }
        td { padding: 10px 12px; border-bottom: 1px solid #eee; }
        tr:nth-child(even) td { background: #f9f9f9; }
        .badge { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 600; }
        .industry { background: #E6F1FB; color: #0C447C; }
        .generated { background: #EAF3DE; color: #27500A; }
      </style></head><body>
      <h2 style="margin-bottom:16px">Product Barcodes — Malimali POS</h2>
      ${printContents}
      </body></html>
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
            {filtered.length} product{filtered.length !== 1 ? 's' : ''} · scan or type the barcode/ID at POS to sell
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
                <th>#</th>
                <th>Product Name</th>
                <th>Category</th>
                <th>Barcode</th>
                <th>Product ID</th>
                <th>Type</th>
                <th>Stock</th>
                <th>Sell Price</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan="8" className={s.tableEmpty}>No products found</td>
                </tr>
              ) : (
                filtered.map((p, i) => {
                  const isGenerated = /^\d{13}$/.test(p.barcode) || /^\d{10,}$/.test(p.barcode)
                  const stockClass = p.stock <= 3 ? s.stockBadgeCritical : p.stock <= 6 ? s.stockBadgeLow : s.stockBadgeOk
                  return (
                    <tr key={p._id}>
                      <td className={s.tdNum}>{i + 1}</td>
                      <td className={s.tdName}>{p.name}</td>
                      <td className={s.tdCat}>{p.category}</td>
                      <td><span className={s.barcodeChip}>{p.barcode || '—'}</span></td>
                      <td><span className={s.idChip}>{p._id}</span></td>
                      <td>
                        <span className={`${s.typeBadge} ${isGenerated ? s.typeBadgeGenerated : s.typeBadgeIndustry}`}>
                          {isGenerated ? 'Generated' : 'Industry'}
                        </span>
                      </td>
                      <td><span className={`${s.stockBadge} ${stockClass}`}>{p.stock}</span></td>
                      <td className={s.tdPrice}>KSh {Number(p.sellPrice).toLocaleString()}</td>
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
        <MdQrCodeScanner className={s.tableHintIcon} />
        At the POS terminal, scan the product barcode or type the <strong>&nbsp;Barcode&nbsp;</strong> value into the scanner input. If the barcode is unreadable, type the <strong>&nbsp;Product ID&nbsp;</strong> instead and press Enter.
      </div>
    </div>
  )
}