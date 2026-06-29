import { useState, useRef, useEffect } from 'react'
import { MdSearch, MdExpandMore, MdStorefront } from 'react-icons/md'
import styles from '@/styles/Products.module.css'

export default function ProductFilters({
  search, setSearch,
  categoryFilter, setCategoryFilter, categories,
  storeFilter, setStoreFilter, stores
}) {
  // Sort alphabetically; "All" always first
  const sortedCats = [
    'All',
    ...Array.from(new Set(categories)).filter(c => c !== 'All').sort(),
  ]
  const sortedStoreNames = Array.from(
    new Set((stores || []).map(s => s.name || s).filter(Boolean))
  ).sort()
  const allStores = ['All', ...sortedStoreNames]

  const CAT_MAX   = 3
  const STORE_MAX = 3

  const visibleCats    = sortedCats.slice(0, CAT_MAX)
  const overflowCats   = sortedCats.slice(CAT_MAX)
  const catInDropdown  = overflowCats.includes(categoryFilter)

  const visibleStores   = allStores.slice(0, STORE_MAX)
  const overflowStores  = allStores.slice(STORE_MAX)
  const storeInDropdown = overflowStores.includes(storeFilter)

  const [isCatDdOpen,   setIsCatDdOpen]   = useState(false)
  const [isStoreDdOpen, setIsStoreDdOpen] = useState(false)
  const catDdRef   = useRef(null)
  const storeDdRef = useRef(null)

  useEffect(() => {
    function handleClickOutside(event) {
      if (catDdRef.current   && !catDdRef.current.contains(event.target))   setIsCatDdOpen(false)
      if (storeDdRef.current && !storeDdRef.current.contains(event.target)) setIsStoreDdOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const chipBase = {
    padding: '6px 14px',
    borderRadius: 'var(--radius-md)',
    fontSize: '12px',
    fontWeight: 600,
    border: '1px solid var(--border-medium)',
    cursor: 'pointer',
    transition: 'all 0.15s',
    background: 'var(--bg-card)',
    color: 'var(--text-secondary)',
    touchAction: 'manipulation',
    userSelect: 'none',
    flexShrink: 0,
    maxWidth: '120px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  }

  const chipActive = {
    ...chipBase,
    background: 'var(--primary)',
    borderColor: 'var(--primary)',
    color: '#fff',
  }

  return (
    <div
      className="p-4 rounded-xl mb-4 flex flex-col gap-3"
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-soft)',
        boxShadow: 'var(--shadow-card)',
      }}
    >
      {/* ── Search ─────────────────────────────────────────── */}
      <div className="relative">
        <MdSearch
          className="absolute left-3 top-1/2 -translate-y-1/2 text-lg"
          style={{ color: 'var(--text-muted)' }}
        />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search products..."
          className="w-full pl-9 pr-3 py-2 rounded-lg text-sm outline-none transition-all"
          style={{
            border: '1px solid var(--border-medium)',
            background: 'var(--bg-muted)',
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

      {/* ── Row 1: Category chips ───────────────────────────── */}
      <div className="flex items-center gap-1.5">
        {visibleCats.map(cat => (
          <button
            key={cat}
            onClick={() => setCategoryFilter(cat)}
            style={categoryFilter === cat ? chipActive : chipBase}
          >
            {cat}
          </button>
        ))}

        {overflowCats.length > 0 && (
          <div className="relative" ref={catDdRef} style={{ flexShrink: 0 }}>
            <button
              onClick={() => setIsCatDdOpen(o => !o)}
              className="flex items-center gap-1"
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
                    onClick={() => { setCategoryFilter(cat); setIsCatDdOpen(false) }}
                    className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                      categoryFilter === cat
                        ? styles.filterDropdownItemActive
                        : styles.filterDropdownItemInactive
                    }`}
                    style={{
                      color: categoryFilter === cat ? 'var(--primary)' : 'var(--text-secondary)',
                      fontWeight: categoryFilter === cat ? 700 : 400,
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

      {/* ── Row 2: Store chips ─────────────────────────────── */}
      {allStores.length > 2 && setStoreFilter && (
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
              style={storeFilter === store ? chipActive : chipBase}
            >
              {store}
            </button>
          ))}

          {overflowStores.length > 0 && (
            <div className="relative" ref={storeDdRef} style={{ flexShrink: 0 }}>
              <button
                onClick={() => setIsStoreDdOpen(o => !o)}
                className="flex items-center gap-1"
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
  )
}
