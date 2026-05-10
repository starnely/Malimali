import { useState, useEffect } from 'react'
import {
  MdLock, MdPerson, MdVisibility,
  MdVisibilityOff, MdAdminPanelSettings
} from 'react-icons/md'
import { useApp } from '@/context/AppContext'
import { useSocketActions } from '@/context/SocketContext' // 1. Import Socket Actions
import styles from '@/styles/Login.module.css'

export default function Login({ onLogin }) {
  const { login, isSetupComplete, setupOwner } = useApp();
  const { refreshSocket } = useSocketActions(); // 2. Initialize refresh function

  const [isSetupMode, setIsSetupMode] = useState(!isSetupComplete);

  // Login form state
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  // Setup form state
  const [name, setName] = useState('')
  const [newUsername, setNewUsername] = useState('')
  const [newPassword, setNewPassword] = useState('')

  // UI feedback state
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setIsSetupMode(!isSetupComplete)
  }, [isSetupComplete])

  // ✅ Handle login
  const handleLogin = async () => {
    if (!username || !password) {
      setError('Please enter username and password')
      return
    }
    setLoading(true)
    const result = await login(username, password)
    setLoading(false)

    if (result.success) {
      setError('')
      refreshSocket() // 3. Trigger socket to connect with fresh user data
      onLogin() 
    } else {
      setError('Invalid credentials or account inactive')
    }
  }

  // ✅ Handle system setup
  const handleSetup = async () => {
    if (!name || !newUsername || !newPassword) {
      setError('All fields are required')
      return
    }
    setLoading(true)
    const result = await setupOwner(newUsername, newPassword, name)
    setLoading(false)

    if (!result.success) {
      setError(result.message)
      return
    }

    setSuccess('Setup complete. You can now login.')
    setError('')
    setIsSetupMode(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#f4f6f9] to-[#e9eef5] font-[Arial,sans-serif]">
      <div className="w-full max-w-[400px] bg-white rounded-2xl px-6 py-8 border border-[#e6e6e6] shadow-[0_15px_40px_rgba(0,0,0,0.08)]">

        {/* HEADER */}
        <div className="text-center mb-6">
          <div className="w-[60px] h-[60px] mx-auto mb-3 bg-[#185FA5] text-white flex items-center justify-center rounded-[14px] text-[26px]">
            {isSetupMode ? <MdAdminPanelSettings /> : <MdLock />}
          </div>
          <h1 className="text-xl font-bold text-gray-800">Malimali POS</h1>
          <p className="text-sm text-gray-500 mt-1">
            {isSetupMode ? 'Setup your system (Owner account)' : 'Sign in to your account'}
          </p>
        </div>

        {isSetupMode ? (
          <>
            <Field label="Owner Name">
              <InputBox icon={<MdPerson />}>
                <input
                  placeholder="e.g. John Doe"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className={styles.input}
                />
              </InputBox>
            </Field>

            <Field label="Username">
              <InputBox icon={<MdPerson />}>
                <input
                  placeholder="Create username"
                  value={newUsername}
                  onChange={e => setNewUsername(e.target.value)}
                  className={styles.input}
                />
              </InputBox>
            </Field>

            <Field label="Password">
              <InputBox
                icon={<MdLock />}
                rightIcon={
                  <span
                    className="absolute right-[10px] top-1/2 -translate-y-1/2 cursor-pointer text-gray-400"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <MdVisibilityOff /> : <MdVisibility />}
                  </span>
                }
              >
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Create strong password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  className={styles.input}
                />
              </InputBox>
              <p className="text-[11px] text-gray-400 mt-1">
                Must contain uppercase letter & number
              </p>
            </Field>

            <button onClick={handleSetup} disabled={loading} className={styles.loginBtn}>
              {loading ? 'Setting up...' : 'Setup System'}
            </button>
          </>
        ) : (
          <>
            <Field label="Username">
              <InputBox icon={<MdPerson />}>
                <input
                  placeholder="Enter username"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleLogin()}
                  className={styles.input}
                />
              </InputBox>
            </Field>

            <Field label="Password">
              <InputBox
                icon={<MdLock />}
                rightIcon={
                  <span
                    className="absolute right-[10px] top-1/2 -translate-y-1/2 cursor-pointer text-gray-400"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <MdVisibilityOff /> : <MdVisibility />}
                  </span>
                }
              >
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleLogin()}
                  className={styles.input}
                />
              </InputBox>
            </Field>

            <button onClick={handleLogin} disabled={loading} className={styles.loginBtn}>
              {loading ? 'Logging in...' : 'Login'}
            </button>
          </>
        )}

        {/* FEEDBACK */}
        {error && (
          <div className="mt-3 bg-[#ffe5e5] text-[#a10000] px-3 py-2 rounded-lg text-[13px]">
            {error}
          </div>
        )}
        {success && (
          <div className="mt-3 bg-[#EAF3DE] text-[#27500A] px-3 py-2 rounded-lg text-[13px]">
            {success}
          </div>
        )}
      </div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div className="mb-[14px]">
      <label className="block text-[13px] text-[#444] mb-[6px]">{label}</label>
      {children}
    </div>
  )
}

function InputBox({ icon, rightIcon, children }) {
  return (
    <div className="relative">
      <span className="absolute left-[10px] top-1/2 -translate-y-1/2 text-gray-400">
        {icon}
      </span>
      {children}
      {rightIcon}
    </div>
  )
}