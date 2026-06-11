import { MdInbox } from 'react-icons/md'

export default function EmptyState({ message = 'No sales found.' }) {
  return (
    <div
      className="flex flex-col items-center justify-center p-12 text-center rounded-xl mt-2"
      style={{
        background: 'var(--bg-card)',
        border: '1px dashed var(--border-medium)',
      }}
    >
      <MdInbox className="text-4xl mb-3" style={{ color: 'var(--border-medium)' }} />
      <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>{message}</p>
    </div>
  )
}
