import { useState, useMemo } from 'react'
import { MdArchive } from 'react-icons/md'
import { useApp } from '@/context/AppContext'
import ArchiveCard from '@/components/cards/ArchiveCard'
import DebtorPanel from '@/components/panels/DebtorPanel'
import { buildLiveSummary } from '@/utils/utils'

export default function DailyArchives() {
  // 1. Update useApp to include isOwner and currentUser
  const { sales, products, today, isOwner, currentUser } = useApp()

  // 2. Define the missing state
  const [selectedStore, setSelectedStore] = useState(isOwner ? "All" : currentUser.store)

  const [expanded, setExpanded] = useState(null)
  const [search, setSearch] = useState('')
  const [debtorPanel, setDebtorPanel] = useState(null)

  const todayStr = today?.slice(0, 10)

  // ✅ Fix: build a summary for EVERY unique date found in sales
  // This is why past dates weren't showing — we were only building today's summary
  // and relying on backend archives for past days which were never saved
  const allSummaries = useMemo(() => {
    // 1. First, filter sales by the selected store
    const filteredSalesByStore = sales.filter(s =>
      selectedStore === "All" || s.store === selectedStore
    );

    // 2. Get unique dates ONLY from those filtered sales
    const uniqueDates = [...new Set(
      filteredSalesByStore
        .map(s => s.date ? String(s.date).slice(0, 10) : null)
        .filter(Boolean)
    )];

    // 3. Build summaries using the filtered list
    return uniqueDates
      .map(date => {
        const summary = buildLiveSummary(date, filteredSalesByStore, products);
        if (!summary) return null;
        return { ...summary, isLive: date === todayStr };
      })
      .filter(Boolean)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [sales, products, todayStr, selectedStore]);

  // Apply date filter
  const filtered = search
    ? allSummaries.filter(a => a.date === search)
    : allSummaries

  return (
    <div className="p-6 bg-gray-100 min-h-screen">
      {debtorPanel && (
        <DebtorPanel date={debtorPanel} onClose={() => setDebtorPanel(null)} />
      )}

      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-xl font-bold flex items-center gap-2 text-gray-800">
          <MdArchive className="text-blue-700 text-2xl" /> Daily Archives
        </h1>

        {/* Add the Store Switcher here */}
        {isOwner && (
          <select
            value={selectedStore}
            onChange={(e) => setSelectedStore(e.target.value)}
            className="p-2 border border-gray-300 rounded-lg text-xs bg-white shadow-sm outline-none"
          >
            <option value="All">All Locations</option>
            <option value="Store One">Store One</option>
            <option value="Store Two">Store Two</option>
            <option value="Headquarters">Headquarters</option>
          </select>
        )}
        
        <p className="text-sm text-gray-500">
          Today shows live data · Past dates show archived snapshots from sales history
        </p>
      </div>

      {/* Date filter */}
      <div className="flex items-center gap-2 mb-4">
        <input
          type="date"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-md text-sm
                     focus:ring-2 focus:ring-blue-500 hover:border-blue-500 transition-colors"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="px-3 py-2 rounded-md text-sm bg-red-100 text-red-700
                       border border-red-400 hover:bg-red-200 transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {/* Empty state */}
      {filtered.length === 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-12 text-center shadow">
          <MdArchive className="text-5xl text-gray-300 mb-2 mx-auto" />
          <div className="text-gray-400 font-medium">
            {search ? `No sales found for ${search}` : 'No sales data yet'}
          </div>
          <div className="text-xs text-gray-400 mt-1">
            {search ? 'Try a different date or clear the filter' : 'Make sales to see daily summaries here'}
          </div>
        </div>
      )}

      {/* Archive cards */}
      {filtered.map(archive => (
        <ArchiveCard
          key={archive.date}
          archive={archive}
          isExpanded={expanded === archive.date}
          onToggle={() =>
            setExpanded(prev => prev === archive.date ? null : archive.date)
          }
          onViewDebtors={() => setDebtorPanel(archive.date)}
        />
      ))}
    </div>
  )
}
