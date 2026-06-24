import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CheckoutModal from '@/pages/Barcodes/CheckoutModal'

// ── Mock useApp ────────────────────────────────────────────────────────
const mockUseApp = vi.hoisted(() => vi.fn())
vi.mock('@/context/AppContext', () => ({ useApp: mockUseApp }))

// ── Context factory ────────────────────────────────────────────────────
function makeContext(overrides = {}) {
  return {
    currentUser: { token: 'tok', fullname: 'Alice', store: 'Main Store' },
    settings: null,
    checkCustomerCredit: vi.fn().mockResolvedValue(null),
    ...overrides,
  }
}

// ── Render helper ──────────────────────────────────────────────────────
function renderModal(props = {}, contextOverrides = {}) {
  mockUseApp.mockReturnValue(makeContext(contextOverrides))
  return render(
    <CheckoutModal
      cartTotal={1000}
      onConfirm={vi.fn()}
      onCancel={vi.fn()}
      {...props}
    />
  )
}

// ── Shortcuts ──────────────────────────────────────────────────────────
const confirmBtn = () => screen.getByRole('button', { name: /Confirm/i })
const clickMethod = (name) => userEvent.click(screen.getByRole('button', { name: new RegExp(name, 'i') }))

// ── Discount calculations ──────────────────────────────────────────────

describe('discount calculations', () => {
  it('fixed discount reduces finalTotal shown in header and confirm button', async () => {
    renderModal()
    await userEvent.type(screen.getByPlaceholderText('e.g. 500'), '200')
    expect(screen.getByText(/Discount: − KSh 200/)).toBeInTheDocument()
    expect(screen.getByText(/Final: KSh 800/)).toBeInTheDocument()
  })

  it('percent discount calculates (10% of 1000 = 100 off)', async () => {
    renderModal()
    await userEvent.selectOptions(screen.getByRole('combobox'), '%')
    await userEvent.type(screen.getByPlaceholderText('e.g. 10'), '10')
    expect(screen.getByText(/Discount: − KSh 100/)).toBeInTheDocument()
    expect(screen.getByText(/Final: KSh 900/)).toBeInTheDocument()
  })

  it('discount is capped at cartTotal — finalTotal never goes negative', async () => {
    renderModal({ cartTotal: 1000 })
    await userEvent.type(screen.getByPlaceholderText('e.g. 500'), '9999')
    // discountAmount = min(9999, 1000) = 1000; finalTotal = 0
    expect(screen.getByText(/Final: KSh 0/)).toBeInTheDocument()
  })
})

// ── Cash payment ───────────────────────────────────────────────────────

describe('cash payment', () => {
  it('Confirm button is disabled when cashGiven is empty', () => {
    renderModal()
    expect(confirmBtn()).toBeDisabled()
  })

  it('Confirm button is disabled when cashGiven < finalTotal', async () => {
    renderModal({ cartTotal: 1000 })
    await userEvent.type(screen.getByPlaceholderText(/Enter amount/i), '500')
    expect(confirmBtn()).toBeDisabled()
  })

  it('Confirm button is enabled when cashGiven equals finalTotal', async () => {
    renderModal({ cartTotal: 1000 })
    await userEvent.type(screen.getByPlaceholderText(/Enter amount/i), '1000')
    expect(confirmBtn()).not.toBeDisabled()
  })

  it('shows "Exact amount" banner when cashGiven equals finalTotal', async () => {
    renderModal({ cartTotal: 1000 })
    await userEvent.type(screen.getByPlaceholderText(/Enter amount/i), '1000')
    expect(screen.getByText(/Exact amount/i)).toBeInTheDocument()
  })

  it('shows change amount when cashGiven exceeds finalTotal', async () => {
    renderModal({ cartTotal: 1000 })
    await userEvent.type(screen.getByPlaceholderText(/Enter amount/i), '1200')
    expect(screen.getByText(/Change to give/i)).toBeInTheDocument()
    expect(screen.getByText('KSh 200')).toBeInTheDocument()
  })

  it('shows "Short by" when cashGiven < finalTotal', async () => {
    renderModal({ cartTotal: 1000 })
    await userEvent.type(screen.getByPlaceholderText(/Enter amount/i), '800')
    expect(screen.getByText(/Short by KSh 200/i)).toBeInTheDocument()
  })
})

// ── M-Pesa flow ────────────────────────────────────────────────────────

describe('M-Pesa flow', () => {
  it('shows "✗ Enter a valid number" feedback for an invalid phone', async () => {
    renderModal()
    await clickMethod('M-Pesa')
    await userEvent.type(screen.getByPlaceholderText(/e\.g\. 0712345678/i), '0812345678')
    expect(screen.getByText(/✗ Enter a valid number/i)).toBeInTheDocument()
  })

  it('shows "✓ Valid phone number" feedback for a valid Kenyan phone', async () => {
    renderModal()
    await clickMethod('M-Pesa')
    await userEvent.type(screen.getByPlaceholderText(/e\.g\. 0712345678/i), '0712345678')
    expect(screen.getByText(/✓ Valid phone number/i)).toBeInTheDocument()
  })

  it('STK send button is disabled for an invalid phone', async () => {
    renderModal()
    await clickMethod('M-Pesa')
    await userEvent.type(screen.getByPlaceholderText(/e\.g\. 0712345678/i), '0812345678')
    expect(screen.getByRole('button', { name: /Send M-Pesa Request/i })).toBeDisabled()
  })

  it('clicking Send STK with a valid phone and cart shows "Waiting for Payment"', async () => {
    const initiateMpesaPayment = vi.fn().mockResolvedValue({ success: true, checkoutRequestId: 'REQ001' })
    renderModal(
      { cart: [{ productId: '1', qty: 1, price: 100 }] },
      { initiateMpesaPayment, checkMpesaStatus: vi.fn().mockResolvedValue(null) }
    )
    await clickMethod('M-Pesa')
    await userEvent.type(screen.getByPlaceholderText(/e\.g\. 0712345678/i), '0712345678')
    await userEvent.click(screen.getByRole('button', { name: /Send M-Pesa Request/i }))
    await waitFor(() => expect(screen.getByText(/Waiting for Payment/i)).toBeInTheDocument())
  })

  it('Confirm stays disabled while waiting for M-Pesa payment confirmation', async () => {
    const initiateMpesaPayment = vi.fn().mockResolvedValue({ success: true, checkoutRequestId: 'REQ001' })
    renderModal(
      { cart: [{ productId: '1', qty: 1, price: 100 }] },
      { initiateMpesaPayment, checkMpesaStatus: vi.fn().mockResolvedValue(null) }
    )
    await clickMethod('M-Pesa')
    await userEvent.type(screen.getByPlaceholderText(/e\.g\. 0712345678/i), '0712345678')
    await userEvent.click(screen.getByRole('button', { name: /Send M-Pesa Request/i }))
    await waitFor(() => expect(screen.getByText(/Waiting for Payment/i)).toBeInTheDocument())
    expect(confirmBtn()).toBeDisabled()
  })
})

// ── Credit payment ─────────────────────────────────────────────────────

describe('credit payment — canConfirm guards', () => {
  it('Confirm is disabled when customerName is empty', async () => {
    renderModal()
    await clickMethod('Credit')
    expect(confirmBtn()).toBeDisabled()
  })

  it('Confirm is disabled when promiseDate is not set', async () => {
    renderModal()
    await clickMethod('Credit')
    await userEvent.type(screen.getByPlaceholderText(/e\.g\. John Kamau/i), 'Alice')
    // promiseDate still empty
    expect(confirmBtn()).toBeDisabled()
  })

  it('Confirm is enabled when both customerName and promiseDate are set', async () => {
    const { container } = renderModal()
    await clickMethod('Credit')
    await userEvent.type(screen.getByPlaceholderText(/e\.g\. John Kamau/i), 'Alice')
    fireEvent.change(container.querySelector('input[type="date"]'), {
      target: { value: '2027-01-15' },
    })
    expect(confirmBtn()).not.toBeDisabled()
  })
})

// ── Credit blacklist gate ──────────────────────────────────────────────
// The useEffect debounces checkCustomerCredit by 500 ms using a real
// setTimeout. RTL's waitFor polls via setInterval, which conflicts with
// vi.useFakeTimers, so we use real timers and waitFor with a 2 s budget
// (generous for a 500 ms debounce on any CI machine).

describe('credit blacklist gate', () => {
  function makeBlacklistedCtx() {
    return {
      checkCustomerCredit: vi.fn().mockResolvedValue({
        blacklisted: true,
        name: 'John Doe',
        blacklistReason: 'Previous default',
        blacklistedBy: 'Manager',
        balance: 5000,
      }),
    }
  }

  async function triggerBlacklist() {
    fireEvent.click(screen.getByRole('button', { name: /Credit/i }))
    fireEvent.change(screen.getByPlaceholderText(/e\.g\. John Kamau/i), {
      target: { value: 'John Doe' },
    })
    // Wait for the 500 ms debounce + async checkCustomerCredit to complete
    await waitFor(
      () => expect(screen.getByText(/BLACKLISTED CUSTOMER/i)).toBeInTheDocument(),
      { timeout: 2000 }
    )
  }

  it('shows BLACKLISTED warning after the 500 ms debounce fires', async () => {
    renderModal({}, makeBlacklistedCtx())
    await triggerBlacklist()
  })

  it('Confirm stays disabled even with name+date when blacklist is unacknowledged', async () => {
    const { container } = renderModal({}, makeBlacklistedCtx())
    await triggerBlacklist()
    fireEvent.change(container.querySelector('input[type="date"]'), {
      target: { value: '2027-01-15' },
    })
    expect(confirmBtn()).toBeDisabled()
  })

  it('Confirm is enabled after clicking "I understand — proceed anyway"', async () => {
    const { container } = renderModal({}, makeBlacklistedCtx())
    await triggerBlacklist()
    fireEvent.change(container.querySelector('input[type="date"]'), {
      target: { value: '2027-01-15' },
    })
    fireEvent.click(screen.getByRole('button', { name: /I understand/i }))
    expect(confirmBtn()).not.toBeDisabled()
  })
})

// ── Card payment ───────────────────────────────────────────────────────

describe('card payment', () => {
  it('Confirm is disabled when both fields are empty', async () => {
    renderModal()
    await clickMethod('Card')
    expect(confirmBtn()).toBeDisabled()
  })

  it('shows "Too short" error for a code under 6 characters', async () => {
    renderModal()
    await clickMethod('Card')
    await userEvent.type(screen.getByPlaceholderText(/e\.g\. 123456/i), 'AB1')
    expect(screen.getByText(/Too short — minimum 6 characters/i)).toBeInTheDocument()
  })

  it('shows "Letters and numbers only" error for a code with invalid characters', async () => {
    renderModal()
    await clickMethod('Card')
    await userEvent.type(screen.getByPlaceholderText(/e\.g\. 123456/i), 'ABC!@#')
    expect(screen.getByText(/Letters and numbers only/i)).toBeInTheDocument()
  })

  it('Confirm is disabled when first code is valid but confirmation is empty', async () => {
    renderModal()
    await clickMethod('Card')
    await userEvent.type(screen.getByPlaceholderText(/e\.g\. 123456/i), 'ABC123')
    expect(confirmBtn()).toBeDisabled()
  })

  it('Confirm is disabled when codes do not match', async () => {
    renderModal()
    await clickMethod('Card')
    await userEvent.type(screen.getByPlaceholderText(/e\.g\. 123456/i), 'ABC123')
    await userEvent.type(screen.getByPlaceholderText(/Re-enter approval code/i), 'ABC124')
    expect(confirmBtn()).toBeDisabled()
  })

  it('shows "Codes don\'t match" panel with both values when entries differ', async () => {
    renderModal()
    await clickMethod('Card')
    await userEvent.type(screen.getByPlaceholderText(/e\.g\. 123456/i), 'ABC123')
    await userEvent.type(screen.getByPlaceholderText(/Re-enter approval code/i), 'ABC124')
    expect(screen.getByText(/Codes don't match/i)).toBeInTheDocument()
    expect(screen.getByText('ABC123')).toBeInTheDocument()
    expect(screen.getByText('ABC124')).toBeInTheDocument()
  })

  it('Confirm is enabled when both entries match a valid code', async () => {
    renderModal()
    await clickMethod('Card')
    await userEvent.type(screen.getByPlaceholderText(/e\.g\. 123456/i), 'ABC123')
    await userEvent.type(screen.getByPlaceholderText(/Re-enter approval code/i), 'ABC123')
    expect(confirmBtn()).not.toBeDisabled()
  })
})

// ── Bank transfer ──────────────────────────────────────────────────────

describe('bank transfer', () => {
  it('Confirm is disabled when both fields are empty', async () => {
    renderModal()
    await clickMethod('Bank Transfer')
    expect(confirmBtn()).toBeDisabled()
  })

  it('shows "Too short" error for a reference under 8 characters', async () => {
    renderModal()
    await clickMethod('Bank Transfer')
    await userEvent.type(screen.getByPlaceholderText(/FTGN/i), 'ABCD')
    expect(screen.getByText(/Too short — minimum 8 characters/i)).toBeInTheDocument()
  })

  it('shows "Letters and numbers only" error for a reference with invalid characters', async () => {
    renderModal()
    await clickMethod('Bank Transfer')
    await userEvent.type(screen.getByPlaceholderText(/FTGN/i), 'TXN-2024')
    expect(screen.getByText(/Letters and numbers only/i)).toBeInTheDocument()
  })

  it('Confirm is disabled when references do not match', async () => {
    renderModal()
    await clickMethod('Bank Transfer')
    await userEvent.type(screen.getByPlaceholderText(/FTGN/i), 'ABCD12345')
    await userEvent.type(screen.getByPlaceholderText(/Re-enter reference number/i), 'ABCD12346')
    expect(confirmBtn()).toBeDisabled()
  })

  it('shows "References don\'t match" panel with both values when entries differ', async () => {
    renderModal()
    await clickMethod('Bank Transfer')
    await userEvent.type(screen.getByPlaceholderText(/FTGN/i), 'ABCD12345')
    await userEvent.type(screen.getByPlaceholderText(/Re-enter reference number/i), 'ABCD12346')
    expect(screen.getByText(/References don't match/i)).toBeInTheDocument()
    expect(screen.getByText('ABCD12345')).toBeInTheDocument()
    expect(screen.getByText('ABCD12346')).toBeInTheDocument()
  })

  it('Confirm is enabled when both entries match a valid reference', async () => {
    renderModal()
    await clickMethod('Bank Transfer')
    await userEvent.type(screen.getByPlaceholderText(/FTGN/i), 'ABCD12345')
    await userEvent.type(screen.getByPlaceholderText(/Re-enter reference number/i), 'ABCD12345')
    expect(confirmBtn()).not.toBeDisabled()
  })
})

// ── Split payment ──────────────────────────────────────────────────────

describe('split payment', () => {
  it('typing cashPart auto-fills mpesaPart as the remainder', async () => {
    renderModal({ cartTotal: 1000 })
    await clickMethod('Split')
    // Two number spinbuttons visible: [0]=discount, [1]=cashPart, [2]=mpesaPart
    const spinbuttons = screen.getAllByRole('spinbutton')
    await userEvent.type(spinbuttons[1], '600')
    expect(spinbuttons[2]).toHaveValue(400)
  })

  it('shows "Short by" when cashPart + mpesaPart < finalTotal', async () => {
    renderModal({ cartTotal: 1000 })
    await clickMethod('Split')
    const spinbuttons = screen.getAllByRole('spinbutton')
    await userEvent.type(spinbuttons[1], '300')
    // mpesaPart auto-fills to 700; set it lower manually
    fireEvent.change(spinbuttons[2], { target: { value: '200' } })
    expect(screen.getByText(/Short by KSh/i)).toBeInTheDocument()
  })
})

// ── handleConfirm payload ──────────────────────────────────────────────

describe('handleConfirm payload', () => {
  it('passes correct cash payload to onConfirm', async () => {
    const onConfirm = vi.fn()
    renderModal({ cartTotal: 1000, onConfirm })
    await userEvent.type(screen.getByPlaceholderText(/Enter amount/i), '1200')
    await userEvent.click(confirmBtn())
    expect(onConfirm).toHaveBeenCalledWith(
      expect.objectContaining({
        paymentMethod: 'cash',
        cashGiven: 1200,
        change: 200,
        discount: 0,
        finalTotal: 1000,
      })
    )
  })

  it('passes correct credit payload to onConfirm', async () => {
    const onConfirm = vi.fn()
    const { container } = renderModal({ cartTotal: 500, onConfirm })
    await clickMethod('Credit')
    await userEvent.type(screen.getByPlaceholderText(/e\.g\. John Kamau/i), 'Alice')
    fireEvent.change(container.querySelector('input[type="date"]'), {
      target: { value: '2027-06-01' },
    })
    await userEvent.click(confirmBtn())
    expect(onConfirm).toHaveBeenCalledWith(
      expect.objectContaining({
        paymentMethod: 'credit',
        isCredit: true,
        balanceDue: 500,
        customerName: 'Alice',
        promiseDate: '2027-06-01',
      })
    )
  })

  it('uses "Walk-in Customer" when customerName is left blank (cash)', async () => {
    const onConfirm = vi.fn()
    renderModal({ cartTotal: 100, onConfirm })
    await userEvent.type(screen.getByPlaceholderText(/Enter amount/i), '100')
    await userEvent.click(confirmBtn())
    expect(onConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ customerName: 'Walk-in Customer' })
    )
  })
})

// ── Settings-restricted payment methods ───────────────────────────────

describe('settings-restricted payment methods', () => {
  it('only renders methods listed in settings.paymentMethods', () => {
    renderModal({}, { settings: { paymentMethods: ['cash', 'mpesa'] } })
    expect(screen.getByRole('button', { name: /Cash/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /M-Pesa/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Credit/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Split/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Bank Transfer/i })).not.toBeInTheDocument()
  })

  it('shows all methods when settings.paymentMethods is not set', () => {
    renderModal({}, { settings: null })
    expect(screen.getByRole('button', { name: /Cash/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Credit/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Bank Transfer/i })).toBeInTheDocument()
  })
})

// ── Back button ────────────────────────────────────────────────────────

describe('Back button', () => {
  it('calls onCancel when Back is clicked', async () => {
    const onCancel = vi.fn()
    renderModal({ onCancel })
    await userEvent.click(screen.getByRole('button', { name: /Back/i }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})
