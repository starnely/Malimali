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

// ── Checksum validation ────────────────────────────────────────────────────
// GS1 mod-10 check digit shared by EAN-13, UPC-A, EAN-8.
// Weight rule (from right, 1-indexed): odd distance → ×3, even → ×1.
function gs1CheckDigit(code) {
  if (!/^\d+$/.test(code) || code.length < 2) return false
  const n = code.length
  let sum = 0
  for (let i = 0; i < n - 1; i++) {
    sum += parseInt(code[i], 10) * ((n - 2 - i) % 2 === 0 ? 3 : 1)
  }
  return (10 - (sum % 10)) % 10 === parseInt(code[n - 1], 10)
}

// Expand 8-digit UPC-E to 12-digit UPC-A so gs1CheckDigit can validate it.
// The final digit of the 6 data digits determines the expansion pattern.
function expandUPCE(upce) {
  if (upce.length !== 8 || !/^\d+$/.test(upce)) return null
  const S = upce[0], D = upce.slice(1, 7), C = upce[7], last = D[5]
  let mid
  if (last === '0' || last === '1' || last === '2') mid = D[0]+D[1]+last+'0000'+D[2]+D[3]+D[4]
  else if (last === '3') mid = D[0]+D[1]+D[2]+'00000'+D[3]+D[4]
  else if (last === '4') mid = D[0]+D[1]+D[2]+D[3]+'00000'+D[4]
  else                   mid = D[0]+D[1]+D[2]+D[3]+D[4]+last+'0000'
  return S + mid + C // 12 digits
}

const _F = Html5QrcodeSupportedFormats
// Returns false only for formats with a mandatory checksum that fails.
// Unrecognised/unlisted formats pass silently (no false rejections).
function passesChecksum(code, fmt) {
  if (fmt === _F.EAN_13) return /^\d{13}$/.test(code) && gs1CheckDigit(code)
  if (fmt === _F.UPC_A)  return /^\d{12}$/.test(code) && gs1CheckDigit(code)
  if (fmt === _F.EAN_8)  return /^\d{8}$/.test(code)  && gs1CheckDigit(code)
  if (fmt === _F.UPC_E)  { const e = expandUPCE(code); return e !== null && gs1CheckDigit(e) }
  return true // Code 39, Code 128, QR — no mandatory check digit
}

function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.type = 'sine'
    osc.frequency.value = 1046 // C6
    gain.gain.setValueAtTime(0.3, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.18)
  } catch (_) {}
}

// Module-level mutex: serialises all start/stop operations so React
// StrictMode's mount→unmount→remount cycle never runs two concurrent
// Html5Qrcode.start() calls against the same div element.
//
// Why this is needed:
//   html5-qrcode's start() calls clearElement() (innerHTML='') at the
//   very beginning — before the async camera opens. So both the first
//   and second mount clear the div and then BOTH await their camera
//   streams, which both inject a <video> when they eventually resolve.
//   Our earlier innerHTML='' in cleanup ran at the wrong time (before
//   either scanner had injected) and didn't fix this.
//
// The mutex ensures: run1 → stop1 → run2, never run1 ∥ run2.
let _mutex = Promise.resolve()

export default function CameraScanner({ onScan, onClose, continuous = false, inline = false }) {
  const [error, setError] = useState('')
  const [flash, setFlash] = useState(false)
  const [scanCount, setScanCount] = useState(0)
  const firedRef = useRef(false)
  const lastScanRef = useRef({ code: '', time: 0 })
  const prevDecodeRef = useRef({ code: '', count: 0 })
  const onScanRef = useRef(onScan)
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onScanRef.current = onScan
    onCloseRef.current = onClose
  })

  useEffect(() => {
    let cancelled = false
    let localScanner = null

    _mutex = _mutex.then(async () => {
      // StrictMode fast-path: cleanup already fired before this microtask
      // ran, so cancelled=true. Bail out — the next queued run() (from the
      // second mount) will start the real scanner.
      if (cancelled) return

      const region = document.getElementById(SCANNER_DIV_ID)
      if (region) region.innerHTML = ''

      const scanner = new Html5Qrcode(SCANNER_DIV_ID, {
        formatsToSupport: RETAIL_FORMATS,
        useBarCodeDetectorIfSupported: true,
        verbose: false,
      })
      localScanner = scanner
      firedRef.current = false

      try {
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 20, qrbox: { width: 240, height: 240 } },
          (decodedText, decodedResult) => {
            if (cancelled) return

            // Silently reject frames whose GS1 check digit doesn't match.
            // Keeps corrupted reads and partial decodes from ever reaching onScan.
            const fmt = decodedResult?.result?.format?.format
            if (!passesChecksum(decodedText, fmt)) return

            if (!continuous) {
              // Single-scan with 2-frame consensus: same code must appear on
              // two consecutive successful decodes before accepting (~50 ms at
              // 20 fps). A different code on any frame resets the counter.
              if (firedRef.current) return
              const prev = prevDecodeRef.current
              if (decodedText === prev.code) {
                const count = prev.count + 1
                prevDecodeRef.current = { code: decodedText, count }
                if (count < 2) return
              } else {
                prevDecodeRef.current = { code: decodedText, count: 1 }
                return
              }
              firedRef.current = true
              scanner.stop().catch(() => {}).finally(() => {
                if (cancelled) return
                onScanRef.current(decodedText)
                onCloseRef.current()
              })
              return
            }

            // Continuous (POS): debounce same barcode within 1500ms;
            // a different code is always accepted immediately. No consensus
            // check here — speed matters more than double-verification.
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

        // start() has resolved — isScanning is now true. If cleanup fired
        // while we were awaiting the camera opening, stop immediately so
        // the mutex's next queued run() gets a clean div.
        if (cancelled && scanner.isScanning) {
          await scanner.stop().catch(() => {})
        }
      } catch (err) {
        if (cancelled) return
        const msg = String(err?.message || err || '').toLowerCase()
        if (msg.includes('permission') || msg.includes('denied') || msg.includes('notallowed')) {
          setError('Camera permission denied. Tap the camera icon in your browser address bar and allow access, then try again.')
        } else {
          setError('Could not start camera. Make sure no other app is using it, then try again.')
        }
      }
    }).catch(() => {})

    return () => {
      cancelled = true
      // Queue teardown after this mount's start() has completed. html5-qrcode
      // throws synchronously if stop() is called before start() resolves,
      // so we must wait for the mutex slot to arrive before calling stop().
      _mutex = _mutex.then(async () => {
        if (localScanner?.isScanning) {
          await localScanner.stop().catch(() => {})
        }
      }).catch(() => {})
    }
  }, [continuous]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Inline mode: slot into the left panel in place of category tabs + grid ──
  if (inline) {
    return (
      <div className={p.posInlineCamera}>
        {error ? (
          <div className={p.cameraError}>{error}</div>
        ) : (
          <>
            <div
              id={SCANNER_DIV_ID}
              className={p.posInlineCameraRegion}
              style={flash ? { outline: '3px solid var(--success)', outlineOffset: '-3px' } : undefined}
            />
            <div className={p.posInlineCameraFooter}>
              <p className={p.posInlineCameraHint}>
                {scanCount > 0
                  ? `${scanCount} item${scanCount !== 1 ? 's' : ''} scanned — keep scanning`
                  : 'Point camera at barcodes — auto-adds to cart'}
              </p>
            </div>
          </>
        )}
      </div>
    )
  }

  // ── Overlay mode: full-screen (used in Add Product registration) ──
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
