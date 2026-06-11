import { useState, useEffect, useCallback } from 'react'
import {
  MdPhone, MdCheckCircle, MdRefresh, MdMoneyOff,
  MdBlock, MdWarning, MdCalendarToday, MdCreditCard,
  MdTrendingDown, MdFilterList, MdExpandMore, MdExpandLess
} from 'react-icons/md'
import { useApp } from '@/context/AppContext'
import s from '@/styles/MyCredits.module.css'

// ── Helpers ───────────────────────────────────────────────────────────
function daysUntil(dateStr) {
  if (!dateStr) return null
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const promise = new Date(dateStr + 'T00:00:00')
  return Math.ceil((promise - today) / (1000 * 60 * 60 * 24))
}

function formatDate(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-KE', {
    day: 'numeric', month: 'short', year: 'numeric'
  })
}

function PromiseBadge({ promiseDate, balance }) {
  if (balance === 0) return (
    <span className={`${s.promiseBadge} ${s.settled}`}>
      <MdCheckCircle style={{ fontSize: '12px' }} /> SETTLED
    </span>
  )
  const days = daysUntil(promiseDate)
  if (days === null) return null
  if (days < 0)  return <span className={`${s.promiseBadge} ${s.overdue}`}><MdWarning style={{ fontSize: '12px' }} /> {Math.abs(days)} DAYS OVERDUE</span>
  if (days === 0) return <span className={`${s.promiseBadge} ${s.dueToday}`}><MdWarning style={{ fontSize: '12px' }} /> DUE TODAY</span>
  if (days <= 3)  return <span className={`${s.promiseBadge} ${s.soon}`}><MdCalendarToday style={{ fontSize: '12px' }} /> {days} DAYS LEFT</span>
  return <span className={`${s.promiseBadge} ${s.ok}`}><MdCalendarToday style={{ fontSize: '12px' }} /> {days} DAYS LEFT</span>
}

const FILTERS = ['all', 'active', 'overdue', 'settled']

export default function MyCredits() {
  const { currentUser, recordRepayment } = useApp()
  const [sales, setSales]               = useState([])
  const [loading, setLoading]           = useState(true)
  const [filter, setFilter]             = useState('all')
  const [expanded, setExpanded]         = useState(new Set())
  const [repaying, setRepaying]         = useState(null)
  const [repayAmt, setRepayAmt]         = useState('')
  const [repayNotes, setRepayNotes]     = useState('')
  const [repayError, setRepayError]     = useState('')
  const [repayLoading, setRepayLoading] = useState(false)
  const [toast, setToast]               = useState(null)

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  const toggleExpand = (id) => {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const token = currentUser?.token
      const id    = currentUser?._id || currentUser?.id
      if (!token || !id) return
      const res  = await fetch(`http://localhost:5000/api/customers/cashier/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (!res.ok) throw new Error('Failed')
      const data = await res.json()
      setSales(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('MyCredits load error:', err)
      setSales([])
    }
    setLoading(false)
  }, [currentUser])

  useEffect(() => { load() }, [load])

  const handleRepay = async () => {
    const amt = Number(repayAmt)
    if (!amt || amt <= 0) return setRepayError('Enter a valid amount')
    if (amt > repaying.balance) return setRepayError(`Max is KSh ${repaying.balance.toLocaleString()}`)
    setRepayError('')
    setRepayLoading(true)
    const res = await recordRepayment(repaying.customerId, amt, repayNotes)
    setRepayLoading(false)
    if (res.success) {
      setRepaying(null)
      setRepayAmt('')
      setRepayNotes('')
      showToast(`KSh ${amt.toLocaleString()} recorded for ${repaying.name}`)
      load()
    } else {
      setRepayError(res.message || 'Failed to record')
    }
  }

  const totalOwed     = sales.reduce((sum, sale) => sum + (sale.balance || 0), 0)
  const totalOriginal = sales.reduce((sum, sale) => sum + (sale.paymentInfo?.finalTotal || sale.total || 0), 0)
  const overdueCount  = sales.filter(s => { const d = daysUntil(s.paymentInfo?.promiseDate); return d !== null && d < 0 && s.balance > 0 }).length
  const settledCount  = sales.filter(s => s.balance === 0).length
  const activeCount   = sales.filter(s => { const d = daysUntil(s.paymentInfo?.promiseDate); return s.balance > 0 && (d === null || d >= 0) }).length
  const recoveredAmt  = totalOriginal - totalOwed

  const filtered = sales.filter(sale => {
    if (filter === 'all')     return true
    if (filter === 'settled') return sale.balance === 0
    if (filter === 'overdue') {
      const d = daysUntil(sale.paymentInfo?.promiseDate)
      return d !== null && d < 0 && sale.balance > 0
    }
    if (filter === 'active') {
      const d = daysUntil(sale.paymentInfo?.promiseDate)
      return sale.balance > 0 && (d === null || d >= 0)
    }
    return true
  })

  const filterCounts = {
    all:     sales.length,
    active:  activeCount,
    overdue: overdueCount,
    settled: settledCount,
  }

  return (
    <div className={s.page}>

      {toast && <div className={`${s.toast} ${s[toast.type]}`}>{toast.msg}</div>}

      {/* ── Page Header ── */}
      <div className={s.pageHeader}>
        <div className={s.pageTitleRow}>
          <div>
            <h1 className={s.pageTitle}>
              <MdCreditCard style={{ fontSize: '24px', verticalAlign: 'middle', marginRight: '8px', color: 'var(--primary)' }} />
              My Credit Sales
            </h1>
            <p className={s.pageSubtitle}>Credit sales you have made and their repayment status</p>
          </div>
          <button className={s.refreshBtn} onClick={load} disabled={loading}>
            <MdRefresh className={loading ? s.spinning : ''} />
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* ── Summary Bar ── */}
      <div className={s.summaryGrid}>
        <div className={`${s.summaryCard} ${s.blue}`}>
          <div className={s.summaryIcon} style={{ background: '#dbeafe' }}>
            <MdTrendingDown style={{ color: 'var(--primary)', fontSize: '20px' }} />
          </div>
          <div>
            <div className={s.summaryLabel}>Total Outstanding</div>
            <div className={s.summaryValue}>KSh {totalOwed.toLocaleString()}</div>
            {totalOriginal > 0 && (
              <div className={s.summarySubtext}>of KSh {totalOriginal.toLocaleString()} credited</div>
            )}
          </div>
        </div>

        <div className={`${s.summaryCard} ${s.red}`}>
          <div className={s.summaryIcon} style={{ background: '#fee2e2' }}>
            <MdWarning style={{ color: '#dc2626', fontSize: '20px' }} />
          </div>
          <div>
            <div className={s.summaryLabel}>Overdue</div>
            <div className={s.summaryValue}>{overdueCount}</div>
            <div className={s.summarySubtext}>
              {overdueCount === 0 ? 'None overdue' : `ticket${overdueCount !== 1 ? 's' : ''} past due date`}
            </div>
          </div>
        </div>

        <div className={`${s.summaryCard} ${s.green}`}>
          <div className={s.summaryIcon} style={{ background: '#dcfce7' }}>
            <MdCheckCircle style={{ color: 'var(--success-dark)', fontSize: '20px' }} />
          </div>
          <div>
            <div className={s.summaryLabel}>Settled</div>
            <div className={s.summaryValue}>{settledCount}</div>
            <div className={s.summarySubtext}>
              {settledCount === 0 ? 'None settled yet' : `ticket${settledCount !== 1 ? 's' : ''} fully paid`}
            </div>
          </div>
        </div>

        <div className={`${s.summaryCard} ${s.orange}`}>
          <div className={s.summaryIcon} style={{ background: '#ffedd5' }}>
            <MdCreditCard style={{ color: '#ea580c', fontSize: '20px' }} />
          </div>
          <div>
            <div className={s.summaryLabel}>Recovered</div>
            <div className={s.summaryValue}>KSh {recoveredAmt.toLocaleString()}</div>
            <div className={s.summarySubtext}>
              {totalOriginal > 0
                ? `${Math.round((recoveredAmt / totalOriginal) * 100)}% of total credited`
                : 'No sales yet'}
            </div>
          </div>
        </div>
      </div>

      {/* ── Recovery Progress Bar ── */}
      {totalOriginal > 0 && (
        <div className={s.recoveryBar}>
          <div className={s.recoveryBarLabel}>
            <span>Recovery Progress</span>
            <span style={{ color: 'var(--success-dark)', fontWeight: 700 }}>
              {Math.round((recoveredAmt / totalOriginal) * 100)}%
            </span>
          </div>
          <div className={s.recoveryTrack}>
            <div
              className={s.recoveryFill}
              style={{ width: `${Math.round((recoveredAmt / totalOriginal) * 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* ── Filter Tabs ── */}
      <div className={s.filterRow}>
        <MdFilterList style={{ color: 'var(--text-muted)', fontSize: '18px', flexShrink: 0 }} />
        {FILTERS.map(f => (
          <button
            key={f}
            className={`${s.filterTab} ${filter === f ? s.filterActive : ''} ${f === 'overdue' && overdueCount > 0 ? s.filterOverduePulse : ''}`}
            onClick={() => setFilter(f)}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
            <span className={`${s.filterBadge} ${filter === f ? s.filterBadgeActive : ''}`}>
              {filterCounts[f]}
            </span>
          </button>
        ))}

        {/* Expand / collapse all */}
        {filtered.length > 0 && (
          <button
            className={s.expandAllBtn}
            onClick={() => {
              if (expanded.size === filtered.length) {
                setExpanded(new Set())
              } else {
                setExpanded(new Set(filtered.map(sale => sale._id)))
              }
            }}
          >
            {expanded.size === filtered.length
              ? <MdExpandLess style={{ fontSize: '16px' }} />
              : <MdExpandMore style={{ fontSize: '16px' }} />}
            {expanded.size === filtered.length ? 'Collapse all' : 'Expand all'}
          </button>
        )}
      </div>

      {/* ── Content ── */}
      {loading ? (
        <div className={s.loadingState}>
          <MdRefresh className={s.spinning} style={{ fontSize: '32px', marginBottom: '12px', color: 'var(--primary)' }} />
          Loading your credit sales...
        </div>
      ) : filtered.length === 0 ? (
        <div className={s.emptyState}>
          <MdMoneyOff className={s.emptyIcon} />
          <div className={s.emptyTitle}>
            {filter === 'all' ? 'No credit sales yet' : `No ${filter} sales`}
          </div>
          <div className={s.emptyDesc}>
            {filter === 'all'
              ? 'Your credit sales will appear here once made.'
              : `You have no ${filter} credit sales right now.`}
          </div>
        </div>
      ) : (
        <div className={s.list}>
          {filtered.map(sale => {
            const days      = daysUntil(sale.paymentInfo?.promiseDate)
            const isOverdue = days !== null && days < 0 && sale.balance > 0
            const isSettled = sale.balance === 0
            const cardClass = isSettled ? s.cardSettled : isOverdue ? s.cardOverdue : s.cardActive
            const owesClass = isOverdue ? s.overdue : s.warning
            const saleTotal = sale.paymentInfo?.finalTotal || sale.total || 0
            const paidAmt   = saleTotal - (sale.balance || 0)
            const paidPct   = saleTotal > 0 ? Math.round((paidAmt / saleTotal) * 100) : 0
            const isOpen    = expanded.has(sale._id)

            return (
              <div key={sale._id} className={`${s.saleCard} ${cardClass} ${isOpen ? s.saleCardOpen : ''}`}>

                {/* ── Snapshot row (always visible, click to expand) ── */}
                <div
                  className={s.snapshot}
                  onClick={() => toggleExpand(sale._id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => e.key === 'Enter' && toggleExpand(sale._id)}
                >
                  <div className={s.snapshotLeft}>
                    <div className={s.customerAvatar}>
                      {(sale.customer?.name || sale.paymentInfo?.customerName || '?')[0].toUpperCase()}
                    </div>
                    <div className={s.snapshotInfo}>
                      <div className={s.customerName}>
                        {sale.customer?.name || sale.paymentInfo?.customerName}
                      </div>
                      {(sale.customer?.phone || sale.paymentInfo?.customerPhone) && (
                        <div className={s.customerPhone}>
                          <MdPhone style={{ fontSize: '12px' }} />
                          {sale.customer?.phone || sale.paymentInfo?.customerPhone}
                        </div>
                      )}
                    </div>
                    <PromiseBadge
                      promiseDate={sale.paymentInfo?.promiseDate}
                      balance={sale.balance}
                    />
                  </div>

                  <div className={s.snapshotRight}>
                    <div className={s.saleRight}>
                      {!isSettled ? (
                        <>
                          <div className={s.owesLabel}>Still owes</div>
                          <div className={`${s.owesValue} ${owesClass}`}>
                            KSh {sale.balance?.toLocaleString()}
                          </div>
                          <div className={s.amountSub}>of KSh {saleTotal.toLocaleString()}</div>
                        </>
                      ) : (
                        <div className={s.settledAmtBadge}>✓ Fully Paid</div>
                      )}
                    </div>
                    <div className={s.chevron}>
                      {isOpen
                        ? <MdExpandLess style={{ fontSize: '20px', color: 'var(--text-muted)' }} />
                        : <MdExpandMore style={{ fontSize: '20px', color: 'var(--text-muted)' }} />
                      }
                    </div>
                  </div>
                </div>

                {/* ── Thin progress bar always visible ── */}
                {!isSettled && saleTotal > 0 && (
                  <div className={s.progressSection}>
                    <div className={s.progressTrack}>
                      <div
                        className={`${s.progressFill} ${isOverdue ? s.progressOverdue : ''}`}
                        style={{ width: `${paidPct}%` }}
                      />
                    </div>
                    <div className={s.progressHint}>{paidPct}% paid</div>
                  </div>
                )}

                {/* ── Expanded detail ── */}
                {isOpen && (
                  <div className={s.expandedBody}>

                    {sale.customer?.blacklisted && (
                      <div className={s.blacklistWarning}>
                        <MdBlock style={{ fontSize: '13px' }} />
                        Blacklisted customer
                        {sale.customer.blacklistReason && ` — ${sale.customer.blacklistReason}`}
                      </div>
                    )}

                    {!isSettled && paidAmt > 0 && (
                      <div className={s.paidDetail}>
                        <span>KSh {paidAmt.toLocaleString()} already paid</span>
                        <span style={{ color: 'var(--success-dark)', fontWeight: 700 }}>{paidPct}%</span>
                      </div>
                    )}

                    <div className={s.metaDates}>
                      <span className={s.metaItem}>📅 Sale: {formatDate(sale.date)}</span>
                      <span className={s.metaItem}>🗓️ Promise: {formatDate(sale.paymentInfo?.promiseDate)}</span>
                    </div>

                    <div className={s.itemTags}>
                      {sale.items?.map((item, i) => (
                        <span key={i} className={s.itemTag}>
                          {item.qty}× {item.productId?.name || 'Product'}
                        </span>
                      ))}
                      <span className={s.receiptRef}>#{sale.receiptId}</span>
                    </div>

                    <div className={s.cardFooter}>
                      {!isSettled ? (
                        <button
                          className={`${s.recordBtn} ${isOverdue ? s.recordBtnOverdue : ''}`}
                          onClick={e => {
                            e.stopPropagation()
                            setRepaying({
                              saleId:     sale._id,
                              customerId: sale.customer?._id || sale.paymentInfo?.customerId,
                              balance:    sale.balance,
                              name:       sale.customer?.name || sale.paymentInfo?.customerName,
                            })
                            setRepayAmt('')
                            setRepayNotes('')
                            setRepayError('')
                          }}
                        >
                          💰 Record Payment
                        </button>
                      ) : (
                        <div className={s.settledTag}>
                          <MdCheckCircle /> Fully settled
                        </div>
                      )}
                    </div>
                  </div>
                )}

              </div>
            )
          })}
        </div>
      )}

      {/* ── Repayment Modal ── */}
      {repaying && (
        <div className={s.overlay}>
          <div className={s.modal}>
            <div className={s.modalTitle}>Record Payment</div>
            <div className={s.modalSubtitle}>
              {repaying.name} — owes KSh {repaying.balance?.toLocaleString()}
            </div>

            <div className={s.warningBox}>
              <div className={s.warningText}>
                ⚠️ You made this credit sale. If this customer does not pay and you continue
                recording sales for them, you may be held responsible.
              </div>
            </div>

            <label className={s.formLabel}>Amount (KSh) *</label>
            <input
              type="number" min="1" max={repaying.balance}
              placeholder={`Max KSh ${repaying.balance?.toLocaleString()}`}
              value={repayAmt}
              onChange={e => { setRepayAmt(e.target.value); setRepayError('') }}
              autoFocus
              className={`${s.formInput} ${repayError ? s.error : ''}`}
            />
            {repayError && <div className={s.errorMsg}>{repayError}</div>}

            <div className={s.quickAmounts}>
              {[500, 1000, 2000].filter(a => a <= repaying.balance).map(a => (
                <button key={a} onClick={() => setRepayAmt(String(a))}
                  className={`${s.quickAmt} ${Number(repayAmt) === a ? s.active : ''}`}>
                  {a.toLocaleString()}
                </button>
              ))}
              <button onClick={() => setRepayAmt(String(repaying.balance))}
                className={`${s.quickAmtFull} ${Number(repayAmt) === repaying.balance ? s.active : ''}`}>
                Full {repaying.balance?.toLocaleString()}
              </button>
            </div>

            <label className={s.formLabel}>Notes (optional)</label>
            <input
              type="text" placeholder="e.g. Cash, M-Pesa, partial..."
              value={repayNotes} onChange={e => setRepayNotes(e.target.value)}
              className={`${s.formInput} ${s.notes}`}
            />

            <div className={s.modalFooter}>
              <button className={s.modalBtnCancel} onClick={() => setRepaying(null)}>Cancel</button>
              <button
                className={s.modalBtnConfirm}
                onClick={handleRepay}
                disabled={repayLoading || !repayAmt}
              >
                {repayLoading ? 'Recording...' : `Record KSh ${Number(repayAmt || 0).toLocaleString()}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
