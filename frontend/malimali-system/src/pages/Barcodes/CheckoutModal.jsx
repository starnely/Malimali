import { useState, useEffect } from 'react'
import { MdPerson, MdMoney, MdCallSplit, MdPhone, MdCheckCircle, MdWarning, MdCreditCard, MdAccountBalance, MdCalendarToday, MdBlock } from 'react-icons/md'
import { useApp } from '@/context/AppContext'
import s from '@/styles/Barcodes.module.css'

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

export default function CheckoutModal({ cartTotal, onConfirm, onCancel }) {
  const { currentUser, settings, checkCustomerCredit } = useApp()

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
  const [cardApprovalCode, setCardApprovalCode] = useState('')
  const [bankReference,    setBankReference]    = useState('')

  // ── Blacklist check state ─────────────────────────────────────────
  const [blacklistInfo,    setBlacklistInfo]    = useState(null)   // null | { name, reason, blacklistedBy }
  const [blacklistAck,     setBlacklistAck]     = useState(false)  // cashier acknowledged warning
  const [checkingBl,       setCheckingBl]       = useState(false)

  // ── Check blacklist whenever name/phone changes on credit ─────────
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
          blacklistedBy: customer.blacklistedBy  || 'Owner',
          balance:       customer.balance        || 0,
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

  // ── Credit valid: name + promiseDate + (if blacklisted must ack) ──
  const creditValid = paymentMethod === 'credit'
    ? customerName.trim().length > 0 &&
      promiseDate.trim().length > 0 &&
      (!blacklistInfo || blacklistAck)
    : true

  const canConfirm =
    paymentMethod === 'cash'   ? cashGivenNum >= finalTotal && cashGiven !== ''                                                   :
    paymentMethod === 'mpesa'  ? mpesaStep === 'confirmed'                                                                        :
    paymentMethod === 'credit' ? creditValid                                                                                       :
    paymentMethod === 'split'  ? splitTotal >= finalTotal && cashPartNum > 0 && mpesaPartNum > 0 && splitMpesaStep === 'confirmed' :
    paymentMethod === 'card'   ? cardApprovalCode.trim().length > 0                                                               :
    paymentMethod === 'bank'   ? bankReference.trim().length > 0
    : false

  const handleSendSTK      = () => { if (mpesaPhone.trim().length      < 9) return; setMpesaStep('waiting') }
  const handleSplitSendSTK = () => { if (splitMpesaPhone.trim().length < 9) return; setSplitMpesaStep('waiting') }

  const handleCashPartChange = (val) => {
    setCashPart(val)
    const remaining = finalTotal - (Number(val) || 0)
    setMpesaPart(remaining > 0 ? String(remaining) : '')
  }

  const handleMethodChange = (method) => {
    setPaymentMethod(method)
    setMpesaStep('enter')
    setSplitMpesaStep('enter')
  }

  const handleConfirm = () => {
    const normalizePhone = (phone) => {
      let p = phone.trim().replace(/\D/g, '')
      if (p.startsWith('0')) p = '254' + p.substring(1)
      if (p.startsWith('7')) p = '254' + p
      return p
    }

    const now           = new Date()
    const formattedDate = now.toLocaleDateString('en-CA')
    const formattedTime = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

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
      mpesaPhone: paymentMethod === 'mpesa' ? normalizePhone(mpesaPhone)
                : paymentMethod === 'split' ? normalizePhone(splitMpesaPhone) : '',
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

          {/* ── BLACKLIST WARNING ── */}
          {paymentMethod === 'credit' && checkingBl && (
            <div style={{
              padding: '10px 14px', borderRadius: 'var(--radius-md)',
              background: 'var(--bg-muted)', marginBottom: '12px',
              fontSize: '13px', color: 'var(--text-muted)'
            }}>
              Checking customer status...
            </div>
          )}

          {paymentMethod === 'credit' && blacklistInfo && !checkingBl && (
            <div style={{
              background: '#fef2f2',
              border: '1.5px solid #fecaca',
              borderRadius: 'var(--radius-md)',
              padding: '14px 16px',
              marginBottom: '12px',
            }}>
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <MdBlock style={{ color: '#dc2626', fontSize: '20px', flexShrink: 0 }} />
                <span style={{ fontWeight: 800, fontSize: '14px', color: '#dc2626' }}>
                  BLACKLISTED CUSTOMER
                </span>
              </div>

              {/* Info */}
              <div style={{ fontSize: '13px', color: '#7f1d1d', marginBottom: '6px' }}>
                <strong>{blacklistInfo.name}</strong> has been blacklisted by <strong>{blacklistInfo.blacklistedBy}</strong>.
              </div>
              <div style={{ fontSize: '12px', color: '#991b1b', marginBottom: '2px' }}>
                Reason: {blacklistInfo.reason}
              </div>
              {blacklistInfo.balance > 0 && (
                <div style={{ fontSize: '12px', color: '#991b1b', marginBottom: '10px' }}>
                  Outstanding balance: <strong>KSh {blacklistInfo.balance.toLocaleString()}</strong>
                </div>
              )}

              {/* Accountability warning */}
              <div style={{
                background: '#fee2e2', borderRadius: 'var(--radius-sm)',
                padding: '8px 10px', marginBottom: '12px',
                fontSize: '12px', color: '#7f1d1d', fontWeight: 600,
              }}>
                ⚠️ If you proceed and this customer does not pay, <strong>you will be personally responsible</strong> for this debt.
              </div>

              {/* Acknowledge checkbox */}
              {!blacklistAck ? (
                <button
                  onClick={() => setBlacklistAck(true)}
                  style={{
                    width: '100%', padding: '9px',
                    background: 'transparent',
                    border: '1.5px solid #dc2626',
                    borderRadius: 'var(--radius-md)',
                    color: '#dc2626', fontWeight: 700,
                    fontSize: '13px', cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  I understand — proceed anyway
                </button>
              ) : (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  fontSize: '12px', color: '#dc2626', fontWeight: 600,
                }}>
                  <MdCheckCircle style={{ fontSize: '16px' }} />
                  Acknowledged — you are responsible if unpaid
                  <button
                    onClick={() => setBlacklistAck(false)}
                    style={{ marginLeft: 'auto', background: 'none', border: 'none',
                      cursor: 'pointer', fontSize: '11px', color: '#dc2626',
                      textDecoration: 'underline', fontFamily: 'inherit' }}
                  >
                    Undo
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Discount */}
          <div className={s.formGroup}>
            <label className={s.formLabel}>Discount (optional)</label>
            <div className={s.discountRow}>
              <select
                value={discountType}
                onChange={e => { setDiscountType(e.target.value); setDiscount('') }}
                className={s.discountSelect}
              >
                <option value="fixed">KSh</option>
                <option value="percent">%</option>
              </select>
              <input
                type="number"
                min="0"
                max={discountType === 'percent' ? 100 : cartTotal}
                placeholder={discountType === 'percent' ? 'e.g. 10' : 'e.g. 500'}
                value={discount}
                onChange={e => setDiscount(e.target.value)}
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
                  autoFocus
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
                <button onClick={() => setCashGiven(String(finalTotal))} className={`${s.quickAmt} ${s.quickAmtExact}`}>
                  Exact
                </button>
              </div>
              {cashGiven !== '' && cashGivenNum >= finalTotal && (
                <div className={`${s.changeBanner} ${cashGivenNum - finalTotal === 0 ? s.changeBannerExact : s.changeBannerChange}`}>
                  <span className={s.changeBannerLabel}
                    style={{ color: cashGivenNum - finalTotal === 0 ? 'var(--success-dark)' : 'var(--warning-dark)' }}>
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
                    <input type="tel" placeholder="e.g. 0712345678"
                      value={mpesaPhone} onChange={e => setMpesaPhone(e.target.value)}
                      autoFocus className={s.formInput} />
                  </div>
                  <button onClick={handleSendSTK} disabled={mpesaPhone.trim().length < 9}
                    className={`${s.stkBtn} ${mpesaPhone.trim().length < 9 ? s.stkBtnDisabled : s.stkBtnActive}`}>
                    📲 Send M-Pesa Request — KSh {finalTotal.toLocaleString()}
                  </button>
                </>
              )}
              {mpesaStep === 'waiting' && (
                <div className={s.mpesaBox}>
                  <div className={s.mpesaEmoji}>📲</div>
                  <div className={s.mpesaTitle}>STK Push Sent</div>
                  <div className={s.mpesaPhone}>{mpesaPhone}</div>
                  <div className={s.mpesaDesc}>
                    Customer's phone is prompting them to enter M-Pesa PIN to pay{' '}
                    <strong>KSh {finalTotal.toLocaleString()}</strong>.
                  </div>
                  <div className={s.mpesaBtns}>
                    <button onClick={() => setMpesaStep('enter')} className={s.mpesaBtnSecondary}>Wrong number</button>
                    <button onClick={() => setMpesaStep('confirmed')} className={s.mpesaBtnConfirm}>✅ Payment Received</button>
                  </div>
                </div>
              )}
              {mpesaStep === 'confirmed' && (
                <div className={s.mpesaConfirmed}>
                  <MdCheckCircle style={{ color: 'var(--success)', fontSize: '24px', flexShrink: 0 }} />
                  <div>
                    <div className={s.mpesaConfirmedTitle}>M-Pesa Payment Confirmed</div>
                    <div className={s.mpesaConfirmedSub}>KSh {finalTotal.toLocaleString()} from {mpesaPhone}</div>
                  </div>
                  <button onClick={() => setMpesaStep('waiting')} className={s.mpesaUndoBtn}>Undo</button>
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
                          <input type="tel" placeholder="e.g. 0712345678"
                            value={splitMpesaPhone} onChange={e => setSplitMpesaPhone(e.target.value)} className={s.formInput} />
                        </div>
                        <button onClick={handleSplitSendSTK}
                          disabled={splitMpesaPhone.trim().length < 9 || splitTotal < finalTotal}
                          className={`${s.stkBtn} ${(splitMpesaPhone.trim().length < 9 || splitTotal < finalTotal) ? s.stkBtnDisabled : s.stkBtnActive}`}
                          style={{ marginTop: '8px' }}>
                          📲 Send M-Pesa KSh {mpesaPartNum.toLocaleString()}
                        </button>
                      </>
                    )}
                    {splitMpesaStep === 'waiting' && (
                      <div className={s.mpesaBox}>
                        <div className={s.mpesaTitle}>📲 Waiting for M-Pesa PIN</div>
                        <div className={s.mpesaDesc}>{splitMpesaPhone} — KSh {mpesaPartNum.toLocaleString()}</div>
                        <div className={s.mpesaBtns}>
                          <button onClick={() => setSplitMpesaStep('enter')} className={s.mpesaBtnSecondary}>Wrong number</button>
                          <button onClick={() => setSplitMpesaStep('confirmed')} className={s.mpesaBtnConfirm}>✅ Received</button>
                        </div>
                      </div>
                    )}
                    {splitMpesaStep === 'confirmed' && (
                      <div className={s.mpesaConfirmed}>
                        <MdCheckCircle style={{ color: 'var(--success)', fontSize: '20px' }} />
                        <div className={s.mpesaConfirmedTitle}>M-Pesa KSh {mpesaPartNum.toLocaleString()} confirmed</div>
                        <button onClick={() => setSplitMpesaStep('waiting')} className={s.mpesaUndoBtn}>Undo</button>
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
                  type="date"
                  min={getTomorrowDate()}
                  value={promiseDate}
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
                  <input type="text" placeholder="e.g. APP-123456"
                    value={cardApprovalCode} onChange={e => setCardApprovalCode(e.target.value)}
                    autoFocus className={`${s.formInput} ${cardApprovalCode.trim() ? s.formInputSuccess : ''}`} />
                </div>
                {!cardApprovalCode.trim() && <div className={s.cardNote}>Enter the approval code from the EDC terminal slip to confirm.</div>}
                {cardApprovalCode.trim() && (
                  <div className={s.mpesaConfirmed}>
                    <MdCheckCircle style={{ color: 'var(--success)', fontSize: '20px', flexShrink: 0 }} />
                    <div>
                      <div className={s.mpesaConfirmedTitle}>Card Approved</div>
                      <div className={s.mpesaConfirmedSub}>Code: {cardApprovalCode.trim()}</div>
                    </div>
                  </div>
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
                  <input type="text" placeholder="e.g. TXN-20240601-00123"
                    value={bankReference} onChange={e => setBankReference(e.target.value)}
                    autoFocus className={`${s.formInput} ${bankReference.trim() ? s.formInputSuccess : ''}`} />
                </div>
                {!bankReference.trim() && <div className={s.cardNote}>Enter the reference number from the customer's transfer confirmation.</div>}
                {bankReference.trim() && (
                  <div className={s.mpesaConfirmed}>
                    <MdCheckCircle style={{ color: 'var(--success)', fontSize: '20px', flexShrink: 0 }} />
                    <div>
                      <div className={s.mpesaConfirmedTitle}>Transfer Reference Recorded</div>
                      <div className={s.mpesaConfirmedSub}>Ref: {bankReference.trim()}</div>
                    </div>
                  </div>
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
