import { useState } from 'react';
import { MdPerson, MdMoney, MdCallSplit, MdPhone, MdCheckCircle, MdWarning } from 'react-icons/md';
import s from '@/styles/Barcodes.module.css';

export default function CheckoutModal({ cartTotal, onConfirm, onCancel }) {
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [cashGiven, setCashGiven] = useState('')
  const [discount, setDiscount] = useState('')
  const [discountType, setDiscountType] = useState('fixed')
  const [customerName, setCustomerName] = useState('')
  const [mpesaPhone, setMpesaPhone] = useState('')
  const [mpesaStep, setMpesaStep] = useState('enter')
  const [cashPart, setCashPart] = useState('')
  const [mpesaPart, setMpesaPart] = useState('')
  const [splitMpesaPhone, setSplitMpesaPhone] = useState('')
  const [splitMpesaStep, setSplitMpesaStep] = useState('enter')

  const discountAmount = discountType === 'percent'
    ? Math.round((Number(discount) / 100) * cartTotal)
    : Number(discount) || 0
  const finalTotal = Math.max(0, cartTotal - discountAmount)
  const cashGivenNum = Number(cashGiven) || 0
  const cashPartNum = Number(cashPart) || 0
  const mpesaPartNum = Number(mpesaPart) || 0
  const splitTotal = cashPartNum + mpesaPartNum
  const splitChange = splitTotal - finalTotal

  const canConfirm =
    paymentMethod === 'cash' ? cashGivenNum >= finalTotal && cashGiven !== '' :
      paymentMethod === 'mpesa' ? mpesaStep === 'confirmed' :
        paymentMethod === 'credit' ? customerName.trim().length > 0 :
          paymentMethod === 'split' ? splitTotal >= finalTotal && cashPartNum > 0 && mpesaPartNum > 0 && splitMpesaStep === 'confirmed'
            : false

  const handleSendSTK = () => { if (mpesaPhone.trim().length < 9) return; setMpesaStep('waiting') }
  const handleSplitSendSTK = () => { if (splitMpesaPhone.trim().length < 9) return; setSplitMpesaStep('waiting') }
  const handleCashPartChange = (val) => {
    setCashPart(val)
    const remaining = finalTotal - (Number(val) || 0)
    if (remaining > 0) setMpesaPart(String(remaining)); else setMpesaPart('')
  }

  const handleConfirm = () => {
    // Basic phone normalization for M-Pesa (converts 07... to 2547...)
    const normalizePhone = (phone) => {
      let p = phone.trim().replace(/\D/g, ''); // remove non-digits
      if (p.startsWith('0')) p = '254' + p.substring(1);
      if (p.startsWith('7')) p = '254' + p;
      return p;
    };

    onConfirm({
      paymentMethod,
      // How much the customer actually handed over / paid via M-Pesa
      amountPaid: paymentMethod === 'cash' ? cashGivenNum :
        paymentMethod === 'mpesa' ? finalTotal :
          paymentMethod === 'split' ? splitTotal : 0,

      cashGiven: cashGivenNum,
      change: paymentMethod === 'cash' ? Math.max(0, cashGivenNum - finalTotal)
        : paymentMethod === 'split' ? Math.max(0, splitChange) : 0,

      discount: discountAmount, finalTotal,

      isCredit: paymentMethod === 'credit',
      balanceDue: paymentMethod === 'credit' ? finalTotal : 0,

      customerName: customerName.trim() || "Walk-in Customer",

      mpesaPhone: paymentMethod === 'mpesa' ? normalizePhone(mpesaPhone)
        : paymentMethod === 'split' ? normalizePhone(splitMpesaPhone) : '',
      cashPart: cashPartNum,
      mpesaPart: mpesaPartNum,
    })
  }

  const payBtn = (method, label, icon) => (
    <button
      key={method}
      onClick={() => { setPaymentMethod(method); setMpesaStep('enter'); setSplitMpesaStep('enter') }}
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
              Customer Name {paymentMethod === 'credit' && <span className={s.requiredStar}>*required</span>}
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

          {/* Discount */}
          <div className={s.formGroup}>
            <label className={s.formLabel}>Discount (optional)</label>
            <div className={s.discountRow}>
              <select
                value={discountType}
                onChange={e => {
                  setDiscountType(e.target.value);
                  setDiscount('')
                }}
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
                Discount: - KSh {discountAmount.toLocaleString()} → Final: KSh {finalTotal.toLocaleString()}
              </div>
            )}
          </div>

          {/* Payment method */}
          <div className={s.formGroup}>
            <label className={s.formLabel}>Payment Method</label>
            <div className={s.payBtns}>
              {payBtn('cash', 'Cash', '💵')}
              {payBtn('mpesa', 'M-Pesa', '📱')}
              {payBtn('split', 'Split', '💳')}
              {payBtn('credit', 'Credit', '📋')}
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
                  value={cashGiven}
                  onChange={e => setCashGiven(e.target.value)}
                  autoFocus
                  className={`${s.formInputLarge} ${cashGivenNum >= finalTotal && cashGiven ? s.formInputSuccess : ''}`}
                />
              </div>
              <div className={s.quickAmounts}>
                {[50, 100, 200, 500, 1000, 2000, 5000, 10000].map(amount => (
                  <button
                    key={amount}
                    onClick={() => setCashGiven(String(amount))}
                    className={`${s.quickAmt} ${cashGivenNum === amount ? s.quickAmtActive : ''}`}
                  >
                    {amount.toLocaleString()}
                  </button>
                ))}
                <button onClick={() => setCashGiven(String(finalTotal))} className={`${s.quickAmt} ${s.quickAmtExact}`}>
                  Exact
                </button>
              </div>
              {cashGiven !== '' && cashGivenNum >= finalTotal && (
                <div className={`${s.changeBanner} ${cashGivenNum - finalTotal === 0 ? s.changeBannerExact : s.changeBannerChange}`}>
                  <span className={s.changeBannerLabel} style={{ color: cashGivenNum - finalTotal === 0 ? '#3B6D11' : '#7A4D00' }}>
                    {cashGivenNum - finalTotal === 0 ? '✅ Exact amount' : '💰 Change to give'}
                  </span>
                  {cashGivenNum - finalTotal > 0 && (
                    <span className={s.changeBannerAmt}>KSh {(cashGivenNum - finalTotal).toLocaleString()}</span>
                  )}
                </div>
              )}
              {cashGiven !== '' && cashGivenNum < finalTotal && (
                <div className={s.shortBanner}>
                  <MdWarning style={{ fontSize: '16px' }} /> Short by KSh {(finalTotal - cashGivenNum).toLocaleString()}
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
                      type="tel" placeholder="e.g. 0712345678"
                      value={mpesaPhone}
                      onChange={e => setMpesaPhone(e.target.value)}
                      autoFocus
                      className={s.formInput}
                      style={{ fontSize: '15px', fontWeight: '600' }}
                    />
                  </div>
                  <button
                    onClick={handleSendSTK}
                    disabled={mpesaPhone.trim().length < 9}
                    className={`${s.stkBtn} ${mpesaPhone.trim().length < 9 ? s.stkBtnDisabled : s.stkBtnActive}`}
                  >
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
                    Customer's phone is prompting them to enter M-Pesa PIN to pay <strong>KSh {finalTotal.toLocaleString()}</strong>.
                  </div>
                  <div className={s.mpesaBtns}>
                    <button onClick={() => setMpesaStep('enter')} className={s.mpesaBtnSecondary}>Wrong number</button>
                    <button onClick={() => setMpesaStep('confirmed')} className={s.mpesaBtnConfirm}>✅ Payment Received</button>
                  </div>
                </div>
              )}
              {mpesaStep === 'confirmed' && (
                <div className={s.mpesaConfirmed}>
                  <MdCheckCircle style={{ color: '#3B6D11', fontSize: '24px', flexShrink: 0 }} />
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
                <div className={s.splitPanelTitle}>
                  <MdCallSplit style={{ fontSize: '16px' }} /> Split: Cash + M-Pesa
                </div>
                <div className={s.splitPanelTotal}>Total to pay: <strong>KSh {finalTotal.toLocaleString()}</strong></div>
                <label className={s.splitInputLabel}>Cash Amount</label>
                <input
                  type="number" min="0" max={finalTotal} placeholder="e.g. 500"
                  value={cashPart}
                  onChange={e => handleCashPartChange(e.target.value)}
                  className={s.splitInput}
                />
                <label className={s.splitInputLabel}>M-Pesa Amount</label>
                <input
                  type="number" min="0" max={finalTotal} placeholder="e.g. 400"
                  value={mpesaPart}
                  onChange={e => setMpesaPart(e.target.value)}
                  className={s.splitInput}
                />
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
                            type="tel" placeholder="e.g. 0712345678"
                            value={splitMpesaPhone}
                            onChange={e => setSplitMpesaPhone(e.target.value)}
                            className={s.formInput}
                            style={{ fontSize: '14px', fontWeight: '600' }}
                          />
                        </div>
                        <button
                          onClick={handleSplitSendSTK}
                          disabled={splitMpesaPhone.trim().length < 9 || splitTotal < finalTotal}
                          className={`${s.stkBtn} ${(splitMpesaPhone.trim().length < 9 || splitTotal < finalTotal) ? s.stkBtnDisabled : s.stkBtnActive}`}
                          style={{ marginTop: '8px' }}
                        >
                          📲 Send M-Pesa KSh {mpesaPartNum.toLocaleString()}
                        </button>
                      </>
                    )}
                    {splitMpesaStep === 'waiting' && (
                      <div className={s.mpesaBox} style={{ textAlign: 'center' }}>
                        <div className={s.mpesaTitle}>📲 Waiting for M-Pesa PIN</div>
                        <div className={s.mpesaDesc} style={{ marginBottom: '10px' }}>{splitMpesaPhone} — KSh {mpesaPartNum.toLocaleString()}</div>
                        <div className={s.mpesaBtns}>
                          <button onClick={() => setSplitMpesaStep('enter')} className={s.mpesaBtnSecondary}>Wrong number</button>
                          <button onClick={() => setSplitMpesaStep('confirmed')} className={s.mpesaBtnConfirm}>✅ Received</button>
                        </div>
                      </div>
                    )}
                    {splitMpesaStep === 'confirmed' && (
                      <div className={s.mpesaConfirmed}>
                        <MdCheckCircle style={{ color: '#3B6D11', fontSize: '20px' }} />
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
                  Customer <strong>{customerName || '(enter name above)'}</strong> will owe <strong>KSh {finalTotal.toLocaleString()}</strong>. No payment collected now.
                </div>
                <div className={s.creditNote2}>Customer name is required before confirming.</div>
              </div>
            </div>
          )}

          {/* Footer buttons */}
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