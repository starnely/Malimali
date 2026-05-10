import styles from '../styles/Alert.module.css'

export default function Alert({
  icon,
  title,
  children,
  variant = 'info',
}) {
  return (
    <div className={`${styles.alert} ${styles[variant]}`}>
      
      <div className={styles.icon}>
        {icon}
      </div>

      <div className="flex-1">
        {title && (
          <div className="font-semibold text-sm mb-1">
            {title}
          </div>
        )}

        <div className="text-sm">
          {children}
        </div>
      </div>

    </div>
  )
}