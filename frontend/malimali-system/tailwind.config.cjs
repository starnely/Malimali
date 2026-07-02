/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // ── Brand ──────────────────────────────────────────────
        primary:       'var(--primary)',
        'primary-dark':'var(--primary-dark)',
        'primary-light':'var(--primary-light)',
        'primary-muted':'var(--primary-muted)',

        // ── Sidebar ────────────────────────────────────────────
        sidebar:       'var(--sidebar-bg)',
        'sidebar-text':'var(--sidebar-text)',
        'sidebar-active':'var(--sidebar-active-bg)',

        // ── Semantic ───────────────────────────────────────────
        success:       'var(--success)',
        'success-light':'var(--success-light)',
        warning:       'var(--warning)',
        'warning-light':'var(--warning-light)',
        danger:        'var(--danger)',
        'danger-light': 'var(--danger-light)',
        info:          'var(--info)',
        'info-light':  'var(--info-light)',

        // ── Surfaces ───────────────────────────────────────────
        page:          'var(--bg-page)',
        card:          'var(--bg-card)',
        muted:         'var(--bg-muted)',
        soft:          'var(--border-soft)',
      },
      backgroundColor: {
        page:   'var(--bg-page)',
        card:   'var(--bg-card)',
        muted:  'var(--bg-muted)',
      },
      textColor: {
        base:      'var(--text-primary)',
        secondary: 'var(--text-secondary)',
        muted:     'var(--text-muted)',
        inverse:   'var(--text-inverse)',
      },
      borderColor: {
        soft:   'var(--border-soft)',
        medium: 'var(--border-medium)',
      },
      boxShadow: {
        card:     'var(--shadow-card)',
        dropdown: 'var(--shadow-dropdown)',
        sidebar:  'var(--shadow-sidebar)',
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
      },
      fontFamily: {
        sans: ['"DM Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      keyframes: {
        slideInRight: {
          from: { transform: 'translateX(100%)', opacity: '0' },
          to:   { transform: 'translateX(0)',     opacity: '1' },
        },
        slideInLeft: {
          from: { transform: 'translateX(-100%)', opacity: '0' },
          to:   { transform: 'translateX(0)',      opacity: '1' },
        },
        fadeIn: {
          from: { opacity: '0', transform: 'translateY(-6px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(10px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        pulse: {
          '0%, 100%': { opacity: '1' },
          '50%':      { opacity: '0.5' },
        },
      },
      animation: {
        slideInRight: 'slideInRight 0.3s cubic-bezier(0.16,1,0.3,1) forwards',
        slideInLeft:  'slideInLeft 0.3s cubic-bezier(0.16,1,0.3,1) forwards',
        fadeIn:       'fadeIn 0.2s ease-out forwards',
        slideUp:      'slideUp 0.25s ease-out forwards',
      },
    },
  },
  plugins: [
    function ({ addVariant }) {
      addVariant('hover', '@media (hover: hover) { &:hover }')
    },
  ],
}