import { useEffect, useRef } from 'react'
import JsBarcode from 'jsbarcode'

export default function BarcodeImage({ value, showText = false, id }) {
  const svgRef = useRef(null)

  useEffect(() => {
    if (!svgRef.current) return

    const safeValue = String(value || '').trim()

    if (!safeValue) {
      svgRef.current.innerHTML = ''
      return
    }

    try {
      JsBarcode(svgRef.current, safeValue, {
        format: 'CODE128',
        width: 2,
        height: 50,       // Slightly shortened height to fit sticker grids better
        displayValue: showText, 
        margin: 4,        // Tighter margins prevent label overflow
        background: '#ffffff',
        lineColor: '#000000',
      })
    } catch (e) {
      console.error('Barcode render error', e)
      svgRef.current.innerHTML = '<text x="10" y="25" fill="red" font-size="12" font-family="sans-serif">Invalid Barcode</text>'
    }
  }, [value, showText])

  return (
    <div className="flex flex-col items-center justify-center w-full animate-fadeIn">
      <svg
        id={id} // 👈 Added: Allows your downloand handler to target this node directly
        ref={svgRef}
        className="w-full max-w-xs h-auto transition-transform duration-300 hover:scale-105"
        // ✅ CRITICAL FALLBACK: Keeps dimensions precise inside raw print windows lacking Tailwind
        style={{ width: '100%', maxWidth: '240px', height: 'auto', display: 'block' }}
      />

      {/* Optional readable text below barcode */}
      {!showText && value && (
        <div 
          className="text-[11px] text-gray-500 mt-1 tracking-wide"
          style={{ fontSize: '11px', color: '#6b7280', fontFamily: 'monospace', marginTop: '4px' }}
        >
          {value}
        </div>
      )}
    </div>
  )
}