import { useEffect } from 'react'
import {
  MdPointOfSale, MdWarning, MdCheckCircle,
  MdRemove, MdAdd, MdDelete, MdPrint
} from 'react-icons/md'
import s from '@/styles/Barcodes.module.css'

export default function ScanPanel({
  cart = [], cartTotal = 0, cartCount = 0,
  scanError, lastScanned,
  scanInput, setScanInput,
  handleScanKeyDown, updateQty,
  removeFromCart, clearCart,
  setShowCheckout, scanInputRef
}) {
  useEffect(() => {
    if (scanInputRef?.current) scanInputRef.current.focus()
  }, [cartCount, lastScanned, scanInputRef])

  const handleGlobalReFocus = () => {
    if (scanInputRef?.current) scanInputRef.current.focus()
  }

  return (
    <div className={s.scanGrid} onClick={handleGlobalReFocus}>

      {/* ── Left column ─────────────────────────────────── */}
      <div>
        {/* Scanner input card */}
        <div className={`${s.card} ${s.cardPad}`} style={{ marginBottom: '1rem' }} onClick={e => e.stopPropagation()}>
          <div className={s.scannerHeader}>
            <div className={s.scannerStatus}>
              <div className={s.pingWrap}>
                <div className={s.pingRing} />
                <div className={s.pingDot} />
              </div>
              <span className={s.scannerStatusText}>
                Scanner active — ready for hardware read or manual product ID
              </span>
            </div>
            {cart.length > 0 && (
              <button
                onClick={e => { e.stopPropagation(); clearCart() }}
                className={s.clearCartBtn}
              >
                Clear Cart
              </button>
            )}
          </div>

          <input
            ref={scanInputRef}
            type="text"
            value={scanInput}
            onChange={e => setScanInput(e.target.value)}
            onKeyDown={handleScanKeyDown}
            placeholder="Scan product barcode or type ID then press Enter..."
            autoFocus
            autoComplete="off"
            className={s.scanInput}
          />
          <div className={s.scanInputHint}>
            Hardware gun automatically adds items · Manual entries require hitting Enter
          </div>
        </div>

        {/* Error alert */}
        {scanError && (
          <div className={s.alertError}>
            <MdWarning style={{ fontSize: '18px', flexShrink: 0 }} /> {scanError}
          </div>
        )}

        {/* Last scanned badge */}
        {lastScanned && (
          <div className={s.lastScanned}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div className={s.lastScannedIcon}>
                <MdCheckCircle style={{ color: 'var(--primary)', fontSize: '20px' }} />
              </div>
              <div>
                <div className={s.lastScannedName}>{lastScanned.name}</div>
                <div className={s.lastScannedSub}>
                  Added successfully · KSh {Number(lastScanned.sellPrice).toLocaleString()}
                </div>
              </div>
            </div>
            <div className={s.lastScannedStock}>Stock Remaining: {lastScanned.stock}</div>
          </div>
        )}

        {/* Empty state */}
        {cart.length === 0 && !lastScanned && (
          <div className={s.emptyState}>
            <div className={s.emptyIcon}>
              <MdPointOfSale style={{ fontSize: '32px', color: 'var(--text-muted)' }} />
            </div>
            <div className={s.emptyTitle}>Counter terminal empty</div>
            <div className={s.emptySub}>Awaiting hardware laser scanner input streams...</div>
          </div>
        )}

        {/* Cart items */}
        {cart.length > 0 && (
          <div className={s.card} onClick={e => e.stopPropagation()}>
            <div className={s.cartHeader}>
              <span className={s.cartTitle}>
                Cart · {cartCount} unit{cartCount !== 1 ? 's' : ''}
              </span>
              <span className={s.cartSub}>
                {cart.length} unique line item{cart.length !== 1 ? 's' : ''}
              </span>
            </div>

            {cart.map(item => (
              <div key={item._id} className={s.cartRow}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className={s.cartItemName}>{item.name || 'Stock Item'}</div>
                  <div className={s.cartItemSub}>
                    KSh {Number(item.sellPrice || 0).toLocaleString()} each
                  </div>
                </div>

                {/* Qty controls */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <button
                    onClick={() => item.qty > 1 ? updateQty(item._id, item.qty - 1) : removeFromCart(item._id)}
                    className={s.qtyBtn}
                  >
                    <MdRemove style={{ fontSize: '16px' }} />
                  </button>
                  <input
                    type="number"
                    min="1"
                    max={item.stock}
                    value={item.qty || ''}
                    onChange={e => {
                      const val = e.target.value
                      if (val === '') { updateQty(item._id, 1); return }
                      updateQty(item._id, Math.min(item.stock, Math.max(1, Number(val))))
                    }}
                    className={s.qtyInput}
                  />
                  <button
                    onClick={() => updateQty(item._id, Math.min(item.stock, item.qty + 1))}
                    disabled={item.qty >= item.stock}
                    className={s.qtyBtn}
                    style={{ opacity: item.qty >= item.stock ? 0.4 : 1, cursor: item.qty >= item.stock ? 'not-allowed' : 'pointer' }}
                  >
                    <MdAdd style={{ fontSize: '16px' }} />
                  </button>
                </div>

                <div className={s.cartItemTotal}>
                  KSh {Number(item.total || 0).toLocaleString()}
                </div>

                <button onClick={() => removeFromCart(item._id)} className={s.deleteBtn}>
                  <MdDelete style={{ fontSize: '16px', color: 'var(--danger)' }} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Checkout sidebar ────────────────────────────── */}
      <div className={s.checkoutSidebar} onClick={e => e.stopPropagation()}>
        <div className={s.checkoutHeader}>
          <div className={s.checkoutTitle}>Checkout Summary</div>
          <div className={s.checkoutSub}>
            {cartCount} item{cartCount !== 1 ? 's' : ''} queued
          </div>
        </div>

        <div className={s.checkoutBody}>
          {cart.length === 0 ? (
            <div className={s.checkoutEmpty}>Waiting for stock lines...</div>
          ) : (
            <>
              {cart.map(item => (
                <div key={item._id} className={s.checkoutLine}>
                  <span className={s.checkoutLineName}>{item.name} × {item.qty}</span>
                  <span className={s.checkoutLineTotal}>
                    KSh {Number(item.total || 0).toLocaleString()}
                  </span>
                </div>
              ))}
              <div className={s.checkoutDivider}>
                <span className={s.checkoutTotalLabel}>GRAND TOTAL</span>
                <span className={s.checkoutTotalValue}>
                  KSh {Number(cartTotal).toLocaleString()}
                </span>
              </div>
            </>
          )}

          <button
            onClick={() => cart.length > 0 && setShowCheckout(true)}
            disabled={cart.length === 0}
            className={s.chargeBtn}
          >
            <MdPrint style={{ fontSize: '18px' }} />
            {cart.length === 0
              ? 'Charge Customer'
              : `Charge KSh ${Number(cartTotal).toLocaleString()}`}
          </button>
          <div className={s.chargeBtnHint}>Launches payment options window</div>
        </div>
      </div>
    </div>
  )
}
