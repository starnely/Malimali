import { describe, it, expect, vi, beforeAll, beforeEach, afterEach, afterAll } from 'vitest'
import { render, act, waitFor } from '@testing-library/react'
import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'
import { AppProvider, useApp } from '@/context/AppContext'

// ── Socket mock ────────────────────────────────────────────────────────
// Shared via vi.hoisted so both the vi.mock factory and the test bodies
// can read/write the same objects.
const socketEmit    = vi.hoisted(() => vi.fn())
const socketHandlers = vi.hoisted(() => ({}))

vi.mock('@/context/SocketContext', () => ({
  useSocket: () => ({
    on:   (event, fn)  => { socketHandlers[event] = fn },
    off:  (event, fn)  => { if (socketHandlers[event] === fn) delete socketHandlers[event] },
    emit: socketEmit,
  }),
  useSocketActions: () => ({ refreshSocket: vi.fn() }),
}))

// ── MSW server ─────────────────────────────────────────────────────────
// The catch-all GET handler silences the staggered fetch burst that fires
// when a currentUser token is present (e.g. after login or on mount with
// localStorage set).
const server = setupServer(
  http.get('http://localhost:5000/api/setup/status', () =>
    HttpResponse.json({ isSetup: false, hasOwner: false })
  ),
  http.get('http://localhost:5000/*', () =>
    HttpResponse.json({ success: false })
  ),
)
beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

// ── Context capture ────────────────────────────────────────────────────
let capturedCtx = null
function CtxCapture() {
  capturedCtx = useApp()
  return null
}

async function renderProvider() {
  capturedCtx = null
  await act(async () => {
    render(
      <AppProvider>
        <CtxCapture />
      </AppProvider>
    )
  })
}

beforeEach(() => {
  localStorage.clear()
  capturedCtx = null
  Object.keys(socketHandlers).forEach(k => delete socketHandlers[k])
  socketEmit.mockClear()
})

// ── Notification state ─────────────────────────────────────────────────

describe('notification state', () => {
  it('addNotification appends a notification with the correct shape', async () => {
    await renderProvider()
    await act(async () => { capturedCtx.addNotification('Hello', 'info', 'owner') })
    expect(capturedCtx.notifications).toHaveLength(1)
    expect(capturedCtx.notifications[0]).toMatchObject({ message: 'Hello', type: 'info', target: 'owner', read: false })
  })

  it('addNotification prepends — newest notification is first', async () => {
    await renderProvider()
    await act(async () => { capturedCtx.addNotification('First', 'info') })
    await act(async () => { capturedCtx.addNotification('Second', 'info') })
    expect(capturedCtx.notifications[0].message).toBe('Second')
  })

  it('markNotificationRead flips the read flag for the specified id', async () => {
    await renderProvider()
    await act(async () => { capturedCtx.addNotification('Test', 'info') })
    const { id } = capturedCtx.notifications[0]
    await act(async () => { capturedCtx.markNotificationRead(id) })
    expect(capturedCtx.notifications[0].read).toBe(true)
  })

  it('markAllNotificationsRead marks all notifications for the given target', async () => {
    await renderProvider()
    await act(async () => { capturedCtx.addNotification('N1', 'info', 'owner') })
    await act(async () => { capturedCtx.addNotification('N2', 'info', 'owner') })
    await act(async () => { capturedCtx.markAllNotificationsRead('owner') })
    expect(capturedCtx.notifications.every(n => n.read)).toBe(true)
  })

  it('clearNotifications removes notifications for the given target', async () => {
    await renderProvider()
    await act(async () => { capturedCtx.addNotification('Keep', 'info', 'employee') })
    await act(async () => { capturedCtx.addNotification('Remove', 'info', 'owner') })
    await act(async () => { capturedCtx.clearNotifications('owner') })
    expect(capturedCtx.notifications).toHaveLength(1)
    expect(capturedCtx.notifications[0].message).toBe('Keep')
  })
})

// ── myNotifications filter ─────────────────────────────────────────────

describe('myNotifications filter', () => {
  it('owner sees notifications targeted at "owner" and "all"', async () => {
    localStorage.setItem('pos_system_user', JSON.stringify({ role: 'owner', token: 'tok' }))
    await renderProvider()
    await act(async () => {
      capturedCtx.addNotification('For owner', 'info', 'owner')
      capturedCtx.addNotification('For all',   'info', 'all')
      capturedCtx.addNotification('For Alice',  'info', 'Alice') // someone else
    })
    const msgs = capturedCtx.myNotifications.map(n => n.message)
    expect(msgs).toContain('For owner')
    expect(msgs).toContain('For all')
    expect(msgs).not.toContain('For Alice')
  })

  it('cashier sees "all" and own-name notifications — NOT owner-only ones', async () => {
    localStorage.setItem('pos_system_user', JSON.stringify({ role: 'cashier', token: 'tok', fullname: 'Alice' }))
    await renderProvider()
    await act(async () => {
      capturedCtx.addNotification('For all',   'info', 'all')
      capturedCtx.addNotification('For Alice',  'info', 'Alice')
      capturedCtx.addNotification('Owner only', 'info', 'owner')
    })
    const msgs = capturedCtx.myNotifications.map(n => n.message)
    expect(msgs).toContain('For all')
    expect(msgs).toContain('For Alice')
    expect(msgs).not.toContain('Owner only')
  })
})

// ── unreadCount ────────────────────────────────────────────────────────

describe('unreadCount', () => {
  it('reflects the number of unread myNotifications', async () => {
    localStorage.setItem('pos_system_user', JSON.stringify({ role: 'owner', token: 'tok' }))
    await renderProvider()
    expect(capturedCtx.unreadCount).toBe(0)
    await act(async () => {
      capturedCtx.addNotification('N1', 'info', 'owner')
      capturedCtx.addNotification('N2', 'info', 'owner')
    })
    expect(capturedCtx.unreadCount).toBe(2)
  })
})

// ── Role-derived flags ─────────────────────────────────────────────────

describe('role-derived flags', () => {
  async function renderAs(role) {
    localStorage.setItem('pos_system_user', JSON.stringify({ role, token: 'tok' }))
    await renderProvider()
  }

  it('isOwner is true when role is "owner"', async () => {
    await renderAs('owner')
    expect(capturedCtx.isOwner).toBe(true)
    expect(capturedCtx.isManager).toBe(false)
  })

  it('isManager is true when role is "manager"', async () => {
    await renderAs('manager')
    expect(capturedCtx.isManager).toBe(true)
    expect(capturedCtx.isOwner).toBe(false)
  })

  it('isCashier is true for role "cashier"', async () => {
    await renderAs('cashier')
    expect(capturedCtx.isCashier).toBe(true)
    expect(capturedCtx.isOwner).toBe(false)
  })
})

// ── setupOwner — validatePassword ──────────────────────────────────────

describe('setupOwner — validatePassword', () => {
  it('returns error when password has no uppercase letter', async () => {
    await renderProvider()
    const form = new FormData()
    form.append('ownerPassword', 'abc123')
    let result
    await act(async () => { result = await capturedCtx.setupOwner(form) })
    expect(result.success).toBe(false)
    expect(result.message).toMatch(/uppercase/i)
  })

  it('returns error when password has no digit', async () => {
    await renderProvider()
    const form = new FormData()
    form.append('ownerPassword', 'AbcDEF')
    let result
    await act(async () => { result = await capturedCtx.setupOwner(form) })
    expect(result.success).toBe(false)
    expect(result.message).toMatch(/number/i)
  })

  it('proceeds to API call when password is valid (mocked success)', async () => {
    server.use(
      http.post('http://localhost:5000/api/setup/initialize', () =>
        HttpResponse.json({ success: true })
      )
    )
    await renderProvider()
    const form = new FormData()
    form.append('ownerPassword', 'Valid1pass')
    let result
    await act(async () => { result = await capturedCtx.setupOwner(form) })
    expect(result.success).toBe(true)
    expect(capturedCtx.isSetupComplete).toBe(true)
  })
})

// ── login ──────────────────────────────────────────────────────────────

describe('login', () => {
  it('sets currentUser and persists to localStorage on success', async () => {
    server.use(
      http.post('http://localhost:5000/api/auth/login', () =>
        HttpResponse.json({
          success: true, token: 'tok123', role: 'cashier',
          fullname: 'Alice', username: 'alice', id: 'u1', store: 'Main Store',
        })
      )
    )
    await renderProvider()
    let result
    await act(async () => { result = await capturedCtx.login('alice', 'Pass1') })
    expect(result).toEqual({ success: true, role: 'cashier' })
    expect(capturedCtx.currentUser?.token).toBe('tok123')
    expect(JSON.parse(localStorage.getItem('pos_system_user')).token).toBe('tok123')
  })

  it('returns failure message when credentials are wrong', async () => {
    server.use(
      http.post('http://localhost:5000/api/auth/login', () =>
        HttpResponse.json({ success: false, message: 'Invalid credentials' }, { status: 401 })
      )
    )
    await renderProvider()
    let result
    await act(async () => { result = await capturedCtx.login('bob', 'wrong') })
    expect(result.success).toBe(false)
    // login() throws on !res.ok and the catch block returns 'Server error'
    expect(result.message).toBe('Server error')
    expect(capturedCtx.currentUser).toBeNull()
  })
})

// ── authFetch 401 handling ─────────────────────────────────────────────

describe('authFetch 401', () => {
  it('clears currentUser when any authenticated request returns 401', async () => {
    // Mount with a logged-in user so tokenRef is populated
    localStorage.setItem('pos_system_user', JSON.stringify({ token: 'tok', role: 'cashier' }))
    server.use(
      // Make the products endpoint return 401 — triggers authFetch 401 branch
      http.get('http://localhost:5000/api/products', () =>
        new HttpResponse(null, { status: 401 })
      )
    )
    await renderProvider()
    // Trigger an authFetch call — catches 401 and clears the user
    await act(async () => { await capturedCtx.fetchProducts() })
    await waitFor(() => expect(capturedCtx.currentUser).toBeNull())
  })
})

// ── shiftCloseNotifs ───────────────────────────────────────────────────

describe('shiftCloseNotifs', () => {
  it('addShiftCloseNotif appends a notif with the correct shape', async () => {
    await renderProvider()
    await act(async () => { capturedCtx.addShiftCloseNotif('Bob', '18:00', 5000) })
    expect(capturedCtx.shiftCloseNotifs).toHaveLength(1)
    expect(capturedCtx.shiftCloseNotifs[0]).toMatchObject({
      employeeName: 'Bob', time: '18:00', revenue: 5000, read: false,
    })
  })

  it('markShiftCloseNotifRead flips read for the correct id', async () => {
    await renderProvider()
    await act(async () => { capturedCtx.addShiftCloseNotif('Bob', '18:00', 5000) })
    const { id } = capturedCtx.shiftCloseNotifs[0]
    await act(async () => { capturedCtx.markShiftCloseNotifRead(id) })
    expect(capturedCtx.shiftCloseNotifs[0].read).toBe(true)
  })

  it('clearShiftCloseNotifs empties the array', async () => {
    await renderProvider()
    await act(async () => { capturedCtx.addShiftCloseNotif('Bob', '18:00', 5000) })
    await act(async () => { capturedCtx.clearShiftCloseNotifs() })
    expect(capturedCtx.shiftCloseNotifs).toHaveLength(0)
  })
})

// ── Socket: newReturnRequest ───────────────────────────────────────────

describe('socket: newReturnRequest', () => {
  const returnPayload = { requesterName: 'Bob', refundAmount: 500, reason: 'Defective' }

  it('adds a warning notification for the owner role', async () => {
    await renderProvider()
    localStorage.setItem('pos_system_user', JSON.stringify({ role: 'owner', token: 'tok' }))
    await act(async () => { socketHandlers['newReturnRequest']?.(returnPayload) })
    expect(capturedCtx.notifications).toHaveLength(1)
    expect(capturedCtx.notifications[0].type).toBe('warning')
    expect(capturedCtx.notifications[0].message).toMatch(/Bob/)
  })

  it('does NOT add a notification for a non-owner role', async () => {
    await renderProvider()
    localStorage.setItem('pos_system_user', JSON.stringify({ role: 'cashier', token: 'tok' }))
    await act(async () => { socketHandlers['newReturnRequest']?.(returnPayload) })
    expect(capturedCtx.notifications).toHaveLength(0)
  })
})

// ── Socket: lowStockAlert ──────────────────────────────────────────────

describe('socket: lowStockAlert', () => {
  const stockPayload = { productName: 'Milk', stock: 2, unit: 'L', reorderLevel: 5 }

  it('adds a warning notification for owner', async () => {
    await renderProvider()
    localStorage.setItem('pos_system_user', JSON.stringify({ role: 'owner', token: 'tok' }))
    await act(async () => { socketHandlers['lowStockAlert']?.(stockPayload) })
    expect(capturedCtx.notifications).toHaveLength(1)
    expect(capturedCtx.notifications[0].message).toMatch(/Milk/)
  })

  it('adds a warning notification for manager', async () => {
    await renderProvider()
    localStorage.setItem('pos_system_user', JSON.stringify({ role: 'manager', token: 'tok' }))
    await act(async () => { socketHandlers['lowStockAlert']?.(stockPayload) })
    expect(capturedCtx.notifications).toHaveLength(1)
  })

  it('does NOT notify a cashier', async () => {
    await renderProvider()
    localStorage.setItem('pos_system_user', JSON.stringify({ role: 'cashier', token: 'tok' }))
    await act(async () => { socketHandlers['lowStockAlert']?.(stockPayload) })
    expect(capturedCtx.notifications).toHaveLength(0)
  })
})

// ── Socket: new_message ────────────────────────────────────────────────

describe('socket: new_message', () => {
  it('increments unreadMsgCount when the sender is a different user', async () => {
    localStorage.setItem('pos_system_user', JSON.stringify({ role: 'cashier', token: 'tok', _id: 'me' }))
    await renderProvider()
    const before = capturedCtx.unreadMsgCount
    await act(async () => {
      socketHandlers['new_message']?.({ message: { _id: 'msg1', senderId: 'other-user' } })
    })
    expect(capturedCtx.unreadMsgCount).toBe(before + 1)
  })

  it('does NOT increment unreadMsgCount when the message is from the current user', async () => {
    localStorage.setItem('pos_system_user', JSON.stringify({ role: 'cashier', token: 'tok', _id: 'me' }))
    await renderProvider()
    const before = capturedCtx.unreadMsgCount
    await act(async () => {
      socketHandlers['new_message']?.({ message: { _id: 'msg2', senderId: 'me' } })
    })
    expect(capturedCtx.unreadMsgCount).toBe(before)
  })
})

// ── Socket: saleVoided ─────────────────────────────────────────────────

describe('socket: saleVoided', () => {
  const voidPayload = { voidedBy: 'Manager', cashier: 'Alice', receiptId: 'RCP-001', total: 2000, voidReason: 'Error' }

  it('adds a warning notification for owner', async () => {
    await renderProvider()
    localStorage.setItem('pos_system_user', JSON.stringify({ role: 'owner', token: 'tok' }))
    await act(async () => { socketHandlers['saleVoided']?.(voidPayload) })
    expect(capturedCtx.notifications).toHaveLength(1)
    expect(capturedCtx.notifications[0].message).toMatch(/RCP-001/)
    expect(capturedCtx.notifications[0].type).toBe('warning')
  })

  it('does NOT notify a non-owner', async () => {
    await renderProvider()
    localStorage.setItem('pos_system_user', JSON.stringify({ role: 'cashier', token: 'tok' }))
    await act(async () => { socketHandlers['saleVoided']?.(voidPayload) })
    expect(capturedCtx.notifications).toHaveLength(0)
  })
})

// ── Socket: adminShiftNotification ────────────────────────────────────

describe('socket: adminShiftNotification', () => {
  const shiftPayload = { employeeName: 'Carol', time: '17:30', revenue: 12000 }

  it('adds a notification and a shiftCloseNotif for the owner', async () => {
    await renderProvider()
    localStorage.setItem('pos_system_user', JSON.stringify({ role: 'owner', token: 'tok' }))
    await act(async () => { socketHandlers['adminShiftNotification']?.(shiftPayload) })
    expect(capturedCtx.notifications.some(n => n.message.includes('Carol'))).toBe(true)
    expect(capturedCtx.shiftCloseNotifs.some(n => n.employeeName === 'Carol')).toBe(true)
  })

  it('does nothing for a non-owner', async () => {
    await renderProvider()
    localStorage.setItem('pos_system_user', JSON.stringify({ role: 'cashier', token: 'tok' }))
    await act(async () => { socketHandlers['adminShiftNotification']?.(shiftPayload) })
    expect(capturedCtx.notifications).toHaveLength(0)
    expect(capturedCtx.shiftCloseNotifs).toHaveLength(0)
  })
})
