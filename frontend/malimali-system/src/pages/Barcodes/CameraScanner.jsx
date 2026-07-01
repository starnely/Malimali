import { useEffect, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { MdClose, MdCameraAlt } from 'react-icons/md'
import p from '@/styles/POS.module.css'

const SCANNER_DIV_ID = 'pos-camera-scanner-region'

export default function CameraScanner({ onScan, onClose }) {
  const [error, setError] = useState('')
  const scannerRef = useRef(null)
  const firedRef = useRef(false)

  useEffect(() => {
    const html5QrCode = new Html5Qrcode(SCANNER_DIV_ID)
    scannerRef.current = html5QrCode
    firedRef.current = false

    html5QrCode
      .start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 150 } },
        (decodedText) => {
          if (firedRef.current) return
          firedRef.current = true
          html5QrCode
            .stop()
            .catch(() => {})
            .finally(() => {
              onScan(decodedText)
              onClose()
            })
        },
        () => { /* scan misses are normal */ }
      )
      .catch((err) => {
        const msg = String(err?.message || err || '').toLowerCase()
        if (msg.includes('permission') || msg.includes('denied') || msg.includes('notallowed')) {
          setError('Camera permission denied. Tap the camera icon in your browser address bar and allow access, then try again.')
        } else {
          setError('Could not start camera. Make sure no other app is using it, then try again.')
        }
      })

    return () => {
      if (scannerRef.current?.isScanning) {
        scannerRef.current.stop().catch(() => {})
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={p.cameraScannerOverlay} onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className={p.cameraScannerBox}>
        <div className={p.cameraScannerHeader}>
          <MdCameraAlt size={18} style={{ color: 'var(--primary)', flexShrink: 0 }} />
          <span className={p.cameraScannerTitle}>Scan Barcode</span>
          <button className={p.cameraScannerClose} onClick={onClose} aria-label="Close camera">
            <MdClose size={18} />
          </button>
        </div>

        {error ? (
          <div className={p.cameraError}>{error}</div>
        ) : (
          <>
            <div id={SCANNER_DIV_ID} className={p.cameraScannerRegion} />
            <p className={p.cameraScannerHint}>Point camera at a barcode — it scans automatically</p>
          </>
        )}
      </div>
    </div>
  )
}
