export default function FormInput({ label, value, onChange, type = 'text', placeholder }) {
  return (
    <div className="mb-4">
      <label
        className="block text-xs font-semibold uppercase tracking-wider mb-1.5"
        style={{ color: 'var(--text-secondary)' }}
      >
        {label}
      </label>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2 rounded-lg text-sm outline-none transition-all duration-200"
        style={{
          border: '1px solid var(--border-medium)',
          background: 'var(--bg-muted)',
          color: 'var(--text-primary)',
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
      />
    </div>
  )
}
