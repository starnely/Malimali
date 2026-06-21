import { describe, it, expect } from 'vitest'
import { isWeightBarcode } from '@/utils/barcodeUtils'

describe('isWeightBarcode', () => {
  // ── Valid weight barcodes ─────────────────────────────────────────────
  it('returns true for a valid 13-digit weight barcode starting with 2', () => {
    expect(isWeightBarcode('2000121001234')).toBe(true)
  })

  it('returns true when digits encode zero weight (all zeros after prefix)', () => {
    expect(isWeightBarcode('2000000000000')).toBe(true)
  })

  it('trims leading and trailing whitespace before checking', () => {
    expect(isWeightBarcode('  2000121001234  ')).toBe(true)
  })

  it('coerces a numeric argument to string and still validates', () => {
    // Barcode scanners may emit numbers; String(2000121001234) === '2000121001234'
    expect(isWeightBarcode(2000121001234)).toBe(true)
  })

  // ── Wrong prefix ──────────────────────────────────────────────────────
  it('returns false for a normal product barcode starting with 1', () => {
    expect(isWeightBarcode('1234567890123')).toBe(false)
  })

  it('returns false for a barcode starting with 3', () => {
    expect(isWeightBarcode('3000121001234')).toBe(false)
  })

  it('returns false for a barcode starting with 0', () => {
    expect(isWeightBarcode('0000121001234')).toBe(false)
  })

  // ── Wrong length ──────────────────────────────────────────────────────
  it('returns false for a 12-digit barcode (too short)', () => {
    expect(isWeightBarcode('200012100123')).toBe(false)
  })

  it('returns false for a 14-digit barcode (too long)', () => {
    expect(isWeightBarcode('20001210012345')).toBe(false)
  })

  it('returns false for an empty string', () => {
    expect(isWeightBarcode('')).toBe(false)
  })

  // ── Non-numeric characters ────────────────────────────────────────────
  it('returns false when barcode contains a letter', () => {
    expect(isWeightBarcode('200012100123A')).toBe(false)
  })

  it('returns false when barcode contains an internal space', () => {
    // Spaces after trim are fine, but spaces embedded in the digits are not
    expect(isWeightBarcode('2000121 01234')).toBe(false)
  })

  it('returns false when barcode contains a hyphen', () => {
    expect(isWeightBarcode('2-00121001234')).toBe(false)
  })
})
