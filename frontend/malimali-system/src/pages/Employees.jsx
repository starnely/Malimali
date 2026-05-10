import { useState } from 'react'
import { useApp } from '@/context/AppContext'
import {
  MdDelete, MdToggleOn, MdToggleOff, MdEdit, MdAdd,
  MdVisibility, MdVisibilityOff
} from 'react-icons/md'
import styles from '@/styles/Employees.module.css'

export default function Employees() {
  const { users, addUser, deleteUser, toggleUserStatus, updateUser } = useApp()

  const [form, setForm] = useState({ name: '', username: '', password: '' })
  const [editUser, setEditUser] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(null)

  const handleSave = () => {
    if (!form.name || !form.username || !form.password) return

    if (editUser) {
      updateUser(editUser._id, form)
    } else {
      addUser(form)
    }

    setForm({ name: '', username: '', password: '' })
    setEditUser(null)
    setShowModal(false)
    setShowPassword(false)
  }

  const openAdd = () => {
    setEditUser(null)
    setForm({ name: '', username: '', password: '' })
    setShowModal(true)
    setShowPassword(false)
  }

  const openEdit = (user) => {
    setEditUser(user)
    setForm({
      name: user.name,
      username: user.username,
      password: user.password
    })
    setShowModal(true)
    setShowPassword(false)
  }

  const employees = users.filter(u => u.role === 'employee')
  const filteredEmployees = employees.filter(
    u =>
      u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.username.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="p-6 bg-gray-100 min-h-screen">

      {/* Header */}
      <div className="flex justify-between items-center mb-6 flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-semibold text-gray-800">Employee Management</h1>
          <p className="text-sm text-gray-500">{employees.length} employees</p>
        </div>

        <button
          onClick={openAdd}
          className="flex items-center gap-2 bg-blue-800 text-white px-4 py-2 rounded-lg text-sm font-medium shadow hover:bg-blue-700 transition"
        >
          <MdAdd /> Add Employee
        </button>
      </div>

      {/* Search */}
      <div className="mb-4 flex gap-2">
        <input
          type="text"
          placeholder="Search employees..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
        />
        {searchTerm && (
          <button
            onClick={() => setSearchTerm('')}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white hover:bg-gray-100 transition"
          >
            Clear
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-50">
              {['Name', 'Username', 'Status', 'Actions'].map(h => (
                <th
                  key={h}
                  className="text-xs text-gray-400 font-medium text-left px-4 py-3 border-b border-gray-100"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {filteredEmployees.map((user, i) => (
              <tr
                key={user._id}
                className={`${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'} ${styles.rowHover}`}
              >
                <td className={styles.td}>{user.name}</td>
                <td className={styles.td}>{user.username}</td>

                <td className={styles.td}>
                  <div className="flex flex-col gap-1">
                    {/* Active/Inactive */}
                    <span
                      className={`text-xs px-3 py-1 rounded-md font-medium ${user.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-700'
                        }`}
                    >
                      {user.active ? 'Active' : 'Inactive'}
                    </span>

                    {/* Shift status */}
                    <span
                      className={`text-xs px-3 py-1 rounded-md font-medium ${user.shiftStatus === 'closed'
                          ? 'bg-gray-200 text-gray-700'
                          : 'bg-yellow-100 text-yellow-700'
                        }`}
                    >
                      {user.shiftStatus === 'closed' ? '✅ Shift Closed' : '🟡 Still Working'}
                    </span>
                  </div>
                </td>

                <td className={styles.td}>
                  <div className="flex gap-2">
                    <button
                      onClick={() => openEdit(user)}
                      className={`${styles.btnBlue} hover:scale-105 transition`}
                    >
                      <MdEdit />
                    </button>

                    <button
                      onClick={() => toggleUserStatus(user._id)}
                      className={`${styles.btnYellow} hover:scale-105 transition`}
                    >
                      {user.active ? <MdToggleOn /> : <MdToggleOff />}
                    </button>

                    <button
                      onClick={() => setConfirmDelete(user)}
                      className={`${styles.btnRed} hover:scale-105 transition`}
                    >
                      <MdDelete />
                    </button>
                  </div>
                </td>
              </tr>
            ))}

            {filteredEmployees.length === 0 && (
              <tr>
                <td colSpan="4" className="text-center py-8 text-sm text-gray-400">
                  No employees found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-lg animate-slideUp">
            <h2 className="text-lg font-semibold mb-6">
              {editUser ? 'Edit Employee' : 'Add Employee'}
            </h2>

            {['name', 'username', 'password'].map(field => (
              <div key={field} className="mb-4">
                <label className="text-sm text-gray-600 block mb-1">
                  {field.charAt(0).toUpperCase() + field.slice(1)}
                </label>
                <div className="relative">
                  <input
                    type={field === 'password' && showPassword ? 'text' : field === 'password' ? 'password' : 'text'}
                    value={form[field]}
                    onChange={e => setForm({ ...form, [field]: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                  {field === 'password' && (
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
                    >
                      {showPassword ? <MdVisibilityOff /> : <MdVisibility />}
                    </button>
                  )}
                </div>
              </div>
            ))}

            <div className="flex gap-2">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white hover:bg-gray-100 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="flex-1 px-3 py-2 rounded-lg text-sm font-medium bg-blue-800 text-white hover:bg-blue-700 transition"
              >
                {editUser ? 'Save Changes' : 'Add Employee'}
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
