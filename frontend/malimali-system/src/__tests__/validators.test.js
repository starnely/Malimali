import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { isValidKenyanPhone } from '@/utils/validators'

// ── isValidKenyanPhone ────────────────────────────────────────────────

describe('isValidKenyanPhone', () => {
  // ── Valid formats ───────────────────────────────────────────────────
  it('accepts 07XXXXXXXX (Safaricom/Airtel local format)', () => {
    expect(isValidKenyanPhone('0712345678')).toBe(true)
  })

  it('accepts 01XXXXXXXX (Airtel local format)', () => {
    expect(isValidKenyanPhone('0112345678')).toBe(true)
  })

  it('accepts 2547XXXXXXXX (international without +)', () => {
    expect(isValidKenyanPhone('254712345678')).toBe(true)
  })

  it('accepts 2541XXXXXXXX (Airtel international without +)', () => {
    expect(isValidKenyanPhone('254112345678')).toBe(true)
  })

  it('accepts +2547XXXXXXXX (international with +)', () => {
    expect(isValidKenyanPhone('+254712345678')).toBe(true)
  })

  it('accepts +2541XXXXXXXX (Airtel international with +)', () => {
    expect(isValidKenyanPhone('+254112345678')).toBe(true)
  })

  it('strips surrounding whitespace before validating', () => {
    expect(isValidKenyanPhone('  0712345678  ')).toBe(true)
  })

  it('strips internal spaces before validating', () => {
    // e.g. "0712 345 678" typed with spaces
    expect(isValidKenyanPhone('0712 345 678')).toBe(true)
  })

  // ── Invalid formats ─────────────────────────────────────────────────
  it('rejects 08XXXXXXXX (not a valid Kenyan prefix)', () => {
    expect(isValidKenyanPhone('0812345678')).toBe(false)
  })

  it('rejects 09XXXXXXXX', () => {
    expect(isValidKenyanPhone('0912345678')).toBe(false)
  })

  it('rejects a number that is too short (9 digits)', () => {
    expect(isValidKenyanPhone('071234567')).toBe(false)
  })

  it('rejects a number that is too long (11 digits local)', () => {
    expect(isValidKenyanPhone('07123456789')).toBe(false)
  })

  it('rejects a number containing letters', () => {
    expect(isValidKenyanPhone('071234567A')).toBe(false)
  })

  it('rejects an empty string', () => {
    expect(isValidKenyanPhone('')).toBe(false)
  })

  it('rejects a number with hyphens', () => {
    expect(isValidKenyanPhone('0712-345-678')).toBe(false)
  })

  it('rejects a US-format number', () => {
    expect(isValidKenyanPhone('+15551234567')).toBe(false)
  })
})

// ── getTomorrowDate (inline — not exported, tested via CheckoutModal in Tier 4)
// Documented here for completeness: the function is:
//   const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().split('T')[0]
// It is a private function in CheckoutModal.jsx — component-level tests cover it there.
