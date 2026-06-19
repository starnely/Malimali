import { useState, useEffect, useCallback } from 'react'
import {
  MdAccountBalanceWallet, MdAdd, MdClose, MdArrowUpward,
  MdArrowDownward, MdLock, MdRefresh, MdStorefront,
} from 'react-icons/md'
import { useApp } from '@/context/AppContext'

const S = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', WebkitBackdropFilter: 'blur(3px)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 },
  modal:   { background: 'var(--bg-card)', borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-dropdown)', width: '100%', maxWidth: 440, overflow: 'hidden' },
  mHead:   { background: 'var(--sidebar-bg)', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  mBody:   { padding: 20 },
  mFoot:   { padding: '14px 20px', borderTop: '1px solid var(--border-soft)', display: 'flex', justifyContent: 'flex-end', gap: 10 },
  label:   { display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 6 },
  input:   { width: '100%', padding: '9px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-medium)', background: 'var(--bg-muted)', color: 'var(--text-primary)', fontSize: 13, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' },
  select:  { width: '100%', padding: '9px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-medium)', background: 'var(--bg-muted)', color: 'var(--text-primary)', fontSize: 13, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' },
}

const btn = (bg, color = 'white', extra = {}) => ({
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '8px 16px', background: bg, color,
  border: color === 'white' ? 'none' : '1px solid var(--border-medium)',
  borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 700,
  fontFamily: 'inherit', cursor: 'pointer', height: 36, ...extra,
})

const CASHOUT_CATEGORIES = [
  { value: 'supplies',    label: 'Supplies',    emoji: '🛒' },
  { value: 'transport',   label: 'Transport',   emoji: '🚗' },
  { value: 'maintenance', label: 'Maintenance', emoji: '🔧' },
  { value: 'utilities',   label: 'Utilities',   emoji: '💡' },
  { value: 'marketing',   label: 'Marketing',   emoji: '📢' },
  { value: 'wages',       label: 'Wages',       emoji: '👷' },
  { value: 'taxes',       label: 'Taxes',       emoji: '📋' },
  { value: 'other',       label: 'Other',       emoji: '📎' },
]

export default function PettyCash() {
  const {
    fetchPettyCashToday, fetchPettyCashHistory,
    openPettyCash, addPettyCashTransaction, closePettyCash,
    currentUser, isOwner, isManager, stores,
  } = useApp()

  const [selectedStore, setSelectedStore] = useState(
    isOwner ? '' : (currentUser?.store || '')
  )
  const store = isOwner ? selectedStore : (currentUser?.store || '')

  const [allStoreRecords, setAllStoreRecords] = useState([])
  const [allLoading,      setAllLoading]      = useState(false)
  const [record,          setRecord]          = useState(null)
  const [history,         setHistory]         = useState([])
  const [loading,         setLoading]         = useState(true)
  const [showTab,         setShowTab]         = useState('today')
  const [modal,           setModal]           = useState(null)
  const [toast,           setToast]           = useState(null)

  const canEdit = isOwner || isManager

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  const loadAllStores = useCallback(async () => {
    if (!isOwner || stores.length === 0) return
    setAllLoading(true)
    const results = await Promise.all(
      stores.map(async s => {
        const data = await fetchPettyCashToday(s.name)
        return { store: s.name, record: data.record || null }
      })
    )
    setAllStoreRecords(results)
    setAllLoading(false)
  }, [isOwner, stores, fetchPettyCashToday])

  const loadToday = useCallback(async () => {
    if (!store) return
    setLoading(true)
    const data = await fetchPettyCashToday(store)
    setRecord(data.record || null)
    setLoading(false)
  }, [fetchPettyCashToday, store])

  const loadHistory = useCallback(async () => {
    const filters = {}
    if (!isOwner && store) filters.store = store
    const data = await fetchPettyCashHistory(filters)
    setHistory(data)
  }, [fetchPettyCashHistory, isOwner, store])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (isOwner && !selectedStore) {
      loadAllStores()
    } else if (store) {
      loadToday()
      loadHistory()
    }
  }, [isOwner, selectedStore, store, loadAllStores, loadToday, loadHistory])

  const isClosed = record?.isClosed
  const balance  = record?.netBalance ?? 0

  // ── Owner all-stores overview ─────────────────────────────────────
  if (isOwner && !selectedStore) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', background: 'var(--bg-page)' }}>
        {toast && (
          <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 9999, padding: '10px 18px', borderRadius: 'var(--radius-md)', background: toast.type === 'error' ? 'var(--danger)' : 'var(--success)', color: 'white', fontWeight: 700, fontSize: 13, boxShadow: 'var(--shadow-dropdown)' }}>
            {toast.msg}
          </div>
        )}

        <div style={{ flexShrink: 0, padding: '24px 24px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8, margin: '0 0 4px' }}>
              <MdAccountBalanceWallet style={{ color: 'var(--primary)' }} /> Petty Cash
            </h1>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>All stores overview — click a store to manage transactions</p>
          </div>
          <button style={btn('var(--bg-card)', 'var(--text-secondary)', { border: '1px solid var(--border-medium)' })} onClick={loadAllStores}>
            <MdRefresh /> Refresh
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {allLoading ? (
            <div style={{ textAlign: 'center', padding: '60px 24px', color: 'var(--text-muted)' }}>
              <MdRefresh style={{ fontSize: 32, opacity: 0.3 }} /><p>Loading all stores...</p>
            </div>
          ) : stores.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 24px', color: 'var(--text-muted)' }}>
              <p>No stores found. Add stores first.</p>
            </div>
          ) : (
            <>
              {allStoreRecords.some(r => r.record) && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 4 }}>
                  {(() => {
                    const open = allStoreRecords.filter(r => r.record)
                    const totalFloat   = open.reduce((s, r) => s + (r.record.openingFloat || 0), 0)
                    const totalIn      = open.reduce((s, r) => s + (r.record.totalIn      || 0), 0)
                    const totalOut     = open.reduce((s, r) => s + (r.record.totalOut     || 0), 0)
                    const totalBalance = open.reduce((s, r) => s + (r.record.netBalance   || 0), 0)
                    return [
                      { label: 'Total Float',    value: totalFloat,   color: 'var(--primary)',      bg: 'var(--primary-light)' },
                      { label: 'Total Cash In',  value: totalIn,      color: 'var(--success-dark)', bg: 'var(--success-light)' },
                      { label: 'Total Cash Out', value: totalOut,     color: 'var(--danger)',       bg: 'var(--danger-light)' },
                      { label: 'Total Balance',  value: totalBalance, color: totalBalance >= 0 ? 'var(--success-dark)' : 'var(--danger)', bg: totalBalance >= 0 ? 'var(--success-light)' : 'var(--danger-light)' },
                    ].map(stat => (
                      <div key={stat.label} style={{ background: stat.bg, borderRadius: 'var(--radius-lg)', padding: '12px 16px' }}>
                        <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: stat.color, opacity: 0.8, marginBottom: 4 }}>{stat.label}</div>
                        <div style={{ fontSize: 18, fontWeight: 900, color: stat.color }}>KSh {stat.value.toLocaleString()}</div>
                        <div style={{ fontSize: 10, color: stat.color, opacity: 0.6, marginTop: 2 }}>{open.length} store{open.length !== 1 ? 's' : ''} open</div>
                      </div>
                    ))
                  })()}
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
                {allStoreRecords.map(({ store: storeName, record: rec }) => (
                  <div
                    key={storeName}
                    onClick={() => setSelectedStore(storeName)}
                    style={{ background: 'var(--bg-card)', border: '1px solid var(--border-soft)', borderRadius: 'var(--radius-lg)', padding: '18px 20px', boxShadow: 'var(--shadow-card)', cursor: 'pointer', transition: 'all 0.15s' }}
                    onMouseEnter={e => { e.currentTarget.style.boxShadow = 'var(--shadow-dropdown)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
                    onMouseLeave={e => { e.currentTarget.style.boxShadow = 'var(--shadow-card)'; e.currentTarget.style.transform = 'translateY(0)' }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 32, height: 32, borderRadius: 'var(--radius-md)', background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)', fontSize: 16 }}>
                          <MdStorefront />
                        </div>
                        <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)' }}>{storeName}</span>
                      </div>
                      {rec ? (
                        <span style={{
                          fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                          background: !rec.isClosed ? 'var(--success-light)' : rec.closedBy === 'System (Auto-Close)' ? '#fef3c7' : 'var(--bg-muted)',
                          color:      !rec.isClosed ? 'var(--success-dark)' : rec.closedBy === 'System (Auto-Close)' ? '#92400e' : 'var(--text-muted)',
                        }}>
                          {!rec.isClosed ? '🔓 Open' : rec.closedBy === 'System (Auto-Close)' ? '⚠️ Auto-Closed' : '✅ Closed'}
                        </span>
                      ) : (
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: 'var(--warning-light)', color: 'var(--warning-dark)' }}>
                          💤 Not opened
                        </span>
                      )}
                    </div>

                    {rec ? (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        {[
                          { label: 'Float',    value: rec.openingFloat, color: 'var(--text-secondary)', bold: false },
                          { label: 'Balance',  value: rec.netBalance,   color: rec.netBalance >= 0 ? 'var(--success-dark)' : 'var(--danger)', bold: true },
                          { label: 'Cash In',  value: rec.totalIn,      color: 'var(--success-dark)', bold: false },
                          { label: 'Cash Out', value: rec.totalOut,     color: 'var(--danger)', bold: false },
                        ].map(s => (
                          <div key={s.label} style={{ padding: '8px 10px', background: 'var(--bg-muted)', borderRadius: 'var(--radius-md)' }}>
                            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 2 }}>{s.label}</div>
                            <div style={{ fontSize: 13, fontWeight: s.bold ? 900 : 700, color: s.color }}>KSh {(s.value || 0).toLocaleString()}</div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ textAlign: 'center', padding: '16px 0', color: 'var(--text-muted)', fontSize: 13 }}>
                        Petty cash not opened today
                      </div>
                    )}

                    <div style={{ marginTop: 12, fontSize: 11, fontWeight: 600, color: 'var(--primary)', textAlign: 'center', opacity: 0.7 }}>
                      Click to manage →
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    )
  }

  // ── Single store view ─────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', background: 'var(--bg-page)' }}>

      {toast && (
        <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 9999, padding: '10px 18px', borderRadius: 'var(--radius-md)', background: toast.type === 'error' ? 'var(--danger)' : 'var(--success)', color: 'white', fontWeight: 700, fontSize: 13, boxShadow: 'var(--shadow-dropdown)' }}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div style={{ flexShrink: 0, padding: '24px 24px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8, margin: '0 0 4px' }}>
            <MdAccountBalanceWallet style={{ color: 'var(--primary)' }} />
            Petty Cash
            {store && <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginLeft: 4 }}>— {store}</span>}
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>Manage daily petty cash float and transactions</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {isOwner && stores.length > 0 && (
            <>
              <button
                style={btn('var(--bg-muted)', 'var(--text-secondary)', { border: '1px solid var(--border-medium)', fontSize: 12 })}
                onClick={() => setSelectedStore('')}
              >
                ← All Stores
              </button>
              <select
                style={{ ...S.input, width: 'auto', height: 36, fontSize: 13 }}
                value={selectedStore}
                onChange={e => setSelectedStore(e.target.value)}
              >
                {stores.map(s => <option key={s._id} value={s.name}>{s.name}</option>)}
              </select>
            </>
          )}
          <button style={btn('var(--bg-card)', 'var(--text-secondary)', { border: '1px solid var(--border-medium)' })} onClick={() => { loadToday(); loadHistory() }}>
            <MdRefresh /> Refresh
          </button>
          {canEdit && !record && (
            <button style={btn('var(--primary)')} onClick={() => setModal('open')}>
              <MdAdd /> Open Petty Cash
            </button>
          )}
          {canEdit && record && !isClosed && (
            <>
              <button style={btn('var(--success)')} onClick={() => setModal({ type: 'tx', txType: 'in' })}>
                <MdArrowDownward /> Cash In
              </button>
              <button style={btn('var(--danger)')} onClick={() => setModal({ type: 'tx', txType: 'out' })}>
                <MdArrowUpward /> Cash Out
              </button>
              <button style={btn('var(--sidebar-bg)')} onClick={() => setModal('close')}>
                <MdLock /> Close
              </button>
            </>
          )}
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ flexShrink: 0, padding: '14px 24px', display: 'flex', gap: 8 }}>
        {['today', 'history'].map(tab => (
          <button
            key={tab}
            onClick={() => setShowTab(tab)}
            style={{ padding: '6px 18px', border: 'none', borderRadius: 'var(--radius-md)', fontWeight: 700, fontSize: 13, fontFamily: 'inherit', cursor: 'pointer', background: showTab === tab ? 'var(--primary)' : 'var(--bg-card)', color: showTab === tab ? 'white' : 'var(--text-secondary)', boxShadow: showTab === tab ? 'var(--shadow-card)' : 'none', transition: 'all 0.15s' }}
          >
            {tab === 'today' ? "Today's Cash" : 'History'}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {showTab === 'today' ? (
          loading ? (
            <div style={{ textAlign: 'center', padding: '60px 24px', color: 'var(--text-muted)' }}>
              <MdRefresh style={{ fontSize: 32, opacity: 0.3 }} /><p>Loading...</p>
            </div>
          ) : !record ? (
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-soft)', borderRadius: 'var(--radius-lg)', textAlign: 'center', padding: '60px 24px' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>💵</div>
              <p style={{ fontSize: 14, color: 'var(--text-muted)', margin: '0 0 16px' }}>
                Petty cash not opened for today{store ? ` · ${store}` : ''}.
              </p>
              {canEdit ? (
                <button style={btn('var(--primary)')} onClick={() => setModal('open')}>
                  <MdAdd /> Open Petty Cash
                </button>
              ) : (
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
                  Only managers and owners can open petty cash.
                </p>
              )}
            </div>
          ) : (
            <>
              {/* Balance cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
                {[
                  { label: 'Opening Float', value: record.openingFloat, color: 'var(--primary)',      bg: 'var(--primary-light)',  border: 'var(--primary)' },
                  { label: 'Total Cash In',  value: record.totalIn,      color: 'var(--success-dark)', bg: 'var(--success-light)', border: 'var(--success)' },
                  { label: 'Total Cash Out', value: record.totalOut,     color: 'var(--danger)',       bg: 'var(--danger-light)',  border: 'var(--danger)' },
                  { label: 'Net Balance',    value: record.netBalance,   color: balance >= 0 ? 'var(--success-dark)' : 'var(--danger)', bg: balance >= 0 ? 'var(--success-light)' : 'var(--danger-light)', border: balance >= 0 ? 'var(--success)' : 'var(--danger)' },
                ].map(stat => (
                  <div key={stat.label} style={{ background: stat.bg, border: `1px solid ${stat.border}`, borderRadius: 'var(--radius-lg)', padding: '14px 16px' }}>
                    <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: stat.color, marginBottom: 6 }}>{stat.label}</div>
                    <div style={{ fontSize: 22, fontWeight: 900, color: stat.color }}>KSh {stat.value?.toLocaleString()}</div>
                  </div>
                ))}
              </div>

              {/* Status banner */}
              {isClosed ? (
                <div style={{ padding: '12px 16px', background: 'var(--success-light)', border: '1px solid var(--success)', borderRadius: 'var(--radius-md)', display: 'flex', gap: 10, alignItems: 'center' }}>
                  <MdLock style={{ color: 'var(--success)', fontSize: 18, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontWeight: 700, color: 'var(--success-dark)', fontSize: 13 }}>Petty cash closed for today</div>
                    <div style={{ fontSize: 12, color: 'var(--success-dark)' }}>
                      Closed by {record.closedBy} · Closing float: KSh {record.closingFloat?.toLocaleString()}
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ padding: '10px 16px', background: 'var(--info-light)', border: '1px solid var(--info)', borderRadius: 'var(--radius-md)', fontSize: 13, color: 'var(--info-dark)', fontWeight: 600 }}>
                  ✅ Petty cash is open · Opened by {record.openedBy}
                  {!canEdit && ' · View only'}
                </div>
              )}

              {/* Transactions */}
              <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-soft)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-card)', overflow: 'hidden' }}>
                <div style={{ padding: '13px 18px', borderBottom: '1px solid var(--border-soft)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)' }}>
                    Transactions ({record.transactions?.length || 0})
                  </span>
                  {canEdit && !isClosed && (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button style={{ ...btn('var(--success)'), padding: '5px 12px', height: 30, fontSize: 12 }} onClick={() => setModal({ type: 'tx', txType: 'in' })}>
                        <MdArrowDownward /> In
                      </button>
                      <button style={{ ...btn('var(--danger)'), padding: '5px 12px', height: 30, fontSize: 12 }} onClick={() => setModal({ type: 'tx', txType: 'out' })}>
                        <MdArrowUpward /> Out
                      </button>
                    </div>
                  )}
                </div>
                <div style={{ padding: '4px 18px' }}>
                  {!record.transactions?.length ? (
                    <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: 13 }}>No transactions yet</div>
                  ) : (
                    record.transactions.map((tx, i) => {
                      const catInfo = tx.expenseCategory
                        ? CASHOUT_CATEGORIES.find(c => c.value === tx.expenseCategory)
                        : null
                      return (
                        <div key={tx._id || i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 0', borderBottom: i < record.transactions.length - 1 ? '1px solid var(--border-soft)' : 'none' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ width: 34, height: 34, borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: tx.type === 'in' ? 'var(--success-light)' : 'var(--danger-light)', flexShrink: 0 }}>
                              {tx.type === 'in'
                                ? <MdArrowDownward style={{ color: 'var(--success)' }} />
                                : <MdArrowUpward   style={{ color: 'var(--danger)' }} />}
                            </div>
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                                {tx.description || (tx.type === 'in' ? 'Cash In' : 'Cash Out')}
                              </div>
                              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
                                {tx.time} · {tx.recordedBy}
                                {tx.type === 'out' && catInfo && (
                                  <span style={{ padding: '1px 7px', borderRadius: 8, fontSize: 10, fontWeight: 700, background: 'var(--danger-light)', color: 'var(--danger-dark)' }}>
                                    {catInfo.emoji} {catInfo.label} · logged as expense
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div style={{ fontWeight: 900, fontSize: 15, color: tx.type === 'in' ? 'var(--success-dark)' : 'var(--danger)' }}>
                            {tx.type === 'in' ? '+' : '−'}KSh {tx.amount?.toLocaleString()}
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            </>
          )
        ) : (
          /* History tab */
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-soft)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-card)', overflow: 'hidden' }}>
            {history.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 24px', color: 'var(--text-muted)' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>📂</div>
                <p style={{ fontSize: 14, margin: 0 }}>No petty cash history yet.</p>
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--sidebar-bg)' }}>
                    {['Date', 'Store', 'Opened By', 'Opening', 'In', 'Out', 'Balance', 'Status'].map(h => (
                      <th key={h} style={{ padding: '11px 14px', fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'white', textAlign: 'left' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {history.map((rec, i) => (
                    <tr key={rec._id} style={{ borderBottom: '1px solid var(--border-soft)', background: i % 2 === 0 ? 'transparent' : 'var(--bg-muted)' }}>
                      <td style={{ padding: '11px 14px', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{rec.date}</td>
                      <td style={{ padding: '11px 14px', fontSize: 12, color: 'var(--text-secondary)' }}>{rec.store}</td>
                      <td style={{ padding: '11px 14px', fontSize: 12, color: 'var(--text-secondary)' }}>{rec.openedBy}</td>
                      <td style={{ padding: '11px 14px', fontSize: 13 }}>KSh {rec.openingFloat?.toLocaleString()}</td>
                      <td style={{ padding: '11px 14px', fontSize: 13, color: 'var(--success-dark)', fontWeight: 700 }}>+KSh {rec.totalIn?.toLocaleString()}</td>
                      <td style={{ padding: '11px 14px', fontSize: 13, color: 'var(--danger)', fontWeight: 700 }}>−KSh {rec.totalOut?.toLocaleString()}</td>
                      <td style={{ padding: '11px 14px', fontSize: 13, fontWeight: 800, color: rec.netBalance >= 0 ? 'var(--success-dark)' : 'var(--danger)' }}>KSh {rec.netBalance?.toLocaleString()}</td>
                      <td style={{ padding: '11px 14px' }}>
                        <span style={{
                          padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700,
                          background: !rec.isClosed ? 'var(--warning-light)' : rec.closedBy === 'System (Auto-Close)' ? '#fef3c7' : 'var(--success-light)',
                          color: !rec.isClosed ? 'var(--warning-dark)' : rec.closedBy === 'System (Auto-Close)' ? '#92400e' : 'var(--success-dark)',
                        }}>
                          {!rec.isClosed ? '🔓 Open' : rec.closedBy === 'System (Auto-Close)' ? '⚠️ Auto-Closed' : '✅ Closed'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* Modals */}
      {modal === 'open' && (
        <OpenModal store={store} onClose={() => setModal(null)}
          onDone={() => { setModal(null); loadToday(); showToast('Petty cash opened') }}
          openPettyCash={openPettyCash}
        />
      )}
      {modal?.type === 'tx' && (
        <TxModal store={store} txType={modal.txType} balance={balance}
          onClose={() => setModal(null)}
          onDone={() => { setModal(null); loadToday(); showToast('Transaction recorded') }}
          addPettyCashTransaction={addPettyCashTransaction}
        />
      )}
      {modal === 'close' && (
        <CloseModal store={store} record={record}
          onClose={() => setModal(null)}
          onDone={() => { setModal(null); loadToday(); loadHistory(); showToast('Petty cash closed') }}
          closePettyCash={closePettyCash}
        />
      )}
    </div>
  )
}

// ── Open Modal ────────────────────────────────────────────────────────
function OpenModal({ store, onClose, onDone, openPettyCash }) {
  const [float,  setFloat]  = useState('')
  const [notes,  setNotes]  = useState('')
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  const handleOpen = async () => {
    setSaving(true)
    const res = await openPettyCash(store, float || 0, notes)
    setSaving(false)
    if (res.success) onDone()
    else setError(res.message || 'Failed to open petty cash')
  }

  return (
    <div style={S.overlay}>
      <div style={S.modal}>
        <div style={S.mHead}>
          <h2 style={{ color: 'white', fontSize: 14, fontWeight: 700, margin: 0 }}>Open Petty Cash · {store}</h2>
          <button style={btn('transparent', 'rgba(255,255,255,0.6)', { padding: 4, width: 28, height: 28 })} onClick={onClose}><MdClose /></button>
        </div>
        <div style={S.mBody}>
          <div style={{ marginBottom: 14 }}>
            <label style={S.label}>Opening Float (KSh)</label>
            <input style={S.input} type='number' min={0} value={float} onChange={e => setFloat(e.target.value)} placeholder='0.00' autoFocus />
          </div>
          <div>
            <label style={S.label}>Notes (optional)</label>
            <input style={S.input} value={notes} onChange={e => setNotes(e.target.value)} placeholder='Any starting notes...' />
          </div>
          {error && <div style={{ marginTop: 12, padding: '10px 14px', background: 'var(--danger-light)', borderRadius: 'var(--radius-md)', color: 'var(--danger-dark)', fontSize: 13, fontWeight: 600 }}>{error}</div>}
        </div>
        <div style={S.mFoot}>
          <button style={btn('var(--bg-card)', 'var(--text-secondary)', { border: '1px solid var(--border-medium)' })} onClick={onClose}>Cancel</button>
          <button style={btn('var(--primary)')} onClick={handleOpen} disabled={saving}>{saving ? 'Opening...' : 'Open Petty Cash'}</button>
        </div>
      </div>
    </div>
  )
}

// ── Transaction Modal ─────────────────────────────────────────────────
function TxModal({ store, txType, balance, onClose, onDone, addPettyCashTransaction }) {
  const [amount,   setAmount]   = useState('')
  const [desc,     setDesc]     = useState('')
  const [category, setCategory] = useState('other')
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState('')

  const isOut = txType === 'out'
  const color = isOut ? 'var(--danger)' : 'var(--success)'
  const label = isOut ? 'Cash Out' : 'Cash In'

  const handleSave = async () => {
    setError('')
    if (!amount || Number(amount) <= 0) { setError('Enter a valid amount'); return }
    if (isOut && Number(amount) > balance) { setError(`Insufficient balance. Available: KSh ${balance.toLocaleString()}`); return }
    setSaving(true)
    const res = await addPettyCashTransaction(store, txType, amount, desc, isOut ? category : undefined)
    setSaving(false)
    if (res.success) onDone()
    else setError(res.message || 'Failed to record transaction')
  }

  return (
    <div style={S.overlay}>
      <div style={S.modal}>
        <div style={{ ...S.mHead, background: isOut ? '#7f1d1d' : '#14532d' }}>
          <h2 style={{ color: 'white', fontSize: 14, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
            {isOut ? <MdArrowUpward /> : <MdArrowDownward />} {label} · {store}
          </h2>
          <button style={btn('transparent', 'rgba(255,255,255,0.6)', { padding: 4, width: 28, height: 28 })} onClick={onClose}><MdClose /></button>
        </div>
        <div style={S.mBody}>
          {isOut && (
            <div style={{ marginBottom: 14, padding: '10px 14px', background: 'var(--warning-light)', borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 600, color: 'var(--warning-dark)' }}>
              Current balance: KSh {balance.toLocaleString()}
            </div>
          )}
          {isOut && (
            <div style={{ marginBottom: 14 }}>
              <label style={S.label}>Expense Category</label>
              <select style={S.select} value={category} onChange={e => setCategory(e.target.value)}>
                {CASHOUT_CATEGORIES.map(c => (
                  <option key={c.value} value={c.value}>{c.emoji} {c.label}</option>
                ))}
              </select>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                💡 This will auto-log an expense under this category
              </div>
            </div>
          )}
          <div style={{ marginBottom: 14 }}>
            <label style={S.label}>Amount (KSh)</label>
            <input style={S.input} type='number' min={0} value={amount} onChange={e => setAmount(e.target.value)} placeholder='0.00' autoFocus />
          </div>
          <div>
            <label style={S.label}>Description</label>
            <input style={S.input} value={desc} onChange={e => setDesc(e.target.value)} placeholder={isOut ? 'What was this for?' : 'Source of cash...'} />
          </div>
          {isOut && Number(amount) > 0 && (
            <div style={{ marginTop: 12, padding: '10px 14px', background: 'var(--danger-light)', border: '1px solid #fecaca', borderRadius: 'var(--radius-md)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--danger-dark)', textTransform: 'uppercase' }}>
                  {CASHOUT_CATEGORIES.find(c => c.value === category)?.emoji} {CASHOUT_CATEGORIES.find(c => c.value === category)?.label}
                </div>
                <div style={{ fontSize: 11, color: 'var(--danger-dark)', marginTop: 2 }}>
                  Will deduct from petty cash + log as expense
                </div>
              </div>
              <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--danger)' }}>−KSh {Number(amount).toLocaleString()}</div>
            </div>
          )}
          {error && <div style={{ marginTop: 12, padding: '10px 14px', background: 'var(--danger-light)', borderRadius: 'var(--radius-md)', color: 'var(--danger-dark)', fontSize: 13, fontWeight: 600 }}>{error}</div>}
        </div>
        <div style={S.mFoot}>
          <button style={btn('var(--bg-card)', 'var(--text-secondary)', { border: '1px solid var(--border-medium)' })} onClick={onClose}>Cancel</button>
          <button style={{ ...btn(color), opacity: saving ? 0.7 : 1 }} onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : label}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Close Modal ───────────────────────────────────────────────────────
function CloseModal({ store, record, onClose, onDone, closePettyCash }) {
  const [closing, setClosing] = useState(String(record?.netBalance || 0))
  const [notes,   setNotes]   = useState('')
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState('')

  const diff = Number(closing) - (record?.netBalance || 0)

  const handleClose = async () => {
    setSaving(true)
    const res = await closePettyCash(store, closing, notes)
    setSaving(false)
    if (res.success) onDone()
    else setError(res.message || 'Failed to close petty cash')
  }

  return (
    <div style={S.overlay}>
      <div style={S.modal}>
        <div style={S.mHead}>
          <h2 style={{ color: 'white', fontSize: 14, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
            <MdLock /> Close Petty Cash · {store}
          </h2>
          <button style={btn('transparent', 'rgba(255,255,255,0.6)', { padding: 4, width: 28, height: 28 })} onClick={onClose}><MdClose /></button>
        </div>
        <div style={S.mBody}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
            {[
              { label: 'Expected Balance', value: `KSh ${record?.netBalance?.toLocaleString()}` },
              { label: 'Transactions',     value: record?.transactions?.length || 0 },
            ].map(stat => (
              <div key={stat.label} style={{ padding: '12px 14px', background: 'var(--bg-muted)', borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 4 }}>{stat.label}</div>
                <div style={{ fontSize: 16, fontWeight: 900, color: 'var(--text-primary)' }}>{stat.value}</div>
              </div>
            ))}
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={S.label}>Actual Closing Count (KSh)</label>
            <input style={S.input} type='number' min={0} value={closing} onChange={e => setClosing(e.target.value)} />
          </div>
          {closing !== '' && (
            <div style={{ marginBottom: 14, padding: '10px 14px', background: diff === 0 ? 'var(--success-light)' : diff > 0 ? 'var(--info-light)' : 'var(--danger-light)', borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 600, color: diff === 0 ? 'var(--success-dark)' : diff > 0 ? 'var(--info-dark)' : 'var(--danger-dark)' }}>
              {diff === 0 ? '✅ Balance matches expected' : diff > 0 ? `📈 Surplus: KSh ${diff.toLocaleString()}` : `📉 Shortage: KSh ${Math.abs(diff).toLocaleString()}`}
            </div>
          )}
          <div>
            <label style={S.label}>Notes (optional)</label>
            <input style={S.input} value={notes} onChange={e => setNotes(e.target.value)} placeholder='Any closing notes...' />
          </div>
          {error && <div style={{ marginTop: 12, padding: '10px 14px', background: 'var(--danger-light)', borderRadius: 'var(--radius-md)', color: 'var(--danger-dark)', fontSize: 13, fontWeight: 600 }}>{error}</div>}
        </div>
        <div style={S.mFoot}>
          <button style={btn('var(--bg-card)', 'var(--text-secondary)', { border: '1px solid var(--border-medium)' })} onClick={onClose}>Cancel</button>
          <button style={{ ...btn('var(--sidebar-bg)'), opacity: saving ? 0.7 : 1 }} onClick={handleClose} disabled={saving}>
            <MdLock /> {saving ? 'Closing...' : 'Close Petty Cash'}
          </button>
        </div>
      </div>
    </div>
  )
}
