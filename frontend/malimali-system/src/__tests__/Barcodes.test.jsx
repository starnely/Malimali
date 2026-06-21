import { describe, it, expect, vi, beforeAll, beforeEach, afterEach, afterAll } from 'vitest'
import { render, screen, within, act, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'
import Barcodes from '@/pages/Barcodes/Barcodes'

// ── Hoist shared mutable state so it's accessible inside vi.mock factories
const mockUseApp = vi.hoisted(() => vi.fn())
const lastScanPanelProps = vi.hoisted(() => ({ current: null }))

// ── Mock context ───────────────────────────────────────────────────────
vi.mock('@/context/AppContext', () => ({
  useApp: mockUseApp,
}))

// ── Mock child components ──────────────────────────────────────────────
// ScanPanel stub: re-exposes cart state as data-testid elements and includes
// the hidden scanner input so handleScanKeyDown can be exercised end-to-end.
vi.mock('@/pages/Barcodes/ScanPanel', () => ({
  default: (props) => {
    lastScanPanelProps.current = props
    return (
      <div data-testid="scan-panel">
        <input
          data-testid="scanner-input"
          value={props.scanInput}
          onChange={e => props.setScanInput(e.target.value)}
          onKeyDown={props.handleScanKeyDown}
        />
        <div data-testid="cart-length">{props.cart.length}</div>
        <div data-testid="cart-count">{props.cartCount}</div>
        <div data-testid="cart-total">{props.cartTotal}</div>
        <div data-testid="scan-error">{props.scanError}</div>
        {props.cart.map(item => (
          <div key={item._id} data-testid={`cart-item-${item._id}`}>
            <span data-testid={`qty-${item._id}`}>{item.qty}</span>
            <span data-testid={`total-${item._id}`}>{item.total}</span>
            <span data-testid={`name-${item._id}`}>{item.name}</span>
          </div>
        ))}
      </div>
    )
  },
}))

vi.mock('@/pages/Barcodes/CheckoutModal', () => ({
  default: ({ onConfirm, onCancel }) => (
    <div data-testid="checkout-modal">
      <button onClick={onCancel} data-testid="checkout-cancel">cancel</button>
      <button onClick={() => onConfirm({ paymentMethod: 'cash', finalTotal: 0, discount: 0 })} data-testid="checkout-confirm">confirm</button>
    </div>
  ),
}))
vi.mock('@/pages/Barcodes/Receipt', () => ({
  default: ({ onClose }) => <div data-testid="receipt"><button onClick={onClose}>close</button></div>,
}))
vi.mock('@/pages/Barcodes/ProductBarcodesTable', () => ({
  default: () => <div data-testid="product-barcodes-table" />,
}))
vi.mock('@/pages/Barcodes/GenerateBarcodes', () => ({
  default: () => <div data-testid="generate-barcodes" />,
}))
vi.mock('jsbarcode', () => ({ default: vi.fn() }))

// ── MSW server ─────────────────────────────────────────────────────────
const server = setupServer()
beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

// ── Test fixtures ──────────────────────────────────────────────────────
const p1 = { _id: 'p1', name: 'Apple',  barcode: 'BC001', sellPrice: 50,  buyPrice: 30, stock: 10, category: 'Fruits', unit: 'pcs' }
const p2 = { _id: 'p2', name: 'Milk',   barcode: 'BC002', sellPrice: 100, buyPrice: 60, stock:  2, category: 'Dairy',  unit: 'L'   }
const p3 = { _id: 'p3', name: 'Bread',  barcode: 'BC003', sellPrice: 80,  buyPrice: 40, stock:  0, category: 'Bakery', unit: 'pcs' }

function makeContext(overrides = {}) {
  return {
    products: [p1, p2, p3],
    recordMultipleSales: vi.fn().mockResolvedValue({ success: false }),
    currentUser: { token: 'tok', fullname: 'Alice', store: 'Main Store' },
    fetchProducts: vi.fn(),
    stores: ['Main Store'],
    isOwner: false,
    ...overrides,
  }
}

beforeEach(() => {
  mockUseApp.mockReturnValue(makeContext())
  lastScanPanelProps.current = null
})

function renderBarcodes(contextOverrides = {}) {
  mockUseApp.mockReturnValue(makeContext(contextOverrides))
  return render(<Barcodes />)
}

// Convenience: call an addToCart/etc. callback and flush React state
async function invoke(fn, ...args) {
  await act(async () => { fn(...args) })
}

// ── Tab navigation ─────────────────────────────────────────────────────

describe('tab navigation', () => {
  it('renders Scan to Sell tab by default', () => {
    renderBarcodes()
    expect(screen.getByTestId('scan-panel')).toBeInTheDocument()
    expect(screen.queryByTestId('product-barcodes-table')).not.toBeInTheDocument()
  })

  it('clicking "Product Barcodes" tab renders ProductBarcodesTable', async () => {
    renderBarcodes()
    await userEvent.click(screen.getByRole('button', { name: /Product Barcodes/i }))
    expect(screen.getByTestId('product-barcodes-table')).toBeInTheDocument()
    expect(screen.queryByTestId('scan-panel')).not.toBeInTheDocument()
  })

  it('clicking "Generate Barcodes" tab renders GenerateBarcodes', async () => {
    renderBarcodes()
    await userEvent.click(screen.getByRole('button', { name: /Generate Barcodes/i }))
    expect(screen.getByTestId('generate-barcodes')).toBeInTheDocument()
  })

  it('cart count badge appears on Scan to Sell tab after item is added', async () => {
    renderBarcodes()
    await invoke(lastScanPanelProps.current.addToCart, 'BC001')
    // The "Scan to Sell" tab button contains a badge span with the cart count
    const scanTab = screen.getByRole('button', { name: /Scan to Sell/i })
    expect(within(scanTab).getByText('1')).toBeInTheDocument()
  })
})

// ── addToCart ──────────────────────────────────────────────────────────

describe('addToCart', () => {
  it('sets scanError when code matches no product', async () => {
    renderBarcodes()
    await invoke(lastScanPanelProps.current.addToCart, 'UNKNOWN')
    expect(screen.getByTestId('scan-error')).toHaveTextContent(/No product found/)
    expect(screen.getByTestId('cart-length')).toHaveTextContent('0')
  })

  it('adds a new item by barcode with qty=1 and correct total', async () => {
    renderBarcodes()
    await invoke(lastScanPanelProps.current.addToCart, 'BC001')
    expect(screen.getByTestId('cart-length')).toHaveTextContent('1')
    expect(screen.getByTestId('qty-p1')).toHaveTextContent('1')
    expect(screen.getByTestId('total-p1')).toHaveTextContent('50')
  })

  it('increments qty when the same product is scanned again', async () => {
    renderBarcodes()
    await invoke(lastScanPanelProps.current.addToCart, 'BC001')
    await invoke(lastScanPanelProps.current.addToCart, 'BC001')
    expect(screen.getByTestId('qty-p1')).toHaveTextContent('2')
    expect(screen.getByTestId('total-p1')).toHaveTextContent('100')
    expect(screen.getByTestId('cart-length')).toHaveTextContent('1') // still one line
  })

  it('sets scanError and does not increment when qty already equals stock', async () => {
    // p2 has stock=2; add it twice to hit the limit, then scan again
    renderBarcodes()
    await invoke(lastScanPanelProps.current.addToCart, 'BC002')
    await invoke(lastScanPanelProps.current.addToCart, 'BC002')
    await invoke(lastScanPanelProps.current.addToCart, 'BC002') // should be rejected
    expect(screen.getByTestId('scan-error')).toHaveTextContent(/Max stock reached/)
    expect(screen.getByTestId('qty-p2')).toHaveTextContent('2')
  })

  it('sets scanError and does not add an out-of-stock product', async () => {
    renderBarcodes()
    await invoke(lastScanPanelProps.current.addToCart, 'BC003') // p3 has stock=0
    expect(screen.getByTestId('scan-error')).toHaveTextContent(/out of stock/i)
    expect(screen.getByTestId('cart-length')).toHaveTextContent('0')
  })

  it('accepts the product _id as an alternative to barcode', async () => {
    renderBarcodes()
    await invoke(lastScanPanelProps.current.addToCart, 'p1')
    expect(screen.getByTestId('name-p1')).toHaveTextContent('Apple')
  })
})

// ── addWeighedItem ─────────────────────────────────────────────────────

describe('addWeighedItem', () => {
  const weighedApple = {
    _id: 'weighed-2000121001234',
    id: 'weighed-2000121001234',
    productId: 'p1',
    name: 'Apple',
    category: 'Fruits',
    sellPrice: 200,
    buyPrice: 30,
    stock: 10,
    qty: 0.5,
    total: 100,
    isWeighed: true,
    weightKg: 0.5,
    weightGrams: 500,
    pricePerKg: 200,
    barcode: '2000121001234',
  }

  it('adds a weighed item to the cart', async () => {
    renderBarcodes()
    await invoke(lastScanPanelProps.current.addWeighedItem, weighedApple)
    expect(screen.getByTestId('cart-length')).toHaveTextContent('1')
    expect(screen.getByTestId(`cart-item-${weighedApple._id}`)).toBeInTheDocument()
  })

  it('sets scanError and does not add a duplicate label barcode', async () => {
    renderBarcodes()
    await invoke(lastScanPanelProps.current.addWeighedItem, weighedApple)
    await invoke(lastScanPanelProps.current.addWeighedItem, weighedApple)
    expect(screen.getByTestId('scan-error')).toHaveTextContent(/already in the cart/i)
    expect(screen.getByTestId('cart-length')).toHaveTextContent('1')
  })

  it('clears scanError on a fresh addWeighedItem call', async () => {
    renderBarcodes()
    // Introduce an error first
    await invoke(lastScanPanelProps.current.addToCart, 'UNKNOWN')
    expect(screen.getByTestId('scan-error')).not.toHaveTextContent('')
    // Adding a valid weighed item should clear it
    await invoke(lastScanPanelProps.current.addWeighedItem, weighedApple)
    expect(screen.getByTestId('scan-error')).toHaveTextContent('')
  })
})

// ── updateQty ──────────────────────────────────────────────────────────

describe('updateQty', () => {
  it('updates qty and recalculates total', async () => {
    renderBarcodes()
    await invoke(lastScanPanelProps.current.addToCart, 'BC001')
    await invoke(lastScanPanelProps.current.updateQty, 'p1', 3)
    expect(screen.getByTestId('qty-p1')).toHaveTextContent('3')
    expect(screen.getByTestId('total-p1')).toHaveTextContent('150')
  })

  it('removes the item when newQty < 1', async () => {
    renderBarcodes()
    await invoke(lastScanPanelProps.current.addToCart, 'BC001')
    await invoke(lastScanPanelProps.current.updateQty, 'p1', 0)
    expect(screen.getByTestId('cart-length')).toHaveTextContent('0')
  })

  it('does not exceed product stock', async () => {
    renderBarcodes()
    await invoke(lastScanPanelProps.current.addToCart, 'BC002') // p2 stock=2
    await invoke(lastScanPanelProps.current.updateQty, 'p2', 99) // beyond stock
    expect(screen.getByTestId('qty-p2')).toHaveTextContent('1') // unchanged
  })

  it('ignores updateQty on a weighed item (qty is locked to weight)', async () => {
    renderBarcodes()
    const weighed = {
      _id: 'weighed-abc', id: 'weighed-abc', productId: 'p1',
      name: 'Apple', category: 'Fruits', sellPrice: 200, buyPrice: 30,
      stock: 10, qty: 0.5, total: 100, isWeighed: true,
      weightKg: 0.5, weightGrams: 500, pricePerKg: 200, barcode: 'abc',
    }
    await invoke(lastScanPanelProps.current.addWeighedItem, weighed)
    await invoke(lastScanPanelProps.current.updateQty, 'weighed-abc', 3)
    expect(screen.getByTestId('qty-weighed-abc')).toHaveTextContent('0.5')
  })
})

// ── removeFromCart / clearCart ─────────────────────────────────────────

describe('removeFromCart and clearCart', () => {
  it('removeFromCart removes the specified item and leaves others', async () => {
    renderBarcodes()
    await invoke(lastScanPanelProps.current.addToCart, 'BC001')
    await invoke(lastScanPanelProps.current.addToCart, 'BC002')
    expect(screen.getByTestId('cart-length')).toHaveTextContent('2')
    await invoke(lastScanPanelProps.current.removeFromCart, 'p1')
    expect(screen.getByTestId('cart-length')).toHaveTextContent('1')
    expect(screen.queryByTestId('cart-item-p1')).not.toBeInTheDocument()
    expect(screen.getByTestId('cart-item-p2')).toBeInTheDocument()
  })

  it('clearCart empties the cart and clears scanError', async () => {
    renderBarcodes()
    await invoke(lastScanPanelProps.current.addToCart, 'BC001')
    await invoke(lastScanPanelProps.current.addToCart, 'UNKNOWN') // sets error
    await invoke(lastScanPanelProps.current.clearCart)
    expect(screen.getByTestId('cart-length')).toHaveTextContent('0')
    expect(screen.getByTestId('scan-error')).toHaveTextContent('')
  })
})

// ── handleScanKeyDown ──────────────────────────────────────────────────

describe('handleScanKeyDown', () => {
  it('ignores non-Enter keys', async () => {
    renderBarcodes()
    const scanner = screen.getByTestId('scanner-input')
    await userEvent.type(scanner, 'BC001') // no Enter
    expect(screen.getByTestId('cart-length')).toHaveTextContent('0')
  })

  it('adds a normal product to the cart when Enter is pressed', async () => {
    renderBarcodes()
    const user = userEvent.setup()
    const scanner = screen.getByTestId('scanner-input')
    await user.type(scanner, 'BC001')
    await user.keyboard('{Enter}')
    await waitFor(() => {
      expect(screen.getByTestId('cart-length')).toHaveTextContent('1')
    })
  })

  it('sets scanError for an unrecognised barcode on Enter', async () => {
    renderBarcodes()
    const user = userEvent.setup()
    const scanner = screen.getByTestId('scanner-input')
    await user.type(scanner, 'NOPE')
    await user.keyboard('{Enter}')
    await waitFor(() => {
      expect(screen.getByTestId('scan-error')).toHaveTextContent(/No product found/)
    })
  })

  it('POSTs to decode API and adds weighed item when weight barcode is scanned', async () => {
    server.use(
      http.post('http://localhost:5000/api/weigh-station/decode', () =>
        HttpResponse.json({
          success: true,
          product: { _id: 'p1', name: 'Apple', category: 'Fruits', buyPrice: 30, stock: 10 },
          weightKg: 0.75,
          weightGrams: 750,
          totalPrice: 150,
          pricePerKg: 200,
        })
      )
    )

    renderBarcodes()
    const user = userEvent.setup()
    const scanner = screen.getByTestId('scanner-input')
    await user.type(scanner, '2000121001234')
    await user.keyboard('{Enter}')

    await waitFor(() => {
      expect(screen.getByTestId('cart-length')).toHaveTextContent('1')
      expect(screen.getByTestId('cart-item-weighed-2000121001234')).toBeInTheDocument()
    })
  })

  it('sets scanError when the decode API returns success:false', async () => {
    server.use(
      http.post('http://localhost:5000/api/weigh-station/decode', () =>
        HttpResponse.json({ success: false, message: 'Unknown label' })
      )
    )

    renderBarcodes()
    const user = userEvent.setup()
    const scanner = screen.getByTestId('scanner-input')
    await user.type(scanner, '2000121001234')
    await user.keyboard('{Enter}')

    await waitFor(() => {
      expect(screen.getByTestId('scan-error')).toHaveTextContent(/Unknown label/i)
    })
  })
})

// ── Owner vs cashier store selector ───────────────────────────────────

describe('store selector', () => {
  it('shows a <select> for store switching when the user is an owner', () => {
    renderBarcodes({ isOwner: true, stores: ['Main Store', 'Branch'] })
    // Owner sees a store dropdown
    expect(screen.getByRole('combobox')).toBeInTheDocument()
  })

  it('shows a plain store name label for a non-owner cashier', () => {
    renderBarcodes({ isOwner: false })
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    expect(screen.getByText('Main Store')).toBeInTheDocument()
  })
})
