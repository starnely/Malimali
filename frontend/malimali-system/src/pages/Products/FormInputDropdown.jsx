export default function FormInputDropdown({ label, value, onChange, options = [] }) {
  return (
    <div className="mb-4">
      <label
        className="block text-xs font-semibold uppercase tracking-wider mb-1.5"
        style={{ color: 'var(--text-secondary)' }}
      >
        {label}
      </label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2 rounded-lg text-sm outline-none transition-all duration-200 cursor-pointer"
        style={{
          border: '1px solid var(--border-medium)',
          background: 'var(--bg-muted)',
          color: value ? 'var(--text-primary)' : 'var(--text-muted)',
        }}
        onFocus={e => {
          e.target.style.borderColor = 'var(--primary)'
          e.target.style.background = 'var(--bg-card)'
          e.target.style.boxShadow = '0 0 0 3px var(--primary-light)'
        }}
        onBlur={e => {
          e.target.style.borderColor = 'var(--border-medium)'
          e.target.style.background = 'var(--bg-muted)'
          e.target.style.boxShadow = 'none'
        }}
      >
        <option value="">Select {label}...</option>
        {options.map((opt, index) => {
          const optionValue = typeof opt === 'object' && opt !== null ? (opt.name || opt._id || '') : opt
          const optionKey   = typeof opt === 'object' && opt !== null ? (opt._id || index) : opt
          const optionLabel = typeof opt === 'object' && opt !== null ? (opt.name || optionValue) : opt
          return (
            <option key={optionKey} value={optionValue}>
              {optionLabel}
            </option>
          )
        })}
      </select>
    </div>
  )
}
