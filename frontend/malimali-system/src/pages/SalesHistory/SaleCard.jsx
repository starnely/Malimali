import { MdUndo, MdBlock } from 'react-icons/md'
import styles from '@/styles/SalesHistory.module.css'
import { useApp } from '@/context/AppContext'

export default function SaleCard({ sale, onReturn, onVoid, category }) {
  const { pendingVoidRequests, pendingReturns } = useApp()
  const pm = sale.paymentInfo?.paymentMethod || 'cash'

  const paymentConfig = {
    mpesa:  { label: '📱 M-Pesa',        cls: styles.paymentMpesa  },
    cash:   { label: '💵 Cash',           cls: styles.paymentCash   },
    split:  { label: '💳 Split',          cls: styles.paymentSplit  },
    credit: { label: '📋 Credit',         cls: styles.paymentCredit },
    card:   { label: '💳 Card (EDC)',     cls: styles.paymentCard   },
    bank:   { label: '🏦 Bank Transfer',  cls: styles.paymentBank   },
  }
  const payment = paymentConfig[pm] || paymentConfig.cash

  const filteredItems = sale.items?.filter(item =>
    category === 'All' || item.productId?.category === category
  ) || []

  if (filteredItems.length === 0) return null

  const isVoided        = sale.voided === true
  const hasPartialVoids = !isVoided && sale.items?.some(i => i.voidStatus === 'voided' || (i.voidedQty || 0) > 0)
  const hasPartialReturns = !isVoided && sale.items?.some(i =>
    (i.returnedQty || 0) > 0 && i.returnStatus === 'approved' && !i.isFullyReturned
  )
  const allItemsVoidable = !isVoided && !sale.returned

  const saleIdStr = String(sale._id)
  const pendingVoid   = pendingVoidRequests?.find(vr => String(vr.saleId?._id || vr.saleId) === saleIdStr)
  const pendingReturn = pendingReturns?.find(r  => String(r.saleId?._id  || r.saleId)  === saleIdStr)

  const itemStatusConfig = {
    approved: { cls: styles.itemApproved, label: '✅ Returned'  },
    pending:  { cls: styles.itemPending,  label: '⏳ Pending'   },
    rejected: { cls: styles.itemRejected, label: '❌ Rejected'  },
    none:     { cls: styles.itemSold,     label: 'Sold'         },
  }

  return (
    <div
      className="mx-3 my-2 rounded-xl overflow-hidden"
      style={{
        background: isVoided ? 'var(--bg-muted)' : 'var(--bg-card)',
        border: `1px solid ${
          isVoided          ? 'var(--danger)'       :
          hasPartialVoids   ? 'var(--warning)'      :
          hasPartialReturns ? 'var(--success)'      : 'var(--border-soft)'
        }`,
        boxShadow: 'var(--shadow-card)',
        opacity: isVoided ? 0.75 : 1,
      }}
    >
      {/* Fully voided banner */}
      {isVoided && (
        <div style={{ background: 'var(--danger)', color: '#fff', padding: '6px 16px', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'space-between', letterSpacing: '0.05em' }}>
          <span>🚫 VOID — {sale.voidReason}</span>
          <span style={{ opacity: 0.8 }}>Authorized by: {sale.voidedBy}</span>
        </div>
      )}

      {/* Partial void banner */}
      {hasPartialVoids && (
        <div style={{ background: 'var(--warning-light)', color: 'var(--badge-warning-text)', padding: '6px 16px', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, borderBottom: '1px solid var(--warning)' }}>
          ⚠️ Partial void — some items have been voided
        </div>
      )}

      {/* Partial return banner */}
      {hasPartialReturns && (
        <div style={{ background: 'var(--success-light)', color: 'var(--badge-success-text)', padding: '6px 16px', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, borderBottom: '1px solid var(--success)' }}>
          ↩️ Partial return — some items have been returned
        </div>
      )}

      {/* Pending void-approval banner */}
      {!isVoided && pendingVoid && (
        <div style={{ background: 'var(--orange-light)', color: 'var(--badge-warning-text)', padding: '6px 16px', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--warning)' }}>
          <span>⏳ Void pending owner approval</span>
          <span style={{ opacity: 0.7, fontWeight: 600 }}>by {pendingVoid.requestedBy?.fullname || pendingVoid.requestedBy?.username || 'Manager'}</span>
        </div>
      )}

      {/* Pending return-approval banner */}
      {pendingReturn && (
        <div style={{ background: 'var(--success-light)', color: 'var(--badge-success-text)', padding: '6px 16px', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--success)' }}>
          <span>⏳ Return pending {pendingReturn.status === 'pending_manager' ? 'manager' : 'owner'} approval</span>
          <span style={{ opacity: 0.7, fontWeight: 600 }}>KSh {(pendingReturn.refundAmount || 0).toLocaleString()}</span>
        </div>
      )}

      {/* Receipt header */}
      <div
        className="px-4 py-2.5 flex justify-between items-center flex-wrap gap-2"
        style={{ background: isVoided ? 'var(--danger-light)' : 'var(--bg-muted)', borderBottom: '1px solid var(--border-soft)' }}
      >
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs font-black" style={{ color: isVoided ? 'var(--danger-dark)' : 'var(--primary)' }}>
            #{sale.receiptId || 'N/A'}
          </span>
          <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
            {sale._id?.slice(-6)}
          </span>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {sale.date && !isNaN(new Date(sale.date)) ? new Date(sale.date).toLocaleTimeString('en-KE') : ''}
          </span>
          <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
            👤 {sale.cashier}
          </span>
          <span className={`text-xs px-2 py-0.5 rounded-md ${payment.cls}`}>
            {payment.label}
          </span>
          {pm === 'credit' && sale.paymentInfo?.promiseDate && (
            <span className="text-xs font-semibold" style={{ color: 'var(--badge-warning-text)' }}>
              📅 Due: {new Date(sale.paymentInfo.promiseDate + 'T00:00:00').toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
          )}
          {pm === 'credit' && sale.paymentInfo?.customerPhone && (
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              📞 {sale.paymentInfo.customerPhone}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm font-bold" style={{ color: isVoided ? 'var(--danger-dark)' : 'var(--primary)', textDecoration: isVoided ? 'line-through' : 'none' }}>
            KSh {(isVoided ? sale.total : sale.items?.reduce((sum, item) => {
              if (item.voidStatus === 'voided') return sum
              return sum + (item.price || 0) * Math.max(0, (item.qty || 0) - (item.voidedQty || 0) - (item.returnedQty || 0))
            }, 0) || 0).toLocaleString()}
          </span>
          {allItemsVoidable && onVoid && (
            <button onClick={() => onVoid(sale)} className={styles.voidBtn}>
              <MdBlock className="text-sm" /> Void
            </button>
          )}
        </div>
      </div>

      {/* Items table — capped height, internal scroll */}
      <div className="overflow-x-auto" style={{ maxHeight: '220px', overflowY: 'auto' }}>
        <table className="w-full border-collapse min-w-[520px] text-sm">
          <thead>
            <tr style={{ background: 'var(--bg-muted)', position: 'sticky', top: 0, zIndex: 1 }}>
              {['Product', 'Category', 'Qty', 'Price', 'Total', 'Status', ''].map(h => (
                <th key={h} className="text-left px-3 py-2 text-[10px] font-black uppercase tracking-wider"
                  style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border-soft)' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredItems.map((item, i) => {
              const isItemVoided   = item.voidStatus === 'voided' || (item.voidedQty >= item.qty && item.voidedQty > 0)
              const isPartialVoid  = !isItemVoided && (item.voidedQty || 0) > 0
              const returnStatus   = item.returnStatus || 'none'
              const statusCfg      = itemStatusConfig[returnStatus] || itemStatusConfig.none
              const activeQty      = Math.max(0, item.qty - (item.voidedQty || 0) - (item.returnedQty || 0))
              const isPartialReturn = returnStatus === 'approved' && (item.returnedQty || 0) > 0 && activeQty > 0

              const rowBg = isVoided || isItemVoided ? 'transparent' :
                isPartialVoid    ? '#fff9f0' :
                isPartialReturn  ? 'var(--success-light)' :
                returnStatus === 'approved' ? 'var(--success-light)' :
                returnStatus === 'pending'  ? 'var(--warning-light)' :
                returnStatus === 'rejected' ? 'var(--danger-light)'  : 'transparent'

              return (
                <tr key={item._id || i}
                  style={{ background: rowBg, borderBottom: '1px solid var(--border-soft)', opacity: isItemVoided ? 0.5 : 1 }}>

                  <td className="px-3 py-2 font-semibold"
                    style={{ color: 'var(--text-primary)', textDecoration: isVoided || isItemVoided ? 'line-through' : 'none' }}>
                    {item.productId?.name || '—'}
                  </td>

                  <td className="px-3 py-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                    {item.productId?.category || '—'}
                  </td>

                  {/* Qty column */}
                  <td className="px-3 py-2" style={{ color: 'var(--text-primary)' }}>
                    {isPartialVoid ? (
                      <span>
                        <span style={{ textDecoration: 'line-through', color: 'var(--text-muted)', marginRight: 4 }}>{item.qty}</span>
                        <span style={{ fontWeight: 700, color: 'var(--badge-warning-text)' }}>{activeQty}</span>
                        <span style={{ fontSize: 10, color: 'var(--danger)', marginLeft: 4 }}>({item.voidedQty} voided)</span>
                      </span>
                    ) : isPartialReturn ? (
                      <span>
                        <span style={{ textDecoration: 'line-through', color: 'var(--text-muted)', marginRight: 4 }}>{item.qty - (item.voidedQty || 0)}</span>
                        <span style={{ fontWeight: 700, color: 'var(--badge-success-text)' }}>{activeQty}</span>
                        <span style={{ fontSize: 10, color: 'var(--badge-success-text)', marginLeft: 4 }}>({item.returnedQty} returned)</span>
                      </span>
                    ) : (
                      item.qty
                    )}
                  </td>

                  <td className="px-3 py-2" style={{ color: 'var(--text-secondary)' }}>
                    KSh {(item.price || 0).toLocaleString()}
                  </td>

                  {/* Total column */}
                  <td className="px-3 py-2 font-bold"
                    style={{ color: isVoided || isItemVoided ? 'var(--text-muted)' : 'var(--primary)' }}>
                    KSh {((item.price || 0) * activeQty).toLocaleString()}
                    {isPartialVoid && (
                      <div style={{ fontSize: 10, color: 'var(--danger)', fontWeight: 600 }}>
                        −KSh {((item.price || 0) * (item.voidedQty || 0)).toLocaleString()} voided
                      </div>
                    )}
                    {isPartialReturn && (
                      <div style={{ fontSize: 10, color: 'var(--badge-success-text)', fontWeight: 600 }}>
                        −KSh {((item.price || 0) * (item.returnedQty || 0)).toLocaleString()} returned
                      </div>
                    )}
                  </td>

                  {/* Status column */}
                  <td className="px-3 py-2">
                    {isVoided || isItemVoided ? (
                      <span className={`px-2 py-0.5 rounded-full text-xs ${styles.itemVoided}`}>
                        🚫 Voided
                        {item.voidedBy && <span style={{ opacity: 0.7, marginLeft: 4 }}>by {item.voidedBy}</span>}
                      </span>
                    ) : isPartialVoid ? (
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 12, background: 'var(--warning-light)', color: 'var(--badge-warning-text)' }}>
                        ⚠️ Partial void
                      </span>
                    ) : isPartialReturn ? (
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 12, background: 'var(--success-light)', color: 'var(--badge-success-text)' }}>
                        ↩️ Partial return
                      </span>
                    ) : (
                      <span className={`px-2 py-0.5 rounded-full text-xs ${statusCfg.cls}`}>
                        {statusCfg.label}
                      </span>
                    )}
                  </td>

                  {/* Return button */}
                  <td className="px-3 py-2">
                    {!isVoided && !isItemVoided && (returnStatus === 'none' || isPartialReturn) ? (
                      <button onClick={() => onReturn(sale)} className={styles.returnBtn}>
                        <MdUndo className="text-sm" /> Return
                      </button>
                    ) : !isVoided && returnStatus === 'pending' ? (
                      <span className="text-xs font-medium" style={{ color: 'var(--badge-warning-text)' }}>
                        Awaiting approval
                      </span>
                    ) : null}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
