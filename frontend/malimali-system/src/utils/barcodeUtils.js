// Detect variable-weight EAN-13 barcodes (prefix "2", used by weigh stations)
export function isWeightBarcode(code) {
  const trimmed = String(code).trim()
  return trimmed.length === 13 && trimmed.startsWith('2') && /^\d+$/.test(trimmed)
}

// Client-side partial decode — display only; server validates the check digit on commit.
// Format: 2[PLU×5][weight×10×5][0][check]
export function decodeWeightBarcode(code) {
  const trimmed = String(code).trim()
  if (trimmed.length !== 13 || !trimmed.startsWith('2') || !/^\d+$/.test(trimmed)) return null
  const pluNumber = parseInt(trimmed.substring(1, 6), 10)
  const weightRaw = parseInt(trimmed.substring(6, 11), 10)
  const weightKg  = weightRaw / 10 / 1000   // ×10 encoded → grams → kg
  return { pluNumber, weightKg }
}
