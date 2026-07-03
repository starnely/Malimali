import { MdSearch, MdStorefront } from 'react-icons/md'
import styles from '@/styles/Products.module.css'

export default function ProductFilters({
  search, setSearch,
  categoryFilter, setCategoryFilter, categories,
  storeFilter, setStoreFilter, stores
}) {
  const sortedCats = [
    'All',
    ...Array.from(new Set(categories)).filter(c => c !== 'All').sort(),
  ]
  const sortedStoreNames = Array.from(
    new Set((stores || []).map(s => s.name || s).filter(Boolean))
  ).sort()
  const allStores = ['All', ...sortedStoreNames]

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
    whiteSpace: 'nowrap',
    fontFamily: 'inherit',
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

      {/* ── Category chips — horizontally scrollable ─────────── */}
      <div className={styles.filterScrollRow}>
        {sortedCats.map(cat => (
          <button
            key={cat}
            onClick={() => setCategoryFilter(cat)}
            style={categoryFilter === cat ? chipActive : chipBase}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* ── Store chips — horizontally scrollable ─────────── */}
      {allStores.length > 2 && setStoreFilter && (
        <div className={styles.filterScrollRow}>
          <span
            className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest"
            style={{ color: 'var(--text-muted)', flexShrink: 0, alignSelf: 'center' }}
          >
            <MdStorefront style={{ color: 'var(--primary)' }} /> Store:
          </span>

          {allStores.map(store => (
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
