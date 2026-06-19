import { useState, useEffect, useCallback, useRef } from 'react'
import {
  MdAttachMoney, MdAdd, MdClose, MdDelete,
  MdPieChart, MdCalendarToday, MdRefresh,
  MdTrendingDown, MdReceiptLong, MdCategory,
  MdExpandMore, MdExpandLess, MdStorefront,
} from 'react-icons/md'
import { useApp } from '@/context/AppContext'
import styles from '@/styles/Expenses.module.css'

const CATEGORIES = [
  { value: 'rent',        label: 'Rent',          emoji: '🏠' },
  { value: 'utilities',   label: 'Utilities',      emoji: '💡' },
  { value: 'wages',       label: 'Wages',          emoji: '👷' },
  { value: 'supplies',    label: 'Supplies',       emoji: '🛒' },
  { value: 'transport',   label: 'Transport',      emoji: '🚗' },
  { value: 'maintenance', label: 'Maintenance',    emoji: '🔧' },
  { value: 'marketing',   label: 'Marketing',      emoji: '📢' },
  { value: 'taxes',       label: 'Taxes & Levies', emoji: '📋' },
  { value: 'other',       label: 'Other',          emoji: '📎' },
]

const CAT_MAP_DISPLAY = {
  ...Object.fromEntries([
    { value: 'rent',        label: 'Rent',          emoji: '🏠' },
    { value: 'utilities',   label: 'Utilities',      emoji: '💡' },
    { value: 'wages',       label: 'Wages',          emoji: '👷' },
    { value: 'supplies',    label: 'Supplies',       emoji: '🛒' },
    { value: 'transport',   label: 'Transport',      emoji: '🚗' },
    { value: 'maintenance', label: 'Maintenance',    emoji: '🔧' },
    { value: 'marketing',   label: 'Marketing',      emoji: '📢' },
    { value: 'taxes',       label: 'Taxes & Levies', emoji: '📋' },
    { value: 'other',       label: 'Other',          emoji: '📎' },
    { value: 'petty_cash',  label: 'Petty Cash',     emoji: '💵' },
  ].map(c => [c.value, c])),
}

const CAT_MAP = CAT_MAP_DISPLAY

const BAR_COLORS = [
  'var(--primary)', '#10B981', '#F59E0B', '#EF4444',
  '#8B5CF6', '#06B6D4', '#F97316', '#EC4899',
  '#84CC16', '#6B7280',
]

const TODAY_EAT = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString().split('T')[0]

export default function Expenses() {
  const {
    fetchExpenses, fetchExpenseSummary, logExpense, deleteExpense,
    currentUser, isOwner, isManager, stores,
  } = useApp()

  const [expenses,      setExpenses]      = useState([])
  const [summary,       setSummary]       = useState([])
  const [grandTotal,    setGrandTotal]    = useState(0)
  const [filterDate,    setFilterDate]    = useState(TODAY_EAT)
  const [filterCat,     setFilterCat]     = useState('')
  const [filterStore,   setFilterStore]   = useState('')   // owner view filter
  const [loading,       setLoading]       = useState(true)
  const [showModal,     setShowModal]     = useState(false)
  const [confirmId,     setConfirmId]     = useState(null)
  const [showBreakdown, setShowBreakdown] = useState(false)
  const [toast,         setToast]         = useState(null)

  // owners: null = all stores (unless they pick one); non-owners: always their store
  const effectiveStore = isOwner
    ? (filterStore || null)
    : (currentUser?.store || null)

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  const loadRef = useRef(null)

  const load = useCallback(async () => {
    setLoading(true)
    const filters = {}
    if (effectiveStore) filters.store    = effectiveStore
    if (filterDate)     filters.date     = filterDate
    if (filterCat)      filters.category = filterCat

    const sumFilters = {}
    if (effectiveStore) sumFilters.store = effectiveStore
    if (filterDate)     sumFilters.date  = filterDate

    const [expData, sumData] = await Promise.all([
      fetchExpenses(filters),
      fetchExpenseSummary(sumFilters),
    ])
    setExpenses(expData)
    setSummary(sumData.summary || [])
    setGrandTotal(sumData.grandTotal || 0)
    setLoading(false)
  }, [fetchExpenses, fetchExpenseSummary, effectiveStore, filterDate, filterCat])

  loadRef.current = load

  useEffect(() => {
    loadRef.current()
  }, [effectiveStore, filterDate, filterCat, fetchExpenses, fetchExpenseSummary])

  const handleDelete = async (id) => {
    const res = await deleteExpense(id)
    if (res.success) {
      showToast(res.warning ? res.warning : 'Expense removed — petty cash balance restored', res.warning ? 'warning' : 'success')
      load()
    } else {
      showToast(res.message || 'Failed to delete', 'error')
    }
    setConfirmId(null)
  }

  const maxCat = summary.reduce((m, c) => Math.max(m, c.total), 0)

  const grouped = expenses.reduce((acc, exp) => {
    const key = exp.date || 'Unknown'
    if (!acc[key]) acc[key] = []
    acc[key].push(exp)
    return acc
  }, {})
  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a))

  return (
    <div className={styles.page}>

      {toast && (
        <div style={{
          position: 'fixed', top: 20, right: 20, zIndex: 9999,
          padding: '10px 18px', borderRadius: 'var(--radius-md)',
          background: toast.type === 'error' ? 'var(--danger)' : toast.type === 'warning' ? 'var(--warning-dark)' : 'var(--success)',
          color: 'white', fontWeight: 700, fontSize: 13,
          boxShadow: 'var(--shadow-dropdown)',
        }}>
          {toast.msg}
        </div>
      )}

      {/* ── Header ── */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h1><MdAttachMoney style={{ color: 'var(--danger)' }} /> Expenses</h1>
          <p>Track daily business expenses and view category breakdowns</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className={styles.btnSecondary} onClick={load} disabled={loading}>
            <MdRefresh style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            {loading ? 'Loading...' : 'Refresh'}
          </button>
          <button className={styles.btnPrimary} onClick={() => setShowModal(true)}>
            <MdAdd /> Log Expense
          </button>
        </div>
      </div>

      {/* ── Filters ── */}
      <div className={styles.filtersBar}>

        {/* Owner: store filter for viewing */}
        {isOwner && stores.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <MdStorefront style={{ color: 'var(--primary)', fontSize: 16, flexShrink: 0 }} />
            <select
              className={styles.filterSelect}
              value={filterStore}
              onChange={e => setFilterStore(e.target.value)}
            >
              <option value=''>All Stores</option>
              {stores.map(s => <option key={s._id} value={s.name}>{s.name}</option>)}
            </select>
          </div>
        )}

        <input
          type='date'
          value={filterDate}
          onChange={e => setFilterDate(e.target.value)}
          className={styles.filterSelect}
        />
        <select className={styles.filterSelect} value={filterCat} onChange={e => setFilterCat(e.target.value)}>
          <option value=''>All Categories</option>
          {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.emoji} {c.label}</option>)}
        </select>
        {filterDate && (
          <button className={styles.btnSecondary} onClick={() => setFilterDate('')}>
            <MdCalendarToday /> All Dates
          </button>
        )}
        {(filterDate || filterCat || filterStore) && (
          <button className={styles.btnSecondary} onClick={() => { setFilterDate(TODAY_EAT); setFilterCat(''); setFilterStore('') }}>
            Reset
          </button>
        )}
      </div>

      {/* ── Fixed content above table ── */}
      <div className={styles.content}>

        {/* Summary cards */}
        <div className={styles.summaryRow}>
          <div className={`${styles.summaryCard} ${styles.summaryDanger}`}>
            <div className={styles.summaryIconWrap} style={{ background: '#fee2e2' }}>
              <MdTrendingDown style={{ color: 'var(--danger)', fontSize: 20 }} />
            </div>
            <div>
              <div className={styles.label}>Total Expenses</div>
              <div className={styles.value} style={{ color: 'var(--danger)' }}>KSh {grandTotal.toLocaleString()}</div>
              {filterDate && <div className={styles.summaryMeta}>{filterDate}</div>}
            </div>
          </div>

          <div className={`${styles.summaryCard} ${styles.summaryBlue}`}>
            <div className={styles.summaryIconWrap} style={{ background: '#dbeafe' }}>
              <MdReceiptLong style={{ color: 'var(--primary)', fontSize: 20 }} />
            </div>
            <div>
              <div className={styles.label}>Transactions</div>
              <div className={styles.value}>{expenses.length}</div>
              <div className={styles.summaryMeta}>{expenses.length === 0 ? 'None recorded' : `${expenses.length} expense${expenses.length !== 1 ? 's' : ''}`}</div>
            </div>
          </div>

          <div className={`${styles.summaryCard} ${styles.summaryPurple}`}>
            <div className={styles.summaryIconWrap} style={{ background: '#ede9fe' }}>
              <MdCategory style={{ color: '#7c3aed', fontSize: 20 }} />
            </div>
            <div>
              <div className={styles.label}>Categories Used</div>
              <div className={styles.value}>{summary.length}</div>
              <div className={styles.summaryMeta}>{summary.length === 0 ? 'None' : `of ${CATEGORIES.length} categories`}</div>
            </div>
          </div>

          {summary[0] && (
            <div className={`${styles.summaryCard} ${styles.summaryOrange}`}>
              <div className={styles.summaryIconWrap} style={{ background: '#ffedd5' }}>
                <span style={{ fontSize: 20 }}>{CAT_MAP[summary[0]._id]?.emoji || '📊'}</span>
              </div>
              <div>
                <div className={styles.label}>Highest Category</div>
                <div className={styles.value} style={{ fontSize: 14, color: '#ea580c' }}>{CAT_MAP[summary[0]._id]?.label || summary[0]._id}</div>
                <div className={styles.summaryMeta}>KSh {summary[0].total.toLocaleString()}</div>
              </div>
            </div>
          )}
        </div>

        {/* Category breakdown (collapsible) */}
        {summary.length > 0 && (
          <div className={styles.breakdown}>
            <div
              className={styles.breakdownHeader}
              onClick={() => setShowBreakdown(v => !v)}
              role="button" tabIndex={0}
              onKeyDown={e => e.key === 'Enter' && setShowBreakdown(v => !v)}
            >
              <h2><MdPieChart style={{ color: 'var(--primary)' }} /> Category Breakdown</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>
                  {summary.length} categor{summary.length !== 1 ? 'ies' : 'y'}
                </span>
                {showBreakdown
                  ? <MdExpandLess style={{ color: 'var(--text-muted)', fontSize: 20 }} />
                  : <MdExpandMore style={{ color: 'var(--text-muted)', fontSize: 20 }} />}
              </div>
            </div>
            {showBreakdown && (
              <div className={styles.breakdownBody}>
                {summary.map((cat, i) => {
                  const pct      = maxCat    ? Math.round((cat.total / maxCat)    * 100) : 0
                  const grandPct = grandTotal ? Math.round((cat.total / grandTotal) * 100) : 0
                  return (
                    <div key={cat._id} className={styles.catRow}>
                      <div className={styles.catLabel}>
                        <span>{CAT_MAP[cat._id]?.emoji}</span>
                        {CAT_MAP[cat._id]?.label || cat._id}
                      </div>
                      <div className={styles.catBarWrap}>
                        <div className={styles.catBar}>
                          <div className={styles.catFill} style={{ width: `${pct}%`, background: BAR_COLORS[i % BAR_COLORS.length] }} />
                        </div>
                        <span className={styles.catPct}>{grandPct}%</span>
                      </div>
                      <div className={styles.catAmount}>KSh {cat.total.toLocaleString()}</div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Scrollable table area ── */}
        <div className={styles.tableWrap}>
          {loading ? (
            <div className={styles.empty}>
              <MdRefresh style={{ fontSize: 32, opacity: 0.3, animation: 'spin 1s linear infinite' }} />
              <p>Loading expenses...</p>
            </div>
          ) : expenses.length === 0 ? (
            <div className={styles.empty}>
              <div className={styles.emptyIcon}>💸</div>
              <p>No expenses recorded{filterDate ? ` for ${filterDate}` : ''}.</p>
              <button className={styles.btnPrimary} style={{ marginTop: 12 }} onClick={() => setShowModal(true)}>
                <MdAdd /> Log First Expense
              </button>
            </div>
          ) : filterDate ? (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Category</th>
                  <th>Description</th>
                  <th>Recorded By</th>
                  {isOwner && <th>Store</th>}
                  <th>Amount</th>
                  {(isOwner || isManager) && <th style={{ textAlign: 'center' }}>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {expenses.map(exp => (
                  <ExpenseRow
                    key={exp._id} exp={exp}
                    canDelete={isOwner || isManager}
                    showStore={isOwner}
                    confirmId={confirmId}
                    setConfirmId={setConfirmId}
                    handleDelete={handleDelete}
                  />
                ))}
              </tbody>
            </table>
          ) : (
            sortedDates.map(date => (
              <div key={date} className={styles.dateGroup}>
                <div className={styles.dateGroupHeader}>
                  <span>📅 {date}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>
                    {grouped[date].length} expense{grouped[date].length !== 1 ? 's' : ''} ·
                    KSh {grouped[date].reduce((s, e) => s + e.amount, 0).toLocaleString()}
                  </span>
                </div>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Category</th>
                      <th>Description</th>
                      <th>Recorded By</th>
                      {isOwner && <th>Store</th>}
                      <th>Amount</th>
                      {(isOwner || isManager) && <th style={{ textAlign: 'center' }}>Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {grouped[date].map(exp => (
                      <ExpenseRow
                        key={exp._id} exp={exp}
                        canDelete={isOwner || isManager}
                        showStore={isOwner}
                        confirmId={confirmId}
                        setConfirmId={setConfirmId}
                        handleDelete={handleDelete}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            ))
          )}
        </div>
      </div>

      {showModal && (
        <LogExpenseModal
          store={currentUser?.store || ''}
          isOwner={isOwner}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); load(); showToast('Expense logged') }}
          logExpense={logExpense}
        />
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

// ── Expense table row ─────────────────────────────────────────────────
function ExpenseRow({ exp, canDelete, showStore, confirmId, setConfirmId, handleDelete }) {
  return (
    <tr>
      <td style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
        <div>{exp.date}</div>
        <div>{exp.time}</div>
      </td>
      <td>
        <span className={styles.catBadge}>
          {CAT_MAP[exp.category]?.emoji} {CAT_MAP[exp.category]?.label || exp.category}
        </span>
        {exp.fromPettyCash && (
          <span style={{ display: 'block', marginTop: 3, fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', background: 'var(--bg-muted)', padding: '1px 6px', borderRadius: 6, width: 'fit-content' }}>
            💵 via petty cash
          </span>
        )}
      </td>
      <td style={{ color: 'var(--text-primary)', maxWidth: 200 }}>
        {exp.description || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>No description</span>}
      </td>
      <td style={{ fontSize: 12 }}>{exp.recordedBy}</td>
      {showStore && (
        <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{exp.store || '—'}</td>
      )}
      <td>
        <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--danger)' }}>
          KSh {exp.amount.toLocaleString()}
        </div>
      </td>
      {canDelete && (
        <td style={{ textAlign: 'center' }}>
          {confirmId === exp._id ? (
            <div style={{ display: 'flex', gap: 6, justifyContent: 'center', alignItems: 'center' }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--danger-dark)' }}>Delete?</span>
              <button onClick={() => setConfirmId(null)} className={styles.btnSecondary} style={{ padding: '2px 8px', height: 26, fontSize: 11 }}>No</button>
              <button onClick={() => handleDelete(exp._id)} style={{ padding: '2px 8px', height: 26, fontSize: 11, border: 'none', borderRadius: 'var(--radius-sm)', background: 'var(--danger)', color: 'white', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Yes</button>
            </div>
          ) : (
            <button className={`${styles.iconBtn} ${styles.danger}`} onClick={() => setConfirmId(exp._id)} title='Remove expense'>
              <MdDelete size={15} />
            </button>
          )}
        </td>
      )}
    </tr>
  )
}

// ── Log Expense Modal ─────────────────────────────────────────────────
function LogExpenseModal({ store, isOwner, onClose, onSaved, logExpense }) {
  const { stores } = useApp()
  const [amount,        setAmount]        = useState('')
  const [category,      setCategory]      = useState('other')
  const [description,   setDescription]   = useState('')
  const [selectedStore, setSelectedStore] = useState(store || '')
  const [saving,        setSaving]        = useState(false)
  const [error,         setError]         = useState('')

  const handleSave = async () => {
    setError('')
    if (!amount || Number(amount) <= 0) { setError('Enter a valid amount.'); return }
    if (isOwner && !selectedStore)      { setError('Select a store.'); return }
    setSaving(true)
    const res = await logExpense({
      amount: Number(amount),
      category,
      description,
      store: isOwner ? selectedStore : store,
    })
    setSaving(false)
    if (res.success) onSaved()
    else setError(res.message || 'Failed to log expense')
  }

  const selectedCat = CAT_MAP[category]

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <h2>Log New Expense</h2>
          <button className={styles.modalClose} onClick={onClose}><MdClose /></button>
        </div>
        <div className={styles.modalBody}>

          {/* Owner must pick which store this expense is for */}
          {isOwner && (
            <div className={styles.formGroup}>
              <label>Store *</label>
              <select value={selectedStore} onChange={e => setSelectedStore(e.target.value)}>
                <option value=''>— Select store —</option>
                {stores.map(s => <option key={s._id} value={s.name}>{s.name}</option>)}
              </select>
            </div>
          )}

          <div className={styles.formGroup}>
            <label>Category</label>
            <select value={category} onChange={e => setCategory(e.target.value)}>
              {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.emoji} {c.label}</option>)}
            </select>
          </div>

          <div className={styles.formGroup}>
            <label>Amount (KSh)</label>
            <input
              type='number' min={0} step='0.01'
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder='0.00'
              autoFocus={!isOwner}
            />
          </div>

          <div className={styles.formGroup}>
            <label>Description (optional)</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder={`What was this ${selectedCat?.label?.toLowerCase()} expense for?`}
            />
          </div>

          {Number(amount) > 0 && (
            <div style={{
              padding: '12px 14px', background: 'var(--danger-light)',
              border: '1px solid #fecaca', borderRadius: 'var(--radius-md)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--danger-dark)', textTransform: 'uppercase' }}>
                  {selectedCat?.emoji} {selectedCat?.label}
                  {(isOwner ? selectedStore : store) && (
                    <span style={{ marginLeft: 8, opacity: 0.7 }}>· {isOwner ? selectedStore : store}</span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: 'var(--danger-dark)', marginTop: 2 }}>
                  {description || 'No description'}
                </div>
              </div>
              <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--danger)' }}>
                KSh {Number(amount).toLocaleString()}
              </div>
            </div>
          )}

          {error && (
            <div style={{ marginTop: 12, padding: '10px 14px', background: 'var(--danger-light)', borderRadius: 'var(--radius-md)', color: 'var(--danger-dark)', fontSize: 13, fontWeight: 600 }}>
              {error}
            </div>
          )}
        </div>
        <div className={styles.modalFooter}>
          <button className={styles.btnSecondary} onClick={onClose}>Cancel</button>
          <button className={styles.btnPrimary} onClick={handleSave} disabled={saving || !amount}>
            {saving ? 'Saving...' : 'Log Expense'}
          </button>
        </div>
      </div>
    </div>
  )
}
