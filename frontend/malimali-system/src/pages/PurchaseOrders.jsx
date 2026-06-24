import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import {
  MdShoppingCart, MdAdd, MdClose, MdSend,
  MdInventory, MdDelete, MdVisibility,
  MdCheckCircle, MdCancel, MdRefresh,
  MdLocalShipping, MdWarning, MdEdit,
  MdPictureAsPdf, MdMarkEmailRead,
  MdPayments, MdReceipt, MdAccountBalance,
  MdPhoneAndroid, MdMoney, MdStore, MdArrowDropDown,
} from 'react-icons/md'
import { useApp } from '@/context/AppContext'
import styles from '@/styles/PurchaseOrders.module.css'

const STATUS_LABELS = {
  draft: { label: 'Draft', icon: '📝' },
  sent: { label: 'Sent', icon: '📤' },
  partial: { label: 'Partial', icon: '📦' },
  received: { label: 'Received', icon: '✅' },
  cancelled: { label: 'Cancelled', icon: '❌' },
}

const PAYMENT_STATUS = {
  unpaid: { label: 'Unpaid', color: 'var(--danger)', bg: 'var(--danger-light)' },
  partial: { label: 'Partial', color: 'var(--warning-dark)', bg: 'var(--warning-light)' },
  paid: { label: 'Paid', color: 'var(--success-dark)', bg: 'var(--success-light)' },
}

const METHOD_ICONS = { cash: '💵', mpesa: '📱', bank: '🏦' }

function getTodayEAT() {
  return new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString().split('T')[0]
}

export default function PurchaseOrders() {
  const {
    suppliers, fetchSuppliers, products, stores, fetchStores,
    fetchPurchaseOrders, createPurchaseOrder, updatePurchaseOrder,
    sendPurchaseOrder, receivePurchaseOrder,
    cancelPurchaseOrder, deletePurchaseOrder,
    currentUser, isOwner,
  } = useApp()

  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState('')
  const [filterSupplier, setFilterSupplier] = useState('')
  const [filterPayment, setFilterPayment] = useState('')
  const [filterStore, setFilterStore] = useState('')
  const [searchText, setSearchText] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [showCreate, setShowCreate] = useState(false)
  const [viewingPO, setViewingPO] = useState(null)
  const [receivingPO, setReceivingPO] = useState(null)
  const [editingPO, setEditingPO] = useState(null)
  const [emailPO, setEmailPO] = useState(null)
  const [invoicePO, setInvoicePO] = useState(null)
  const [payingPO, setPayingPO] = useState(null)
  const [toast, setToast] = useState(null)

  const defaultStore = currentUser?.store || 'Main Store'

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  const load = useCallback(async () => {
    setLoading(true)
    const filters = {}
    // Owners can filter by any store; staff always see their own store
    if (isOwner) {
      if (filterStore) filters.store = filterStore
    } else {
      filters.store = defaultStore
    }
    if (filterStatus) filters.status = filterStatus
    if (filterSupplier) filters.supplierId = filterSupplier
    if (filterPayment) filters.paymentStatus = filterPayment
    const data = await fetchPurchaseOrders(filters)
    setOrders(data)
    setLoading(false)
  }, [fetchPurchaseOrders, defaultStore, isOwner, filterStore, filterStatus, filterSupplier, filterPayment])

  useEffect(() => { load() }, [load])
  useEffect(() => { fetchSuppliers() }, [fetchSuppliers])
  useEffect(() => { if (fetchStores) fetchStores() }, [fetchStores])

  const PAGE_SIZE = 25

  const stats = useMemo(() => ({
    total: orders.length,
    draft: orders.filter(o => o.status === 'draft').length,
    sent: orders.filter(o => o.status === 'sent').length,
    partial: orders.filter(o => o.status === 'partial').length,
    received: orders.filter(o => o.status === 'received').length,
    unpaid: orders.filter(o => o.paymentStatus === 'unpaid' && o.invoiceAmount > 0).length,
    outstanding: orders.reduce((s, o) => s + (o.balance || 0), 0),
  }), [orders])

  const filteredOrders = useMemo(() => {
    const q = searchText.trim().toLowerCase()
    if (!q) return orders
    return orders.filter(o =>
      o.poNumber?.toLowerCase().includes(q) ||
      o.supplierName?.toLowerCase().includes(q)
    )
  }, [orders, searchText])

  const totalPages = Math.ceil(filteredOrders.length / PAGE_SIZE)
  const pagedOrders = useMemo(() =>
    filteredOrders.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [filteredOrders, currentPage]
  )

  useEffect(() => { setCurrentPage(1) }, [orders, searchText])

  const handleSend = async (po) => {
    const res = await sendPurchaseOrder(po._id)
    if (res.success) { showToast(`PO ${po.poNumber} marked as sent`); load() }
    else showToast(res.message || 'Failed', 'error')
  }

  const handleCancel = async (po) => {
    if (!window.confirm(`Cancel PO ${po.poNumber}?`)) return
    const res = await cancelPurchaseOrder(po._id, 'Manually cancelled')
    if (res.success) { showToast(`PO ${po.poNumber} cancelled`); load() }
    else showToast(res.message || 'Failed', 'error')
  }

  const handleDelete = async (po) => {
    if (!window.confirm(`Delete draft PO ${po.poNumber}?`)) return
    const res = await deletePurchaseOrder(po._id)
    if (res.success) { showToast('PO deleted'); load() }
    else showToast(res.message || 'Failed', 'error')
  }

  const handleDownloadPDF = (po) => {
    window.open(`http://localhost:5000/api/purchase-orders/${po._id}/pdf?token=${currentUser?.token}`, '_blank')
  }

  // Derive store list: prefer context stores array, fall back to unique stores from orders
  const storeOptions = useMemo(() => {
    if (Array.isArray(stores) && stores.length > 0) return stores.map(s => (typeof s === 'string' ? s : s.name))
    const fromOrders = [...new Set(orders.map(o => o.store).filter(Boolean))]
    return fromOrders.length > 0 ? fromOrders : [defaultStore]
  }, [stores, orders, defaultStore])

  return (
    <div className={styles.page}>
      {toast && (
        <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 9999, padding: '10px 18px', borderRadius: 'var(--radius-md)', background: toast.type === 'error' ? 'var(--danger)' : 'var(--success)', color: 'white', fontWeight: 700, fontSize: 13, boxShadow: 'var(--shadow-dropdown)' }}>
          {toast.msg}
        </div>
      )}

      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h1><MdShoppingCart style={{ color: 'var(--primary)' }} /> Purchase Orders</h1>
          <p>Create, manage and pay supplier orders</p>
        </div>
        <div className={styles.headerActions}>
          <button className={styles.btnSecondary} onClick={load}><MdRefresh /> Refresh</button>
          <button className={styles.btnPrimary} onClick={() => setShowCreate(true)}><MdAdd /> New PO</button>
        </div>
      </div>

      <div style={{ padding: '0 24px 14px' }}>
        <div className={styles.summaryRow}>
          {[
            { label: 'Total POs', value: stats.total, color: 'var(--primary)' },
            { label: 'Draft', value: stats.draft, color: 'var(--text-muted)' },
            { label: 'Sent', value: stats.sent, color: 'var(--info)' },
            { label: 'Partial', value: stats.partial, color: 'var(--warning-dark)' },
            { label: 'Received', value: stats.received, color: 'var(--success)' },
            { label: 'Unpaid Invoices', value: stats.unpaid, color: 'var(--danger)' },
          ].map(s => (
            <div key={s.label} className={styles.summaryCard}>
              <div className={styles.label}>{s.label}</div>
              <div className={styles.value} style={{ color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>
        {stats.outstanding > 0 && (
          <div style={{ marginTop: 10, padding: '12px 16px', background: 'var(--danger-light)', border: '1px solid var(--danger)', borderRadius: 'var(--radius-md)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: 'var(--danger-dark)' }}>
              <MdPayments size={18} /> Total outstanding supplier balance
            </div>
            <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--danger)' }}>KSh {stats.outstanding.toLocaleString()}</div>
          </div>
        )}
      </div>

      {/* ── Filters bar ── */}
      <div className={styles.filtersBar}>
        {/* Store filter — owners only */}
        {isOwner && (
          <select className={styles.filterSelect} value={filterStore} onChange={e => setFilterStore(e.target.value)}>
            <option value=''>All Stores</option>
            {storeOptions.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        )}
        <select className={styles.filterSelect} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value=''>All Statuses</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
        </select>
        <select className={styles.filterSelect} value={filterSupplier} onChange={e => setFilterSupplier(e.target.value)}>
          <option value=''>All Suppliers</option>
          {suppliers
            .filter(s => {
              if (s.isActive === false) return false
              const supStores = Array.isArray(s.stores) && s.stores.length > 0
                ? s.stores : s.store ? [s.store] : []
              return supStores.length === 0 || supStores.includes(filterStore || defaultStore)
            })
            .map(s => <option key={s._id} value={s._id}>{s.name} — {s.company}</option>)
          }
        </select>
        <select className={styles.filterSelect} value={filterPayment} onChange={e => setFilterPayment(e.target.value)}>
          <option value=''>All Payment Statuses</option>
          <option value='unpaid'>💰 Unpaid</option>
          <option value='partial'>⏳ Partial</option>
          <option value='paid'>✅ Paid</option>
        </select>
        <input
          className={styles.filterInput}
          type='search'
          placeholder='Search PO number or supplier…'
          value={searchText}
          onChange={e => setSearchText(e.target.value)}
          style={{ minWidth: 220 }}
        />
      </div>

      <div className={styles.content}>
        <div className={styles.tableWrap}>
          {loading ? (
            <div className={styles.empty}><p>Loading purchase orders...</p></div>
          ) : orders.length === 0 ? (
            <div className={styles.empty}>
              <div className={styles.emptyIcon}>📋</div>
              <p>No purchase orders found. Create one to start restocking.</p>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className={styles.empty}>
              <div className={styles.emptyIcon}>🔍</div>
              <p>No purchase orders match <strong>"{searchText}"</strong>. Try a different search term.</p>
            </div>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>PO Number</th>
                  <th>Supplier</th>
                  <th>Store</th>
                  <th>Items</th>
                  <th>Order Value</th>
                  <th>Invoice / Payment</th>
                  <th>Status</th>
                  <th className={styles.center}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pagedOrders.map(po => {
                  const ps = PAYMENT_STATUS[po.paymentStatus]
                  const hasInvoice = po.invoiceAmount > 0
                  return (
                    <tr key={po._id}>
                      <td>
                        <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'monospace', fontSize: 12 }}>{po.poNumber}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{po.date}</div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{po.supplierName}</div>
                        {po.supplierPhone && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{po.supplierPhone}</div>}
                      </td>
                      <td>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <MdStore size={13} style={{ color: 'var(--text-muted)' }} />{po.store || '—'}
                        </div>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--primary)' }}>{po.items?.length}</span>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{po.items?.reduce((s, i) => s + i.qtyOrdered, 0)} units</div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>KSh {(po.totalOrderedCost || 0).toLocaleString()}</div>
                        {po.status === 'partial' && <div style={{ fontSize: 11, color: 'var(--success-dark)' }}>Rcvd: KSh {(po.totalReceivedCost || 0).toLocaleString()}</div>}
                      </td>
                      <td>
                        {hasInvoice ? (
                          <>
                            <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>Inv: KSh {po.invoiceAmount.toLocaleString()}</div>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 3, padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 700, background: ps?.bg, color: ps?.color }}>
                              {po.paymentStatus === 'paid' ? '✅' : po.paymentStatus === 'partial' ? '⏳' : '💰'} {ps?.label}
                              {po.balance > 0 && <span style={{ marginLeft: 4 }}>· KSh {po.balance.toLocaleString()} due</span>}
                            </div>
                          </>
                        ) : (
                          <span style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>No invoice yet</span>
                        )}
                      </td>
                      <td>
                        <span className={`${styles.badge} ${styles[po.status]}`}>
                          {STATUS_LABELS[po.status]?.icon} {STATUS_LABELS[po.status]?.label}
                        </span>
                        {(po.status === 'received' || po.status === 'partial') && !po.invoiceAmount && (
                          <div style={{ marginTop: 4, display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 7px', borderRadius: 10, fontSize: 10, fontWeight: 700, background: 'var(--warning-light)', color: 'var(--warning-dark)', whiteSpace: 'nowrap' }}>
                            ⚠ Invoice due
                          </div>
                        )}
                      </td>
                      <td>
                        <div className={styles.actionRow}>
                          <button className={`${styles.iconBtn} ${styles.primary}`} onClick={() => setViewingPO(po)} title="View"><MdVisibility size={16} /></button>
                          <button className={`${styles.iconBtn} ${styles.primary}`} onClick={() => handleDownloadPDF(po)} title="PDF"><MdPictureAsPdf size={16} /></button>
                          {(po.status === 'draft' || po.status === 'sent') && <button className={`${styles.iconBtn} ${styles.primary}`} onClick={() => setEmailPO(po)} title="Email"><MdMarkEmailRead size={16} /></button>}
                          {po.status === 'draft' && <button className={`${styles.iconBtn} ${styles.primary}`} onClick={() => handleSend(po)} title="Mark sent"><MdSend size={16} /></button>}
                          {(po.status === 'sent' || po.status === 'partial') && <button className={`${styles.iconBtn} ${styles.success}`} onClick={() => setReceivingPO(po)} title="Receive stock"><MdInventory size={16} /></button>}
                          {(po.status === 'received' || po.status === 'partial') && <button className={`${styles.iconBtn} ${styles.warning}`} onClick={() => setInvoicePO(po)} title="Record invoice"><MdReceipt size={16} /></button>}
                          {hasInvoice && po.paymentStatus !== 'paid' && <button className={`${styles.iconBtn} ${styles.success}`} onClick={() => setPayingPO(po)} title="Pay supplier"><MdPayments size={16} /></button>}
                          {po.status === 'draft' && <button className={`${styles.iconBtn} ${styles.warning}`} onClick={() => setEditingPO(po)} title="Edit"><MdEdit size={16} /></button>}
                          {(po.status === 'draft' || po.status === 'sent') && <button className={`${styles.iconBtn} ${styles.danger}`} onClick={() => handleCancel(po)} title="Cancel"><MdCancel size={16} /></button>}
                          {isOwner && (po.status === 'draft' || po.status === 'cancelled') && <button className={`${styles.iconBtn} ${styles.danger}`} onClick={() => handleDelete(po)} title="Delete"><MdDelete size={16} /></button>}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
          {!loading && filteredOrders.length > PAGE_SIZE && (
            <div className={styles.pagination}>
              <span className={styles.paginationInfo}>
                Showing {((currentPage - 1) * PAGE_SIZE) + 1}–{Math.min(currentPage * PAGE_SIZE, filteredOrders.length)} of {filteredOrders.length}
              </span>
              <div className={styles.paginationPages}>
                <button
                  className={styles.pageBtn}
                  onClick={() => setCurrentPage(p => p - 1)}
                  disabled={currentPage === 1}
                >‹ Prev</button>
                {(() => {
                  const pages = []
                  const delta = 2
                  const start = Math.max(1, currentPage - delta)
                  const end = Math.min(totalPages, currentPage + delta)
                  if (start > 1) { pages.push(1); if (start > 2) pages.push('…') }
                  for (let i = start; i <= end; i++) pages.push(i)
                  if (end < totalPages) { if (end < totalPages - 1) pages.push('…'); pages.push(totalPages) }
                  return pages.map((p, i) => p === '…'
                    ? <span key={`ellipsis-${i}`} style={{ padding: '0 4px', color: 'var(--text-muted)' }}>…</span>
                    : <button key={p} onClick={() => setCurrentPage(p)} className={`${styles.pageBtn} ${p === currentPage ? styles.pageBtnActive : ''}`}>{p}</button>
                  )
                })()}
                <button
                  className={styles.pageBtn}
                  onClick={() => setCurrentPage(p => p + 1)}
                  disabled={currentPage === totalPages}
                >Next ›</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {showCreate && (
        <CreatePOModal
          suppliers={suppliers} products={products}
          defaultStore={defaultStore} storeOptions={storeOptions}
          onClose={() => setShowCreate(false)}
          onSaved={() => { setShowCreate(false); load(); showToast('Purchase order created') }}
          createPurchaseOrder={createPurchaseOrder}
        />
      )}
      {viewingPO && (
        <ViewPOModal po={viewingPO} currentUser={currentUser}
          onClose={() => setViewingPO(null)}
          onDownloadPDF={() => handleDownloadPDF(viewingPO)}
          onEmail={() => { setViewingPO(null); setEmailPO(viewingPO) }}
          onPay={() => { setViewingPO(null); setPayingPO(viewingPO) }}
          onInvoice={() => { setViewingPO(null); setInvoicePO(viewingPO) }}
        />
      )}
      {receivingPO && (
        <ReceiveModal po={receivingPO}
          products={products}
          onClose={() => setReceivingPO(null)}
          onReceived={() => { setReceivingPO(null); load(); showToast('Stock received and inventory updated') }}
          receivePurchaseOrder={receivePurchaseOrder}
        />
      )}
      {editingPO && (
        <CreatePOModal
          suppliers={suppliers} products={products}
          defaultStore={defaultStore} storeOptions={storeOptions}
          editingPO={editingPO}
          onClose={() => setEditingPO(null)}
          onSaved={() => { setEditingPO(null); load(); showToast('Purchase order updated') }}
          createPurchaseOrder={createPurchaseOrder}
          updatePurchaseOrder={updatePurchaseOrder}
        />
      )}
      {emailPO && (
        <EmailPOModal po={emailPO} currentUser={currentUser}
          onClose={() => setEmailPO(null)}
          onSent={() => { setEmailPO(null); load(); showToast('Email sent to supplier') }}
        />
      )}
      {invoicePO && (
        <InvoiceModal po={invoicePO} currentUser={currentUser}
          onClose={() => setInvoicePO(null)}
          onSaved={() => { setInvoicePO(null); load(); showToast('Invoice recorded') }}
        />
      )}
      {payingPO && (
        <PaymentModal po={payingPO} currentUser={currentUser}
          onClose={() => setPayingPO(null)}
          onPaid={() => { setPayingPO(null); load(); showToast('Payment recorded successfully') }}
        />
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════
//  PRODUCT COMBOBOX — searchable + low-stock grouped
// ══════════════════════════════════════════════════════════════════════
function ProductCombobox({ value, options, usedIds, disabled, onChange }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [activeIdx, setActiveIdx] = useState(-1)
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 })
  const [hovered, setHovered] = useState(false)
  const containerRef = useRef(null)

  const selected = options.find(p => p._id === value)

  const reorderOf = p => p.reorderLevel ?? p.reorderPoint
  const isLow = p => { const r = reorderOf(p); return r != null && (p.stock ?? p.quantity ?? 0) <= r }

  const q = query.trim().toLowerCase()
  const visible = options.filter(p => !q || p.name.toLowerCase().includes(q))
  const lowGroup = visible.filter(isLow)
  const normalGroup = visible.filter(p => !isLow(p))
  const flat = [...lowGroup, ...normalGroup]

  const PANEL_MAX_H = 270

  const calcPos = () => {
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const spaceBelow = window.innerHeight - rect.bottom
    const flipUp = spaceBelow < PANEL_MAX_H
    setPos({
      top:    flipUp ? undefined : rect.bottom + 2,
      bottom: flipUp ? window.innerHeight - rect.top + 2 : undefined,
      left:   rect.left,
      width:  rect.width,
    })
  }

  const close = () => { setOpen(false); setQuery(''); setActiveIdx(-1) }

  const openDropdown = () => { calcPos(); setOpen(true) }

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const onDown = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) close()
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  // Close on any scroll so the fixed panel doesn't drift from the input
  useEffect(() => {
    if (!open) return
    window.addEventListener('scroll', close, true)
    return () => window.removeEventListener('scroll', close, true)
  }, [open])

  const select = (id) => { onChange(id); close() }

  const onKeyDown = (e) => {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') { e.preventDefault(); openDropdown() }
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIdx(i => Math.min(i + 1, flat.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const p = flat[activeIdx]
      if (p && !usedIds.has(p._id)) select(p._id)
    } else if (e.key === 'Escape') {
      close()
    }
  }

  const ROW = { padding: '6px 10px', fontSize: 12, userSelect: 'none' }
  const GROUP_HDR = {
    padding: '5px 10px', fontSize: 10, fontWeight: 700,
    textTransform: 'uppercase', letterSpacing: '0.06em',
  }

  const panel = (
    <div style={{
      position: 'fixed',
      top:    pos.top,
      bottom: pos.bottom,
      left:   pos.left,
      width:  pos.width,
      zIndex: 9999,
      background: 'var(--bg-card)',
      border: '1px solid var(--border-medium)',
      borderRadius: 'var(--radius-sm)',
      maxHeight: 270,
      overflowY: 'auto',
      boxShadow: '0 4px 14px rgba(0,0,0,0.14)',
    }}>
      {flat.length === 0 && (
        <div style={{ ...ROW, color: 'var(--text-muted)', textAlign: 'center', padding: '12px' }}>
          No products match "{query}"
        </div>
      )}

      {lowGroup.length > 0 && (
        <>
          <div style={{ ...GROUP_HDR, color: 'var(--warning-dark)', background: 'var(--warning-light)', borderBottom: '1px solid var(--warning)', position: 'sticky', top: 0 }}>
            ⚠️ Low Stock
          </div>
          {lowGroup.map(p => {
            const isUsed = usedIds.has(p._id)
            const idx = flat.indexOf(p)
            const reorder = reorderOf(p)
            return (
              <div
                key={p._id}
                onMouseDown={e => { e.preventDefault(); if (!isUsed) select(p._id) }}
                onMouseEnter={() => setActiveIdx(idx)}
                style={{
                  ...ROW,
                  cursor: isUsed ? 'not-allowed' : 'pointer',
                  background: idx === activeIdx ? 'var(--primary-light)' : 'transparent',
                  opacity: isUsed ? 0.45 : 1,
                }}
              >
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{p.name}</span>
                <span style={{ marginLeft: 7, color: 'var(--warning-dark)', fontSize: 11 }}>
                  stock: {p.stock ?? p.quantity ?? 0}{p.unit ? ` ${p.unit}` : ''} · reorder at {reorder}
                </span>
                {isUsed && <span style={{ marginLeft: 7, fontSize: 10, color: 'var(--text-muted)' }}>(already added)</span>}
              </div>
            )
          })}
        </>
      )}

      {normalGroup.length > 0 && (
        <>
          {lowGroup.length > 0 && (
            <div style={{ ...GROUP_HDR, color: 'var(--text-muted)', background: 'var(--bg-muted)', borderTop: '1px solid var(--border-soft)', borderBottom: '1px solid var(--border-soft)' }}>
              All Products
            </div>
          )}
          {normalGroup.map(p => {
            const isUsed = usedIds.has(p._id)
            const idx = flat.indexOf(p)
            return (
              <div
                key={p._id}
                onMouseDown={e => { e.preventDefault(); if (!isUsed) select(p._id) }}
                onMouseEnter={() => setActiveIdx(idx)}
                style={{
                  ...ROW,
                  cursor: isUsed ? 'not-allowed' : 'pointer',
                  background: idx === activeIdx ? 'var(--primary-light)' : 'transparent',
                  opacity: isUsed ? 0.45 : 1,
                }}
              >
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{p.name}</span>
                <span style={{ marginLeft: 7, color: 'var(--text-muted)', fontSize: 11 }}>
                  (stock: {p.stock ?? p.quantity ?? 0} {p.unit || 'pcs'})
                </span>
                {isUsed && <span style={{ marginLeft: 7, fontSize: 10, color: 'var(--text-muted)' }}>(already added)</span>}
              </div>
            )
          })}
        </>
      )}
    </div>
  )

  return (
    <div
      ref={containerRef}
      style={{ position: 'relative' }}
      onMouseEnter={() => !disabled && setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <input
        value={open ? query : (selected?.name || '')}
        onChange={e => { setQuery(e.target.value); if (!open) openDropdown(); setActiveIdx(-1) }}
        onFocus={openDropdown}
        onKeyDown={onKeyDown}
        placeholder='— Select product —'
        disabled={disabled}
        style={{
          width: '100%', padding: '5px 24px 5px 8px', borderRadius: 'var(--radius-sm)',
          border: `1px solid ${open ? 'var(--primary)' : hovered ? 'var(--text-secondary)' : 'var(--border-medium)'}`,
          background: disabled ? 'var(--bg-muted)' : 'var(--bg-card)',
          color: 'var(--text-primary)', fontFamily: 'inherit', fontSize: 12,
          outline: 'none', boxSizing: 'border-box',
          cursor: disabled ? 'not-allowed' : 'pointer',
          transition: 'border-color 0.15s',
        }}
      />
      <MdArrowDropDown
        size={18}
        style={{
          position: 'absolute', right: 5, top: '50%',
          transform: open ? 'translateY(-50%) rotate(180deg)' : 'translateY(-50%)',
          color: open ? 'var(--primary)' : 'var(--text-muted)',
          pointerEvents: 'none',
          transition: 'transform 0.15s, color 0.15s',
        }}
      />
      {open && !disabled && createPortal(panel, document.body)}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════
//  CREATE / EDIT PO MODAL
// ══════════════════════════════════════════════════════════════════════
function CreatePOModal({
  suppliers, products,
  defaultStore, storeOptions,
  editingPO, onClose, onSaved,
  createPurchaseOrder, updatePurchaseOrder,
}) {
  const isEdit = !!editingPO

  // ── Store ──────────────────────────────────────────────────────────
  const [selectedStore, setSelectedStore] = useState(editingPO?.store || defaultStore || '')

  // ── Supplier ──────────────────────────────────────────────────────
  const [supplierId, setSupplierId] = useState(editingPO?.supplierId?._id || '')
  const [supplierName, setSupplierName] = useState(editingPO?.supplierName || '')
  const [supplierPhone, setSupplierPhone] = useState(editingPO?.supplierPhone || '')

  // ── Other fields ──────────────────────────────────────────────────
  const [expectedDate, setExpectedDate] = useState(editingPO?.expectedDate || '')
  const [notes, setNotes] = useState(editingPO?.notes || '')

  // ── Items ─────────────────────────────────────────────────────────
  const [items, setItems] = useState(
    editingPO?.items?.map(i => ({
      productId: i.productId?._id || i.productId,
      productName: i.productName,
      qtyOrdered: i.qtyOrdered,
      unitCost: i.unitCost,
    })) || [{ productId: '', productName: '', qtyOrdered: 1, unitCost: 0 }]
  )

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // ── Derived: products filtered to the selected store ──────────────
  const storeProducts = useMemo(() => {
    if (!selectedStore) return products
    return products.filter(p => {
      const pStores = Array.isArray(p.stores) && p.stores.length > 0
        ? p.stores
        : p.store ? [p.store] : []
      return pStores.length === 0 || pStores.includes(selectedStore)
    })
  }, [products, selectedStore])

  // ── Derived: suppliers filtered to the selected store ────────────
  const storeSuppliers = useMemo(() => {
    return suppliers.filter(s => {
      if (s.isActive === false) return false
      const supStores = Array.isArray(s.stores) && s.stores.length > 0
        ? s.stores : s.store ? [s.store] : []
      return supStores.length === 0 || supStores.includes(selectedStore || defaultStore)
    })
  }, [suppliers, selectedStore, defaultStore])

  // ── When store changes, clear any items whose product is no longer available ──
  const handleStoreChange = (newStore) => {
    setSelectedStore(newStore)
    // Reset supplier since they may be store-specific
    setSupplierId('')
    setSupplierName('')
    setSupplierPhone('')
    // Keep only items whose product exists in the new store
    setItems(prev =>
      prev.map(item => {
        if (!item.productId) return item
        const stillAvailable = products.some(p => {
          if (p._id !== item.productId) return false
          const pStores = Array.isArray(p.stores) && p.stores.length > 0
            ? p.stores : p.store ? [p.store] : []
          return pStores.length === 0 || pStores.includes(newStore)
        })
        return stillAvailable ? item : { productId: '', productName: '', qtyOrdered: 1, unitCost: 0 }
      })
    )
  }

  // ── Supplier selection → auto-fill name + phone ───────────────────
  const onSupplierChange = (id) => {
    setSupplierId(id)
    const sup = storeSuppliers.find(s => s._id === id)
    if (sup) {
      setSupplierName(sup.name)
      setSupplierPhone(sup.phone || '')
    } else {
      setSupplierName('')
      setSupplierPhone('')
    }
  }

  // ── Product selection → auto-fill name + buyPrice; duplicate guard ─
  const onProductChange = (index, productId) => {
    // Duplicate guard
    const alreadyUsed = items.some((item, i) => i !== index && item.productId === productId)
    if (alreadyUsed && productId) {
      setError(`That product is already in the order. Adjust the quantity on the existing row instead.`)
      return
    }
    setError('')
    const product = storeProducts.find(p => p._id === productId)
    const updated = [...items]
    updated[index] = {
      ...updated[index],
      productId,
      productName: product?.name || '',
      unitCost: product?.buyPrice ?? product?.costPrice ?? 0,
    }
    setItems(updated)
  }

  const updateItem = (index, field, value) => {
    const u = [...items]
    u[index] = { ...u[index], [field]: value }
    setItems(u)
  }

  const removeItem = (index) => {
    if (items.length > 1) setItems(items.filter((_, i) => i !== index))
  }

  const addItem = () => {
    setItems([...items, { productId: '', productName: '', qtyOrdered: 1, unitCost: 0 }])
  }

  const totalCost = items.reduce((s, i) => s + Number(i.qtyOrdered) * Number(i.unitCost), 0)

  const handleSave = async () => {
    setError('')
    if (!selectedStore) { setError('Please select a store.'); return }
    const validItems = items.filter(i => i.productId && i.qtyOrdered > 0)
    if (!validItems.length) { setError('Add at least one product.'); return }

    setSaving(true)
    const payload = {
      supplierId: supplierId || null,
      supplierName: supplierId ? undefined : supplierName || 'Manual / Walk-in',
      supplierPhone: supplierId ? undefined : supplierPhone,
      store: selectedStore,
      items: validItems,
      notes,
      expectedDate,
    }
    const res = isEdit
      ? await updatePurchaseOrder(editingPO._id, payload)
      : await createPurchaseOrder(payload)
    setSaving(false)
    if (res.success) onSaved()
    else setError(res.message || 'Failed to save')
  }

  return (
    <div className={styles.overlay}>
      <div className={`${styles.modal} ${styles.modalWide}`}>
        <div className={styles.modalHeader}>
          <h2>{isEdit ? `Edit PO — ${editingPO.poNumber}` : 'Create New Purchase Order'}</h2>
          <button className={styles.modalClose} onClick={onClose}><MdClose /></button>
        </div>
        <div className={styles.modalBody}>

          {/* ── Store selector (required) ── */}
          <div style={{ marginBottom: 16, padding: '12px 14px', background: 'var(--primary-light)', border: '1px solid var(--primary)', borderRadius: 'var(--radius-md)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <MdStore size={18} style={{ color: 'var(--primary)', flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--primary)', display: 'block', marginBottom: 4 }}>
                  Store <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <select
                  value={selectedStore}
                  onChange={e => handleStoreChange(e.target.value)}
                  style={{ width: '100%', padding: '6px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--primary)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontFamily: 'inherit', fontSize: 13, outline: 'none', cursor: 'pointer' }}
                >
                  <option value=''>— Select store —</option>
                  {storeOptions.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            {selectedStore && (
              <div style={{ marginTop: 6, fontSize: 11, color: 'var(--primary)', fontWeight: 600 }}>
                Showing {storeProducts.length} product{storeProducts.length !== 1 ? 's' : ''} and {storeSuppliers.length} supplier{storeSuppliers.length !== 1 ? 's' : ''} for {selectedStore}
              </div>
            )}
          </div>

          {/* ── Supplier + meta ── */}
          <div className={styles.formGrid}>
            <div className={styles.formGroup}>
              <label>Supplier <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span></label>
              <select
                value={supplierId}
                onChange={e => onSupplierChange(e.target.value)}
                disabled={!selectedStore}
              >
                <option value=''>— Manual / Walk-in —</option>
                {storeSuppliers.map(s => (
                  <option key={s._id} value={s._id}>{s.name}{s.company ? ` — ${s.company}` : ''}</option>
                ))}
              </select>
              {!selectedStore && (
                <div style={{ fontSize: 11, color: 'var(--warning-dark)', marginTop: 4 }}>Select a store first to see its suppliers.</div>
              )}
            </div>
            <div className={styles.formGroup}>
              <label>Supplier Name</label>
              <input value={supplierName} onChange={e => setSupplierName(e.target.value)} placeholder='Auto-filled or enter manually' />
            </div>
            <div className={styles.formGroup}>
              <label>Supplier Phone</label>
              <input value={supplierPhone} onChange={e => setSupplierPhone(e.target.value)} placeholder='e.g. 0712 345 678' />
              {supplierId && supplierPhone && (
                <div style={{ fontSize: 11, color: 'var(--success-dark)', marginTop: 4 }}>✓ Auto-filled from supplier record</div>
              )}
            </div>
            <div className={styles.formGroup}>
              <label>Expected Delivery Date</label>
              <input type='date' value={expectedDate} onChange={e => setExpectedDate(e.target.value)} />
            </div>
            <div className={`${styles.formGroup} ${styles.span2}`}>
              <label>Notes <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span></label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder='Delivery instructions, payment terms...' />
            </div>
          </div>

          {/* ── Order items ── */}
          <div className={styles.itemsSection}>
            <h3>Order Items</h3>
            {!selectedStore && (
              <div style={{ padding: '10px 14px', background: 'var(--warning-light)', border: '1px solid var(--warning)', borderRadius: 'var(--radius-md)', fontSize: 13, color: 'var(--warning-dark)', fontWeight: 600, marginBottom: 10 }}>
                ⚠️ Select a store above to load its products.
              </div>
            )}
            <table className={styles.itemsTable}>
              <thead>
                <tr>
                  <th>Product</th>
                  <th style={{ width: 90 }}>Qty</th>
                  <th style={{ width: 120 }}>Cost per Unit (KSh)</th>
                  <th style={{ width: 120 }}>Total</th>
                  <th style={{ width: 40 }}></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => {
                  const productMeta = storeProducts.find(p => p._id === item.productId)
                  const reorderLevel = productMeta?.reorderLevel ?? productMeta?.reorderPoint ?? null
                  const productUnit = productMeta?.unit || 'pcs'
                  return (
                    <tr key={i}>
                      <td>
                        <ProductCombobox
                          value={item.productId}
                          options={storeProducts}
                          usedIds={new Set(items.filter((_, idx) => idx !== i).map(it => it.productId).filter(Boolean))}
                          disabled={!selectedStore}
                          onChange={productId => onProductChange(i, productId)}
                        />
                        {/* Reorder level hint */}
                        {reorderLevel != null && (
                          <div style={{ fontSize: 11, color: 'var(--warning-dark)', marginTop: 3, display: 'flex', alignItems: 'center', gap: 3 }}>
                            <MdWarning size={11} /> Reorder at {reorderLevel} {productUnit}
                          </div>
                        )}
                        {/* Duplicate inline indicator — shown on the blocked row */}
                        {item.productId && items.filter(it => it.productId === item.productId).length > 1 && (
                          <div style={{ fontSize: 11, color: 'var(--danger)', marginTop: 3 }}>⚠️ Duplicate — remove one row</div>
                        )}
                      </td>
                      <td>
                        <input
                          type='number' min={1}
                          value={item.qtyOrdered}
                          onChange={e => updateItem(i, 'qtyOrdered', e.target.value)}
                        />
                        {item.productId && (
                          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                            {productUnit}
                          </div>
                        )}
                      </td>
                      <td>
                        <input
                          type='number' min={0} step='0.01'
                          value={item.unitCost}
                          onChange={e => updateItem(i, 'unitCost', e.target.value)}
                        />
                        {item.productId && productMeta?.buyPrice != null && (
                          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                            Buy price: KSh {productMeta.buyPrice.toLocaleString()} / {productUnit}
                          </div>
                        )}
                      </td>
                      <td style={{ fontWeight: 700, color: 'var(--primary)', fontSize: 12 }}>
                        {(Number(item.qtyOrdered) * Number(item.unitCost)).toLocaleString()}
                      </td>
                      <td>
                        <button
                          onClick={() => removeItem(i)}
                          style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--danger)', padding: 4 }}
                        >
                          <MdDelete size={16} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <div className={styles.addItemRow}>
              <button className={styles.btnSecondary} onClick={addItem} disabled={!selectedStore}>
                <MdAdd /> Add Item
              </button>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
              <div style={{ background: 'var(--primary-light)', border: '1px solid var(--primary)', borderRadius: 'var(--radius-md)', padding: '10px 18px', textAlign: 'right' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase' }}>Total Order Value</div>
                <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--primary)' }}>KSh {totalCost.toLocaleString()}</div>
              </div>
            </div>
          </div>

          {error && (
            <div style={{ marginTop: 12, padding: '10px 14px', background: 'var(--danger-light)', borderRadius: 'var(--radius-md)', color: 'var(--danger-dark)', fontSize: 13, fontWeight: 600 }}>
              <MdWarning style={{ verticalAlign: 'middle', marginRight: 6 }} />{error}
            </div>
          )}
        </div>
        <div className={styles.modalFooter}>
          <button className={styles.btnSecondary} onClick={onClose}>Cancel</button>
          <button className={styles.btnPrimary} onClick={handleSave} disabled={saving || !selectedStore}>
            {saving ? 'Saving...' : isEdit ? 'Update PO' : 'Create PO'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════
//  INVOICE MODAL  (unchanged)
// ══════════════════════════════════════════════════════════════════════
function InvoiceModal({ po, currentUser, onClose, onSaved }) {
  const [invoiceNumber, setInvoiceNumber] = useState(po.invoiceNumber || '')
  const [invoiceAmount, setInvoiceAmount] = useState(po.invoiceAmount || po.totalReceivedCost || po.totalOrderedCost || '')
  const [invoiceDate, setInvoiceDate] = useState(() => po.invoiceDate || getTodayEAT())
  const [photoFile, setPhotoFile] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSave = async () => {
    setError('')
    if (!invoiceAmount || Number(invoiceAmount) <= 0) { setError('Invoice amount is required.'); return }
    setSaving(true)
    try {
      const fd = new FormData()
      fd.append('invoiceNumber', invoiceNumber)
      fd.append('invoiceAmount', invoiceAmount)
      fd.append('invoiceDate', invoiceDate)
      if (photoFile) fd.append('invoicePhoto', photoFile)
      const res = await fetch(`http://localhost:5000/api/purchase-orders/${po._id}/invoice`, {
        method: 'PATCH', headers: { Authorization: `Bearer ${currentUser?.token}` }, body: fd,
      })
      const data = await res.json()
      if (res.ok && data.success) onSaved()
      else setError(data.message || 'Failed to record invoice')
    } catch { setError('Network error') }
    setSaving(false)
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <h2><MdReceipt style={{ verticalAlign: 'middle', marginRight: 6 }} /> Record Supplier Invoice — {po.poNumber}</h2>
          <button className={styles.modalClose} onClick={onClose}><MdClose /></button>
        </div>
        <div className={styles.modalBody}>
          <div style={{ padding: '10px 14px', background: 'var(--info-light)', border: '1px solid var(--info)', borderRadius: 'var(--radius-md)', fontSize: 13, marginBottom: 16, color: 'var(--info-dark)', fontWeight: 600 }}>
            📋 Record the invoice the supplier brought with this delivery. The invoice amount may differ from the PO value.
          </div>
          <div className={styles.formGroup}><label>Invoice Number (from supplier's document)</label><input value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} placeholder="e.g. INV-2026-089" /></div>
          <div className={styles.formGroup}>
            <label>Invoice Amount (KSh) *</label>
            <input type='number' min={0} value={invoiceAmount} onChange={e => setInvoiceAmount(e.target.value)} placeholder="0.00" autoFocus />
            {po.totalOrderedCost > 0 && (
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>PO value was KSh {po.totalOrderedCost.toLocaleString()} — adjust if supplier charged differently</div>
            )}
          </div>
          <div className={styles.formGroup}><label>Invoice Date</label><input type='date' value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} /></div>
          <div className={styles.formGroup}>
            <label>Upload Invoice Photo (optional)</label>
            <input type='file' accept='image/*,application/pdf' onChange={e => setPhotoFile(e.target.files[0])} style={{ padding: '8px 0', fontSize: 13, color: 'var(--text-secondary)' }} />
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Photo of physical invoice. JPEG, PNG or PDF, max 5MB.</div>
          </div>
          {Number(invoiceAmount) > 0 && (
            <div style={{ padding: '12px 14px', background: 'var(--warning-light)', border: '1px solid var(--warning)', borderRadius: 'var(--radius-md)', fontSize: 13 }}>
              <div style={{ fontWeight: 700, color: 'var(--warning-dark)', marginBottom: 4 }}>Invoice Summary</div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Amount to pay supplier:</span>
                <span style={{ fontWeight: 900, fontSize: 16, color: 'var(--warning-dark)' }}>KSh {Number(invoiceAmount).toLocaleString()}</span>
              </div>
            </div>
          )}
          {error && <div style={{ marginTop: 12, padding: '10px 14px', background: 'var(--danger-light)', borderRadius: 'var(--radius-md)', color: 'var(--danger-dark)', fontSize: 13, fontWeight: 600 }}>{error}</div>}
        </div>
        <div className={styles.modalFooter}>
          <button className={styles.btnSecondary} onClick={onClose}>Cancel</button>
          <button className={styles.btnPrimary} onClick={handleSave} disabled={saving || !invoiceAmount}>
            {saving ? 'Saving...' : '📋 Record Invoice'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════
//  PAYMENT MODAL  (unchanged)
// ══════════════════════════════════════════════════════════════════════
function PaymentModal({ po, currentUser, onClose, onPaid }) {
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('mpesa')
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')
  const [paying, setPaying] = useState(false)
  const [error, setError] = useState('')
  const [payments, setPayments] = useState([])
  const [advisory, setAdvisory] = useState(null)

  const balance = po.balance || 0
  const token = currentUser?.token

  useEffect(() => {
    if (!token) return
    let cancelled = false
    async function loadPayments() {
      try {
        const res = await fetch(`http://localhost:5000/api/purchase-orders/${po._id}/payments`, { headers: { Authorization: `Bearer ${token}` } })
        const data = await res.json()
        if (!cancelled && data.success) setPayments(data.payments || [])
      } catch { /* silent */ }
    }
    loadPayments()
    return () => { cancelled = true }
  }, [po._id, token])

  useEffect(() => {
    if (!token) return
    let cancelled = false
    async function loadAdvisory() {
      try {
        const now = new Date(Date.now() + 3 * 60 * 60 * 1000)
        const y = now.getFullYear(); const m = now.getMonth() + 1; const mm = String(m).padStart(2, '0')
        const from = `${y}-${mm}-01`; const to = `${y}-${mm}-${new Date(y, m, 0).getDate()}`
        const [salesRes, expRes, outstandingRes, spRes] = await Promise.all([
          fetch(`http://localhost:5000/api/sales`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`http://localhost:5000/api/expenses/summary?from=${from}&to=${to}`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`http://localhost:5000/api/purchase-orders/outstanding`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`http://localhost:5000/api/purchase-orders/supplier-payments?from=${from}&to=${to}`, { headers: { Authorization: `Bearer ${token}` } }),
        ])
        const [salesData, expData, outstandingData, spData] = await Promise.all([
          salesRes.json().catch(() => ({ sales: [] })),
          expRes.json().catch(() => ({ grandTotal: 0 })),
          outstandingRes.json().catch(() => ({ totalOutstanding: 0 })),
          spRes.json().catch(() => ({ total: 0 })),
        ])
        if (cancelled) return
        const allSales = salesData.sales || []
        const revenue = allSales
          .filter(s => {
            if (s.returned || s.voided) return false
            const saleDate = s.date ? String(s.date).slice(0, 10) : (s.createdAt ? new Date(s.createdAt).toISOString().split('T')[0] : null)
            return saleDate && saleDate >= from && saleDate <= to
          })
          .reduce((sum, s) => sum + (s.paymentInfo?.finalTotal || s.netTotal || s.total || 0), 0)
        const expenses = expData.grandTotal || 0
        const supplierPayments = spData.total || 0
        const totalOutstanding = outstandingData.totalOutstanding || 0
        const otherSupplierDebt = Math.max(0, totalOutstanding - (po.balance || 0))
        setAdvisory({ revenue, expenses, supplierPayments, otherSupplierDebt, net: revenue - expenses - supplierPayments })
      } catch { /* silent */ }
    }
    loadAdvisory()
    return () => { cancelled = true }
  }, [po._id, po.store, po.balance, token])

  const handlePay = async () => {
    setError('')
    if (!amount || Number(amount) <= 0) { setError('Enter a valid amount.'); return }
    if (Number(amount) > balance) { setError(`Amount exceeds balance. Maximum: KSh ${balance.toLocaleString()}`); return }
    if (method === 'mpesa' && !reference.trim()) { setError('M-Pesa transaction code is required.'); return }
    if (method === 'bank' && !reference.trim()) { setError('Bank reference number is required.'); return }
    setPaying(true)
    try {
      const res = await fetch(`http://localhost:5000/api/purchase-orders/${po._id}/payments`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ amount: Number(amount), method, reference, notes }),
      })
      const data = await res.json()
      if (res.ok && data.success) onPaid()
      else setError(data.message || 'Failed to record payment')
    } catch { setError('Network error') }
    setPaying(false)
  }

  const methodConfig = {
    cash: { icon: <MdMoney size={18} />, label: 'Cash', placeholder: 'Optional receipt number' },
    mpesa: { icon: <MdPhoneAndroid size={18} />, label: 'M-Pesa', placeholder: 'e.g. QHJ4K8X9P2 (required)' },
    bank: { icon: <MdAccountBalance size={18} />, label: 'Bank Transfer', placeholder: 'Bank reference number (required)' },
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <h2><MdPayments style={{ verticalAlign: 'middle', marginRight: 6 }} /> Pay Supplier — {po.poNumber}</h2>
          <button className={styles.modalClose} onClick={onClose}><MdClose /></button>
        </div>
        <div className={styles.modalBody}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 16 }}>
            {[
              { label: 'Invoice Amount', value: `KSh ${(po.invoiceAmount || 0).toLocaleString()}`, color: 'var(--text-primary)' },
              { label: 'Already Paid', value: `KSh ${(po.amountPaid || 0).toLocaleString()}`, color: 'var(--success-dark)' },
              { label: 'Balance Due', value: `KSh ${balance.toLocaleString()}`, color: balance > 0 ? 'var(--danger)' : 'var(--success-dark)' },
            ].map(s => (
              <div key={s.label} style={{ padding: '10px 12px', background: 'var(--bg-muted)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-soft)' }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 4 }}>{s.label}</div>
                <div style={{ fontSize: 15, fontWeight: 900, color: s.color }}>{s.value}</div>
              </div>
            ))}
          </div>
          {advisory ? (
            <div style={{ padding: '12px 14px', background: advisory.net >= Number(amount || 0) ? 'var(--success-light)' : 'var(--warning-light)', border: `1px solid ${advisory.net >= Number(amount || 0) ? 'var(--success)' : 'var(--warning)'}`, borderRadius: 'var(--radius-md)', marginBottom: 16, fontSize: 12 }}>
              <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>📊 This Month's Financial Position</div>
              {[
                { label: 'Revenue this month', value: advisory.revenue, color: 'var(--success-dark)' },
                { label: 'Expenses this month', value: advisory.expenses, color: 'var(--danger)' },
                { label: 'Supplier payments made', value: advisory.supplierPayments, color: advisory.supplierPayments > 0 ? 'var(--danger)' : 'var(--text-muted)' },
                { label: 'Other supplier debt', value: advisory.otherSupplierDebt, color: advisory.otherSupplierDebt > 0 ? 'var(--warning-dark)' : 'var(--text-muted)' },
                { label: 'Available (Rev − Exp − Paid)', value: advisory.net, color: advisory.net >= 0 ? 'var(--success-dark)' : 'var(--danger)', bold: true },
              ].map(r => (
                <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', borderTop: r.bold ? '1px solid var(--border-soft)' : 'none', marginTop: r.bold ? 6 : 0, paddingTop: r.bold ? 6 : 2 }}>
                  <span style={{ color: 'var(--text-secondary)', fontWeight: r.bold ? 700 : 400 }}>{r.label}</span>
                  <span style={{ fontWeight: r.bold ? 900 : 600, color: r.color }}>KSh {(r.value || 0).toLocaleString()}</span>
                </div>
              ))}
              {Number(amount) > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 6, marginTop: 6, borderTop: '2px solid var(--border-medium)', fontWeight: 700, fontSize: 13 }}>
                  <span style={{ color: 'var(--text-primary)' }}>After this payment</span>
                  <span style={{ color: advisory.net - Number(amount) >= 0 ? 'var(--success-dark)' : 'var(--danger)' }}>KSh {(advisory.net - Number(amount)).toLocaleString()}</span>
                </div>
              )}
            </div>
          ) : (
            <div style={{ padding: '10px 14px', background: 'var(--bg-muted)', borderRadius: 'var(--radius-md)', marginBottom: 16, fontSize: 12, color: 'var(--text-muted)' }}>📊 Loading financial position...</div>
          )}
          <div className={styles.formGroup}>
            <label>Payment Method</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {Object.entries(methodConfig).map(([key, cfg]) => (
                <div key={key} onClick={() => setMethod(key)} style={{ flex: 1, padding: '10px 8px', borderRadius: 'var(--radius-md)', border: `2px solid ${method === key ? 'var(--primary)' : 'var(--border-medium)'}`, background: method === key ? 'var(--primary-light)' : 'var(--bg-muted)', cursor: 'pointer', textAlign: 'center', transition: 'all 0.15s' }}>
                  <div style={{ color: method === key ? 'var(--primary)' : 'var(--text-muted)', fontSize: 20, marginBottom: 4 }}>{cfg.icon}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: method === key ? 'var(--primary)' : 'var(--text-secondary)' }}>{cfg.label}</div>
                </div>
              ))}
            </div>
          </div>
          <div className={styles.formGroup}>
            <label>Amount (KSh) *</label>
            <input type='number' min={0} max={balance} value={amount} onChange={e => setAmount(e.target.value)} placeholder={`Max: KSh ${balance.toLocaleString()}`} autoFocus />
            <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
              {[balance, Math.round(balance / 2)].filter(v => v > 0).map((v, idx) => (
                <button key={idx} onClick={() => setAmount(String(v))} style={{ padding: '3px 10px', fontSize: 11, fontWeight: 600, border: '1px solid var(--border-medium)', borderRadius: 20, background: 'var(--bg-muted)', cursor: 'pointer', color: 'var(--text-secondary)', fontFamily: 'inherit' }}>
                  KSh {v.toLocaleString()}
                </button>
              ))}
            </div>
          </div>
          <div className={styles.formGroup}>
            <label>{method === 'mpesa' ? 'M-Pesa Transaction Code *' : method === 'bank' ? 'Bank Reference Number *' : 'Receipt Number (optional)'}</label>
            <input value={reference} onChange={e => setReference(e.target.value)} placeholder={methodConfig[method].placeholder} />
          </div>
          <div className={styles.formGroup}>
            <label>Notes (optional)</label>
            <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any additional notes..." />
          </div>
          {payments.length > 0 && (
            <div style={{ marginTop: 4 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Previous Payments</div>
              {payments.map((p, i) => (
                <div key={p._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: i < payments.length - 1 ? '1px solid var(--border-soft)' : 'none', fontSize: 12 }}>
                  <div>
                    <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{METHOD_ICONS[p.method]} {p.method}</span>
                    {p.reference && <span style={{ color: 'var(--text-muted)', marginLeft: 8 }}>{p.reference}</span>}
                    <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>{p.date} · by {p.paidBy}</div>
                  </div>
                  <span style={{ fontWeight: 700, color: 'var(--success-dark)' }}>KSh {p.amount.toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
          {error && <div style={{ marginTop: 12, padding: '10px 14px', background: 'var(--danger-light)', borderRadius: 'var(--radius-md)', color: 'var(--danger-dark)', fontSize: 13, fontWeight: 600 }}>{error}</div>}
        </div>
        <div className={styles.modalFooter}>
          <button className={styles.btnSecondary} onClick={onClose}>Cancel</button>
          <button className={styles.btnSuccess} onClick={handlePay} disabled={paying || !amount || Number(amount) <= 0}>
            {paying ? 'Recording...' : `💰 Pay KSh ${Number(amount || 0).toLocaleString()} via ${method}`}
          </button>
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════
//  VIEW PO MODAL  (unchanged)
// ══════════════════════════════════════════════════════════════════════
function ViewPOModal({ po, onClose, onDownloadPDF, onEmail, onPay, onInvoice }) {
  const status = STATUS_LABELS[po.status] || {}
  const ps = PAYMENT_STATUS[po.paymentStatus]
  const hasInvoice = po.invoiceAmount > 0
  return (
    <div className={styles.overlay}>
      <div className={`${styles.modal} ${styles.modalWide}`}>
        <div className={styles.modalHeader}>
          <h2>{po.poNumber} — {status.icon} {status.label}</h2>
          <button className={styles.modalClose} onClick={onClose}><MdClose /></button>
        </div>
        <div className={styles.modalBody}>
          <div className={styles.detailSection}>
            <h3>Supplier & Order Info</h3>
            <div className={styles.detailGrid}>
              {[
                { key: 'Supplier', val: po.supplierName },
                { key: 'Phone', val: po.supplierPhone || '—' },
                { key: 'Store', val: po.store || '—' },
                { key: 'Order Date', val: po.date },
                { key: 'Expected Delivery', val: po.expectedDate || '—' },
                { key: 'Created By', val: po.createdBy || '—' },
                po.receivedBy ? { key: 'Received By', val: po.receivedBy } : null,
              ].filter(Boolean).map(item => (
                <div key={item.key} className={styles.detailItem}>
                  <div className={styles.key}>{item.key}</div>
                  <div className={styles.val}>{item.val}</div>
                </div>
              ))}
            </div>
          </div>
          <div className={styles.detailSection}>
            <h3>Items Ordered</h3>
            <table className={styles.itemsTable}>
              <thead>
                <tr>
                  <th>Product</th>
                  <th style={{ textAlign: 'center' }}>Ordered</th>
                  <th style={{ textAlign: 'center' }}>Received</th>
                  <th>Unit Cost</th>
                  <th>Line Total</th>
                  <th>Progress</th>
                </tr>
              </thead>
              <tbody>
                {po.items?.map((item, i) => {
                  const pct = item.qtyOrdered ? Math.min(100, Math.round(item.qtyReceived / item.qtyOrdered * 100)) : 0
                  return (
                    <tr key={i}>
                      <td><div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{item.productName}</div></td>
                      <td style={{ textAlign: 'center', fontWeight: 700 }}>{item.qtyOrdered}</td>
                      <td style={{ textAlign: 'center', fontWeight: 700, color: item.qtyReceived >= item.qtyOrdered ? 'var(--success)' : 'var(--warning-dark)' }}>{item.qtyReceived}</td>
                      <td>KSh {item.unitCost?.toLocaleString()}</td>
                      <td style={{ fontWeight: 700 }}>KSh {(item.qtyOrdered * item.unitCost).toLocaleString()}</td>
                      <td style={{ minWidth: 80 }}>
                        <div style={{ fontSize: 11, marginBottom: 3, color: 'var(--text-muted)' }}>{pct}%</div>
                        <div className={styles.progressBar}><div className={styles.progressFill} style={{ width: `${pct}%` }} /></div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {(po.status === 'received' || po.status === 'partial') && (
            <div className={styles.detailSection}>
              <h3>Invoice & Payment</h3>
              {hasInvoice ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
                  {[
                    { label: 'Invoice No', value: po.invoiceNumber || '—', color: 'var(--text-primary)' },
                    { label: 'Invoice Date', value: po.invoiceDate || '—', color: 'var(--text-primary)' },
                    { label: 'Invoice Amount', value: `KSh ${(po.invoiceAmount || 0).toLocaleString()}`, color: 'var(--text-primary)' },
                    { label: 'Amount Paid', value: `KSh ${(po.amountPaid || 0).toLocaleString()}`, color: 'var(--success-dark)' },
                    { label: 'Balance Due', value: `KSh ${(po.balance || 0).toLocaleString()}`, color: po.balance > 0 ? 'var(--danger)' : 'var(--success-dark)' },
                    { label: 'Payment Status', value: ps?.label || '—', color: ps?.color || 'var(--text-muted)' },
                  ].map(s => (
                    <div key={s.label} style={{ padding: '10px 12px', background: 'var(--bg-muted)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-soft)' }}>
                      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 4 }}>{s.label}</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: s.color }}>{s.value}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ padding: '12px 14px', background: 'var(--warning-light)', border: '1px solid var(--warning)', borderRadius: 'var(--radius-md)', fontSize: 13, color: 'var(--warning-dark)', fontWeight: 600 }}>
                  ⚠️ No invoice recorded yet. Click "Record Invoice" below to add the supplier's invoice details.
                </div>
              )}
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 12 }}>
            <div style={{ textAlign: 'right', padding: '10px 16px', background: 'var(--bg-muted)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Order Value</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--text-primary)' }}>KSh {(po.totalOrderedCost || 0).toLocaleString()}</div>
            </div>
            {po.totalReceivedCost > 0 && (
              <div style={{ textAlign: 'right', padding: '10px 16px', background: 'var(--success-light)', borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontSize: 11, color: 'var(--success-dark)', fontWeight: 700, textTransform: 'uppercase' }}>Received Value</div>
                <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--success-dark)' }}>KSh {(po.totalReceivedCost || 0).toLocaleString()}</div>
              </div>
            )}
          </div>
          {po.notes && <div style={{ marginTop: 14, padding: '10px 14px', background: 'var(--bg-muted)', borderRadius: 'var(--radius-md)', fontSize: 13, color: 'var(--text-secondary)' }}><strong>Notes:</strong> {po.notes}</div>}
        </div>
        <div className={styles.modalFooter}>
          <button className={styles.btnSecondary} onClick={onDownloadPDF}><MdPictureAsPdf size={15} style={{ marginRight: 4, verticalAlign: 'middle' }} /> PDF</button>
          {(po.status === 'draft' || po.status === 'sent') && <button className={styles.btnSecondary} onClick={onEmail}><MdMarkEmailRead size={15} style={{ marginRight: 4, verticalAlign: 'middle' }} /> Email</button>}
          {(po.status === 'received' || po.status === 'partial') && !hasInvoice && <button className={styles.btnSecondary} onClick={onInvoice}><MdReceipt size={15} style={{ marginRight: 4, verticalAlign: 'middle' }} /> Record Invoice</button>}
          {hasInvoice && po.paymentStatus !== 'paid' && <button className={styles.btnSuccess} onClick={onPay}><MdPayments size={15} style={{ marginRight: 4, verticalAlign: 'middle' }} /> Pay Supplier</button>}
          <button className={styles.btnSecondary} onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════
//  RECEIVE STOCK MODAL
// ══════════════════════════════════════════════════════════════════════
function ReceiveModal({ po, products, onClose, onReceived, receivePurchaseOrder }) {
  const [quantities, setQuantities] = useState(
    Object.fromEntries(po.items.map(item => [item._id, item.qtyOrdered - item.qtyReceived]))
  )
  const [actualCosts, setActualCosts] = useState(
    Object.fromEntries(po.items.map(item => [item._id, item.unitCost]))
  )
  const [newSellPrices, setNewSellPrices] = useState(() => {
    const map = {}
    for (const item of po.items) {
      const pid = String(item.productId?._id || item.productId)
      const product = products.find(p => String(p._id) === pid)
      map[item._id] = product?.sellPrice ?? ''
    }
    return map
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const getProduct = (item) => {
    const pid = String(item.productId?._id || item.productId)
    return products.find(p => String(p._id) === pid)
  }

  const calcMarginPct = (sell, cost) => {
    const s = Number(sell); const c = Number(cost)
    if (!s || s <= 0 || isNaN(c)) return null
    return ((s - c) / s * 100)
  }

  const handleReceive = async () => {
    setError('')
    for (const poItem of po.items) {
      const max = poItem.qtyOrdered - poItem.qtyReceived
      if (Number(quantities[poItem._id] || 0) > max) {
        setError(`${poItem.productName}: cannot receive more than ${max}.`); return
      }
      const cost = Number(actualCosts[poItem._id])
      if (isNaN(cost) || cost < 0) {
        setError(`${poItem.productName}: enter a valid unit cost.`); return
      }
    }
    const items = po.items
      .map(item => ({
        itemId: item._id,
        qtyReceived: Number(quantities[item._id] || 0),
        actualUnitCost: Number(actualCosts[item._id]),
        newSellPrice: newSellPrices[item._id] !== '' ? Number(newSellPrices[item._id]) : undefined,
      }))
      .filter(i => i.qtyReceived > 0)
    if (!items.length) { setError('Enter quantities received for at least one item.'); return }
    setSaving(true)
    const res = await receivePurchaseOrder(po._id, items)
    setSaving(false)
    if (res.success) onReceived()
    else setError(res.message || 'Failed to receive stock')
  }

  const totalValue = po.items.reduce(
    (s, item) => s + (Number(quantities[item._id]) || 0) * (Number(actualCosts[item._id]) || 0), 0
  )

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <h2><MdInventory style={{ marginRight: 6, verticalAlign: 'middle' }} /> Receive Stock — {po.poNumber}</h2>
          <button className={styles.modalClose} onClick={onClose}><MdClose /></button>
        </div>
        <div className={styles.modalBody}>

          <div style={{ marginBottom: 16, padding: '10px 14px', background: 'var(--info-light)', borderRadius: 'var(--radius-md)', fontSize: 13, color: 'var(--info-dark)', fontWeight: 600 }}>
            <MdLocalShipping style={{ verticalAlign: 'middle', marginRight: 6 }} />
            Confirm quantities and actual unit costs paid. Buy prices update for <strong>future sales only</strong> — past sales already recorded are not affected.
          </div>

          {po.items.map(item => {
            const remaining  = item.qtyOrdered - item.qtyReceived
            const pct        = item.qtyOrdered ? Math.min(100, Math.round(item.qtyReceived / item.qtyOrdered * 100)) : 0
            const itemUnit   = item.unit || 'pcs'
            const product    = getProduct(item)
            const origCost   = item.unitCost
            const actualCost = Number(actualCosts[item._id])
            const costChanged = !isNaN(actualCost) && Math.abs(actualCost - origCost) > 0.001
            const costDiff   = actualCost - origCost
            const sellForMargin = (newSellPrices[item._id] !== '' && !isNaN(Number(newSellPrices[item._id])))
              ? Number(newSellPrices[item._id])
              : (product?.sellPrice || 0)
            const origMargin = calcMarginPct(product?.sellPrice, origCost)
            const newMargin  = calcMarginPct(sellForMargin, actualCost)

            return (
              <div key={item._id} style={{
                marginBottom: 14, padding: '14px 16px',
                background: 'var(--bg-muted)', borderRadius: 'var(--radius-md)',
                border: `1px solid ${costChanged ? 'var(--warning)' : 'var(--border-soft)'}`,
              }}>
                {/* Product name + progress */}
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>{item.productName}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                    Ordered: {item.qtyOrdered} {itemUnit} · Received so far: {item.qtyReceived} {itemUnit} · Remaining: {remaining} {itemUnit}
                  </div>
                  <div className={styles.progressBar} style={{ marginTop: 6, width: 160 }}>
                    <div className={styles.progressFill} style={{ width: `${pct}%` }} />
                  </div>
                </div>

                {/* Three input columns */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                  {/* Qty */}
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Qty Now ({itemUnit})</div>
                    <input
                      type='number' min={0} max={remaining}
                      value={quantities[item._id] ?? ''}
                      onChange={e => setQuantities({ ...quantities, [item._id]: e.target.value })}
                      disabled={remaining <= 0}
                      style={{ width: '100%', padding: '6px 8px', border: '1px solid var(--border-medium)', borderRadius: 'var(--radius-sm)', background: remaining <= 0 ? 'var(--bg-muted)' : 'var(--bg-card)', color: 'var(--text-primary)', fontFamily: 'inherit', fontSize: 13, outline: 'none', textAlign: 'center', boxSizing: 'border-box' }}
                    />
                  </div>

                  {/* Actual unit cost */}
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Actual Unit Cost (KSh)</div>
                    <input
                      type='number' min={0} step='0.01'
                      value={actualCosts[item._id] ?? ''}
                      onChange={e => setActualCosts({ ...actualCosts, [item._id]: e.target.value })}
                      style={{ width: '100%', padding: '6px 8px', border: `1px solid ${costChanged ? 'var(--warning)' : 'var(--border-medium)'}`, borderRadius: 'var(--radius-sm)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontFamily: 'inherit', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                    />
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>PO quoted: KSh {origCost.toLocaleString()}</div>
                  </div>

                  {/* Optional new sell price */}
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>
                      Selling Price (KSh) <span style={{ fontWeight: 400, textTransform: 'none', fontSize: 9 }}>— optional update</span>
                    </div>
                    <input
                      type='number' min={0} step='0.01'
                      value={newSellPrices[item._id] ?? ''}
                      onChange={e => setNewSellPrices({ ...newSellPrices, [item._id]: e.target.value })}
                      style={{ width: '100%', padding: '6px 8px', border: '1px solid var(--border-medium)', borderRadius: 'var(--radius-sm)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontFamily: 'inherit', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                    />
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>Current: KSh {(product?.sellPrice || 0).toLocaleString()}</div>
                  </div>
                </div>

                {/* Variance + margin callout — only shown when cost changed */}
                {costChanged && (
                  <div style={{
                    marginTop: 10, padding: '8px 12px', borderRadius: 'var(--radius-sm)', fontSize: 12,
                    background: costDiff > 0 ? 'var(--warning-light)' : 'var(--success-light)',
                    border: `1px solid ${costDiff > 0 ? 'var(--warning)' : 'var(--success)'}`,
                  }}>
                    <div style={{ fontWeight: 700, color: costDiff > 0 ? 'var(--warning-dark)' : 'var(--success-dark)', marginBottom: origMargin !== null ? 4 : 0 }}>
                      {costDiff > 0 ? '⚠️' : '✅'} Price changed: KSh {origCost.toLocaleString()} → KSh {actualCost.toLocaleString()} ({costDiff > 0 ? '+' : ''}KSh {Math.abs(costDiff).toLocaleString()})
                    </div>
                    {origMargin !== null && newMargin !== null && (
                      <div style={{ color: 'var(--text-secondary)' }}>
                        Margin at KSh {sellForMargin.toLocaleString()} sell price:{' '}
                        <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{origMargin.toFixed(1)}%</span>
                        {' → '}
                        <span style={{ fontWeight: 700, color: newMargin < origMargin ? 'var(--danger)' : 'var(--success-dark)' }}>
                          {newMargin.toFixed(1)}%
                        </span>
                        {newMargin < 20 && newMargin < origMargin && (
                          <span style={{ color: 'var(--danger)', marginLeft: 6 }}>⚠️ Low margin</span>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Subtotal */}
                <div style={{ marginTop: 10, display: 'flex', justifyContent: 'flex-end', fontSize: 12, color: 'var(--text-muted)' }}>
                  Subtotal:&nbsp;<span style={{ fontWeight: 700, color: 'var(--primary)' }}>
                    KSh {((Number(quantities[item._id]) || 0) * (isNaN(actualCost) ? origCost : actualCost)).toLocaleString()}
                  </span>
                </div>
              </div>
            )
          })}

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
            <div style={{ background: 'var(--success-light)', border: '1px solid var(--success)', borderRadius: 'var(--radius-md)', padding: '10px 16px', textAlign: 'right' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--success-dark)', textTransform: 'uppercase' }}>Total Value Received Now</div>
              <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--success-dark)' }}>KSh {totalValue.toLocaleString()}</div>
            </div>
          </div>

          {error && (
            <div style={{ marginTop: 12, padding: '10px 14px', background: 'var(--danger-light)', borderRadius: 'var(--radius-md)', color: 'var(--danger-dark)', fontSize: 13, fontWeight: 600 }}>
              <MdWarning style={{ verticalAlign: 'middle', marginRight: 6 }} />{error}
            </div>
          )}
        </div>
        <div className={styles.modalFooter}>
          <button className={styles.btnSecondary} onClick={onClose}>Cancel</button>
          <button className={styles.btnSuccess} onClick={handleReceive} disabled={saving}>
            <MdCheckCircle /> {saving ? 'Updating...' : 'Confirm Receipt & Update Stock'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════
//  EMAIL PO MODAL  (unchanged)
// ══════════════════════════════════════════════════════════════════════
function EmailPOModal({ po, currentUser, onClose, onSent }) {
  const supplierEmail = po.supplierId?.email || ''
  const [recipient, setRecipient] = useState(supplierEmail)
  const [subject, setSubject] = useState(`Purchase Order ${po.poNumber} — Request for Supply`)
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  const handleSend = async () => {
    setError('')
    if (!recipient.trim()) { setError('Recipient email is required.'); return }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient.trim())) { setError('Enter a valid email address.'); return }
    setSending(true)
    try {
      const res = await fetch(`http://localhost:5000/api/purchase-orders/${po._id}/send-email`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${currentUser?.token}` },
        body: JSON.stringify({ recipientEmail: recipient.trim(), subject, message }),
      })
      const data = await res.json()
      if (res.ok && data.success) onSent()
      else setError(data.message || 'Failed to send email')
    } catch { setError('Network error.') }
    setSending(false)
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <h2>📧 Send PO by Email — {po.poNumber}</h2>
          <button className={styles.modalClose} onClick={onClose}><MdClose /></button>
        </div>
        <div className={styles.modalBody}>
          <div style={{ padding: '10px 14px', background: 'var(--info-light)', border: '1px solid var(--info)', borderRadius: 'var(--radius-md)', fontSize: 13, marginBottom: 16 }}>
            <strong>Supplier:</strong> {po.supplierName}
            {po.supplierPhone && <span style={{ marginLeft: 12, color: 'var(--text-muted)' }}>📞 {po.supplierPhone}</span>}
            {!supplierEmail && <div style={{ marginTop: 6, color: 'var(--warning-dark)', fontWeight: 600, fontSize: 12 }}>⚠️ No email saved for this supplier.</div>}
          </div>
          <div className={styles.formGroup}><label>Recipient Email *</label><input value={recipient} onChange={e => setRecipient(e.target.value)} placeholder="supplier@company.com" autoFocus /></div>
          <div className={styles.formGroup}><label>Subject</label><input value={subject} onChange={e => setSubject(e.target.value)} /></div>
          <div className={styles.formGroup}><label>Additional Message (optional)</label><textarea value={message} onChange={e => setMessage(e.target.value)} placeholder="Specific instructions, urgency notes..." /></div>
          <div style={{ background: 'var(--bg-muted)', borderRadius: 'var(--radius-md)', padding: '12px 14px', fontSize: 12, color: 'var(--text-secondary)', border: '1px solid var(--border-soft)' }}>
            <div style={{ fontWeight: 700, marginBottom: 6, color: 'var(--text-primary)' }}>Email will include:</div>
            <div>✅ PO Number: <strong>{po.poNumber}</strong></div>
            <div>✅ {po.items?.length} product line{po.items?.length !== 1 ? 's' : ''} · Total: <strong>KSh {(po.totalOrderedCost || 0).toLocaleString()}</strong></div>
            <div style={{ marginTop: 6, color: 'var(--text-muted)', fontStyle: 'italic' }}>Status updates to "Sent" after delivery.</div>
          </div>
          {error && <div style={{ marginTop: 12, padding: '10px 14px', background: 'var(--danger-light)', borderRadius: 'var(--radius-md)', color: 'var(--danger-dark)', fontSize: 13, fontWeight: 600 }}>⚠️ {error}</div>}
        </div>
        <div className={styles.modalFooter}>
          <button className={styles.btnSecondary} onClick={onClose}>Cancel</button>
          <button className={styles.btnPrimary} onClick={handleSend} disabled={sending || !recipient.trim()}>{sending ? 'Sending…' : '📧 Send Email to Supplier'}</button>
        </div>
      </div>
    </div>
  )
}
