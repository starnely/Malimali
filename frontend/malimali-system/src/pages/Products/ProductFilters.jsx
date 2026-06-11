import { useState, useRef, useEffect } from 'react'
import { MdSearch, MdExpandMore, MdStorefront } from 'react-icons/md'

export default function ProductFilters({
  search, setSearch,
  categoryFilter, setCategoryFilter, categories,
  storeFilter, setStoreFilter, stores
}) {
  const uniqueCategories = Array.from(new Set(['All', ...categories]))
  const uniqueStores     = ['All', ...Array.from(new Set((stores || []).map(s => s.name || s).filter(Boolean)))]

  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const dropdownRef = useRef(null)

  const MAX_VISIBLE       = 7
  const visibleCategories = uniqueCategories.slice(0, MAX_VISIBLE)
  const overflowCategories= uniqueCategories.slice(MAX_VISIBLE)
  const isFilterInDropdown= overflowCategories.includes(categoryFilter)

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false)
      }
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
      {/* ── Row 1: Search + Category Chips ─────────────── */}
      <div className="flex flex-wrap gap-2 items-center">

        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
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

        {/* Category chips */}
        <div className="flex flex-wrap gap-1.5">
          {visibleCategories.map(cat => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              style={categoryFilter === cat ? chipActive : chipBase}
            >
              {cat}
            </button>
          ))}

          {/* Overflow dropdown */}
          {overflowCategories.length > 0 && (
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="flex items-center gap-1"
                style={isFilterInDropdown ? chipActive : chipBase}
              >
                <span>{isFilterInDropdown ? categoryFilter : 'More'}</span>
                <MdExpandMore
                  className={`transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`}
                  size={16}
                />
              </button>

              {isDropdownOpen && (
                <div
                  className="absolute right-0 mt-2 w-52 max-h-60 overflow-y-auto rounded-xl z-30 py-1"
                  style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-soft)',
                    boxShadow: 'var(--shadow-dropdown)',
                  }}
                >
                  {overflowCategories.map(cat => (
                    <button
                      key={cat}
                      onClick={() => { setCategoryFilter(cat); setIsDropdownOpen(false) }}
                      className="w-full text-left px-4 py-2 text-sm transition-colors"
                      style={{
                        color: categoryFilter === cat ? 'var(--primary)' : 'var(--text-secondary)',
                        background: categoryFilter === cat ? 'var(--primary-light)' : 'transparent',
                        fontWeight: categoryFilter === cat ? 700 : 400,
                      }}
                      onMouseEnter={e => {
                        if (categoryFilter !== cat) e.currentTarget.style.background = 'var(--bg-muted)'
                      }}
                      onMouseLeave={e => {
                        if (categoryFilter !== cat) e.currentTarget.style.background = 'transparent'
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
      </div>

      {/* ── Row 2: Store Filter ─────────────────────────── */}
      {uniqueStores.length > 2 && setStoreFilter && (
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest"
            style={{ color: 'var(--text-muted)' }}
          >
            <MdStorefront style={{ color: 'var(--primary)' }} /> Store:
          </span>
          {uniqueStores.map(store => (
            <button
              key={store}
              onClick={() => setStoreFilter(store)}
              style={storeFilter === store ? chipActive : chipBase}
            >
              {store}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
