import { useState } from 'react'
import { useApp } from '@/context/AppContext'
import {
  MdDelete, MdToggleOn, MdToggleOff, MdEdit, MdAdd,
  MdVisibility, MdVisibilityOff, MdRefresh
} from 'react-icons/md'
import FormInputDropdown from './Products/FormInputDropdown'
import styles from '@/styles/Employees.module.css'

export default function Employees() {
  const { users, addUser, deleteUser, toggleUserStatus, updateUser } = useApp()

  const initialForm = {
    fullname: '',
    username: '',
    email: '',
    password: '',
    role: 'cashier',
    store: 'Store One'
  }

  const [form, setForm] = useState(initialForm)
  const [editUser, setEditUser] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(null)

  const handleSave = () => {
    if (!form.fullname || !form.username || !form.password) return

    if (editUser) {
      updateUser(editUser._id, form)
    } else {
      addUser(form)
    }

    setForm(initialForm)
    setEditUser(null)
    setShowModal(false)
    setShowPassword(false)
  }

  const generatePassword = () => {
    const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
    let retVal = "";
    for (let i = 0; i < 12; ++i) {
      retVal += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    setForm({ ...form, password: retVal });
  }

  const openAdd = () => {
    setEditUser(null)
    setForm(initialForm)
    setShowModal(true)
  }

  const openEdit = (user) => {
    setEditUser(user)
    setForm({
      fullname: user.fullname || user.name,
      username: user.username,
      email: user.email || '',
      password: '', // Keep password empty for security on edit
      role: user.role,
      store: user.store || 'Store One'
    })
    setShowModal(true)
  }


  // Filter for both Managers and Cashiers (excluding Owners)
  const staff = users.filter(u => u.role === 'manager' || u.role === 'cashier')
  const filteredStaff = staff.filter(
    u =>
      (u.fullname || u.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.username.toLowerCase().includes(searchTerm.toLowerCase())
  )


  return (
    <div className="p-6 bg-gray-100 min-h-screen">
      {/* Header */}
      <div className="flex justify-between items-center mb-6 flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-semibold text-gray-800">Staff Management</h1>
          <p className="text-sm text-gray-500">{staff.length} staff members across all stores</p>
        </div>

        <button
          onClick={openAdd}
          className="flex items-center gap-2 bg-blue-800 text-white px-4 py-2 rounded-lg text-sm font-medium shadow hover:bg-blue-700 transition"
        >
          <MdAdd /> Add New Staff
        </button>
      </div>

      {/* Search & Stats */}
      <div className="mb-4 flex gap-2">
        <input
          type="text"
          placeholder="Search by name or username..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
        />
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-50">
              {['Fullname', 'Role', 'Store', 'Status', 'Actions'].map(h => (
                <th key={h} className="text-xs text-gray-400 font-medium text-left px-4 py-3 border-b border-gray-100">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredStaff.map((user, i) => (
              <tr key={user._id} className={`${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'} ${styles.rowHover}`}>
                <td className={styles.td}>
                  <div className="font-medium text-gray-800">{user.fullname || user.name}</div>
                  <div className="text-xs text-gray-400">@{user.username}</div>
                </td>
                <td className={styles.td}>
                  <span className={`capitalize text-xs font-semibold ${user.role === 'manager' ? 'text-purple-600' : 'text-blue-600'}`}>
                    {user.role}
                  </span>
                </td>
                <td className={styles.td}>{user.store || 'N/A'}</td>
                <td className={styles.td}>
                  <div className="flex flex-col gap-1">
                    <span className={`text-[10px] px-2 py-0.5 rounded text-center font-bold uppercase ${user.active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {user.active ? 'Active' : 'Inactive'}
                    </span>
                    <span className="text-[10px] text-gray-400 italic text-center">
                      {user.shiftStatus === 'open' ? '🟢 On Shift' : '⚪ Off Duty'}
                    </span>
                  </div>
                </td>
                <td className={styles.td}>
                  <div className="flex gap-2">
                    <button onClick={() => openEdit(user)} className={styles.btnBlue}><MdEdit /></button>
                    <button onClick={() => toggleUserStatus(user._id)} className={styles.btnYellow}>
                      {user.active ? <MdToggleOn /> : <MdToggleOff />}
                    </button>
                    <button onClick={() => setConfirmDelete(user)} className={styles.btnRed}><MdDelete /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Modal (Refined Design) */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg shadow-lg">
            <h2 className="text-lg font-bold mb-6 text-gray-800 border-b pb-2">
              {editUser ? 'Modify Staff Account' : 'Create User Account'}
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase">Fullname</label>
                <input
                  value={form.fullname}
                  onChange={e => setForm({ ...form, fullname: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm mt-1"
                  placeholder="John Smith"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase">Username</label>
                <input
                  value={form.username}
                  onChange={e => setForm({ ...form, username: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm mt-1"
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs font-bold text-gray-500 uppercase">Email Address</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm mt-1"
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs font-bold text-gray-500 uppercase">Password</label>
                <div className="relative mt-1">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={form.password}
                    onChange={e => setForm({ ...form, password: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                    {showPassword ? <MdVisibilityOff /> : <MdVisibility />}
                  </button>
                </div>
                {!editUser && (
                  <button onClick={generatePassword} className="text-[10px] text-blue-600 mt-1 flex items-center gap-1 hover:underline">
                    <MdRefresh /> Generate Secure Password
                  </button>
                )}
              </div>

              <FormInputDropdown
                label="Role"
                value={form.role}
                options={['manager', 'cashier']}
                onChange={val => setForm({ ...form, role: val })}
              />
              <FormInputDropdown
                label="Assigned Store"
                value={form.store}
                options={['Store One', 'Store Two', 'Warehouse']}
                onChange={val => setForm({ ...form, store: val })}
              />
            </div>

            <div className="flex gap-3 pt-4 border-t">
              <button onClick={() => setShowModal(false)} className="flex-1 py-2 border rounded-lg text-sm font-medium hover:bg-gray-50">Dismiss</button>
              <button onClick={handleSave} className="flex-1 py-2 rounded-lg text-sm font-bold bg-teal-600 text-white hover:bg-teal-700">
                {editUser ? 'Update Profile' : 'Create Account'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-lg animate-slideUp">
            <h2 className="text-lg font-semibold mb-4">Confirm Delete</h2>
            <p className="text-sm text-gray-600 mb-6">
              Are you sure you want to delete <span className="font-medium">{confirmDelete.name}</span>?
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white hover:bg-gray-100 transition"
              >
                Cancel
              </button>
              <button
                onClick={() => { deleteUser(confirmDelete._id); setConfirmDelete(null) }}
                className="flex-1 px-3 py-2 rounded-lg text-sm font-medium bg-red-600 text-white hover:bg-red-500 transition"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
