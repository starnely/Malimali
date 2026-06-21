// Detect variable-weight EAN-13 barcodes (prefix "2", used by weigh stations)
export function isWeightBarcode(code) {
  const trimmed = String(code).trim()
  return trimmed.length === 13 && trimmed.startsWith('2') && /^\d+$/.test(trimmed)
}
