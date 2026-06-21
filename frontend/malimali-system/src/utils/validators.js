// Accepts: 07XXXXXXXX, 01XXXXXXXX, 2547XXXXXXXX, 2541XXXXXXXX, +254 variants
export function isValidKenyanPhone(phone) {
  const cleaned = phone.trim().replace(/\s+/g, '')
  return /^(07\d{8}|01\d{8}|2547\d{8}|2541\d{8}|\+2547\d{8}|\+2541\d{8})$/.test(cleaned)
}
