import { useState, useEffect, useMemo, useCallback } from 'react'
import { MdWarning, MdDelete, MdStorefront, MdRefresh, MdTrendingDown, MdClose } from 'react-icons/md'
import { useApp } from '@/context/AppContext'
import { useHistoryModal } from '@/hooks/useHistoryModal'
import { API_BASE_URL } from '@/config/api'
import styles from '@/styles/ExpiredStock.module.css'

const isTouchDevice = () => window.matchMedia('(pointer: coarse)').matches

export default function ExpiredStock() {
  const { currentUser, products, fetchProducts, isOwner, isManager, stores } = useApp()

  const [expiredStock, setExpiredStock] = useState([])
  const [totalLoss, setTotalLoss] = useState(0)
  const [loading, setLoading] = useState(true)
  const [storeFilter, setStoreFilter] = useState('All')
  const [showMove, openMove, closeMove] = useHistoryModal('expired-move')
  const [moveProd, setMoveProd] = useState(null)
  const [moveQty, setMoveQty] = useState('')
  const [moveNotes, setMoveNotes] = useState('')
  const [moving, setMoving] = useState(false)
  const [checking, setChecking] = useState(false)
  const [message, setMessage] = useState(null)
  const [confirmId, setConfirmId] = useState(null)

  const token = currentUser?.token

  const fetchExpired = useCallback(async () => {
    try {
      setLoading(true)
      const params = storeFilter !== 'All' ? `?store=${encodeURIComponent(storeFilter)}` : ''
      const res = await fetch(`${API_BASE_URL}/api/expired${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (data.success) {
        setExpiredStock(data.expired || [])
        setTotalLoss(data.totalLoss || 0)
      }
    } catch (err) {
      console.error('Error fetching expired stock:', err)
    } finally {
      setLoading(false)
    }
  }, [token, storeFilter])

  useEffect(() => {
    if (token) fetchExpired()
  }, [token, storeFilter, fetchExpired])

  // ── Filter expiring products by store selection ──────────────────
  const expiringProducts = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    return (products || []).filter(p => {
      if (!p.expiryDate || p.isExpired) return false
      if (storeFilter !== 'All' && p.store !== storeFilter) return false
      const exp = new Date(p.expiryDate)
      const daysLeft = (exp - today) / (1000 * 60 * 60 * 24)
      return daysLeft <= 30 && daysLeft >= 0
    }).sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate))
  }, [products, storeFilter])

  useEffect(() => { if (!showMove) { setMoveProd(null); setMoveQty(''); setMoveNotes('') } }, [showMove])

  const handleMoveToExpired = async () => {
    if (!moveProd) return
    const qty = Number(moveQty) || moveProd.stock
    if (qty <= 0 || qty > moveProd.stock) {
      setMessage({ type: 'error', text: 'Invalid quantity' }); return
    }
    try {
      setMoving(true)
      const res = await fetch(`${API_BASE_URL}/api/expired/move/${moveProd._id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ quantity: qty, notes: moveNotes }),
      })
      const data = await res.json()
      if (data.success) {
        setMessage({ type: 'success', text: `Moved ${qty} units. Loss: KSh ${data.totalLoss.toLocaleString()}` })
        closeMove(); setMoveQty(''); setMoveNotes('')
        fetchExpired(); fetchProducts()
      } else {
        setMessage({ type: 'error', text: data.message || 'Failed to move product' })
      }
    } catch {
      setMessage({ type: 'error', text: 'Server error' })
    } finally {
      setMoving(false)
    }
  }

  const handleAutoCheck = async () => {
    try {
      setChecking(true)
      const res = await fetch(`${API_BASE_URL}/api/expired/auto-check`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (data.success) {
        setMessage({ type: 'success', text: `Auto-check complete. ${data.moved} product(s) moved to expired.` })
        fetchExpired(); fetchProducts()
      }
    } catch { setMessage({ type: 'error', text: 'Auto-check failed' }) }
    finally { setChecking(false) }
  }

  const handleDelete = async (id) => {
    try {
      await fetch(`${API_BASE_URL}/api/expired/${id}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
      })
      setConfirmId(null)
      fetchExpired()
    } catch (err) { console.error('Delete error:', err) }
  }

  const formatDate = (d) => {
    if (!d) return '—'
    return new Date(d).toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  const storeOptions = ['All', ...(stores || []).map(s => s.name || s).filter(Boolean)]

  return (
    <div className="flex flex-col min-h-full md:h-full md:overflow-hidden" style={{ background: 'var(--bg-page)' }}>

      {/* ── Fixed header ───────────────────────────────── */}
      <div className="flex-shrink-0 px-6 pt-6 pb-4">
        <div className="flex justify-between items-start flex-wrap gap-3 mb-4">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
              <MdWarning style={{ color: 'var(--danger)', fontSize: '22px' }} /> Expired Stock
            </h1>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
              Products past their expiry date — tracked as business loss
            </p>
          </div>
          {isOwner && (
            <button
              onClick={handleAutoCheck}
              disabled={checking}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold text-white transition"
              style={{ background: checking ? 'var(--border-medium)' : 'var(--warning)', cursor: checking ? 'not-allowed' : 'pointer' }}
            >
              <MdRefresh className={checking ? 'animate-spin' : ''} />
              {checking ? 'Checking...' : 'Run Auto-Check'}
            </button>
          )}
        </div>

        {/* Message banner */}
        {message && (
          <div
            className="mb-4 p-3 rounded-lg text-sm font-medium flex justify-between items-center"
            style={message.type === 'success'
              ? { background: 'var(--success-light)', color: 'var(--success-dark)', border: '1px solid var(--success)' }
              : { background: 'var(--danger-light)', color: 'var(--danger-dark)', border: '1px solid var(--danger)' }
            }
          >
            {message.text}
            <button onClick={() => setMessage(null)} className="text-xs underline ml-3">dismiss</button>
          </div>
        )}

        {/* Summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          {[
            { label: 'Total Loss (Expired)', value: `KSh ${totalLoss.toLocaleString()}`, color: 'var(--danger)', bg: 'var(--danger-light)' },
            { label: 'Expired Records', value: expiredStock.length, color: 'var(--warning-dark)', bg: 'var(--warning-light)' },
            { label: 'Expiring Soon (≤30 days)', value: expiringProducts.length, color: 'var(--info-dark)', bg: 'var(--info-light)' },
          ].map((card, i) => (
            <div key={i} className="rounded-xl p-4" style={{ background: card.bg, border: `1px solid ${card.color}30` }}>
              <div className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: card.color, opacity: 0.8 }}>
                {card.label}
              </div>
              <div className="text-2xl font-black" style={{ color: card.color }}>{card.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Scrollable content ──────────────────────────── */}
      <div className="md:flex-1 md:overflow-y-auto px-6 pb-6">

        {/* Expiring soon warning — filtered by store */}
        {expiringProducts.length > 0 && (isOwner || isManager) && (
          <div
            className="rounded-xl p-4 mb-5"
            style={{ background: 'var(--warning-light)', border: '1px solid var(--warning)' }}
          >
            <h2 className="text-sm font-bold mb-3 flex items-center gap-2" style={{ color: 'var(--warning-dark)' }}>
              <MdWarning />
              Products Expiring Soon
              {storeFilter !== 'All' && (
                <span className="text-xs font-normal" style={{ color: 'var(--warning-dark)', opacity: 0.7 }}>
                  — {storeFilter}
                </span>
              )}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {expiringProducts.map(p => {
                const today = new Date(); today.setHours(0, 0, 0, 0)
                const daysLeft = Math.ceil((new Date(p.expiryDate) - today) / (1000 * 60 * 60 * 24))
                return (
                  <div
                    key={p._id}
                    className="rounded-lg p-3 flex justify-between items-center"
                    style={{ background: 'var(--bg-card)', border: '1px solid var(--warning)' }}
                  >
                    <div>
                      <div className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{p.name}</div>
                      <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                        {p.store} · Stock: {p.stock} {p.unit || 'pcs'}
                      </div>
                      <div className="text-xs font-bold mt-1" style={{ color: 'var(--warning-dark)' }}>
                        {daysLeft === 0 ? 'Expires today!' : `${daysLeft} day${daysLeft !== 1 ? 's' : ''} left`}
                      </div>
                    </div>
                    {(isOwner || isManager) && (
                      <button
                        onClick={() => { setMoveProd(p); setMoveQty(String(p.stock)); openMove() }}
                        className={`px-2.5 py-1 text-xs font-bold text-white rounded-lg transition ${styles.moveBtn}`}
                      >
                        Move
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Store filter */}
        {(isOwner || isManager) && storeOptions.length > 1 && (
          <div className="flex gap-2 mb-4 flex-wrap">
            {storeOptions.map(s => (
              <button
                key={s}
                onClick={() => setStoreFilter(s)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold transition"
                style={storeFilter === s
                  ? { background: 'var(--primary)', color: '#fff' }
                  : { background: 'var(--bg-card)', color: 'var(--text-secondary)', border: '1px solid var(--border-medium)' }
                }
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Expired stock table */}
        <div
          className="rounded-xl overflow-hidden"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-soft)', boxShadow: 'var(--shadow-card)' }}
        >
          <div
            className="px-5 py-4 flex items-center gap-2"
            style={{ borderBottom: '1px solid var(--border-soft)' }}
          >
            <MdTrendingDown style={{ color: 'var(--danger)', fontSize: '18px' }} />
            <h2 className="text-sm font-bold uppercase tracking-wider" style={{ color: 'var(--text-primary)' }}>
              Expired Stock Records
            </h2>
          </div>

          {loading ? (
            <div className="p-12 text-center" style={{ color: 'var(--text-muted)' }}>Loading...</div>
          ) : expiredStock.length === 0 ? (
            <div className="p-12 text-center">
              <div className="text-4xl mb-3">✅</div>
              <div className="text-sm" style={{ color: 'var(--text-muted)' }}>No expired stock records</div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: 'var(--bg-muted)', borderBottom: '1px solid var(--border-soft)' }}>
                    {['Product', 'Store', 'Qty', 'Buy Price', 'Loss', 'Expiry Date', 'Moved On', 'By', ...(isOwner ? ['Action'] : [])].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {expiredStock.map((e, i) => (
                    <tr
                      key={e._id}
                      style={{
                        borderBottom: '1px solid var(--border-soft)',
                        background: i % 2 === 0 ? 'transparent' : 'var(--bg-muted)',
                      }}
                    >
                      <td className="px-4 py-3">
                        <div className="font-bold" style={{ color: 'var(--text-primary)' }}>{e.productName}</div>
                        <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{e.category}</div>
                        {e.batch && <div className="text-[10px] font-semibold" style={{ color: 'var(--primary)' }}>Batch: {e.batch}</div>}
                      </td>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--primary)' }}>
                          <MdStorefront className="text-xs" /> {e.store}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-bold" style={{ color: 'var(--text-primary)' }}>{e.quantity} {e.unit || 'pcs'}</td>
                      <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>KSh {(e.buyPrice || 0).toLocaleString()}</td>
                      <td className="px-4 py-3 font-bold" style={{ color: 'var(--danger)' }}>KSh {(e.totalLoss || 0).toLocaleString()}</td>
                      <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{formatDate(e.expiryDate)}</td>
                      <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>{formatDate(e.movedAt)}</td>
                      <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>{e.processedBy}</td>
                      {isOwner && (
                        <td className="px-4 py-3">
                          {confirmId === e._id ? (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => setConfirmId(null)}
                                className="px-2 py-1 rounded text-xs font-semibold"
                                style={{ border: '1px solid var(--border-medium)', color: 'var(--text-secondary)', background: 'var(--bg-card)' }}
                              >
                                No
                              </button>
                              <button
                                onClick={() => handleDelete(e._id)}
                                className="px-2 py-1 rounded text-xs font-bold text-white"
                                style={{ background: 'var(--danger)' }}
                              >
                                Yes
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setConfirmId(e._id)}
                              className="p-1.5 rounded-lg transition"
                              style={{ color: 'var(--danger)' }}
                              onMouseEnter={e2 => { if (!isTouchDevice()) e2.currentTarget.style.background = 'var(--danger-light)' }}
                              onMouseLeave={e2 => { if (!isTouchDevice()) e2.currentTarget.style.background = 'transparent' }}
                            >
                              <MdDelete />
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background: 'var(--danger-light)', borderTop: `2px solid var(--danger)` }}>
                    <td colSpan={isOwner ? 4 : 3} className="px-4 py-3 text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                      Total Loss
                    </td>
                    <td colSpan={isOwner ? 5 : 5} className="px-4 py-3 text-base font-black" style={{ color: 'var(--danger)' }}>
                      KSh {totalLoss.toLocaleString()}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── Move to Expired Modal ───────────────────────── */}
      {showMove && moveProd && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)' }}
        >
          <div
            className="w-full max-w-md rounded-xl overflow-hidden"
            style={{ background: 'var(--bg-card)', boxShadow: 'var(--shadow-dropdown)' }}
          >
            <div className="px-5 py-4 flex justify-between items-center" style={{ background: 'var(--danger)' }}>
              <div>
                <h2 className="text-white font-bold text-sm">Move to Expired Stock</h2>
                <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.7)' }}>
                  {moveProd.name} · {moveProd.store}
                </p>
              </div>
              <button
                onClick={closeMove}
                className="w-7 h-7 flex items-center justify-center rounded-lg transition"
                style={{ color: 'rgba(255,255,255,0.6)' }}
                onMouseEnter={e => { if (!isTouchDevice()) e.currentTarget.style.background = 'rgba(255,255,255,0.15)' }}
                onMouseLeave={e => { if (!isTouchDevice()) e.currentTarget.style.background = 'transparent' }}
              >
                <MdClose size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="p-3 rounded-lg space-y-1.5" style={{ background: 'var(--danger-light)', border: '1px solid var(--danger)' }}>
                {[
                  { label: 'Current Stock', value: `${moveProd.stock} ${moveProd.unit || 'pcs'}` },
                  { label: 'Buy Price', value: `KSh ${(moveProd.buyPrice || 0).toLocaleString()}` },
                  { label: 'Expiry Date', value: formatDate(moveProd.expiryDate) },
                ].map(row => (
                  <div key={row.label} className="flex justify-between text-sm">
                    <span style={{ color: 'var(--text-muted)' }}>{row.label}</span>
                    <span className="font-semibold" style={{ color: 'var(--danger-dark)' }}>{row.value}</span>
                  </div>
                ))}
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider block mb-1.5" style={{ color: 'var(--text-muted)' }}>
                  Quantity to Move ({moveProd.unit || 'pcs'})
                </label>
                <input
                  type="number"
                  value={moveQty}
                  onChange={e => setMoveQty(e.target.value)}
                  min="1"
                  max={moveProd.stock}
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none transition-all"
                  style={{ border: '1px solid var(--border-medium)', background: 'var(--bg-muted)', color: 'var(--text-primary)' }}
                  onFocus={e => { e.target.style.borderColor = 'var(--danger)'; e.target.style.boxShadow = '0 0 0 3px var(--danger-light)' }}
                  onBlur={e => { e.target.style.borderColor = 'var(--border-medium)'; e.target.style.boxShadow = 'none' }}
                />
                {moveQty && Number(moveQty) > 0 && (
                  <div className="text-xs font-bold mt-1" style={{ color: 'var(--danger)' }}>
                    Estimated Loss: KSh {(Number(moveQty) * (moveProd.buyPrice || 0)).toLocaleString()}
                  </div>
                )}
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider block mb-1.5" style={{ color: 'var(--text-muted)' }}>
                  Notes (optional)
                </label>
                <input
                  type="text"
                  value={moveNotes}
                  onChange={e => setMoveNotes(e.target.value)}
                  placeholder="e.g. damaged packaging, batch recall..."
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none transition-all"
                  style={{ border: '1px solid var(--border-medium)', background: 'var(--bg-muted)', color: 'var(--text-primary)' }}
                  onFocus={e => { e.target.style.borderColor = 'var(--primary)'; e.target.style.boxShadow = '0 0 0 3px var(--primary-light)' }}
                  onBlur={e => { e.target.style.borderColor = 'var(--border-medium)'; e.target.style.boxShadow = 'none' }}
                />
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  onClick={closeMove}
                  className="flex-1 py-2.5 rounded-lg text-sm font-semibold transition"
                  style={{ border: '1px solid var(--border-medium)', color: 'var(--text-secondary)', background: 'var(--bg-card)' }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleMoveToExpired}
                  disabled={moving}
                  className="flex-1 py-2.5 rounded-lg text-sm font-bold text-white transition"
                  style={{ background: moving ? 'var(--border-medium)' : 'var(--danger)', cursor: moving ? 'not-allowed' : 'pointer' }}
                >
                  {moving ? 'Moving...' : 'Confirm Move'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
