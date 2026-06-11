import { useState } from 'react'
import { MdClose, MdVisibility, MdVisibilityOff, MdPerson } from 'react-icons/md'
import { useApp } from '@/context/AppContext'
import FormInputDropdown from '@/pages/Products/FormInputDropdown'

export default function CreateUserModal({ isOpen, onClose, onCreate }) {
  const { stores } = useApp()

  const [formData, setFormData] = useState({
    fullname: '',
    username: '',
    email:    '',
    password: '',
    role:     'cashier',
    store:    '',
  })
  const [showPassword, setShowPassword] = useState(false)

  const generatePassword = () => {
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*'
    let pass = ''
    for (let i = 0; i < 12; i++) {
      pass += charset.charAt(Math.floor(Math.random() * charset.length))
    }
    setFormData(prev => ({ ...prev, password: pass }))
  }

  if (!isOpen) return null

  const storeOptions = stores.map(s => s.name || s)

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50 p-4"
      style={{ background: 'rgba(15,23,42,0.6)', WebkitBackdropFilter: 'blur(3px)',backdropFilter: 'blur(3px)' }}
    >
      <div
        className="w-full max-w-md rounded-xl overflow-hidden"
        style={{ background: 'var(--bg-card)', boxShadow: 'var(--shadow-dropdown)' }}
      >
        {/* Header */}
        <div
          className="px-5 py-4 flex items-center justify-between flex-shrink-0"
          style={{ background: 'var(--sidebar-bg)' }}
        >
          <div className="flex items-center gap-2">
            <MdPerson className="text-white text-xl" />
            <span className="text-white text-sm font-bold">Create User Account</span>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center transition"
            style={{ color: 'rgba(255,255,255,0.6)' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <MdClose size={18} />
          </button>
        </div>

        {/* Form */}
        <div className="p-5 space-y-4">
          {/* Fullname */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-secondary)' }}>
              Full Name
            </label>
            <input
              className="w-full px-3 py-2 rounded-lg text-sm outline-none transition-all"
              style={{ border: '1px solid var(--border-medium)', background: 'var(--bg-muted)', color: 'var(--text-primary)' }}
              value={formData.fullname}
              onChange={e => setFormData({ ...formData, fullname: e.target.value })}
              placeholder="John Smith"
              onFocus={e => { e.target.style.borderColor = 'var(--primary)'; e.target.style.boxShadow = '0 0 0 3px var(--primary-light)' }}
              onBlur={e  => { e.target.style.borderColor = 'var(--border-medium)'; e.target.style.boxShadow = 'none' }}
            />
          </div>

          {/* Username */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-secondary)' }}>
              Username
            </label>
            <input
              className="w-full px-3 py-2 rounded-lg text-sm outline-none transition-all"
              style={{ border: '1px solid var(--border-medium)', background: 'var(--bg-muted)', color: 'var(--text-primary)' }}
              value={formData.username}
              onChange={e => setFormData({ ...formData, username: e.target.value })}
              onFocus={e => { e.target.style.borderColor = 'var(--primary)'; e.target.style.boxShadow = '0 0 0 3px var(--primary-light)' }}
              onBlur={e  => { e.target.style.borderColor = 'var(--border-medium)'; e.target.style.boxShadow = 'none' }}
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-secondary)' }}>
              Email
            </label>
            <input
              type="email"
              className="w-full px-3 py-2 rounded-lg text-sm outline-none transition-all"
              style={{ border: '1px solid var(--border-medium)', background: 'var(--bg-muted)', color: 'var(--text-primary)' }}
              value={formData.email}
              onChange={e => setFormData({ ...formData, email: e.target.value })}
              onFocus={e => { e.target.style.borderColor = 'var(--primary)'; e.target.style.boxShadow = '0 0 0 3px var(--primary-light)' }}
              onBlur={e  => { e.target.style.borderColor = 'var(--border-medium)'; e.target.style.boxShadow = 'none' }}
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-secondary)' }}>
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                className="w-full px-3 py-2 pr-10 rounded-lg text-sm outline-none transition-all"
                style={{ border: '1px solid var(--border-medium)', background: 'var(--bg-muted)', color: 'var(--text-primary)' }}
                value={formData.password}
                onChange={e => setFormData({ ...formData, password: e.target.value })}
                onFocus={e => { e.target.style.borderColor = 'var(--primary)'; e.target.style.boxShadow = '0 0 0 3px var(--primary-light)' }}
                onBlur={e  => { e.target.style.borderColor = 'var(--border-medium)'; e.target.style.boxShadow = 'none' }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2"
                style={{ color: 'var(--text-muted)' }}
              >
                {showPassword ? <MdVisibilityOff size={18} /> : <MdVisibility size={18} />}
              </button>
            </div>
            <button
              onClick={generatePassword}
              className="mt-2 text-xs font-bold px-3 py-1.5 rounded-lg transition"
              style={{ background: 'var(--primary-light)', color: 'var(--primary)' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--primary-muted)'}
              onMouseLeave={e => e.currentTarget.style.background = 'var(--primary-light)'}
            >
              Generate Secure Password
            </button>
          </div>

          {/* Role + Store */}
          <div className="grid grid-cols-2 gap-4">
            <FormInputDropdown
              label="Role"
              value={formData.role}
              options={['owner', 'manager', 'cashier']}
              onChange={val => setFormData({ ...formData, role: val })}
            />
            <FormInputDropdown
              label="Store"
              value={formData.store}
              options={storeOptions}
              onChange={val => setFormData({ ...formData, store: val })}
            />
          </div>
        </div>

        {/* Footer */}
        <div
          className="px-5 py-4 flex justify-end gap-2.5"
          style={{ borderTop: '1px solid var(--border-soft)', background: 'var(--bg-muted)' }}
        >
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-semibold transition"
            style={{ border: '1px solid var(--border-medium)', color: 'var(--text-secondary)', background: 'var(--bg-card)' }}
          >
            Cancel
          </button>
          <button
            onClick={() => onCreate(formData)}
            className="px-4 py-2 rounded-lg text-sm font-bold text-white transition"
            style={{ background: 'var(--primary)' }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--primary-dark)'}
            onMouseLeave={e => e.currentTarget.style.background = 'var(--primary)'}
          >
            Create Account
          </button>
        </div>
      </div>
    </div>
  )
}
