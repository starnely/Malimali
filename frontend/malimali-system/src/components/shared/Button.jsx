import styles from '@/styles/Button.module.css'

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  disabled = false,
  onClick,
  className = '',
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        ${styles.btn}
        ${styles[variant]}
        ${styles[size]}
        ${disabled ? styles.disabled : ''}
        ${className}
      `}
    >
      {children}
    </button>
  )
}