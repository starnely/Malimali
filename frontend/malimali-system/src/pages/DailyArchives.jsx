import { useState, useEffect, useMemo } from 'react'
import { MdArchive, MdStorefront } from 'react-icons/md'
import { useApp } from '@/context/AppContext'
import { useHistoryModal } from '@/hooks/useHistoryModal'
import ArchiveCard from '@/components/cards/ArchiveCard'
import DebtorPanel from '@/components/panels/DebtorPanel'
import { buildLiveSummary } from '@/utils/utils'

export default function DailyArchives() {
  const { sales, products, today, isOwner, currentUser, stores } = useApp()

  const [selectedStore, setSelectedStore] = useState(isOwner ? 'All' : currentUser?.store)
  const [expanded,      setExpanded]      = useState(null)
  const [search,        setSearch]        = useState('')
  const [showDebtorPanel, openDebtorPanel, closeDebtorPanel] = useHistoryModal('debtor-panel')
  const [debtorDate, setDebtorDate] = useState(null)

  useEffect(() => { if (!showDebtorPanel) setDebtorDate(null) }, [showDebtorPanel])

  const todayStr = today?.slice(0, 10)

  const allSummaries = useMemo(() => {
    const filteredSalesByStore = sales.filter(s =>
      selectedStore === 'All' || s.store === selectedStore
    )
    const uniqueDates = [...new Set(
      filteredSalesByStore
        .map(s => s.date ? String(s.date).slice(0, 10) : null)
        .filter(Boolean)
    )]
    return uniqueDates
      .map(date => {
        const summary = buildLiveSummary(date, filteredSalesByStore, products)
        if (!summary) return null
        return { ...summary, isLive: date === todayStr }
      })
      .filter(Boolean)
      .sort((a, b) => b.date.localeCompare(a.date))
  }, [sales, products, todayStr, selectedStore])

  const filtered = search
    ? allSummaries.filter(a => a.date === search)
    : allSummaries

  return (
    <div className="flex flex-col min-h-full md:h-full md:overflow-hidden" style={{ background: 'var(--bg-page)' }}>
      {showDebtorPanel && (
        <DebtorPanel date={debtorDate} onClose={closeDebtorPanel} />
      )}

      {/* ── Fixed header ───────────────────────────────── */}
      <div className="flex-shrink-0 px-6 pt-6 pb-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-5">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
              <MdArchive style={{ color: 'var(--primary)', fontSize: '24px' }} />
              Daily Archives
            </h1>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
              Today shows live data · Past dates show archived snapshots from sales history
            </p>
          </div>

          {/* Store switcher */}
          {isOwner && (
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-xl transition-all"
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--primary-muted)',
                boxShadow: 'var(--shadow-card)',
              }}
            >
              <MdStorefront style={{ color: 'var(--primary)', fontSize: '18px' }} />
              <span
                className="text-xs font-bold uppercase tracking-wider hidden sm:inline"
                style={{ color: 'var(--text-muted)' }}
              >
                Branch:
              </span>
              <select
                value={selectedStore}
                onChange={e => setSelectedStore(e.target.value)}
                className="bg-transparent text-sm font-semibold outline-none cursor-pointer pr-2"
                style={{ color: 'var(--text-primary)' }}
              >
                <option value="All">✨ All Locations</option>
                {stores?.map(st => (
                  <option key={st._id} value={st.name}>📍 {st.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Date filter */}
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="px-3 py-2 rounded-lg text-sm outline-none transition-all"
            style={{
              border: '1px solid var(--border-medium)',
              background: 'var(--bg-muted)',
              color: 'var(--text-primary)',
            }}
            onFocus={e => { e.target.style.borderColor = 'var(--primary)'; e.target.style.boxShadow = '0 0 0 3px var(--primary-light)' }}
            onBlur={e  => { e.target.style.borderColor = 'var(--border-medium)'; e.target.style.boxShadow = 'none' }}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="px-3 py-2 rounded-lg text-sm font-semibold transition"
              style={{
                background: 'var(--danger-light)',
                color: 'var(--danger-dark)',
                border: '1px solid var(--danger)',
              }}
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* ── Scrollable content ──────────────────────────── */}
      <div className="md:flex-1 md:overflow-y-auto px-6 pb-6">
        {filtered.length === 0 ? (
          <div
            className="rounded-xl p-12 text-center"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-soft)', boxShadow: 'var(--shadow-card)' }}
          >
            <MdArchive className="text-5xl mx-auto mb-3" style={{ color: 'var(--border-medium)' }} />
            <div className="font-semibold text-base" style={{ color: 'var(--text-secondary)' }}>
              {search ? `No sales found for ${search}` : 'No sales data yet'}
            </div>
            <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
              {search ? 'Try a different date or clear the filter' : 'Make sales to see daily summaries here'}
            </div>
          </div>
        ) : (
          filtered.map(archive => (
            <ArchiveCard
              key={archive.date}
              archive={archive}
              isExpanded={expanded === archive.date}
              onToggle={() => setExpanded(prev => prev === archive.date ? null : archive.date)}
              onViewDebtors={() => { setDebtorDate(archive.date); openDebtorPanel() }}
            />
          ))
        )}
      </div>
    </div>
  )
}
