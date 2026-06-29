import { useEffect, useRef, useState } from 'react'
import { MdPrint, MdWarning } from 'react-icons/md'
import { useApp } from '@/context/AppContext'
import s from '@/styles/Barcodes.module.css'
import { API_BASE_URL as API_BASE } from '@/config/api'


export default function Receipt({ receipt, onClose }) {
  const { settings, currentUser, stores } = useApp()

  const [printStatus, setPrintStatus] = useState(null)
  const hasPrinted = useRef(false)

  const storeBranch       = receipt?.store || 'Main Branch'
  const matchedStore      = stores?.find(st => st._id === storeBranch || st.name === storeBranch)
  const branchDisplayName = matchedStore?.name || (typeof storeBranch === 'string' ? storeBranch : 'Main Branch')
  const receiptAddress    = matchedStore?.location || settings?.location || settings?.businessAddress || settings?.address || receipt?.address || 'Address Not Set'
  const receiptPhone      = matchedStore?.phone || settings?.phone || settings?.businessPhone || settings?.telephone || receipt?.phone || 'Phone Not Set'
  const receiptFooter     = settings?.receiptFooter || 'Thank you for shopping with us!'

  const payment          = receipt?.paymentInfo || receipt || {}
  const cashierName      = receipt?.cashier || receipt?.soldBy || currentUser?.fullname || currentUser?.name || currentUser?.username || 'Staff'
  const displayReceiptId = receipt?.receiptId || receipt?.saleId || 'N/A'

  const receiptDate = receipt?.date
    ? new Date(receipt.date).toLocaleDateString('en-CA')
    : new Date().toLocaleDateString('en-CA')

  const receiptTime = receipt?.time || (receipt?.createdAt
    ? new Date(receipt.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))

  const subtotal = (receipt?.items || []).reduce(
    (sum, item) => sum + (Number(item.price || item.sellPrice || 0) * item.qty), 0
  )
  const discount = Number(payment.discount || receipt?.discount || 0)
  const total    = Number(receipt?.total || receipt?.finalTotal || (subtotal - discount))

  const promiseDate      = payment.promiseDate || ''
  const isCredit         = payment.paymentMethod === 'credit'
  const formattedPromise = promiseDate
    ? new Date(promiseDate + 'T00:00:00').toLocaleDateString('en-KE', {
        weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
      })
    : ''

  const buildPrintPayload = () => ({
    printerType:      settings?.printerType,
    printerIp:        settings?.printerIp,
    printerPort:      9100,
    businessName:     settings?.companyName || settings?.businessName || 'Retail POS',
    branch:           branchDisplayName,
    address:          receiptAddress,
    phone:            receiptPhone,
    receiptId:        displayReceiptId,
    date:             receiptDate,
    time:             receiptTime,
    items:            receipt?.items || [],
    total:            receipt?.total,
    finalTotal:       payment.finalTotal || total,
    discount,
    paymentMethod:    payment.paymentMethod,
    cashGiven:        payment.cashGiven,
    change:           payment.change,
    mpesaPhone:       payment.mpesaPhone,
    cashPart:         payment.cashPart,
    mpesaPart:        payment.mpesaPart,
    cardApprovalCode: payment.cardApprovalCode,
    bankReference:    payment.bankReference,
    customerName:     payment.customerName,
    promiseDate,
    cashier:          cashierName,
    receiptFooter,
    kraPin:           settings?.kraPin || '',
    currency:         settings?.currency || 'KSh',
  })

  const callPrintAPI = async () => {
    const res = await fetch(`${API_BASE}/api/print/receipt`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${currentUser?.token}`
      },
      body: JSON.stringify(buildPrintPayload())
    })
    return await res.json()
  }

  useEffect(() => {
    if (!receipt) return
    if (hasPrinted.current) return
    hasPrinted.current = true

    const printerType = settings?.printerType || 'browser'

    if (printerType === 'browser') {
      setTimeout(() => {
        window.print()
        setPrintStatus('done')
      }, 400)
      return
    }

    const autoPrint = async () => {
      setPrintStatus('printing')
      try {
        const data = await callPrintAPI()
        if (data.success) {
          setPrintStatus('done')
        } else {
          setPrintStatus('fallback')
          setTimeout(() => window.print(), 400)
        }
      } catch {
        setPrintStatus('fallback')
        setTimeout(() => window.print(), 400)
      }
    }

    autoPrint()
  }, [receipt]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!receipt) return null

  const handleManualPrint = async () => {
    const printerType = settings?.printerType || 'browser'
    if (printerType === 'browser') { window.print(); return }

    setPrintStatus('printing')
    try {
      const data = await callPrintAPI()
      if (data.success) { setPrintStatus('done') }
      else { setPrintStatus('fallback'); window.print() }
    } catch {
      setPrintStatus('fallback')
      window.print()
    }
  }

  return (
    <div className={s.overlay}>
      <div className={s.receiptPaper}>

        {printStatus === 'printing' && (
          <div className={s.noPrint} style={{
            padding: '8px 12px', marginBottom: '10px', borderRadius: 'var(--radius-md)',
            background: 'var(--primary-light)', color: 'var(--primary)',
            fontSize: '12px', fontWeight: '600', textAlign: 'center',
            fontFamily: 'DM Sans, sans-serif',
          }}>
            🖨️ Sending to printer...
          </div>
        )}
        {printStatus === 'fallback' && (
          <div className={s.noPrint} style={{
            padding: '8px 12px', marginBottom: '10px', borderRadius: 'var(--radius-md)',
            background: 'var(--warning-light)', color: 'var(--warning-dark)',
            fontSize: '12px', fontWeight: '600', textAlign: 'center',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
            fontFamily: 'DM Sans, sans-serif',
          }}>
            <MdWarning /> Printer unreachable — using browser print
          </div>
        )}

        {/* Header */}
        <div className={s.rHeaderCenter}>
          <div className={s.rCompany}>{settings?.businessName || settings?.companyName || 'Retail POS'}</div>
          <div className={s.rBranch}>Branch: {branchDisplayName}</div>
          <div className={s.rAddress}>{receiptAddress}</div>
          <div className={s.rAddress}>Tel: {receiptPhone}</div>
          <div className={s.rMetaSmall} style={{ marginTop: '8px' }}>
            <strong>Receipt ID:</strong> {displayReceiptId}
          </div>
          <div className={s.rMetaSmall}>
            <strong>Date:</strong> {receiptDate} &nbsp;|&nbsp; <strong>Time:</strong> {receiptTime}
          </div>
        </div>

        <div className={s.rDivider} />

        <div className={s.rTableHeader}>
          <span>Qty</span><span>Description</span><span>Amount</span>
        </div>

        {/* ── Item rows — handles both normal and weighed items ── */}
        {(receipt.items || []).map((item, i) => {
          const isWeighed   = !!item.isWeighed
          const itemPrice   = Number(item.price || item.sellPrice || 0)
          const itemTotal   = itemPrice * item.qty
          const displayName = isWeighed && item.weightGrams
            ? `${item.name} (${item.weightGrams}g)`
            : item.name
          const displaySub  = isWeighed
            ? `${Number(item.weightKg || 0).toFixed(3)} kg × KSh ${Number(item.pricePerKg || 0).toLocaleString()}/kg`
            : `@ KSh ${itemPrice.toLocaleString()}`

          return (
            <div key={i} className={s.rRow}>
              <span>{item.qty}</span>
              <div className={s.rDesc}>
                <div>{displayName}</div>
                <div className={s.rSub}>{displaySub}</div>
              </div>
              <span>KSh {itemTotal.toLocaleString()}</span>
            </div>
          )
        })}

        <div className={s.rDivider} />

        <div className={s.rSummaryRow}>
          <span>Subtotal</span><span>KSh {subtotal.toLocaleString()}</span>
        </div>
        {discount > 0 && (
          <div className={s.rSummaryRow} style={{ color: '#d32f2f' }}>
            <span>Discount</span><span>− KSh {discount.toLocaleString()}</span>
          </div>
        )}
        <div className={s.rSummaryRow} style={{ fontSize: '1.15rem', fontWeight: 'bold', marginTop: '4px' }}>
          <span>Total</span><span>KSh {total.toLocaleString()}</span>
        </div>

        <div className={s.rDivider} style={{ borderStyle: 'dashed' }} />

        <div className={s.rSummaryRow}>
          <span>Paid via</span>
          <span style={{ fontWeight: 600, textTransform: 'capitalize' }}>
            {payment.paymentMethod === 'bank' ? 'Bank Transfer' : payment.paymentMethod || 'N/A'}
          </span>
        </div>
        {Number(payment.cashGiven) > 0 && (
          <div className={s.rSummaryRow}>
            <span>Amount Tendered</span><span>KSh {Number(payment.cashGiven).toLocaleString()}</span>
          </div>
        )}
        {Number(payment.change) > 0 && (
          <div className={s.rSummaryRow} style={{ fontWeight: 'bold' }}>
            <span>Change Due</span><span>KSh {Number(payment.change).toLocaleString()}</span>
          </div>
        )}
        {payment.paymentMethod === 'mpesa' && payment.mpesaPhone && (
          <div className={s.rSummaryRow}><span>M-Pesa No</span><span>{payment.mpesaPhone}</span></div>
        )}
        {payment.paymentMethod === 'split' && (
          <>
            <div className={s.rSummaryRow} style={{ fontSize: '0.9rem', color: '#666', paddingLeft: '8px' }}>
              <span>• Cash Portion</span><span>KSh {Number(payment.cashPart).toLocaleString()}</span>
            </div>
            <div className={s.rSummaryRow} style={{ fontSize: '0.9rem', color: '#666', paddingLeft: '8px' }}>
              <span>• M-Pesa Portion</span><span>KSh {Number(payment.mpesaPart).toLocaleString()}</span>
            </div>
          </>
        )}

        {/* Credit note */}
        {isCredit && (
          <div className={s.rCreditNote}>
            <div>CREDIT SALE — UNPAID BALANCE</div>
            <div>Customer: {payment.customerName || 'Walk-in Customer'}</div>
            {payment.customerPhone && (
              <div>Phone: {payment.customerPhone}</div>
            )}
            {formattedPromise && (
              <div style={{ marginTop: '4px', fontWeight: 'bold' }}>
                ⏰ Payment Due: {formattedPromise}
              </div>
            )}
          </div>
        )}

        {payment.paymentMethod === 'card' && (
          <div className={s.rSummaryRow}>
            <span>Approval Code</span>
            <span style={{ fontFamily: 'monospace', letterSpacing: '0.05em' }}>{payment.cardApprovalCode || 'N/A'}</span>
          </div>
        )}
        {payment.paymentMethod === 'bank' && (
          <div className={s.rSummaryRow}>
            <span>Transfer Ref</span>
            <span style={{ fontFamily: 'monospace', letterSpacing: '0.05em' }}>{payment.bankReference || 'N/A'}</span>
          </div>
        )}

        <div className={s.rDivider} />

        <div className={s.rFooter}>
          <div><strong>Served by:</strong> {cashierName}</div>
          <div style={{ fontStyle: 'italic', marginTop: '4px', color: '#555' }}>{receiptFooter}</div>
          {settings?.kraPin && (
            <div style={{ marginTop: '6px', fontSize: '10px', color: '#888' }}>KRA PIN: {settings.kraPin}</div>
          )}
        </div>

        {/* Action buttons */}
        <div className={`${s.receiptActions} ${s.noPrint}`}>
          <button onClick={onClose} className={s.receiptBtnSecondary}>New Sale</button>
          <button
            onClick={handleManualPrint}
            disabled={printStatus === 'printing'}
            className={s.receiptBtnPrimary}
            style={{ opacity: printStatus === 'printing' ? 0.7 : 1 }}
          >
            <MdPrint size={18} />
            {printStatus === 'printing' ? 'Printing...' : 'Print Receipt'}
          </button>
        </div>
      </div>
    </div>
  )
}
