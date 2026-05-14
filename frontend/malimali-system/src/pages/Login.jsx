import { useState } from 'react'
import {
  MdLock, MdPerson, MdVisibility,
  MdVisibilityOff
} from 'react-icons/md'
import { useApp } from '@/context/AppContext'
import { useSocketActions } from '@/context/SocketContext'
import styles from '@/styles/Login.module.css'

export default function Login({ onLogin }) {
  const { login, settings } = useApp();
  const { refreshSocket } = useSocketActions();

  // Login form state
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  // UI feedback state
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

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
      refreshSocket() 
      if (onLogin) onLogin() // Notifies App.jsx to show the dashboard
    } else {
      setError('Invalid credentials or account inactive')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#f4f6f9] to-[#e9eef5] font-[Arial,sans-serif]">
      <div className="w-full max-w-[400px] bg-white rounded-2xl px-6 py-8 border border-[#e6e6e6] shadow-[0_15px_40px_rgba(0,0,0,0.08)]">

        {/* HEADER */}
        <div className="text-center mb-6">
          <div className="w-[60px] h-[60px] mx-auto mb-3 bg-[#185FA5] text-white flex items-center justify-center rounded-[14px] text-[26px] overflow-hidden">
            {settings?.logo ? (
              <img src={settings.logo} alt="Logo" className="w-full h-full object-cover" />
            ) : (
              <MdLock />
            )}
          </div>
          <h1 className="text-xl font-bold text-gray-800">
            {settings?.businessName || 'POS System'}
          </h1>
          <p className="text-sm text-gray-500 mt-1">Sign in to your account</p>
        </div>

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

        <button 
          onClick={handleLogin} 
          disabled={loading} 
          className="w-full bg-[#185FA5] hover:bg-[#144d86] text-white py-3 rounded-xl font-bold transition-all disabled:opacity-50"
        >
          {loading ? 'Logging in...' : 'Login'}
        </button>

        {/* FEEDBACK */}
        {error && (
          <div className="mt-3 bg-[#ffe5e5] text-[#a10000] px-3 py-2 rounded-lg text-[13px] text-center">
            {error}
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