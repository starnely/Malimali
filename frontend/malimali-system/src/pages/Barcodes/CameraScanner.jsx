import { useEffect, useRef, useState } from 'react'
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode'
import { MdClose, MdCameraAlt } from 'react-icons/md'
import p from '@/styles/POS.module.css'

const SCANNER_DIV_ID = 'pos-camera-scanner-region'

const RETAIL_FORMATS = [
  Html5QrcodeSupportedFormats.EAN_13,
  Html5QrcodeSupportedFormats.EAN_8,
  Html5QrcodeSupportedFormats.UPC_A,
  Html5QrcodeSupportedFormats.UPC_E,
  Html5QrcodeSupportedFormats.CODE_128,
  Html5QrcodeSupportedFormats.CODE_39,
]

export default function CameraScanner({ onScan, onClose }) {
  const [error, setError] = useState('')
  const scannerRef = useRef(null)
  const firedRef = useRef(false)
  // Refs always point to the latest callbacks — the scanner's async callback
  // reads from refs so it never calls a stale closure captured at mount time.
  const onScanRef = useRef(onScan)
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onScanRef.current = onScan
    onCloseRef.current = onClose
  })

  useEffect(() => {
    const html5QrCode = new Html5Qrcode(SCANNER_DIV_ID, {
      formatsToSupport: RETAIL_FORMATS,
      useBarCodeDetectorIfSupported: true,
      verbose: false,
    })
    scannerRef.current = html5QrCode
    firedRef.current = false

    html5QrCode
      .start(
        { facingMode: 'environment' },
        { fps: 20, qrbox: { width: 240, height: 240 } },
        (decodedText) => {
          if (firedRef.current) return
          firedRef.current = true
          html5QrCode
            .stop()
            .catch(() => {})
            .finally(() => {
              onScanRef.current(decodedText)
              onCloseRef.current()
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
