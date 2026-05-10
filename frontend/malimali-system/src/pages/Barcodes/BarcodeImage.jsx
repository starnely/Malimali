import { useEffect, useRef } from 'react'
import JsBarcode from 'jsbarcode'

export default function BarcodeImage({ value, showText = false }) {
  const svgRef = useRef(null)

  useEffect(() => {
    if (!svgRef.current) return

    const safeValue = String(value || '').trim()

    if (!safeValue) {
      // Clear SVG if no value
      svgRef.current.innerHTML = ''
      return
    }

    try {
      JsBarcode(svgRef.current, safeValue, {
        format: 'CODE128',
        width: 2,
        height: 60,
        displayValue: showText, // ✅ controlled externally
        margin: 8,
        background: '#ffffff',
        lineColor: '#1a1a1a',
      })
    } catch (e) {
      console.error('Barcode render error', e)
      svgRef.current.innerHTML = '<text x="10" y="20" fill="red">Invalid barcode</text>'
    }
  }, [value, showText])

  return (
    <div className="flex flex-col items-center justify-center w-full animate-fadeIn">
      <svg
        ref={svgRef}
        className="w-full max-w-xs h-auto transition-transform duration-300 hover:scale-105"
      />

      {/* Optional readable text below barcode */}
      {!showText && value && (
        <div className="text-[11px] text-gray-500 mt-1 tracking-wide">
          {value}
        </div>
      )}
    </div>
  )
}