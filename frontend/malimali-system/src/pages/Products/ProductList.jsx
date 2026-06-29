import { MdEdit, MdDelete } from 'react-icons/md'
import ProductCardRow from './ProductCardRow'
import styles from '@/styles/Products.module.css'
import { fmtQty } from '@/utils/utils'

const columns = [
  { name: 'Product', width: 'w-5/12' },
  { name: 'Stock',   width: 'w-1/12' },
  { name: 'Prices',  width: 'w-2/12' },
  { name: 'Status',  width: 'w-1/12' },
  { name: 'Actions', width: 'w-3/12' },
]

const stockBadgeClass = (stock) => {
  if (stock <= 3) return styles.critical
  if (stock <= 6) return styles.low
  return styles.inStock
}

export default function ProductList({ filtered, openEdit, setRestockProduct, setDeleteConfirm }) {
  return (
    <>
      {/* ── Desktop Table (hidden at ≤768px) ─────────────── */}
      <div className={`md:flex-1 md:overflow-hidden px-6 pb-6 ${styles.productTableContainer}`}>
        <div
          className="rounded-xl md:h-full flex flex-col"
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-soft)',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          {/* Fixed Table Header */}
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

          {/* Scrollable Table Body */}
          <div className="md:flex-1 md:overflow-y-auto">
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

      {/* ── Mobile Cards (shown at ≤768px) ───────────────── */}
      <div className={styles.mobileProductList}>
        {filtered.length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-3xl mb-2">📦</div>
            <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>
              No products found
            </p>
          </div>
        ) : (
          filtered.map(product => {
            const today = new Date()
            today.setHours(0, 0, 0, 0)
            const expiryDate = product.expiryDate ? new Date(product.expiryDate) : null
            const isExpired = product.isExpired || (expiryDate && expiryDate < today)
            const isExpiringSoon = expiryDate && !isExpired &&
              (expiryDate - today) / (1000 * 60 * 60 * 24) <= 30
            const unit = product.unit || 'pcs'
            const sellPrice = product.isWeighed
              ? (product.pricePerKg || product.sellPrice || 0)
              : (product.sellPrice || 0)

            const metaParts = []
            if (product.category) metaParts.push(product.category)
            if (product.store) metaParts.push(product.store)
            if (product.batch) metaParts.push(`Batch: ${product.batch}`)

            return (
              <div
                key={product._id}
                className={`${styles.mobileProductCard} ${isExpired ? styles.mobileProductCardExpired : ''}`}
              >
                {/* Header: name + badge */}
                <div className={styles.mobileProductHeader}>
                  <div className={styles.mobileProductInfo}>
                    <div className={styles.mobileProductName}>{product.name}</div>
                    {metaParts.length > 0 && (
                      <div className={styles.mobileProductMeta}>{metaParts.join(' · ')}</div>
                    )}
                  </div>
                  <div className={styles.mobileProductBadges}>
                    {isExpired ? (
                      <span className={`px-2 py-0.5 rounded text-xs ${styles.expiredBadge}`}>
                        Expired
                      </span>
                    ) : isExpiringSoon ? (
                      <span className={`px-2 py-0.5 rounded text-xs ${styles.expiringSoonBadge}`}>
                        Exp Soon
                      </span>
                    ) : (
                      <span className={`px-2 py-0.5 rounded text-xs ${stockBadgeClass(product.stock)}`}>
                        {product.stock <= 3 ? 'Critical' : product.stock <= 6 ? 'Low' : 'In Stock'}
                      </span>
                    )}
                  </div>
                </div>

                {/* Price cells */}
                <div className={styles.mobileProductPrices}>
                  <div className={styles.mobileProductPriceCell}>
                    <div className={styles.mobileProductPriceLabel}>Stock</div>
                    <div className={styles.mobileProductPriceValue}>
                      {fmtQty(product.stock)}
                      <span className={styles.mobileProductPriceUnit}>{unit}</span>
                    </div>
                  </div>
                  <div className={styles.mobileProductPriceCell}>
                    <div className={styles.mobileProductPriceLabel}>
                      {product.isWeighed ? 'Per KG' : 'Sell'}
                    </div>
                    <div className={styles.mobileProductPriceValue}>
                      KSh {sellPrice.toLocaleString()}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className={styles.mobileProductActions}>
                  <button
                    className={styles.mobileActionEdit}
                    onClick={() => openEdit(product)}
                    title="Edit product"
                  >
                    <MdEdit size={18} />
                  </button>
                  <button
                    className={styles.mobileActionRestock}
                    onClick={() => setRestockProduct(product)}
                  >
                    Restock
                  </button>
                  <button
                    className={styles.mobileActionDelete}
                    onClick={() => setDeleteConfirm(product)}
                    title="Delete product"
                  >
                    <MdDelete size={18} />
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>
    </>
  )
}
