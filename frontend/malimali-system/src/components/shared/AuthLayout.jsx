const AuthLayout = ({ children }) => {
  return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg-card)' }}>

      {/* LEFT — Developer branding */}
      <div
        className="hidden lg:flex w-1/2 flex-col items-center justify-center p-12"
        style={{ background: 'var(--bg-page)', borderRight: '1px solid var(--border-soft)' }}
      >
        <div className="text-center">
          {/* Dev logo */}
          <div
            className="w-12 h-12 flex items-center justify-center rounded-md mx-auto mb-6 text-xl font-bold"
            style={{ background: 'var(--sidebar-bg)', color: '#fff' }}
          >
            MKD
          </div>

          <h1 className="font-bold text-3xl mb-2" style={{ color: 'var(--primary)' }}>
            POS (Point Of Sales) v2.0
          </h1>

          <div className="my-8">
            <img src="/pos.jpg" alt="POS System" className="w-full max-w-md mx-auto" />
          </div>

          <div className="mt-12 text-sm" style={{ color: 'var(--text-muted)' }}>
            <p>© 2026 - 2050 POS (Point Of Sales) v2.0.</p>
            <p>
              Designed & Developed by:{' '}
              <span className="font-medium" style={{ color: 'var(--primary-muted)' }}>NthigaERPTech</span>
            </p>
          </div>
        </div>
      </div>

      {/* RIGHT — Dynamic content */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          {children}
        </div>
      </div>
    </div>
  )
}

export default AuthLayout
