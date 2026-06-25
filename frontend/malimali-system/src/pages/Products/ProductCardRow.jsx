import { MdEdit, MdDelete, MdStorefront, MdCalendarToday, MdWarning, MdScale } from 'react-icons/md'
import styles from '@/styles/Products.module.css'

export default function ProductCardRow({ product, stockBadge, openEdit, setRestockProduct, setDeleteConfirm }) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const expiryDate      = product.expiryDate ? new Date(product.expiryDate) : null
  const isExpired       = product.isExpired || (expiryDate && expiryDate < today)
  const isExpiringSoon  = expiryDate && !isExpired &&
    (expiryDate - today) / (1000 * 60 * 60 * 24) <= 30

  const formatDate = (d) => {
    if (!d) return '—'
    return new Date(d).toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  const expiryBadgeClass = isExpired
    ? styles.expiredBadge
    : isExpiringSoon
      ? styles.expiringSoonBadge
      : styles.freshBadge

  const isWeighed = !!product.isWeighed
  const unit = product.unit || 'pcs'

  return (
    <tr className={`${styles.tableRow} ${isExpired ? styles.tableRowExpired : ''}`}>

      {/* ── Product Info ─────────────────────────────────── */}
      <td className="p-3 w-5/12">
        <div className="flex flex-col gap-0.5">

          {/* Name + weighed badge */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              {product.name}
            </span>
            {isWeighed && (
              <span
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 3,
                  fontSize: 9, fontWeight: 800, padding: '1px 6px',
                  borderRadius: 20, textTransform: 'uppercase', letterSpacing: '0.06em',
                  background: 'var(--primary-light)', color: 'var(--primary)',
                  border: '1px solid var(--primary)',
                }}
              >
                <MdScale size={9} /> Weighed
              </span>
            )}
          </div>

          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {product.category}
          </span>
          {product.description && (
            <span className="text-xs truncate max-w-[200px]" style={{ color: 'var(--text-muted)' }}>
              {product.description}
            </span>
          )}
          {product.batch && (
            <span className="text-[10px] font-semibold" style={{ color: 'var(--primary)' }}>
              Batch: {product.batch}
            </span>
          )}

          {/* PLU number for weighed items */}
          {isWeighed && product.pluNumber && (
            <span className="text-[10px] font-semibold" style={{ color: 'var(--text-muted)' }}>
              PLU: {product.pluNumber}
            </span>
          )}

          {/* Store + Supplier tags */}
          <div className="flex flex-wrap gap-1.5 mt-1">
            {product.store && (
              <span
                className="flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded"
                style={{ background: 'var(--primary-light)', color: 'var(--primary)' }}
              >
                <MdStorefront className="text-[11px]" /> {product.store}
              </span>
            )}
            {product.supplier && (
              <span
                className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                style={{ background: 'var(--bg-muted)', color: 'var(--text-secondary)' }}
              >
                {product.supplier}
              </span>
            )}
          </div>

          {/* Dates */}
          <div className="flex flex-wrap gap-2 mt-0.5">
            {product.mftDate && (
              <span className="flex items-center gap-1 text-[10px]" style={{ color: 'var(--text-muted)' }}>
                <MdCalendarToday className="text-[10px]" /> MFT: {formatDate(product.mftDate)}
              </span>
            )}
            {expiryDate && (
              <span className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded ${expiryBadgeClass}`}>
                {(isExpired || isExpiringSoon) && <MdWarning className="text-[11px]" />}
                EXP: {formatDate(expiryDate)}
              </span>
            )}
          </div>
        </div>
      </td>

      {/* ── Stock ────────────────────────────────────────── */}
      <td className="p-3 w-1/12">
        <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
          {product.stock}
        </span>
        <span className="text-[10px] block" style={{ color: 'var(--text-muted)' }}>
          {unit}
        </span>
      </td>

      {/* ── Prices ───────────────────────────────────────── */}
      <td className="p-3 w-2/12">
        <div className="flex flex-col gap-0.5">
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Buy:{' '}
            <span className="font-semibold" style={{ color: 'var(--text-secondary)' }}>
              KSh {(product.buyPrice || 0).toLocaleString()}
            </span>
          </span>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {isWeighed ? 'Per KG:' : 'Sell:'}{' '}
            <span className="font-bold" style={{ color: 'var(--primary)' }}>
              KSh {(isWeighed
                ? (product.pricePerKg || product.sellPrice || 0)
                : (product.sellPrice || 0)
              ).toLocaleString()}
            </span>
            {isWeighed && (
              <span style={{ fontSize: 9, color: 'var(--text-muted)', marginLeft: 2 }}>/kg</span>
            )}
          </span>
        </div>
      </td>

      {/* ── Status ───────────────────────────────────────── */}
      <td className="p-3 w-1/12">
        {isExpired ? (
          <span className={`px-2 py-1 rounded-md text-xs ${styles.expiredBadge}`}>
            Expired
          </span>
        ) : (
          <span className={`px-2 py-1 rounded-md text-xs ${stockBadge(product.stock)}`}>
            {product.stock <= 3 ? 'Critical' : product.stock <= 6 ? 'Low' : 'In Stock'}
          </span>
        )}
      </td>

      {/* ── Actions ──────────────────────────────────────── */}
      <td className="p-3 w-3/12">
        <div className="flex items-center gap-1 flex-wrap">
          <button
            onClick={() => openEdit(product)}
            className="p-1.5 rounded-lg transition"
            title="Edit"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'var(--primary-light)'
              e.currentTarget.style.color = 'var(--primary)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.color = 'var(--text-muted)'
            }}
          >
            <MdEdit className="text-base" />
          </button>
          <button
            onClick={() => setRestockProduct(product)}
            className="px-2.5 py-1 text-xs font-bold rounded-lg text-white transition"
            style={{ background: 'var(--success)' }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--success-dark)'}
            onMouseLeave={e => e.currentTarget.style.background = 'var(--success)'}
          >
            Restock
          </button>
          <button
            onClick={() => setDeleteConfirm(product)}
            className="p-1.5 rounded-lg transition"
            title="Delete"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'var(--danger-light)'
              e.currentTarget.style.color = 'var(--danger)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.color = 'var(--text-muted)'
            }}
          >
            <MdDelete className="text-base" />
          </button>
        </div>
      </td>
    </tr>
  )
}
