import { useState, useEffect, useRef } from 'react'
import { MdPerson, MdMoney, MdCallSplit, MdPhone, MdCheckCircle, MdWarning, MdCreditCard, MdAccountBalance, MdCalendarToday, MdBlock } from 'react-icons/md'
import { useApp } from '@/context/AppContext'
import { useSocket } from '@/context/SocketContext'
import s from '@/styles/Barcodes.module.css'
import { isValidKenyanPhone } from '@/utils/validators'

const ALL_METHODS = [
  { key: 'cash',   label: 'Cash',          icon: '💵' },
  { key: 'mpesa',  label: 'M-Pesa',        icon: '📱' },
  { key: 'split',  label: 'Split',         icon: '💳' },
  { key: 'credit', label: 'Credit',        icon: '📋' },
  { key: 'card',   label: 'Card',          icon: '💳' },
  { key: 'bank',   label: 'Bank Transfer', icon: '🏦' },
]

function getTomorrowDate() {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toISOString().split('T')[0]
}

const CODE_RX = /^[A-Za-z0-9]+$/
const isValidCardCode = (c) => c.length >= 6 && CODE_RX.test(c)
const isValidBankRef  = (r) => r.length >= 8 && CODE_RX.test(r)
const isTouchDevice   = () => window.matchMedia('(pointer: coarse)').matches


export default function CheckoutModal({ cartTotal, cart, onConfirm, onCancel }) {
  const { currentUser, settings, checkCustomerCredit, initiateMpesaPayment, checkMpesaStatus, initiateSplitMpesaVerify, queryMpesaStatus } = useApp()
  const socket = useSocket()

  const enabledMethods = settings?.paymentMethods?.length
    ? ALL_METHODS.filter(m => settings.paymentMethods.includes(m.key))
    : ALL_METHODS

  const [paymentMethod,    setPaymentMethod]    = useState(enabledMethods[0]?.key || 'cash')
  const [cashGiven,        setCashGiven]        = useState('')
  const [discount,         setDiscount]         = useState('')
  const [discountType,     setDiscountType]     = useState('fixed')
  const [customerName,     setCustomerName]     = useState('')
  const [customerPhone,    setCustomerPhone]    = useState('')
  const [promiseDate,      setPromiseDate]      = useState('')
  const [mpesaPhone,       setMpesaPhone]       = useState('')
  const [mpesaStep,        setMpesaStep]        = useState('enter')
  const [cashPart,         setCashPart]         = useState('')
  const [mpesaPart,        setMpesaPart]        = useState('')
  const [splitMpesaPhone,  setSplitMpesaPhone]  = useState('')
  const [splitMpesaStep,   setSplitMpesaStep]   = useState('enter')
  const [cardApprovalCode,        setCardApprovalCode]        = useState('')
  const [cardApprovalCodeConfirm, setCardApprovalCodeConfirm] = useState('')
  const [bankReference,           setBankReference]           = useState('')
  const [bankReferenceConfirm,    setBankReferenceConfirm]    = useState('')

  // ── Real M-Pesa STK push state ────────────────────────────────────
  const [mpesaCheckoutRequestId, setMpesaCheckoutRequestId] = useState('')
  const [mpesaConfirmedSale,     setMpesaConfirmedSale]     = useState(null)
  const [mpesaReceiptNumber,     setMpesaReceiptNumber]     = useState('')
  const [mpesaErrorMsg,          setMpesaErrorMsg]          = useState('')
  const mpesaTimerRef = useRef(null)

  // ── Split M-Pesa verification state ───────────────────────────────
  const [splitMpesaCheckoutRequestId, setSplitMpesaCheckoutRequestId] = useState('')
  const [splitMpesaReceiptNumber,     setSplitMpesaReceiptNumber]     = useState('')
  const [splitMpesaErrorMsg,          setSplitMpesaErrorMsg]          = useState('')
  const splitMpesaTimerRef = useRef(null)

  // ── Blacklist check state ─────────────────────────────────────────
  const [blacklistInfo, setBlacklistInfo] = useState(null)
  const [blacklistAck,  setBlacklistAck]  = useState(false)
  const [checkingBl,    setCheckingBl]    = useState(false)

  useEffect(() => {
    let active = true
    const run = async () => {
      if (paymentMethod !== 'credit') {
        if (active) { setBlacklistInfo(null); setBlacklistAck(false) }
        return
      }
      const name  = customerName.trim()
      const phone = customerPhone.trim()
      if (!name && !phone) {
        if (active) { setBlacklistInfo(null); setBlacklistAck(false) }
        return
      }
      if (active) setCheckingBl(true)
      const customer = await checkCustomerCredit(name, phone, currentUser?.store || '')
      if (!active) return
      setCheckingBl(false)
      if (customer?.blacklisted) {
        setBlacklistInfo({
          name:          customer.name,
          reason:        customer.blacklistReason || 'No reason given',
          blacklistedBy: customer.blacklistedBy   || 'Owner',
          balance:       customer.balance         || 0,
        })
        setBlacklistAck(false)
      } else {
        setBlacklistInfo(null)
      }
    }
    const timer = setTimeout(() => { run() }, 500)
    return () => { active = false; clearTimeout(timer) }
  }, [customerName, customerPhone, paymentMethod, checkCustomerCredit, currentUser])

  // ── Discount ──────────────────────────────────────────────────────
  const rawDiscount    = Math.max(0, Number(discount) || 0)
  const discountAmount = discountType === 'percent'
    ? Math.min(Math.round((rawDiscount / 100) * cartTotal), cartTotal)
    : Math.min(rawDiscount, cartTotal)
  const finalTotal = Math.max(0, cartTotal - discountAmount)

  const cashGivenNum = Number(cashGiven)  || 0
  const cashPartNum  = Number(cashPart)   || 0
  const mpesaPartNum = Number(mpesaPart)  || 0
  const splitTotal   = cashPartNum + mpesaPartNum
  const splitChange  = splitTotal - finalTotal

  const creditValid = paymentMethod === 'credit'
    ? customerName.trim().length > 0 &&
      promiseDate.trim().length > 0 &&
      (!blacklistInfo || blacklistAck)
    : true

  const canConfirm =
    paymentMethod === 'cash'   ? cashGivenNum >= finalTotal && cashGiven !== ''                                                                        :
    paymentMethod === 'mpesa'  ? mpesaStep === 'confirmed'                                                                                             :
    paymentMethod === 'credit' ? creditValid                                                                                                            :
    paymentMethod === 'split'  ? splitTotal >= finalTotal && cashPartNum > 0 && mpesaPartNum > 0 && splitMpesaStep === 'confirmed'                      :
    paymentMethod === 'card'   ? isValidCardCode(cardApprovalCode.trim()) && cardApprovalCode.trim() === cardApprovalCodeConfirm.trim()                 :
    paymentMethod === 'bank'   ? isValidBankRef(bankReference.trim()) && bankReference.trim() === bankReferenceConfirm.trim()
    : false

  // ── Real STK push handler ─────────────────────────────────────────
  const handleSendSTK = async () => {
    if (!isValidKenyanPhone(mpesaPhone) || !cart?.length) return
    setMpesaStep('loading')
    setMpesaErrorMsg('')

    const result = await initiateMpesaPayment({
      phone:        mpesaPhone,
      amount:       finalTotal,
      cartItems:    cart,
      discount:     discountAmount,
      finalTotal,
      customerName: customerName.trim() || 'Walk-in Customer',
    })

    if (!result.success) {
      setMpesaStep('error')
      setMpesaErrorMsg(result.message || 'Failed to send M-Pesa request. Please try again.')
      return
    }

    setMpesaCheckoutRequestId(result.checkoutRequestId)
    setMpesaStep('waiting')
    mpesaTimerRef.current = setTimeout(() => setMpesaStep('timeout'), 2 * 60 * 1000)
  }

  // Socket: listen for real Safaricom callback result
  useEffect(() => {
    if (!socket || mpesaStep !== 'waiting') return
    const handleResult = (data) => {
      clearTimeout(mpesaTimerRef.current)
      if (data.status === 'success') {
        setMpesaReceiptNumber(data.mpesaReceiptNumber || '')
        setMpesaConfirmedSale(data.sale || {})
        setMpesaStep('confirmed')
      } else {
        setMpesaErrorMsg(data.message || 'Payment failed. Please try again.')
        setMpesaStep('failed')
      }
    }
    socket.on('mpesa_result', handleResult)
    return () => socket.off('mpesa_result', handleResult)
  }, [socket, mpesaStep])

  // Polling fallback: every 5s in case socket event is missed
  useEffect(() => {
    if (mpesaStep !== 'waiting' || !mpesaCheckoutRequestId) return
    const poll = setInterval(async () => {
      const data = await checkMpesaStatus(mpesaCheckoutRequestId)
      if (!data?.success) return
      if (data.status === 'confirmed') {
        clearTimeout(mpesaTimerRef.current)
        setMpesaReceiptNumber(data.mpesaReceiptNumber || '')
        setMpesaConfirmedSale(data)
        setMpesaStep('confirmed')
      } else if (data.status === 'failed') {
        clearTimeout(mpesaTimerRef.current)
        setMpesaStep('failed')
        setMpesaErrorMsg('Payment was cancelled or failed. Please try again.')
      }
    }, 5000)
    return () => clearInterval(poll)
  }, [mpesaStep, mpesaCheckoutRequestId, checkMpesaStatus])

  // Cleanup timers on unmount
  useEffect(() => () => {
    clearTimeout(mpesaTimerRef.current)
    clearTimeout(splitMpesaTimerRef.current)
  }, [])

  // Socket: listen for split M-Pesa verification result
  useEffect(() => {
    if (!socket || splitMpesaStep !== 'waiting') return
    const handleVerifyResult = (data) => {
      clearTimeout(splitMpesaTimerRef.current)
      if (data.status === 'success') {
        setSplitMpesaReceiptNumber(data.mpesaReceiptNumber || '')
        setSplitMpesaStep('confirmed')
      } else {
        setSplitMpesaErrorMsg(data.message || 'Payment failed. Please try again.')
        setSplitMpesaStep('failed')
      }
    }
    socket.on('mpesa_verify_result', handleVerifyResult)
    return () => socket.off('mpesa_verify_result', handleVerifyResult)
  }, [socket, splitMpesaStep])

  // Polling fallback for split verification
  useEffect(() => {
    if (splitMpesaStep !== 'waiting' || !splitMpesaCheckoutRequestId) return
    const poll = setInterval(async () => {
      const data = await checkMpesaStatus(splitMpesaCheckoutRequestId)
      if (!data?.success) return
      if (data.status === 'confirmed') {
        clearTimeout(splitMpesaTimerRef.current)
        setSplitMpesaReceiptNumber(data.mpesaReceiptNumber || '')
        setSplitMpesaStep('confirmed')
      } else if (data.status === 'failed') {
        clearTimeout(splitMpesaTimerRef.current)
        setSplitMpesaStep('failed')
        setSplitMpesaErrorMsg('Payment was cancelled or failed. Please try again.')
      }
    }, 5000)
    return () => clearInterval(poll)
  }, [splitMpesaStep, splitMpesaCheckoutRequestId, checkMpesaStatus])

  const handleSplitSendSTK = async () => {
    if (!isValidKenyanPhone(splitMpesaPhone) || mpesaPartNum <= 0) return
    setSplitMpesaStep('loading')
    setSplitMpesaErrorMsg('')

    const result = await initiateSplitMpesaVerify({ phone: splitMpesaPhone, amount: mpesaPartNum })
    if (!result.success) {
      setSplitMpesaStep('failed')
      setSplitMpesaErrorMsg(result.message || 'Failed to send M-Pesa request. Please try again.')
      return
    }

    setSplitMpesaCheckoutRequestId(result.checkoutRequestId)
    setSplitMpesaStep('waiting')
    splitMpesaTimerRef.current = setTimeout(() => setSplitMpesaStep('timeout'), 2 * 60 * 1000)
  }

  // Bug 5 guard: before allowing a retry we verify the original request is
  // truly resolved to prevent sending a second STK push while the first is
  // still pending (double-charge risk if the original callback arrives late).
  const handleRetry = async () => {
    if (mpesaCheckoutRequestId) {
      const data = await queryMpesaStatus(mpesaCheckoutRequestId)
      if (data?.status === 'confirmed') {
        // Original payment actually went through — surface it as success
        setMpesaReceiptNumber(data.mpesaReceiptNumber || '')
        setMpesaConfirmedSale(data)
        setMpesaStep('confirmed')
        return
      }
      if (data?.status === 'pending') {
        setMpesaErrorMsg('Original payment may still be processing — please wait a few seconds before retrying.')
        return
      }
      // 'failed' or query error → safe to retry
    }
    setMpesaStep('enter')
    setMpesaErrorMsg('')
    setMpesaCheckoutRequestId('')
  }

  const handleCashPartChange = (val) => {
    setCashPart(val)
    const remaining = finalTotal - (Number(val) || 0)
    setMpesaPart(remaining > 0 ? String(remaining) : '')
  }

  const handleMethodChange = (method) => {
    setPaymentMethod(method)
    setMpesaStep('enter')
    setSplitMpesaStep('enter')
    clearTimeout(splitMpesaTimerRef.current)
    setSplitMpesaCheckoutRequestId('')
    setSplitMpesaReceiptNumber('')
    setSplitMpesaErrorMsg('')
    setCardApprovalCode(''); setCardApprovalCodeConfirm('')
    setBankReference('');    setBankReferenceConfirm('')
  }

  const handleConfirm = () => {
    const normalizePhone = (phone) => {
      let ph = phone.trim().replace(/\D/g, '')
      if (ph.startsWith('0')) ph = '254' + ph.substring(1)
      if (ph.startsWith('7')) ph = '254' + ph
      return ph
    }
    const now           = new Date()
    const formattedDate = now.toLocaleDateString('en-CA')
    const formattedTime = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

    // M-Pesa: sale was already created on backend — pass the confirmed sale object
    // so Barcodes.jsx can skip recordMultipleSales and build the receipt directly.
    if (paymentMethod === 'mpesa' && mpesaConfirmedSale) {
      onConfirm({
        paymentMethod:      'mpesa',
        confirmedSale:      mpesaConfirmedSale,
        mpesaReceiptNumber,
        mpesaPhone:         normalizePhone(mpesaPhone),
        finalTotal,
        discount:           discountAmount,
        customerName:       customerName.trim() || 'Walk-in Customer',
        cashGiven:          0,
        change:             0,
        cashPart:           0,
        mpesaPart:          finalTotal,
        date:               mpesaConfirmedSale.date || formattedDate,
        time:               mpesaConfirmedSale.time || formattedTime,
        cashier:            currentUser?.fullname || currentUser?.username || 'Staff',
      })
      return
    }

    onConfirm({
      paymentMethod,
      amountPaid: paymentMethod === 'cash'  ? cashGivenNum :
                  paymentMethod === 'mpesa' ? finalTotal   :
                  paymentMethod === 'split' ? splitTotal   :
                  paymentMethod === 'card'  ? finalTotal   :
                  paymentMethod === 'bank'  ? finalTotal   : 0,
      cashGiven: cashGivenNum,
      change: paymentMethod === 'cash'  ? Math.max(0, cashGivenNum - finalTotal) :
              paymentMethod === 'split' ? Math.max(0, splitChange)               : 0,
      discount: discountAmount,
      finalTotal,
      isCredit:      paymentMethod === 'credit',
      balanceDue:    paymentMethod === 'credit' ? finalTotal : 0,
      customerName:  customerName.trim() || 'Walk-in Customer',
      customerPhone: paymentMethod === 'credit' ? normalizePhone(customerPhone) : '',
      promiseDate:   paymentMethod === 'credit' ? promiseDate : '',
      mpesaPhone: paymentMethod === 'split' ? normalizePhone(splitMpesaPhone) : '',
      splitMpesaReceiptNumber: paymentMethod === 'split' ? splitMpesaReceiptNumber : '',
      cashPart:  cashPartNum,
      mpesaPart: mpesaPartNum,
      cardApprovalCode: paymentMethod === 'card' ? cardApprovalCode.trim() : '',
      bankReference:    paymentMethod === 'bank' ? bankReference.trim()    : '',
      date:    formattedDate,
      time:    formattedTime,
      cashier: currentUser?.fullname || currentUser?.username || 'Staff',
    })
  }

  const payBtn = (method, label, icon) => (
    <button
      key={method}
      onClick={() => handleMethodChange(method)}
      className={`${s.payBtnItem} ${paymentMethod === method ? s.payBtnActive : ''}`}
    >
      <span className={s.payBtnEmoji}>{icon}</span>
      {label}
    </button>
  )

  return (
    <div className={`${s.overlay} ${s.overlayCheckout}`}>
      <div className={s.checkoutCard}>

        {/* Header */}
        <div className={s.checkoutModalHeader}>
          <div>
            <div className={s.checkoutModalTitle}>Confirm Payment</div>
            <div className={s.checkoutModalSub}>Complete the sale</div>
          </div>
          <div className={s.checkoutModalAmt}>KSh {Number(finalTotal).toLocaleString()}</div>
        </div>

        <div className={s.checkoutModalBody}>

          {/* Customer name */}
          <div className={s.formGroup}>
            <label className={s.formLabel}>
              Customer Name{paymentMethod === 'credit' && <span className={s.requiredStar}> *required</span>}
            </label>
            <div className={s.inputWrap}>
              <MdPerson className={s.inputIcon} />
              <input
                type="text"
                placeholder="e.g. John Kamau"
                value={customerName}
                onChange={e => setCustomerName(e.target.value)}
                className={`${s.formInput} ${paymentMethod === 'credit' && !customerName.trim() ? s.formInputError : ''}`}
              />
            </div>
          </div>

          {/* Customer phone — credit only */}
          {paymentMethod === 'credit' && (
            <div className={s.formGroup}>
              <label className={s.formLabel}>
                Customer Phone <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(optional)</span>
              </label>
              <div className={s.inputWrap}>
                <MdPhone className={s.inputIcon} />
                <input
                  type="tel"
                  placeholder="e.g. 0712345678"
                  value={customerPhone}
                  onChange={e => setCustomerPhone(e.target.value)}
                  className={s.formInput}
                />
              </div>
            </div>
          )}

          {/* Blacklist warning */}
          {paymentMethod === 'credit' && checkingBl && (
            <div style={{ padding: '10px 14px', borderRadius: 'var(--radius-md)', background: 'var(--bg-muted)', marginBottom: '12px', fontSize: '13px', color: 'var(--text-muted)' }}>
              Checking customer status...
            </div>
          )}

          {paymentMethod === 'credit' && blacklistInfo && !checkingBl && (
            <div style={{ background: 'var(--danger-light)', border: '1.5px solid var(--danger-light)', borderRadius: 'var(--radius-md)', padding: '14px 16px', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <MdBlock style={{ color: 'var(--danger)', fontSize: '20px', flexShrink: 0 }} />
                <span style={{ fontWeight: 800, fontSize: '14px', color: 'var(--danger)' }}>BLACKLISTED CUSTOMER</span>
              </div>
              <div style={{ fontSize: '13px', color: 'var(--badge-danger-text)', marginBottom: '6px' }}>
                <strong>{blacklistInfo.name}</strong> has been blacklisted by <strong>{blacklistInfo.blacklistedBy}</strong>.
              </div>
              <div style={{ fontSize: '12px', color: 'var(--badge-danger-text)', marginBottom: '2px' }}>Reason: {blacklistInfo.reason}</div>
              {blacklistInfo.balance > 0 && (
                <div style={{ fontSize: '12px', color: 'var(--badge-danger-text)', marginBottom: '10px' }}>
                  Outstanding balance: <strong>KSh {blacklistInfo.balance.toLocaleString()}</strong>
                </div>
              )}
              <div style={{ background: 'var(--danger-light)', borderRadius: 'var(--radius-sm)', padding: '8px 10px', marginBottom: '12px', fontSize: '12px', color: 'var(--badge-danger-text)', fontWeight: 600 }}>
                ⚠️ If you proceed and this customer does not pay, <strong>you will be personally responsible</strong> for this debt.
              </div>
              {!blacklistAck ? (
                <button onClick={() => setBlacklistAck(true)} style={{ width: '100%', padding: '9px', background: 'transparent', border: '1.5px solid var(--danger)', borderRadius: 'var(--radius-md)', color: 'var(--danger)', fontWeight: 700, fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit' }}>
                  I understand — proceed anyway
                </button>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--danger)', fontWeight: 600 }}>
                  <MdCheckCircle style={{ fontSize: '16px' }} />
                  Acknowledged — you are responsible if unpaid
                  <button onClick={() => setBlacklistAck(false)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', fontSize: '11px', color: 'var(--danger)', textDecoration: 'underline', fontFamily: 'inherit' }}>Undo</button>
                </div>
              )}
            </div>
          )}

          {/* Discount */}
          <div className={s.formGroup}>
            <label className={s.formLabel}>Discount (optional)</label>
            <div className={s.discountRow}>
              <select value={discountType} onChange={e => { setDiscountType(e.target.value); setDiscount('') }} className={s.discountSelect}>
                <option value="fixed">KSh</option>
                <option value="percent">%</option>
              </select>
              <input
                type="number" min="0" max={discountType === 'percent' ? 100 : cartTotal}
                placeholder={discountType === 'percent' ? 'e.g. 10' : 'e.g. 500'}
                value={discount} onChange={e => setDiscount(e.target.value)}
                className={s.discountInput}
              />
            </div>
            {discountAmount > 0 && (
              <div className={s.discountFeedback}>
                Discount: − KSh {discountAmount.toLocaleString()} → Final: KSh {finalTotal.toLocaleString()}
              </div>
            )}
          </div>

          {/* Payment method */}
          <div className={s.formGroup}>
            <label className={s.formLabel}>Payment Method</label>
            <div className={s.payBtns}>
              {enabledMethods.map(({ key, label, icon }) => payBtn(key, label, icon))}
            </div>
          </div>

          {/* ── CASH ── */}
          {paymentMethod === 'cash' && (
            <div className={s.formGroup}>
              <label className={s.formLabel}>Cash Given by Customer</label>
              <div className={s.inputWrap}>
                <MdMoney className={s.inputIcon} />
                <input
                  type="number" min="0" placeholder="Enter amount"
                  value={cashGiven} onChange={e => setCashGiven(e.target.value)}
                  autoFocus={!isTouchDevice()}
                  className={`${s.formInputLarge} ${cashGivenNum >= finalTotal && cashGiven ? s.formInputSuccess : ''}`}
                />
              </div>
              <div className={s.quickAmounts}>
                {[50, 100, 200, 500, 1000, 2000, 5000, 10000].map(amount => (
                  <button key={amount} onClick={() => setCashGiven(String(amount))}
                    className={`${s.quickAmt} ${cashGivenNum === amount ? s.quickAmtActive : ''}`}>
                    {amount.toLocaleString()}
                  </button>
                ))}
                <button onClick={() => setCashGiven(String(finalTotal))} className={`${s.quickAmt} ${s.quickAmtExact}`}>Exact</button>
              </div>
              {cashGiven !== '' && cashGivenNum >= finalTotal && (
                <div className={`${s.changeBanner} ${cashGivenNum - finalTotal === 0 ? s.changeBannerExact : s.changeBannerChange}`}>
                  <span className={s.changeBannerLabel} style={{ color: cashGivenNum - finalTotal === 0 ? 'var(--badge-success-text)' : 'var(--badge-warning-text)' }}>
                    {cashGivenNum - finalTotal === 0 ? '✅ Exact amount' : '💰 Change to give'}
                  </span>
                  {cashGivenNum - finalTotal > 0 && (
                    <span className={s.changeBannerAmt}>KSh {(cashGivenNum - finalTotal).toLocaleString()}</span>
                  )}
                </div>
              )}
              {cashGiven !== '' && cashGivenNum < finalTotal && (
                <div className={s.shortBanner}>
                  <MdWarning style={{ fontSize: '16px' }} />
                  Short by KSh {(finalTotal - cashGivenNum).toLocaleString()}
                </div>
              )}
            </div>
          )}

          {/* ── M-PESA ── */}
          {paymentMethod === 'mpesa' && (
            <div className={s.formGroup}>
              {mpesaStep === 'enter' && (
                <>
                  <label className={s.formLabel}>Customer M-Pesa Phone Number</label>
                  <div className={s.inputWrap}>
                    <MdPhone className={s.inputIcon} />
                    <input
                      type="tel"
                      placeholder="e.g. 0712345678"
                      value={mpesaPhone}
                      onChange={e => setMpesaPhone(e.target.value)}
                      autoFocus={!isTouchDevice()}
                      className={`${s.formInput} ${
                        mpesaPhone && !isValidKenyanPhone(mpesaPhone) ? s.formInputError :
                        mpesaPhone &&  isValidKenyanPhone(mpesaPhone) ? s.formInputSuccess : ''
                      }`}
                    />
                  </div>
                  {mpesaPhone && !isValidKenyanPhone(mpesaPhone) && (
                    <div style={{ fontSize: 11, color: 'var(--badge-danger-text)', marginTop: 4, fontWeight: 600 }}>
                      ✗ Enter a valid number — 07XXXXXXXX, 01XXXXXXXX or 2547XXXXXXXX
                    </div>
                  )}
                  {mpesaPhone && isValidKenyanPhone(mpesaPhone) && (
                    <div style={{ fontSize: 11, color: 'var(--badge-success-text)', marginTop: 4, fontWeight: 600 }}>
                      ✓ Valid phone number
                    </div>
                  )}
                  <button
                    onClick={handleSendSTK}
                    disabled={!isValidKenyanPhone(mpesaPhone)}
                    className={`${s.stkBtn} ${!isValidKenyanPhone(mpesaPhone) ? s.stkBtnDisabled : s.stkBtnActive}`}
                  >
                    📲 Send M-Pesa Request — KSh {finalTotal.toLocaleString()}
                  </button>
                </>
              )}
              {mpesaStep === 'loading' && (
                <div className={s.mpesaBox}>
                  <div className={s.mpesaEmoji}>⏳</div>
                  <div className={s.mpesaTitle}>Initiating M-Pesa...</div>
                  <div className={s.mpesaDesc}>Connecting to Safaricom. Please wait.</div>
                </div>
              )}
              {mpesaStep === 'waiting' && (
                <div className={s.mpesaBox}>
                  <div className={s.mpesaEmoji}>📲</div>
                  <div className={s.mpesaTitle}>Waiting for Payment</div>
                  <div className={s.mpesaPhone}>{mpesaPhone}</div>
                  <div className={s.mpesaDesc}>
                    Customer's phone is prompting them to enter their M-Pesa PIN to pay{' '}
                    <strong>KSh {finalTotal.toLocaleString()}</strong>.
                  </div>
                  <div className={s.mpesaDesc} style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
                    This request expires in 2 minutes. Do not close this window.
                  </div>
                  <div className={s.mpesaBtns}>
                    <button
                      onClick={() => { clearTimeout(mpesaTimerRef.current); setMpesaStep('enter') }}
                      className={s.mpesaBtnSecondary}
                    >
                      Wrong number
                    </button>
                  </div>
                </div>
              )}
              {mpesaStep === 'confirmed' && (
                <div className={s.mpesaConfirmed}>
                  <MdCheckCircle style={{ color: 'var(--success)', fontSize: '24px', flexShrink: 0 }} />
                  <div>
                    <div className={s.mpesaConfirmedTitle}>M-Pesa Payment Confirmed</div>
                    <div className={s.mpesaConfirmedSub}>
                      KSh {finalTotal.toLocaleString()}
                      {mpesaReceiptNumber ? ` · Receipt: ${mpesaReceiptNumber}` : ''}
                    </div>
                  </div>
                </div>
              )}
              {(mpesaStep === 'failed' || mpesaStep === 'timeout' || mpesaStep === 'error') && (
                <div className={s.mpesaBox}>
                  <div className={s.mpesaEmoji}>❌</div>
                  <div className={s.mpesaTitle} style={{ color: 'var(--danger)' }}>
                    {mpesaStep === 'timeout' ? 'Payment Timed Out'
                      : mpesaStep === 'failed' ? 'Payment Failed'
                      : 'Request Failed'}
                  </div>
                  <div className={s.mpesaDesc}>
                    {mpesaStep === 'timeout'
                      ? 'The customer did not respond within 2 minutes.'
                      : mpesaErrorMsg || 'Something went wrong. Please try again.'}
                  </div>
                  <button
                    onClick={handleRetry}
                    className={s.mpesaBtnSecondary}
                    style={{ marginTop: 12 }}
                  >
                    Try Again
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── SPLIT ── */}
          {paymentMethod === 'split' && (
            <div className={s.formGroup}>
              <div className={s.splitPanel}>
                <div className={s.splitPanelTitle}><MdCallSplit style={{ fontSize: '16px' }} /> Split: Cash + M-Pesa</div>
                <div className={s.splitPanelTotal}>Total to pay: <strong>KSh {finalTotal.toLocaleString()}</strong></div>
                <label className={s.splitInputLabel}>Cash Amount</label>
                <input type="number" min="0" max={finalTotal} placeholder="e.g. 500"
                  value={cashPart} onChange={e => handleCashPartChange(e.target.value)} className={s.splitInput} />
                <label className={s.splitInputLabel}>M-Pesa Amount</label>
                <input type="number" min="0" max={finalTotal} placeholder="e.g. 400"
                  value={mpesaPart} onChange={e => setMpesaPart(e.target.value)} className={s.splitInput} />
                {cashPartNum > 0 && mpesaPartNum > 0 && (
                  <div className={`${s.splitStatus} ${splitTotal >= finalTotal ? s.splitStatusOk : s.splitStatusBad}`}>
                    <div className={s.splitStatusText}>
                      {splitTotal >= finalTotal
                        ? splitChange > 0 ? `✅ Change: KSh ${splitChange.toLocaleString()}` : '✅ Exact split'
                        : `⚠️ Short by KSh ${(finalTotal - splitTotal).toLocaleString()}`}
                    </div>
                  </div>
                )}
                {mpesaPartNum > 0 && (
                  <>
                    <label className={s.splitInputLabel}>Customer M-Pesa Phone</label>
                    {splitMpesaStep === 'enter' && (
                      <>
                        <div className={s.inputWrap}>
                          <MdPhone className={s.inputIcon} />
                          <input
                            type="tel"
                            placeholder="e.g. 0712345678"
                            value={splitMpesaPhone}
                            onChange={e => setSplitMpesaPhone(e.target.value)}
                            className={`${s.formInput} ${
                              splitMpesaPhone && !isValidKenyanPhone(splitMpesaPhone) ? s.formInputError :
                              splitMpesaPhone &&  isValidKenyanPhone(splitMpesaPhone) ? s.formInputSuccess : ''
                            }`}
                          />
                        </div>
                        {splitMpesaPhone && !isValidKenyanPhone(splitMpesaPhone) && (
                          <div style={{ fontSize: 11, color: 'var(--badge-danger-text)', marginTop: 4, fontWeight: 600 }}>
                            ✗ Enter a valid number — 07XXXXXXXX, 01XXXXXXXX or 2547XXXXXXXX
                          </div>
                        )}
                        {splitMpesaPhone && isValidKenyanPhone(splitMpesaPhone) && (
                          <div style={{ fontSize: 11, color: 'var(--badge-success-text)', marginTop: 4, fontWeight: 600 }}>
                            ✓ Valid phone number
                          </div>
                        )}
                        <button
                          onClick={handleSplitSendSTK}
                          disabled={!isValidKenyanPhone(splitMpesaPhone) || splitTotal < finalTotal}
                          className={`${s.stkBtn} ${(!isValidKenyanPhone(splitMpesaPhone) || splitTotal < finalTotal) ? s.stkBtnDisabled : s.stkBtnActive}`}
                          style={{ marginTop: '8px' }}
                        >
                          📲 Send M-Pesa KSh {mpesaPartNum.toLocaleString()}
                        </button>
                      </>
                    )}
                    {splitMpesaStep === 'loading' && (
                      <div className={s.mpesaBox}>
                        <div className={s.mpesaEmoji}>⏳</div>
                        <div className={s.mpesaTitle}>Initiating M-Pesa...</div>
                        <div className={s.mpesaDesc}>Connecting to Safaricom. Please wait.</div>
                      </div>
                    )}
                    {splitMpesaStep === 'waiting' && (
                      <div className={s.mpesaBox}>
                        <div className={s.mpesaEmoji}>📲</div>
                        <div className={s.mpesaTitle}>Waiting for M-Pesa PIN</div>
                        <div className={s.mpesaPhone}>{splitMpesaPhone}</div>
                        <div className={s.mpesaDesc}>
                          Customer entering PIN to pay <strong>KSh {mpesaPartNum.toLocaleString()}</strong>.
                          Do not click "Received" until Safaricom confirms.
                        </div>
                        <div className={s.mpesaBtns}>
                          <button
                            onClick={() => { clearTimeout(splitMpesaTimerRef.current); setSplitMpesaStep('enter'); setSplitMpesaCheckoutRequestId('') }}
                            className={s.mpesaBtnSecondary}
                          >
                            Wrong number
                          </button>
                        </div>
                      </div>
                    )}
                    {(splitMpesaStep === 'failed' || splitMpesaStep === 'timeout') && (
                      <div className={s.mpesaBox}>
                        <div className={s.mpesaEmoji}>❌</div>
                        <div className={s.mpesaTitle} style={{ color: 'var(--danger)' }}>
                          {splitMpesaStep === 'timeout' ? 'Payment Timed Out' : 'Payment Failed'}
                        </div>
                        <div className={s.mpesaDesc}>
                          {splitMpesaStep === 'timeout'
                            ? 'Customer did not respond within 2 minutes.'
                            : splitMpesaErrorMsg || 'Something went wrong. Please try again.'}
                        </div>
                        <button
                          onClick={() => { setSplitMpesaStep('enter'); setSplitMpesaErrorMsg(''); setSplitMpesaCheckoutRequestId('') }}
                          className={s.mpesaBtnSecondary}
                          style={{ marginTop: 12 }}
                        >
                          Try Again
                        </button>
                      </div>
                    )}
                    {splitMpesaStep === 'confirmed' && (
                      <div className={s.mpesaConfirmed}>
                        <MdCheckCircle style={{ color: 'var(--success)', fontSize: '20px' }} />
                        <div>
                          <div className={s.mpesaConfirmedTitle}>M-Pesa KSh {mpesaPartNum.toLocaleString()} confirmed</div>
                          {splitMpesaReceiptNumber && (
                            <div className={s.mpesaConfirmedSub}>Receipt: {splitMpesaReceiptNumber}</div>
                          )}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {/* ── CREDIT ── */}
          {paymentMethod === 'credit' && (
            <div className={s.formGroup}>
              <div className={s.creditPanel}>
                <div className={s.creditTitle}>⚠️ Credit Sale</div>
                <div className={s.creditDesc}>
                  Customer <strong>{customerName || '(enter name above)'}</strong> will owe{' '}
                  <strong>KSh {finalTotal.toLocaleString()}</strong>. No payment collected now.
                </div>
                <label className={s.splitInputLabel} style={{ marginTop: '12px' }}>
                  <MdCalendarToday style={{ fontSize: '14px', marginRight: '4px', verticalAlign: 'middle' }} />
                  Payment Promise Date <span className={s.requiredStar}>*required</span>
                </label>
                <input
                  type="date" min={getTomorrowDate()} value={promiseDate}
                  onChange={e => setPromiseDate(e.target.value)}
                  className={`${s.formInput} ${!promiseDate ? s.formInputError : s.formInputSuccess}`}
                  style={{ marginTop: '4px' }}
                />
                {!promiseDate && (
                  <div className={s.creditNote2}>Customer must commit to a payment date before confirming.</div>
                )}
                {promiseDate && (
                  <div className={s.mpesaConfirmed} style={{ marginTop: '8px' }}>
                    <MdCalendarToday style={{ color: 'var(--primary)', fontSize: '18px', flexShrink: 0 }} />
                    <div>
                      <div className={s.mpesaConfirmedTitle}>Promise date set</div>
                      <div className={s.mpesaConfirmedSub}>
                        Customer commits to pay by{' '}
                        {new Date(promiseDate + 'T00:00:00').toLocaleDateString('en-KE', {
                          weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── CARD ── */}
          {paymentMethod === 'card' && (
            <div className={s.formGroup}>
              <div className={s.cardPanel}>
                <div className={s.cardPanelTitle}><MdCreditCard style={{ fontSize: '16px' }} /> Card Payment — EDC Terminal</div>
                <div className={s.cardPanelDesc}>
                  Charge <strong>KSh {finalTotal.toLocaleString()}</strong> on the card terminal,
                  then enter the approval code from the terminal slip below.
                </div>
                <label className={s.splitInputLabel}>Approval Code</label>
                <div className={s.inputWrap}>
                  <MdCreditCard className={s.inputIcon} />
                  <input
                    type="text"
                    placeholder="e.g. 123456"
                    value={cardApprovalCode}
                    onChange={e => setCardApprovalCode(e.target.value)}
                    autoFocus={!isTouchDevice()}
                    className={`${s.formInput} ${
                      !cardApprovalCode.trim() ? '' :
                      !isValidCardCode(cardApprovalCode.trim()) ? s.formInputError : s.formInputSuccess
                    }`}
                  />
                </div>
                {cardApprovalCode.trim() && !isValidCardCode(cardApprovalCode.trim()) && (
                  <div style={{ fontSize: 11, color: 'var(--badge-danger-text)', marginTop: 4, fontWeight: 600 }}>
                    {!CODE_RX.test(cardApprovalCode.trim())
                      ? '✗ Letters and numbers only — no spaces or symbols'
                      : '✗ Too short — minimum 6 characters'}
                  </div>
                )}
                <label className={s.splitInputLabel} style={{ marginTop: '10px' }}>Re-enter code to confirm</label>
                <div className={s.inputWrap}>
                  <MdCreditCard className={s.inputIcon} />
                  <input
                    type="text"
                    placeholder="Re-enter approval code"
                    value={cardApprovalCodeConfirm}
                    onChange={e => setCardApprovalCodeConfirm(e.target.value)}
                    className={`${s.formInput} ${
                      !cardApprovalCodeConfirm.trim() ? '' :
                      cardApprovalCode.trim() === cardApprovalCodeConfirm.trim() ? s.formInputSuccess : s.formInputError
                    }`}
                  />
                </div>
                {cardApprovalCode.trim() && cardApprovalCodeConfirm.trim() && cardApprovalCode.trim() !== cardApprovalCodeConfirm.trim() && (
                  <div style={{ background: 'var(--danger-light)', border: '1.5px solid var(--danger-light)', borderRadius: 'var(--radius-md)', padding: '12px 14px', marginTop: '8px' }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--danger)', marginBottom: 6 }}>⚠️ Codes don't match</div>
                    <div style={{ display: 'flex', gap: 16, fontSize: 12 }}>
                      <div>
                        <div style={{ color: 'var(--text-muted)', fontSize: 11, marginBottom: 2 }}>First entry</div>
                        <div style={{ fontFamily: 'monospace', fontWeight: 600 }}>{cardApprovalCode.trim()}</div>
                      </div>
                      <div>
                        <div style={{ color: 'var(--text-muted)', fontSize: 11, marginBottom: 2 }}>Second entry</div>
                        <div style={{ fontFamily: 'monospace', fontWeight: 600 }}>{cardApprovalCodeConfirm.trim()}</div>
                      </div>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--badge-danger-text)', marginTop: 6 }}>Fix the entry that contains the typo.</div>
                  </div>
                )}
                {isValidCardCode(cardApprovalCode.trim()) && cardApprovalCodeConfirm.trim() && cardApprovalCode.trim() === cardApprovalCodeConfirm.trim() && (
                  <div className={s.mpesaConfirmed}>
                    <MdCheckCircle style={{ color: 'var(--success)', fontSize: '20px', flexShrink: 0 }} />
                    <div>
                      <div className={s.mpesaConfirmedTitle}>Card Approved</div>
                      <div className={s.mpesaConfirmedSub}>Code: {cardApprovalCode.trim()}</div>
                    </div>
                  </div>
                )}
                {!cardApprovalCode.trim() && (
                  <div className={s.cardNote}>Enter the approval code from the EDC terminal slip — letters and numbers only, minimum 6 characters.</div>
                )}
              </div>
            </div>
          )}

          {/* ── BANK TRANSFER ── */}
          {paymentMethod === 'bank' && (
            <div className={s.formGroup}>
              <div className={s.cardPanel}>
                <div className={s.cardPanelTitle}><MdAccountBalance style={{ fontSize: '16px' }} /> Bank Transfer</div>
                <div className={s.cardPanelDesc}>
                  Customer transfers <strong>KSh {finalTotal.toLocaleString()}</strong> via their
                  banking app or teller. Enter the transaction reference number from their confirmation.
                </div>
                <label className={s.splitInputLabel}>Reference Number</label>
                <div className={s.inputWrap}>
                  <MdAccountBalance className={s.inputIcon} />
                  <input
                    type="text"
                    placeholder="e.g. FTGN24060100001"
                    value={bankReference}
                    onChange={e => setBankReference(e.target.value)}
                    autoFocus={!isTouchDevice()}
                    className={`${s.formInput} ${
                      !bankReference.trim() ? '' :
                      !isValidBankRef(bankReference.trim()) ? s.formInputError : s.formInputSuccess
                    }`}
                  />
                </div>
                {bankReference.trim() && !isValidBankRef(bankReference.trim()) && (
                  <div style={{ fontSize: 11, color: 'var(--badge-danger-text)', marginTop: 4, fontWeight: 600 }}>
                    {!CODE_RX.test(bankReference.trim())
                      ? '✗ Letters and numbers only — no spaces or symbols'
                      : '✗ Too short — minimum 8 characters'}
                  </div>
                )}
                <label className={s.splitInputLabel} style={{ marginTop: '10px' }}>Re-enter reference to confirm</label>
                <div className={s.inputWrap}>
                  <MdAccountBalance className={s.inputIcon} />
                  <input
                    type="text"
                    placeholder="Re-enter reference number"
                    value={bankReferenceConfirm}
                    onChange={e => setBankReferenceConfirm(e.target.value)}
                    className={`${s.formInput} ${
                      !bankReferenceConfirm.trim() ? '' :
                      bankReference.trim() === bankReferenceConfirm.trim() ? s.formInputSuccess : s.formInputError
                    }`}
                  />
                </div>
                {bankReference.trim() && bankReferenceConfirm.trim() && bankReference.trim() !== bankReferenceConfirm.trim() && (
                  <div style={{ background: 'var(--danger-light)', border: '1.5px solid var(--danger-light)', borderRadius: 'var(--radius-md)', padding: '12px 14px', marginTop: '8px' }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--danger)', marginBottom: 6 }}>⚠️ References don't match</div>
                    <div style={{ display: 'flex', gap: 16, fontSize: 12 }}>
                      <div>
                        <div style={{ color: 'var(--text-muted)', fontSize: 11, marginBottom: 2 }}>First entry</div>
                        <div style={{ fontFamily: 'monospace', fontWeight: 600 }}>{bankReference.trim()}</div>
                      </div>
                      <div>
                        <div style={{ color: 'var(--text-muted)', fontSize: 11, marginBottom: 2 }}>Second entry</div>
                        <div style={{ fontFamily: 'monospace', fontWeight: 600 }}>{bankReferenceConfirm.trim()}</div>
                      </div>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--badge-danger-text)', marginTop: 6 }}>Fix the entry that contains the typo.</div>
                  </div>
                )}
                {isValidBankRef(bankReference.trim()) && bankReferenceConfirm.trim() && bankReference.trim() === bankReferenceConfirm.trim() && (
                  <div className={s.mpesaConfirmed}>
                    <MdCheckCircle style={{ color: 'var(--success)', fontSize: '20px', flexShrink: 0 }} />
                    <div>
                      <div className={s.mpesaConfirmedTitle}>Transfer Reference Recorded</div>
                      <div className={s.mpesaConfirmedSub}>Ref: {bankReference.trim()}</div>
                    </div>
                  </div>
                )}
                {!bankReference.trim() && (
                  <div className={s.cardNote}>Enter the reference number from the customer's transfer confirmation — letters and numbers only, minimum 8 characters.</div>
                )}
              </div>
            </div>
          )}

          {/* Footer */}
          <div className={s.modalFooter}>
            <button onClick={onCancel} className={s.modalBtnBack}>Back</button>
            <button
              onClick={handleConfirm}
              disabled={!canConfirm}
              className={`${s.modalBtnConfirm} ${canConfirm ? s.modalBtnConfirmActive : s.modalBtnConfirmDisabled}`}
            >
              <MdCheckCircle style={{ fontSize: '18px' }} />
              Confirm · KSh {finalTotal.toLocaleString()}
            </button>
          </div>

        </div>
      </div>
    </div>
  )
}
