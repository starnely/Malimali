import ProductCardRow from './ProductCardRow'
import styles from '@/styles/Products.module.css'

const columns = [
  { name: 'Product', width: 'w-5/12' },
  { name: 'Stock',   width: 'w-1/12' },
  { name: 'Prices',  width: 'w-2/12' },
  { name: 'Status',  width: 'w-1/12' },
  { name: 'Actions', width: 'w-3/12' },
]

// Returns CSS module class name instead of Tailwind string
const stockBadgeClass = (stock) => {
  if (stock <= 3) return styles.critical
  if (stock <= 6) return styles.low
  return styles.inStock
}

export default function ProductList({ filtered, openEdit, setRestockProduct, setDeleteConfirm }) {
  return (
    <div className="flex-1 overflow-hidden px-6 pb-6">
      <div
        className="rounded-xl h-full flex flex-col"
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-soft)',
          boxShadow: 'var(--shadow-card)',
        }}
      >
        {/* ── Fixed Table Header ───────────────────────── */}
        <div className="flex-shrink-0 pr-[17px]">
          <table className="w-full table-fixed border-collapse">
            <thead>
              <tr style={{ background: 'var(--bg-muted)', borderBottom: '2px solid var(--border-soft)' }}>
                {columns.map(col => (
                  <th
                    key={col.name}
                    className={`p-3 text-left text-[10px] font-black uppercase tracking-widest ${col.width}`}
                    style={{ color: 'var(--text-muted)' }}
                  >
                    {col.name}
                  </th>
                ))}
              </tr>
            </thead>
          </table>
        </div>

        {/* ── Scrollable Table Body ────────────────────── */}
        <div className="flex-1 overflow-y-auto">
          <table className="w-full table-fixed border-collapse">
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan="5" className="p-12 text-center">
                    <div className="text-3xl mb-2">📦</div>
                    <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>
                      No products found
                    </p>
                  </td>
                </tr>
              ) : (
                filtered.map(p => (
                  <ProductCardRow
                    key={p._id}
                    product={p}
                    stockBadge={stockBadgeClass}
                    openEdit={openEdit}
                    setRestockProduct={setRestockProduct}
                    setDeleteConfirm={setDeleteConfirm}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
