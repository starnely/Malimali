import { useState, useRef, useEffect } from 'react'
import { MdSearch, MdDateRange, MdExpandMore, MdStorefront } from 'react-icons/md'
import styles from '@/styles/SalesHistory.module.css'

export default function SalesFilters({
  search, setSearch,
  dateFrom, setDateFrom,
  dateTo, setDateTo,
  category, setCategory,
  categories,
  storeFilter, setStoreFilter, storeList,
}) {
  const CAT_MAX   = 3
  const STORE_MAX = 3

  const visibleCats     = (categories || []).slice(0, CAT_MAX)
  const overflowCats    = (categories || []).slice(CAT_MAX)
  const catInDropdown   = overflowCats.includes(category)

  const allStores       = storeList || []
  const visibleStores   = allStores.slice(0, STORE_MAX)
  const overflowStores  = allStores.slice(STORE_MAX)
  const storeInDropdown = overflowStores.includes(storeFilter)

  const [isCatDdOpen,   setIsCatDdOpen]   = useState(false)
  const [isStoreDdOpen, setIsStoreDdOpen] = useState(false)
  const catDdRef   = useRef(null)
  const storeDdRef = useRef(null)

  useEffect(() => {
    function handleClickOutside(e) {
      if (catDdRef.current   && !catDdRef.current.contains(e.target))   setIsCatDdOpen(false)
      if (storeDdRef.current && !storeDdRef.current.contains(e.target)) setIsStoreDdOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const chipBase = {
    padding: '5px 14px',
    borderRadius: '99px',
    fontSize: '12px',
    fontWeight: 600,
    border: '1px solid var(--border-medium)',
    cursor: 'pointer',
    transition: 'all 0.15s',
    background: 'var(--bg-card)',
    color: 'var(--text-secondary)',
    whiteSpace: 'nowrap',
    touchAction: 'manipulation',
    userSelect: 'none',
    flexShrink: 0,
    maxWidth: '120px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  }
  const chipActive = {
    ...chipBase,
    background: 'var(--primary)',
    borderColor: 'var(--primary)',
    color: '#fff',
  }

  return (
    <div
      className="rounded-xl p-4 mb-4"
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-soft)',
        boxShadow: 'var(--shadow-card)',
      }}
    >
      <div className="flex flex-col gap-3">

        {/* ── Search + Date (side-by-side ≥640px, stacked below) ─ */}
        <div className="flex flex-col sm:flex-row gap-2">

          {/* Search */}
          <div className="relative flex-1">
            <MdSearch
              className="absolute left-3 top-1/2 -translate-y-1/2 text-lg"
              style={{ color: 'var(--text-muted)' }}
            />
            <input
              type="text"
              placeholder="Search products..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-lg text-sm outline-none transition-all"
              style={{
                background: 'var(--bg-muted)',
                border: '1px solid var(--border-medium)',
                color: 'var(--text-primary)',
              }}
              onFocus={e => {
                e.target.style.borderColor = 'var(--primary)'
                e.target.style.boxShadow = '0 0 0 3px var(--primary-light)'
                e.target.style.background = 'var(--bg-card)'
              }}
              onBlur={e => {
                e.target.style.borderColor = 'var(--border-medium)'
                e.target.style.boxShadow = 'none'
                e.target.style.background = 'var(--bg-muted)'
              }}
            />
          </div>

          {/* Date range */}
          <div
            className="flex items-center gap-2 px-3 py-2 rounded-lg"
            style={{ background: 'var(--bg-muted)', border: '1px solid var(--border-medium)' }}
          >
            <MdDateRange className="flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="bg-transparent text-xs outline-none min-w-0 flex-1"
              style={{ color: 'var(--text-secondary)' }}
            />
            <span className="flex-shrink-0 text-xs" style={{ color: 'var(--border-medium)' }}>—</span>
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="bg-transparent text-xs outline-none min-w-0 flex-1"
              style={{ color: 'var(--text-secondary)' }}
            />
          </div>

        </div>

        {/* ── Category chips + More dropdown ─────────────────── */}
        <div className="flex items-center gap-1.5">
          {visibleCats.map(cat => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={styles.categoryChip}
              style={category === cat ? chipActive : chipBase}
            >
              {cat}
            </button>
          ))}

          {overflowCats.length > 0 && (
            <div className="relative" ref={catDdRef} style={{ flexShrink: 0 }}>
              <button
                onClick={() => setIsCatDdOpen(o => !o)}
                className={`flex items-center gap-1 ${styles.categoryChip}`}
                style={catInDropdown ? chipActive : chipBase}
              >
                <span>More</span>
                <MdExpandMore
                  className={`transition-transform duration-200 ${isCatDdOpen ? 'rotate-180' : ''}`}
                  size={16}
                />
              </button>

              {isCatDdOpen && (
                <div
                  className="absolute left-0 mt-2 w-52 max-h-60 overflow-y-auto rounded-xl z-30 py-1"
                  style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-soft)',
                    boxShadow: 'var(--shadow-dropdown)',
                  }}
                >
                  {overflowCats.map(cat => (
                    <button
                      key={cat}
                      onClick={() => { setCategory(cat); setIsCatDdOpen(false) }}
                      className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                        category === cat
                          ? styles.filterDropdownItemActive
                          : styles.filterDropdownItemInactive
                      }`}
                      style={{
                        color: category === cat ? 'var(--primary)' : 'var(--text-secondary)',
                        fontWeight: category === cat ? 700 : 400,
                      }}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Store chips + More dropdown — owner only ────────── */}
        {storeList && storeList.length > 0 && (
          <div className="flex items-center gap-1.5">
            <span
              className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest"
              style={{ color: 'var(--text-muted)', flexShrink: 0 }}
            >
              <MdStorefront style={{ color: 'var(--primary)' }} /> Store:
            </span>

            {visibleStores.map(store => (
              <button
                key={store}
                onClick={() => setStoreFilter(store)}
                className={styles.storeChip}
                style={storeFilter === store ? chipActive : chipBase}
              >
                {store}
              </button>
            ))}

            {overflowStores.length > 0 && (
              <div className="relative" ref={storeDdRef} style={{ flexShrink: 0 }}>
                <button
                  onClick={() => setIsStoreDdOpen(o => !o)}
                  className={`flex items-center gap-1 ${styles.storeChip}`}
                  style={storeInDropdown ? chipActive : chipBase}
                >
                  <span>More</span>
                  <MdExpandMore
                    className={`transition-transform duration-200 ${isStoreDdOpen ? 'rotate-180' : ''}`}
                    size={16}
                  />
                </button>

                {isStoreDdOpen && (
                  <div
                    className="absolute left-0 mt-2 w-52 max-h-60 overflow-y-auto rounded-xl z-30 py-1"
                    style={{
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border-soft)',
                      boxShadow: 'var(--shadow-dropdown)',
                    }}
                  >
                    {overflowStores.map(store => (
                      <button
                        key={store}
                        onClick={() => { setStoreFilter(store); setIsStoreDdOpen(false) }}
                        className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                          storeFilter === store
                            ? styles.filterDropdownItemActive
                            : styles.filterDropdownItemInactive
                        }`}
                        style={{
                          color: storeFilter === store ? 'var(--primary)' : 'var(--text-secondary)',
                          fontWeight: storeFilter === store ? 700 : 400,
                        }}
                      >
                        {store}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  )
}
