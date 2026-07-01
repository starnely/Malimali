// Normalise any Kenyan phone format to E.164 (+2547XXXXXXXX)
function normalizePhone(phone) {
  let p = String(phone || '').trim().replace(/\D/g, '')
  if (!p) return null
  if (p.startsWith('0')) p = '254' + p.slice(1)
  if (p.startsWith('7') || p.startsWith('1')) p = '254' + p
  return '+' + p
}

function getSmsEndpoint() {
  const username = (process.env.AT_USERNAME || '').toLowerCase()
  return username === 'sandbox'
    ? 'https://api.sandbox.africastalking.com/version1/messaging'
    : 'https://api.africastalking.com/version1/messaging'
}

/**
 * sendSmsReceipt — fire-and-forget M-Pesa receipt SMS via Africa's Talking.
 *
 * receiptData: { store, receiptId, itemCount, finalTotal, mpesaReceiptNumber, date }
 *
 * Resolves silently on success; logs and resolves (never throws) on failure
 * so callers can safely use it without a .catch() guard.
 */
async function sendSmsReceipt(phone, receiptData) {
  const apiKey   = process.env.AT_API_KEY
  const username = process.env.AT_USERNAME

  if (!apiKey || !username) {
    console.warn('[SMS] Africa\'s Talking not configured (AT_API_KEY / AT_USERNAME missing) — skipping receipt SMS')
    return
  }

  const to = normalizePhone(phone)
  if (!to) {
    console.warn('[SMS] Cannot send receipt — phone number missing or invalid:', phone)
    return
  }

  const { store, receiptId, itemCount, finalTotal, mpesaReceiptNumber, date } = receiptData

  const storeName = String(store || 'POS').slice(0, 20)
  const total     = Number(finalTotal || 0).toLocaleString('en-KE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
  const mpesaRef  = mpesaReceiptNumber || 'N/A'
  const count     = Number(itemCount) || 0
  const dateStr   = date || new Date().toISOString().split('T')[0]

  const message = [
    storeName,
    `Receipt: ${receiptId}`,
    `${count} item${count !== 1 ? 's' : ''} · KSh ${total}`,
    `Mpesa: ${mpesaRef}`,
    dateStr,
    'Thank you!',
  ].join('\n')

  const endpoint = getSmsEndpoint()

  // ── Temporary credential debug — remove after confirming SMS works ──
  const maskedKey = apiKey.length > 10
    ? `${apiKey.slice(0, 6)}...${apiKey.slice(-4)}`
    : `${apiKey.slice(0, 3)}...(${apiKey.length} chars total)`
  console.log('[SMS Debug] AT_USERNAME:', username)
  console.log('[SMS Debug] AT_API_KEY: ', maskedKey)
  console.log('[SMS Debug] Endpoint:   ', endpoint)
  console.log('[SMS Debug] Sending to: ', to)
  // ────────────────────────────────────────────────────────────────────

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'apiKey':         apiKey,           // capital K — matches AT docs exactly
        'Accept':         'application/json',
        'Content-Type':   'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ username, to, message }).toString(),
    })

    const rawBody = await res.text()
    console.log('[SMS Debug] AT response status:', res.status)
    console.log('[SMS Debug] AT response body:  ', rawBody)

    if (!res.ok) {
      console.error('[SMS] AT returned HTTP', res.status, '— see body above for details')
      return
    }

    let data
    try {
      data = JSON.parse(rawBody)
    } catch {
      console.error('[SMS] AT response is not valid JSON:', rawBody)
      return
    }

    console.log(`[SMS] Receipt sent to ${to} (${receiptId})`)
    for (const r of data?.SMSMessageData?.Recipients ?? []) {
      console.log(`[SMS]   → ${r.number} status: ${r.status}, cost: ${r.cost}`)
    }
  } catch (err) {
    console.error('[SMS] Network error sending receipt to', to, '—', err.message)
  }
}

module.exports = { sendSmsReceipt }
