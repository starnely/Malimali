import { MdClose, MdInventory } from 'react-icons/md'
import FormInput from './FormInput'
import styles from '@/styles/Products.module.css'
import { fmtQty } from '@/utils/utils'

export default function RestockModal({ restockProduct, restockQty, setRestockQty, confirmRestock, onClose }) {
  if (!restockProduct) return null

  const unit = restockProduct.unit || 'pcs'
  const newTotal = Number(restockProduct.stock) + (Number(restockQty) || 0)

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50"
      style={{ background: 'var(--overlay-bg)', WebkitBackdropFilter: 'blur(3px)', backdropFilter: 'blur(3px)' }}
    >
      <div
        className="w-[90vw] max-w-[380px] rounded-xl overflow-hidden"
        style={{
          background: 'var(--bg-card)',
          boxShadow: 'var(--shadow-dropdown)',
          border: '1px solid var(--border-soft)',
        }}
      >
        {/* Header */}
        <div
          className="px-5 py-4 flex items-center justify-between"
          style={{ background: 'var(--sidebar-bg)' }}
        >
          <div className="flex items-center gap-2">
            <MdInventory className="text-white text-lg" />
            <span className="text-white text-sm font-bold">Restock Product</span>
          </div>
          <button
            onClick={() => onClose()}
            className={`w-7 h-7 rounded-md flex items-center justify-center transition ${styles.restockCloseBtn}`}
          >
            <MdClose size={18} />
          </button>
        </div>

        <div className="p-5">
          {/* Product info */}
          <div
            className="mb-5 p-3.5 rounded-lg"
            style={{ background: 'var(--primary-light)', border: '1px solid var(--primary-muted)30' }}
          >
            <p className="text-sm font-bold" style={{ color: 'var(--primary-dark)' }}>
              {restockProduct.name}
            </p>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                Current stock:
                <span className="font-bold ml-1" style={{ color: 'var(--primary)' }}>
                  {fmtQty(restockProduct.stock)} {unit}
                </span>
              </span>
              {restockQty && Number(restockQty) > 0 && (
                <>
                  <span style={{ color: 'var(--text-muted)' }}>→</span>
                  <span className="text-xs font-bold" style={{ color: 'var(--badge-success-text)' }}>
                    {fmtQty(newTotal)} {unit} after restock
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Input */}
          <FormInput
            label={`Quantity to Add (${unit})`}
            type="number"
            placeholder="e.g. 50"
            value={restockQty}
            onChange={v => {
              const num = Number(v)
              if (num > 10000) return
              setRestockQty(v)
            }}
          />

          {Number(restockQty) > 0 && (
            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
              Max 10,000 {unit} per restock. Current: {fmtQty(restockProduct.stock)} → New: {fmtQty(Number(restockProduct.stock) + Number(restockQty))} {unit}
            </p>
          )}

          {/* Actions */}
          <div className="flex gap-2.5 mt-2">
            <button
              onClick={confirmRestock}
              disabled={!restockQty || Number(restockQty) <= 0}
              className={`flex-1 py-2.5 rounded-lg text-sm font-bold text-white transition ${styles.restockUpdateBtn}`}
            >
              Update Stock
            </button>
            <button
              onClick={() => onClose()}
              className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition ${styles.restockCancelBtn}`}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
