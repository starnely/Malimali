import { MdWarning } from 'react-icons/md'
import styles from '@/styles/Products.module.css'

export default function DeleteConfirmModal({ deleteConfirm, handleDeleteConfirmed, setDeleteConfirm }) {
  if (!deleteConfirm) return null

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50 animate-fadeIn"
      style={{ background: 'rgba(15,23,42,0.55)', WebkitBackdropFilter: 'blur(3px)',backdropFilter: 'blur(3px)' }}
    >
      <div
        className="w-[90vw] max-w-[360px] rounded-xl p-6"
        style={{
          background: 'var(--bg-card)',
          boxShadow: 'var(--shadow-dropdown)',
          border: '1px solid var(--border-soft)',
        }}
      >
        {/* Icon + Title */}
        <div className="flex items-center gap-3 mb-4">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: 'var(--danger-light)' }}
          >
            <MdWarning className="text-xl" style={{ color: 'var(--danger)' }} />
          </div>
          <div>
            <h3 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
              Delete Product
            </h3>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              This action cannot be undone
            </p>
          </div>
        </div>

        {/* Message */}
        <p className="text-sm mb-6 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          Are you sure you want to delete{' '}
          <span className="font-bold" style={{ color: 'var(--text-primary)' }}>
            "{deleteConfirm.name}"
          </span>
          ? All associated data will be permanently removed.
        </p>

        {/* Actions */}
        <div className="flex gap-2.5">
          <button
            onClick={() => setDeleteConfirm(null)}
            className={`flex-1 px-3 py-2.5 rounded-lg text-sm font-semibold transition ${styles.deleteModalCancelBtn}`}
          >
            Cancel
          </button>
          <button
            onClick={handleDeleteConfirmed}
            className={`flex-1 px-3 py-2.5 rounded-lg text-sm font-bold text-white transition ${styles.deleteModalConfirmBtn}`}
          >
            Yes, Delete
          </button>
        </div>
      </div>
    </div>
  )
}
