import { describe, it, expect, vi, beforeAll, afterEach, afterAll } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'
import ScanPanel from '@/pages/Barcodes/ScanPanel'

// ── MSW: intercepts commitManual fetch calls ───────────────────────────
const server = setupServer()
beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

// ── Prop factory ───────────────────────────────────────────────────────
function makeProps(overrides = {}) {
  return {
    cart: [],
    cartTotal: 0,
    cartCount: 0,
    scanError: null,
    lastScanned: null,
    scanInput: '',
    setScanInput: vi.fn(),
    handleScanKeyDown: vi.fn(),
    updateQty: vi.fn(),
    removeFromCart: vi.fn(),
    clearCart: vi.fn(),
    setShowCheckout: vi.fn(),
    scanInputRef: { current: null },
    products: [],
    loadingProducts: false,
    addToCart: vi.fn(),
    addWeighedItem: vi.fn(),
    currentUser: { token: 'test-token' },
    ...overrides,
  }
}

const sampleProducts = [
  { _id: 'p1', name: 'Apple',  category: 'Fruits', sellPrice:  50, stock: 10 },
  { _id: 'p2', name: 'Banana', category: 'Fruits', sellPrice:  30, stock:  5 },
  { _id: 'p3', name: 'Milk',   category: 'Dairy',  sellPrice: 100, stock:  0 },
  { _id: 'p4', name: 'Cheese', category: 'Dairy',  sellPrice: 200, stock:  3 },
]

function renderPanel(overrides = {}) {
  return render(<ScanPanel {...makeProps(overrides)} />)
}

// ── Loading / empty states ─────────────────────────────────────────────

describe('loadingProducts', () => {
  it('shows "Loading products..." while loadingProducts is true', () => {
    renderPanel({ loadingProducts: true })
    expect(screen.getByText('Loading products...')).toBeInTheDocument()
  })

  it('shows "No products found" when products list is empty and not loading', () => {
    renderPanel()
    expect(screen.getByText('No products found')).toBeInTheDocument()
  })
})

// ── Cart state ─────────────────────────────────────────────────────────

describe('cart state', () => {
  it('shows empty-cart prompt when cart is empty', () => {
    renderPanel()
    expect(screen.getByText('Scan or tap a product to start')).toBeInTheDocument()
  })

  it('Charge button is disabled and shows "Charge Customer" when cart is empty', () => {
    renderPanel()
    const btn = screen.getByRole('button', { name: /Charge Customer/i })
    expect(btn).toBeDisabled()
  })

  it('Clear button is absent when cart is empty', () => {
    renderPanel()
    expect(screen.queryByRole('button', { name: /Clear/i })).not.toBeInTheDocument()
  })

  it('shows item name in cart row', () => {
    const cart = [{ _id: 'c1', name: 'Apple', qty: 2, sellPrice: 50, total: 100, stock: 10 }]
    renderPanel({ cart, cartTotal: 100, cartCount: 2 })
    // product grid is empty (no products prop) so "Apple" only appears in the cart row
    expect(screen.getByText('Apple')).toBeInTheDocument()
  })

  it('Charge button shows total and is enabled when cart has items', () => {
    const cart = [{ _id: 'c1', name: 'Apple', qty: 2, sellPrice: 50, total: 100, stock: 10 }]
    renderPanel({ cart, cartTotal: 100, cartCount: 2 })
    const btn = screen.getByRole('button', { name: /Charge.*100/i })
    expect(btn).not.toBeDisabled()
  })

  it('Clear button is visible when cart has items', () => {
    const cart = [{ _id: 'c1', name: 'Apple', qty: 2, sellPrice: 50, total: 100, stock: 10 }]
    renderPanel({ cart, cartTotal: 100, cartCount: 2 })
    expect(screen.getByRole('button', { name: /Clear/i })).toBeInTheDocument()
  })

  it('clicking Clear calls clearCart', async () => {
    const clearCart = vi.fn()
    const cart = [{ _id: 'c1', name: 'Apple', qty: 2, sellPrice: 50, total: 100, stock: 10 }]
    renderPanel({ cart, cartTotal: 100, cartCount: 2, clearCart })
    await userEvent.click(screen.getByRole('button', { name: /Clear/i }))
    expect(clearCart).toHaveBeenCalledTimes(1)
  })

  it('weighed item shows ×1 lock instead of qty +/− controls', () => {
    const cart = [{
      _id: 'weighed-abc',
      name: 'Tomatoes',
      isWeighed: true,
      qty: 0.5,
      weightKg: 0.5,
      weightGrams: 500,
      pricePerKg: 200,
      total: 100,
      sellPrice: 200,
      stock: 10,
    }]
    renderPanel({ cart, cartTotal: 100, cartCount: 1 })
    expect(screen.getByText('×1')).toBeInTheDocument()
  })
})

// ── scanError / lastScanned ────────────────────────────────────────────

describe('scanError and lastScanned', () => {
  it('renders the error banner when scanError is provided', () => {
    renderPanel({ scanError: 'Product not found' })
    expect(screen.getByText(/Product not found/)).toBeInTheDocument()
  })

  it('does not render an error banner when scanError is null', () => {
    renderPanel()
    expect(screen.queryByText(/not found/i)).not.toBeInTheDocument()
  })

  it('renders lastScanned product name and stock', () => {
    const lastScanned = { _id: 'p1', name: 'Apple', sellPrice: 50, stock: 9 }
    // Pass no products so "Apple" only appears in the lastScanned bar
    renderPanel({ lastScanned, products: [] })
    expect(screen.getByText('Apple')).toBeInTheDocument()
    expect(screen.getByText('9 left')).toBeInTheDocument()
  })

  it('does not render lastScanned bar when lastScanned is null', () => {
    renderPanel({ lastScanned: null })
    // With no products, no stock badges exist; absence of "N left" confirms bar is hidden
    expect(screen.queryByText(/\d+ left/)).not.toBeInTheDocument()
  })
})

// ── stockBadge ─────────────────────────────────────────────────────────

describe('stockBadge', () => {
  it('shows "Out of stock" for stock = 0', () => {
    renderPanel({ products: [{ _id: 'p1', name: 'Milk', sellPrice: 100, stock: 0 }] })
    expect(screen.getByText('Out of stock')).toBeInTheDocument()
  })

  it('shows "N left" for stock = 1', () => {
    renderPanel({ products: [{ _id: 'p1', name: 'Milk', sellPrice: 100, stock: 1 }] })
    expect(screen.getByText('1 left')).toBeInTheDocument()
  })

  it('shows "N left" at the upper amber boundary (stock = 3)', () => {
    renderPanel({ products: [{ _id: 'p1', name: 'Cheese', sellPrice: 200, stock: 3 }] })
    expect(screen.getByText('3 left')).toBeInTheDocument()
  })

  it('shows "N left" at the dark-amber boundary (stock = 6)', () => {
    renderPanel({ products: [{ _id: 'p1', name: 'Cheese', sellPrice: 200, stock: 6 }] })
    expect(screen.getByText('6 left')).toBeInTheDocument()
  })

  it('shows "N in stock" for stock = 7', () => {
    renderPanel({ products: [{ _id: 'p1', name: 'Apple', sellPrice: 50, stock: 7 }] })
    expect(screen.getByText('7 in stock')).toBeInTheDocument()
  })
})

// ── Category pills ─────────────────────────────────────────────────────

describe('category pills', () => {
  it('renders "All" plus one pill per unique category', () => {
    renderPanel({ products: sampleProducts })
    expect(screen.getByRole('button', { name: 'All' })).toBeInTheDocument()
    // Pills are buttons; category labels inside product cards are divs — no ambiguity
    expect(screen.getByRole('button', { name: 'Dairy' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Fruits' })).toBeInTheDocument()
  })

  it('clicking a category pill filters the product grid to that category', async () => {
    renderPanel({ products: sampleProducts })
    await userEvent.click(screen.getByRole('button', { name: 'Dairy' }))
    expect(screen.getByText('Milk')).toBeInTheDocument()
    expect(screen.getByText('Cheese')).toBeInTheDocument()
    expect(screen.queryByText('Apple')).not.toBeInTheDocument()
    expect(screen.queryByText('Banana')).not.toBeInTheDocument()
  })
})

// ── Search ─────────────────────────────────────────────────────────────

describe('search', () => {
  it('filters the product grid by name as the user types', async () => {
    renderPanel({ products: sampleProducts })
    await userEvent.type(screen.getByPlaceholderText('Search products by name...'), 'mil')
    expect(screen.getByText('Milk')).toBeInTheDocument()
    expect(screen.queryByText('Apple')).not.toBeInTheDocument()
    expect(screen.queryByText('Banana')).not.toBeInTheDocument()
  })
})

// ── handleProductClick ─────────────────────────────────────────────────

describe('handleProductClick', () => {
  it('in-stock product button is enabled', () => {
    renderPanel({ products: [{ _id: 'p1', name: 'Apple', sellPrice: 50, stock: 10 }] })
    expect(screen.getByRole('button', { name: /Apple/i })).not.toBeDisabled()
  })

  it('clicking in-stock product calls addToCart with its barcode', async () => {
    const addToCart = vi.fn()
    const products = [{ _id: 'p1', name: 'Apple', sellPrice: 50, stock: 10, barcode: '1234567890123' }]
    renderPanel({ products, addToCart })
    await userEvent.click(screen.getByRole('button', { name: /Apple/i }))
    expect(addToCart).toHaveBeenCalledWith('1234567890123')
  })

  it('falls back to _id when product has no barcode', async () => {
    const addToCart = vi.fn()
    const products = [{ _id: 'p1', name: 'Apple', sellPrice: 50, stock: 10 }]
    renderPanel({ products, addToCart })
    await userEvent.click(screen.getByRole('button', { name: /Apple/i }))
    expect(addToCart).toHaveBeenCalledWith('p1')
  })

  it('out-of-stock product button is disabled', () => {
    renderPanel({ products: [{ _id: 'p1', name: 'Milk', sellPrice: 100, stock: 0 }] })
    expect(screen.getByRole('button', { name: /Milk/i })).toBeDisabled()
  })

  it('isWeighed product button is disabled (must be scanned from label)', () => {
    const products = [{ _id: 'p1', name: 'Tomatoes', sellPrice: 80, stock: 5, isWeighed: true }]
    renderPanel({ products })
    expect(screen.getByRole('button', { name: /Tomatoes/i })).toBeDisabled()
  })
})

// ── Manual code entry ──────────────────────────────────────────────────

describe('manual code entry', () => {
  it('shows "Weighed item label" dropdown for a 13-digit weight barcode', async () => {
    renderPanel()
    await userEvent.type(screen.getByPlaceholderText(/Type barcode/), '2000121001234')
    expect(screen.getByText('Weighed item label')).toBeInTheDocument()
  })

  it('shows matched product meta text for a normal barcode', async () => {
    const products = [{ _id: 'p1', name: 'Apple', sellPrice: 50, stock: 10, barcode: '1234567890123' }]
    renderPanel({ products })
    await userEvent.type(screen.getByPlaceholderText(/Type barcode/), '1234567890123')
    // The dropdown meta row shows "Barcode: <code>" — unique to the dropdown
    expect(screen.getByText(/Barcode: 1234567890123/)).toBeInTheDocument()
  })

  it('shows no-match message when code matches nothing', async () => {
    renderPanel({ products: [] })
    await userEvent.type(screen.getByPlaceholderText(/Type barcode/), 'xyz-unknown')
    expect(screen.getByText(/No product found/)).toBeInTheDocument()
  })

  it('pressing Escape clears the manual input', async () => {
    renderPanel()
    const input = screen.getByPlaceholderText(/Type barcode/)
    await userEvent.type(input, 'hello')
    expect(input).toHaveValue('hello')
    await userEvent.keyboard('{Escape}')
    expect(input).toHaveValue('')
  })

  it('pressing Enter on a matched product calls addToCart and clears the input', async () => {
    const addToCart = vi.fn()
    const products = [{ _id: 'p1', name: 'Apple', sellPrice: 50, stock: 10, barcode: '1234567890123' }]
    renderPanel({ products, addToCart })
    const user = userEvent.setup()
    const input = screen.getByPlaceholderText(/Type barcode/)
    await user.type(input, '1234567890123')
    await user.keyboard('{Enter}')
    expect(addToCart).toHaveBeenCalledWith('1234567890123')
    expect(input).toHaveValue('')
  })

  it('pressing Enter on a weight barcode POSTs to decode API and calls addWeighedItem', async () => {
    const addWeighedItem = vi.fn()
    server.use(
      http.post('http://localhost:5000/api/weigh-station/decode', () =>
        HttpResponse.json({
          success: true,
          product: {
            _id: 'prod1', name: 'Tomatoes', category: 'Vegetables',
            buyPrice: 30, stock: 20,
          },
          weightKg: 0.5,
          weightGrams: 500,
          totalPrice: 100,
          pricePerKg: 200,
        })
      )
    )

    renderPanel({ addWeighedItem })
    const user = userEvent.setup()
    const input = screen.getByPlaceholderText(/Type barcode/)
    await user.type(input, '2000121001234')
    await user.keyboard('{Enter}')

    await waitFor(() => {
      expect(addWeighedItem).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Tomatoes',
          weightKg: 0.5,
          isWeighed: true,
          barcode: '2000121001234',
        })
      )
    })
  })
})
