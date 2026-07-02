import { useEffect, useRef, useState } from 'react'
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode'
import { MdClose, MdCameraAlt, MdCheckCircle } from 'react-icons/md'
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

function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.type = 'sine'
    osc.frequency.value = 1046 // C6 — bright, short confirmation tone
    gain.gain.setValueAtTime(0.3, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.18)
  } catch (_) {}
}

export default function CameraScanner({ onScan, onClose, continuous = false }) {
  const [error, setError] = useState('')
  const [flash, setFlash] = useState(false)
  const [scanCount, setScanCount] = useState(0)
  const scannerRef = useRef(null)
  const firedRef = useRef(false)
  // last accepted scan: { code, time } — used for continuous-mode debounce
  const lastScanRef = useRef({ code: '', time: 0 })
  const onScanRef = useRef(onScan)
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onScanRef.current = onScan
    onCloseRef.current = onClose
  })

  useEffect(() => {
    // Task A fix: clear any stale video DOM left by React StrictMode's
    // mount→unmount→remount cycle. html5-qrcode's async stop() may not have
    // finished removing its elements before the second mount's start() runs,
    // leaving two stacked <video> elements in the div.
    const region = document.getElementById(SCANNER_DIV_ID)
    if (region) region.innerHTML = ''

    // Guard flag so async stop().finally() callbacks after unmount are ignored.
    let active = true

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
          if (!active) return

          if (!continuous) {
            // Single-scan mode: fire once then close.
            if (firedRef.current) return
            firedRef.current = true
            html5QrCode
              .stop()
              .catch(() => {})
              .finally(() => {
                if (!active) return
                onScanRef.current(decodedText)
                onCloseRef.current()
              })
            return
          }

          // Continuous mode: debounce — same code within 1500ms is ignored to
          // prevent the same barcode firing many times while it stays in frame.
          // A different code is always accepted immediately.
          const now = Date.now()
          const last = lastScanRef.current
          if (decodedText === last.code && now - last.time < 1500) return

          lastScanRef.current = { code: decodedText, time: now }
          onScanRef.current(decodedText)

          beep()
          if (navigator.vibrate) navigator.vibrate(50)
          setFlash(true)
          setScanCount(c => c + 1)
          setTimeout(() => setFlash(false), 200)
        },
        () => {}
      )
      .catch((err) => {
        if (!active) return
        const msg = String(err?.message || err || '').toLowerCase()
        if (msg.includes('permission') || msg.includes('denied') || msg.includes('notallowed')) {
          setError('Camera permission denied. Tap the camera icon in your browser address bar and allow access, then try again.')
        } else {
          setError('Could not start camera. Make sure no other app is using it, then try again.')
        }
      })

    return () => {
      active = false
      if (scannerRef.current?.isScanning) {
        scannerRef.current.stop().catch(() => {})
      }
    }
  }, [continuous]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={p.cameraScannerOverlay} onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className={p.cameraScannerBox}>
        <div className={p.cameraScannerHeader}>
          <MdCameraAlt size={18} style={{ color: 'var(--primary)', flexShrink: 0 }} />
          <span className={p.cameraScannerTitle}>
            {continuous
              ? `Scan Barcodes${scanCount > 0 ? ` · ${scanCount} scanned` : ''}`
              : 'Scan Barcode'}
          </span>
          <button className={p.cameraScannerClose} onClick={onClose} aria-label="Close camera">
            <MdClose size={18} />
          </button>
        </div>

        {error ? (
          <div className={p.cameraError}>{error}</div>
        ) : (
          <>
            <div
              id={SCANNER_DIV_ID}
              className={p.cameraScannerRegion}
              style={flash ? { outline: '3px solid var(--success)', outlineOffset: '-3px' } : undefined}
            />
            {continuous ? (
              <div className={p.cameraScannerContinuousFooter}>
                <p className={p.cameraScannerHint} style={{ margin: 0, padding: 0 }}>
                  {scanCount > 0
                    ? `${scanCount} item${scanCount !== 1 ? 's' : ''} scanned — keep scanning or tap Done`
                    : 'Point camera at barcodes to scan'}
                </p>
                <button className={p.cameraScannerDoneBtn} onClick={onClose}>
                  <MdCheckCircle size={15} />
                  Done
                </button>
              </div>
            ) : (
              <p className={p.cameraScannerHint}>Point camera at a barcode — it scans automatically</p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
