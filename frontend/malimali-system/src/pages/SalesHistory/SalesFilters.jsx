import { MdSearch, MdDateRange } from 'react-icons/md'

export default function SalesFilters({
  search, setSearch,
  dateFrom, setDateFrom,
  dateTo, setDateTo,
  category, setCategory,
  visibleCategories, dropdownCategories
}) {
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
      <div className="flex flex-wrap items-center gap-3">

        {/* Search */}
        <div className="relative flex-[2] min-w-[180px]">
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
          <MdDateRange style={{ color: 'var(--text-muted)' }} />
          <input
            type="date"
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            className="bg-transparent text-xs outline-none w-24"
            style={{ color: 'var(--text-secondary)' }}
          />
          <span style={{ color: 'var(--border-medium)' }}>—</span>
          <input
            type="date"
            value={dateTo}
            onChange={e => setDateTo(e.target.value)}
            className="bg-transparent text-xs outline-none w-24"
            style={{ color: 'var(--text-secondary)' }}
          />
        </div>

        {/* Category chips */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {visibleCategories.map(cat => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              style={category === cat ? chipActive : chipBase}
            >
              {cat}
            </button>
          ))}
          {dropdownCategories.length > 0 && (
            <select
              onChange={e => setCategory(e.target.value)}
              value={dropdownCategories.includes(category) ? category : 'more'}
              className="outline-none cursor-pointer text-xs font-semibold rounded-full px-3 py-1.5"
              style={{
                border: '1px solid var(--border-medium)',
                background: dropdownCategories.includes(category) ? 'var(--primary)' : 'var(--bg-card)',
                color: dropdownCategories.includes(category) ? '#fff' : 'var(--text-secondary)',
              }}
            >
              <option value="more" disabled>More...</option>
              {dropdownCategories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          )}
        </div>
      </div>
    </div>
  )
}
