/**
 * test-mpesa-callback.js
 *
 * Simulates a successful Safaricom STK callback against a real pending sale.
 * Run from the backend directory:
 *
 *   node test-mpesa-callback.js
 *
 * Prerequisites:
 *   - Backend server running on localhost:5000
 *   - At least one M-Pesa sale in status "pending" with a checkoutRequestId set
 *     (initiate a payment from the POS terminal first — the pending sale is
 *     created before Safaricom is contacted, so no real phone is needed if the
 *     STK push reaches Daraja sandbox)
 */

require('dotenv').config()
const mongoose = require('mongoose')

const MONGO_URI    = process.env.MONGO_URI || 'mongodb://localhost:27017/pos-system'
const CALLBACK_URL = 'http://localhost:5000/api/mpesa/callback'

async function main() {
  await mongoose.connect(MONGO_URI)
  console.log('Connected to MongoDB:', MONGO_URI)

  const Sale = require('./models/Sale')

  // Find the most recent sale that has a checkoutRequestId and a phone number.
  // Prefer "pending" (the normal state after a real STK push) but also accept
  // "failed" in case a previous callback already marked it failed.
  const sale = await Sale.findOne({
    mpesaCheckoutRequestId: { $exists: true, $ne: '' },
    'paymentInfo.mpesaPhone': { $exists: true, $ne: '' },
    status: { $in: ['pending', 'failed'] },
  }).sort({ createdAt: -1 }).lean()

  if (!sale) {
    console.error('\nNo usable M-Pesa sale found.')
    console.error('To create one: go to POS terminal → add items to cart → Charge Customer → M-Pesa → enter any phone number and submit.')
    console.error('The pending sale is written to MongoDB before Safaricom is contacted, so the STK push does not need to succeed.')
    await mongoose.disconnect()
    process.exit(1)
  }

  const amount = Math.ceil(sale.paymentInfo?.finalTotal ?? sale.total ?? 1)

  // Fake receipt number — prefixed SIM so it is obviously synthetic in logs/DB
  const fakeReceiptNumber = 'SIM' + Date.now().toString(36).toUpperCase().slice(-4)
                          + Math.random().toString(36).toUpperCase().slice(2, 6)

  console.log('\n── Sale selected ──────────────────────────────────')
  console.log('  _id:                ', String(sale._id))
  console.log('  receiptId:          ', sale.receiptId)
  console.log('  status:             ', sale.status)
  console.log('  mpesaPhone:         ', sale.paymentInfo?.mpesaPhone)
  console.log('  checkoutRequestId:  ', sale.mpesaCheckoutRequestId)
  console.log('  merchantRequestId:  ', sale.mpesaMerchantRequestId || '(not set)')
  console.log('  amount (finalTotal):', amount)
  console.log('  fake receipt#:      ', fakeReceiptNumber)
  console.log('───────────────────────────────────────────────────\n')

  const payload = {
    Body: {
      stkCallback: {
        MerchantRequestID: sale.mpesaMerchantRequestId || '29115-34620561-1',
        CheckoutRequestID: sale.mpesaCheckoutRequestId,
        ResultCode:        0,
        ResultDesc:        'The service request is processed successfully.',
        CallbackMetadata: {
          Item: [
            { Name: 'Amount',             Value: amount },
            { Name: 'MpesaReceiptNumber', Value: fakeReceiptNumber },
            { Name: 'Balance' },
            { Name: 'TransactionDate',    Value: Number(new Date().toISOString().replace(/\D/g, '').slice(0, 14)) },
            { Name: 'PhoneNumber',        Value: Number(String(sale.paymentInfo?.mpesaPhone || '').replace(/\D/g, '')) },
          ],
        },
      },
    },
  }

  console.log('Sending payload to', CALLBACK_URL)
  console.log(JSON.stringify(payload, null, 2), '\n')

  const res = await fetch(CALLBACK_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(payload),
  })

  const body = await res.text()
  console.log('── Callback endpoint response ──')
  console.log('  HTTP status:', res.status)
  console.log('  Body:       ', body)
  console.log()
  console.log('Now check your backend server logs for:')
  console.log('  [MPesa Callback] lines  — callback processing')
  console.log('  [SMS] lines             — SMS receipt dispatch')
  console.log()
  console.log('And verify in MongoDB that the sale status changed to "confirmed".')

  await mongoose.disconnect()
}

main().catch(err => {
  console.error('Script error:', err.message)
  process.exit(1)
})
