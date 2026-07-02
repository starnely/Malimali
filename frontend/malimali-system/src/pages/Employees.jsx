import { useState, useEffect } from 'react'
import { useApp } from '@/context/AppContext'
import {
  MdDelete, MdToggleOn, MdToggleOff, MdEdit, MdAdd,
  MdVisibility, MdVisibilityOff, MdRefresh, MdClose, MdPeople
} from 'react-icons/md'
import FormInputDropdown from './Products/FormInputDropdown'
import styles from '@/styles/Employees.module.css'

const initialForm = {
  fullname: '', username: '', email: '',
  password: '', role: 'cashier', store: ''
}

export default function Employees() {
  const { users, addUser, deleteUser, toggleUserStatus, updateUser, stores, fetchStores } = useApp()

  const [form,          setForm]          = useState(initialForm)
  const [editUser,      setEditUser]      = useState(null)
  const [showModal,     setShowModal]     = useState(false)
  const [showPassword,  setShowPassword]  = useState(false)
  const [searchTerm,    setSearchTerm]    = useState('')
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [formErrors,    setFormErrors]    = useState({})

  useEffect(() => { fetchStores() }, [fetchStores])

  const validate = () => {
    const e = {}
    if (!form.fullname.trim())              e.fullname = 'Full name is required'
    if (!form.username.trim())              e.username = 'Username is required'
    if (!editUser && !form.password.trim()) e.password = 'Password is required for new accounts'
    setFormErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSave = () => {
    if (!validate()) return
    if (editUser) { updateUser(editUser._id, form) } else { addUser(form) }
    setForm(initialForm); setEditUser(null)
    setShowModal(false); setShowPassword(false); setFormErrors({})
  }

  const generatePassword = () => {
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*'
    let pwd = ''
    for (let i = 0; i < 12; i++) pwd += charset.charAt(Math.floor(Math.random() * charset.length))
    setForm({ ...form, password: pwd })
    setFormErrors(p => ({ ...p, password: undefined }))
  }

  const openAdd = () => {
    setEditUser(null); setForm(initialForm); setFormErrors({}); setShowModal(true)
  }

  const openEdit = (user) => {
    setEditUser(user)
    setForm({
      fullname: user.fullname || user.name || '',
      username: user.username || '',
      email:    user.email    || '',
      password: '',
      role:     user.role     || 'cashier',
      store:    user.store    || '',
    })
    setFormErrors({}); setShowModal(true)
  }

  const staff         = users.filter(u => u.role === 'manager' || u.role === 'cashier')
  const filteredStaff = staff.filter(u =>
    (u.fullname || u.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.username.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const inp = (key) => ({
    width: '100%', padding: '9px 12px', marginTop: '4px',
    border: `1px solid ${formErrors[key] ? 'var(--danger)' : 'var(--border-medium)'}`,
    borderRadius: 'var(--radius-md)', fontSize: '13px', outline: 'none',
    background: 'var(--bg-muted)', color: 'var(--text-primary)',
    boxSizing: 'border-box', transition: 'all 0.15s',
  })

  const onFocus = (e) => { e.target.style.borderColor = 'var(--primary)'; e.target.style.boxShadow = '0 0 0 3px var(--primary-light)'; e.target.style.background = 'var(--bg-card)' }
  const onBlur  = (key) => (e) => { e.target.style.borderColor = formErrors[key] ? 'var(--danger)' : 'var(--border-medium)'; e.target.style.boxShadow = 'none'; e.target.style.background = 'var(--bg-muted)' }

  return (
    <div className="flex flex-col min-h-full md:h-full md:overflow-hidden" style={{ background: 'var(--bg-page)' }}>

      {/* ── Fixed header ─────────────────────────────────── */}
      <div className="flex-shrink-0 px-6 pt-6 pb-4">
        <div className="flex justify-between items-center flex-wrap gap-2 mb-4">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
              <MdPeople style={{ color: 'var(--primary)' }} /> Staff Management
            </h1>
            <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {staff.length} staff member{staff.length !== 1 ? 's' : ''} across all stores
            </p>
          </div>
          <button
            onClick={openAdd}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold text-white transition ${styles.btnAdd}`}
          >
            <MdAdd /> Add New Staff
          </button>
        </div>

        <input
          type="text"
          placeholder="Search by name or username..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="w-full px-3 py-2 rounded-lg text-sm outline-none transition-all"
          style={{ border: '1px solid var(--border-medium)', background: 'var(--bg-card)', color: 'var(--text-primary)' }}
          onFocus={e => { e.target.style.borderColor = 'var(--primary)'; e.target.style.boxShadow = '0 0 0 3px var(--primary-light)' }}
          onBlur={e  => { e.target.style.borderColor = 'var(--border-medium)'; e.target.style.boxShadow = 'none' }}
        />
      </div>

      {/* ── Scrollable content ───────────────────────────── */}
      <div className="md:flex-1 md:overflow-y-auto px-6 pb-6">
        <div className="rounded-xl overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-soft)', boxShadow: 'var(--shadow-card)' }}>
          <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr style={{ background: 'var(--sidebar-bg)' }}>
                {['Fullname', 'Role', 'Store', 'Status', 'Actions'].map(h => (
                  <th key={h} className="text-left text-[10px] font-black uppercase tracking-widest text-white px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredStaff.length === 0 ? (
                <tr>
                  <td colSpan="5" className="py-12 text-center">
                    <div className="text-3xl mb-2">👥</div>
                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                      {searchTerm ? 'No staff match your search' : 'No staff added yet'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredStaff.map((user, i) => (
                  <tr
                    key={user._id}
                    className={styles.rowHover}
                    style={{ background: i % 2 === 0 ? 'transparent' : 'var(--bg-muted)', borderBottom: '1px solid var(--border-soft)' }}
                  >
                    <td className={styles.td}>
                      <div className="font-semibold" style={{ color: 'var(--text-primary)' }}>{user.fullname || user.name}</div>
                      <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>@{user.username}</div>
                    </td>
                    <td className={styles.td}>
                      <span className="text-xs font-bold capitalize px-2 py-0.5 rounded"
                        style={user.role === 'manager'
                          ? { background: '#EDE9FE', color: '#6D28D9' }
                          : { background: 'var(--primary-light)', color: 'var(--primary)' }
                        }
                      >
                        {user.role}
                      </span>
                    </td>
                    <td className={styles.td} style={{ color: 'var(--text-secondary)' }}>{user.store || 'N/A'}</td>
                    <td className={styles.td}>
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] px-2 py-0.5 rounded text-center font-bold uppercase"
                          style={user.active
                            ? { background: 'var(--success-light)', color: 'var(--success-dark)' }
                            : { background: 'var(--danger-light)',  color: 'var(--danger-dark)'  }
                          }
                        >
                          {user.active ? 'Active' : 'Inactive'}
                        </span>
                        <span className="text-[10px] text-center italic" style={{ color: 'var(--text-muted)' }}>
                          {user.shiftStatus === 'open' ? '🟢 On Shift' : '⚪ Off Duty'}
                        </span>
                      </div>
                    </td>
                    <td className={styles.td}>
                      <div className="flex gap-2">
                        <button onClick={() => openEdit(user)}             className={styles.btnBlue}>   <MdEdit size={15} />   </button>
                        <button onClick={() => toggleUserStatus(user._id)} className={styles.btnYellow}>
                          {user.active ? <MdToggleOn size={15} /> : <MdToggleOff size={15} />}
                        </button>
                        <button onClick={() => setConfirmDelete(user)}     className={styles.btnRed}>    <MdDelete size={15} /> </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          </div>
        </div>
      </div>

      {/* ── Add / Edit Modal ─────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4"
          style={{ background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)' }}
        >
          <div className="w-full max-w-lg rounded-xl overflow-hidden" style={{ background: 'var(--bg-card)', boxShadow: 'var(--shadow-dropdown)' }}>
            <div className="px-5 py-4 flex items-center justify-between" style={{ background: 'var(--sidebar-bg)' }}>
              <span className="text-white text-sm font-bold">{editUser ? 'Edit Staff Account' : 'Create Staff Account'}</span>
              <button onClick={() => setShowModal(false)} className="w-7 h-7 flex items-center justify-center rounded-lg"
                style={{ color: 'rgba(255,255,255,0.6)', background: 'none', border: 'none', cursor: 'pointer' }}>
                <MdClose size={18} />
              </button>
            </div>

            <div className="p-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">

                <div>
                  <label className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Full Name</label>
                  <input value={form.fullname} placeholder="John Smith" style={inp('fullname')} onFocus={onFocus} onBlur={onBlur('fullname')}
                    onChange={e => { setForm({ ...form, fullname: e.target.value }); setFormErrors(p => ({ ...p, fullname: undefined })) }} />
                  {formErrors.fullname && <p className="text-xs mt-1" style={{ color: 'var(--danger)' }}>{formErrors.fullname}</p>}
                </div>

                <div>
                  <label className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Username</label>
                  <input value={form.username} placeholder="johnsmith" style={inp('username')} onFocus={onFocus} onBlur={onBlur('username')}
                    onChange={e => { setForm({ ...form, username: e.target.value }); setFormErrors(p => ({ ...p, username: undefined })) }} />
                  {formErrors.username && <p className="text-xs mt-1" style={{ color: 'var(--danger)' }}>{formErrors.username}</p>}
                </div>

                <div className="md:col-span-2">
                  <label className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Email Address</label>
                  <input type="email" value={form.email} placeholder="john@company.com" style={inp('email')} onFocus={onFocus} onBlur={onBlur('email')}
                    onChange={e => setForm({ ...form, email: e.target.value })} />
                </div>

                <div className="md:col-span-2">
                  <label className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                    Password{editUser && <span className="normal-case font-normal ml-1" style={{ color: 'var(--text-muted)' }}>(blank = keep current)</span>}
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={form.password}
                      placeholder={editUser ? 'Leave blank to keep current' : 'Min. 6 characters'}
                      style={{ ...inp('password'), paddingRight: '40px' }}
                      onFocus={onFocus} onBlur={onBlur('password')}
                      onChange={e => { setForm({ ...form, password: e.target.value }); setFormErrors(p => ({ ...p, password: undefined })) }}
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2"
                      style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}>
                      {showPassword ? <MdVisibilityOff size={17} /> : <MdVisibility size={17} />}
                    </button>
                  </div>
                  {!editUser && (
                    <button onClick={generatePassword} type="button"
                      className="text-[11px] mt-1 flex items-center gap-1"
                      style={{ color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer' }}>
                      <MdRefresh size={13} /> Generate Secure Password
                    </button>
                  )}
                  {formErrors.password && <p className="text-xs mt-1" style={{ color: 'var(--danger)' }}>{formErrors.password}</p>}
                </div>

                <FormInputDropdown label="Role" value={form.role} options={['manager', 'cashier']} onChange={val => setForm({ ...form, role: val })} />
                <FormInputDropdown label="Assigned Store" value={form.store} options={stores.map(s => s.name)} onChange={val => setForm({ ...form, store: val })} />
              </div>

              <div className="flex gap-3 pt-4" style={{ borderTop: '1px solid var(--border-soft)' }}>
                <button onClick={() => setShowModal(false)}
                  className="flex-1 py-2.5 rounded-lg text-sm font-semibold"
                  style={{ border: '1px solid var(--border-medium)', color: 'var(--text-secondary)', background: 'var(--bg-card)', cursor: 'pointer' }}>
                  Cancel
                </button>
                <button onClick={handleSave}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-bold text-white transition ${styles.modalSave}`}
                >
                  {editUser ? 'Update Account' : 'Create Account'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirm Modal ─────────────────────────── */}
      {confirmDelete && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4"
          style={{ background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)' }}>
          <div className="w-full max-w-sm rounded-xl overflow-hidden" style={{ background: 'var(--bg-card)', boxShadow: 'var(--shadow-dropdown)' }}>
            <div className="px-5 py-4" style={{ background: 'var(--danger)' }}>
              <span className="text-white text-sm font-bold">Confirm Delete</span>
            </div>
            <div className="p-5">
              <p className="text-sm mb-5" style={{ color: 'var(--text-secondary)' }}>
                Delete <span className="font-bold" style={{ color: 'var(--text-primary)' }}>{confirmDelete.fullname || confirmDelete.name}</span>? This cannot be undone.
              </p>
              <div className="flex gap-3">
                <button onClick={() => setConfirmDelete(null)}
                  className="flex-1 py-2.5 rounded-lg text-sm font-semibold"
                  style={{ border: '1px solid var(--border-medium)', color: 'var(--text-secondary)', background: 'var(--bg-card)', cursor: 'pointer' }}>
                  Cancel
                </button>
                <button onClick={() => { deleteUser(confirmDelete._id); setConfirmDelete(null) }}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-bold text-white transition ${styles.modalDelete}`}
                >
                  Yes, Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
