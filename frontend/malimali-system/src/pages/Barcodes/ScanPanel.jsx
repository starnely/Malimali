import {
  MdPointOfSale, MdWarning, MdCheckCircle,
  MdRemove, MdAdd, MdDelete, MdPrint
} from 'react-icons/md';
import s from '@/styles/Barcodes.module.css';

export default function ScanPanel({
  cart, cartTotal, cartCount,
  scanError, lastScanned,
  scanInput, setScanInput,
  handleScanKeyDown, updateQty,
  removeFromCart, clearCart,
  setShowCheckout, scanInputRef
}) {
  return (
    <div className={s.scanGrid}>
      <div>
        {/* Scanner input card */}
        <div className={`${s.card} ${s.cardPad}`} style={{ marginBottom: '1rem' }}>
          <div className={s.scannerHeader}>
            <div className={s.scannerStatus}>
              <div className={s.pingWrap}>
                <div className={s.pingRing} />
                <div className={s.pingDot} />
              </div>
              <span className={s.scannerStatusText}>
                Scanner active — scan barcode or type product ID
              </span>
            </div>
            {cart.length > 0 && (
              <button onClick={clearCart} className={s.clearCartBtn}>Clear Cart</button>
            )}
          </div>
          <input
            ref={scanInputRef}
            type="text"
            value={scanInput}
            onChange={e => setScanInput(e.target.value)}
            onKeyDown={handleScanKeyDown}
            placeholder="Scan barcode or type product ID / barcode then press Enter..."
            autoFocus
            className={s.scanInput}
          />
          <div className={s.scanInputHint}>
            Hardware scanner auto-submits · Type barcode or product ID manually then press Enter
          </div>
        </div>

        {/* Error */}
        {scanError && (
          <div className={s.alertError}>
            <MdWarning style={{ fontSize: '18px', flexShrink: 0 }} /> {scanError}
          </div>
        )}

        {/* Last scanned */}
        {lastScanned && (
          <div className={s.lastScanned}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div className={s.lastScannedIcon}>
                <MdCheckCircle style={{ color: '#185FA5', fontSize: '20px' }} />
              </div>
              <div>
                <div className={s.lastScannedName}>{lastScanned.name}</div>
                <div className={s.lastScannedSub}>
                  Added to cart · KSh {Number(lastScanned.sellPrice).toLocaleString()}
                </div>
              </div>
            </div>
            <div className={s.lastScannedStock}>Stock: {lastScanned.stock}</div>
          </div>
        )}

        {/* Empty state */}
        {cart.length === 0 && !lastScanned && (
          <div className={s.emptyState}>
            <div className={s.emptyIcon}>
              <MdPointOfSale style={{ fontSize: '32px', color: '#bbb' }} />
            </div>
            <div className={s.emptyTitle}>No items scanned yet</div>
            <div className={s.emptySub}>Start scanning products to build the cart</div>
          </div>
        )}

        {/* Cart items */}
        {cart.length > 0 && (
          <div className={s.card}>
            <div className={s.cartHeader}>
              <span className={s.cartTitle}>
                Cart · {cartCount} item{cartCount !== 1 ? 's' : ''}
              </span>
              <span className={s.cartSub}>
                {cart.length} product{cart.length !== 1 ? 's' : ''}
              </span>
            </div>
            {cart.map(item => (
              <div key={item._id} className={s.cartRow}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className={s.cartItemName}>{item.name}</div>
                  <div className={s.cartItemSub}>
                    KSh {Number(item.sellPrice).toLocaleString()} each
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <button onClick={() => updateQty(item._id, item.qty - 1)} className={s.qtyBtn}>
                    <MdRemove style={{ fontSize: '16px' }} />
                  </button>
                  <input
                    type="number"
                    min="1"
                    max={item.stock}
                    value={item.qty}
                    onChange={e => updateQty(item._id, Number(e.target.value))}
                    className={s.qtyInput}
                  />
                  <button onClick={() => updateQty(item._id, item.qty + 1)} className={s.qtyBtn}>
                    <MdAdd style={{ fontSize: '16px' }} />
                  </button>
                </div>
                <div className={s.cartItemTotal}>
                  KSh {Number(item.total).toLocaleString()}
                </div>
                <button onClick={() => removeFromCart(item._id)} className={s.deleteBtn}>
                  <MdDelete style={{ fontSize: '16px', color: '#E24B4A' }} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Checkout sidebar */}
      <div className={s.checkoutSidebar}>
        <div className={s.checkoutHeader}>
          <div className={s.checkoutTitle}>Checkout</div>
          <div className={s.checkoutSub}>
            {cartCount} item{cartCount !== 1 ? 's' : ''} in cart
          </div>
        </div>
        <div className={s.checkoutBody}>
          {cart.length === 0 ? (
            <div className={s.checkoutEmpty}>Cart is empty</div>
          ) : (
            <>
              {cart.map(item => (
                <div key={item._id} className={s.checkoutLine}>
                  <span className={s.checkoutLineName}>{item.name} × {item.qty}</span>
                  <span className={s.checkoutLineTotal}>
                    KSh {Number(item.total).toLocaleString()}
                  </span>
                </div>
              ))}
              <div className={s.checkoutDivider}>
                <span className={s.checkoutTotalLabel}>TOTAL</span>
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
          <div className={s.chargeBtnHint}>Choose payment method on next screen</div>
        </div>
      </div>
    </div>
  );
}
