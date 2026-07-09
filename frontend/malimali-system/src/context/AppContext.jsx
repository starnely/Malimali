import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { useSocket, useSocketActions } from './SocketContext';
import { API_BASE_URL } from '@/config/api'

/* @refresh reload */
const AppContext = createContext()

function load(key, fallback) {
  try {
    const saved = localStorage.getItem(key)
    return saved ? JSON.parse(saved) : fallback
  } catch {
    return fallback
  }
}

export function AppProvider({ children }) {

  // ── SETTINGS ──────────────────────────────────────────────────────────
  const [settings, setSettings] = useState(() => load('pos_system_settings', null))

  useEffect(() => {
    if (settings) {
      localStorage.setItem('pos_system_settings', JSON.stringify(settings));
      const displayTitle = settings.companyName || settings.businessName || 'POS';
      document.title = `${displayTitle} - Management`;
    }
  }, [settings]);

  // Apply saved brand colors onto CSS variables whenever settings load/change.
  useEffect(() => {
    const bc = settings?.brandColors;
    if (!bc) return;
    const root = document.documentElement;

    function hexToHSL(hex) {
      let r = parseInt(hex.slice(1, 3), 16) / 255;
      let g = parseInt(hex.slice(3, 5), 16) / 255;
      let b = parseInt(hex.slice(5, 7), 16) / 255;
      let max = Math.max(r, g, b), min = Math.min(r, g, b);
      let h = 0, s = 0, l = (max + min) / 2;
      if (max !== min) {
        let d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        else if (max === g) h = ((b - r) / d + 2) / 6;
        else h = ((r - g) / d + 4) / 6;
      }
      return { h: h * 360, s: s * 100, l: l * 100 };
    }

    function hslToHex(h, s, l) {
      h /= 360; s /= 100; l /= 100;
      function hue2rgb(p, q, t) {
        if (t < 0) t += 1; if (t > 1) t -= 1;
        if (t < 1/6) return p + (q - p) * 6 * t;
        if (t < 1/2) return q;
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
      }
      let r, g, b;
      if (s === 0) { r = g = b = l; } else {
        let q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        let p = 2 * l - q;
        r = hue2rgb(p, q, h + 1/3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1/3);
      }
      const hex2 = x => { let h2 = Math.round(x * 255).toString(16); return h2.length === 1 ? '0' + h2 : h2; };
      return '#' + hex2(r) + hex2(g) + hex2(b);
    }

    function clamp(v, lo, hi) { return Math.min(Math.max(v, lo), hi); }

    // WCAG 2.1 relative luminance — returns '#FFFFFF' or '#111827' for ≥ 4.5:1 contrast
    function getContrastText(hex) {
      let r = parseInt(hex.slice(1, 3), 16) / 255;
      let g = parseInt(hex.slice(3, 5), 16) / 255;
      let b = parseInt(hex.slice(5, 7), 16) / 255;
      r = r <= 0.04045 ? r / 12.92 : Math.pow((r + 0.055) / 1.055, 2.4);
      g = g <= 0.04045 ? g / 12.92 : Math.pow((g + 0.055) / 1.055, 2.4);
      b = b <= 0.04045 ? b / 12.92 : Math.pow((b + 0.055) / 1.055, 2.4);
      const L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      return L > 0.179 ? '#111827' : '#FFFFFF';
    }

    if (bc.primary) {
      const { h, s, l } = hexToHSL(bc.primary);
      root.style.setProperty('--primary',       bc.primary);
      root.style.setProperty('--primary-dark',  hslToHex(h, clamp(s + 5, 0, 100), clamp(l - 15, 8, 90)));
      root.style.setProperty('--primary-light', hslToHex(h, clamp(s - 30, 10, 100), clamp(l + 40, 50, 96)));
      root.style.setProperty('--primary-muted', hslToHex(h, clamp(s - 15, 10, 100), clamp(l + 20, 30, 80)));
      // Sidebar surface: dark, rich shade of primary — stays sophisticated regardless of secondary choice
      root.style.setProperty('--sidebar-bg',    hslToHex(h, clamp(s + 9, 40, 100), clamp(l - 17, 8, 35)));
      // Sidebar text: light primary tint — always readable on the dark sidebar surface
      root.style.setProperty('--sidebar-text',  hslToHex(h, clamp(s - 25, 10, 80), clamp(l + 42, 60, 90)));
      root.style.setProperty('--sidebar-border', 'rgba(255,255,255,0.08)');
    }
    if (bc.secondary) {
      // Secondary drives small accent surfaces only: active nav item + subtle hover glow
      const [rr, gg, bb] = [
        parseInt(bc.secondary.slice(1, 3), 16),
        parseInt(bc.secondary.slice(3, 5), 16),
        parseInt(bc.secondary.slice(5, 7), 16),
      ];
      root.style.setProperty('--sidebar-active-bg',   bc.secondary);
      root.style.setProperty('--sidebar-active-text', getContrastText(bc.secondary));
      root.style.setProperty('--sidebar-hover-bg',    `rgba(${rr},${gg},${bb},0.12)`);
    }
  }, [settings?.brandColors]);

  // ── CORE STATE ─────────────────────────────────────────────────────────
  const [isSetupComplete, setIsSetupComplete] = useState(null)
  const [connectionError, setConnectionError] = useState(false)
  const [currentUser, setCurrentUser] = useState(() => load('pos_system_user', null))
  const [users, setUsers] = useState([])
  const [products, setProducts] = useState([])
  const [sales, setSales] = useState([])
  const [returns, setReturns] = useState([])
  const [dailyArchives, setDailyArchives] = useState([])
  const [notifications, setNotifications] = useState(() => load('pos_system_notifications', []))
  const [shiftCloses, setShiftCloses] = useState(() => load('pos_system_shift_closes', []))
  const [stores, setStores] = useState([])
  const [categories, setCategories] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [messages, setMessages] = useState([])
  const [conversations, setConversations] = useState([])
  const [unreadMsgCount, setUnreadMsgCount] = useState(0)
  const [shiftCloseNotifs, setShiftCloseNotifs] = useState(() => load('pos_shift_close_notifs', []))
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [voidRequests, setVoidRequests] = useState([])

  useEffect(() => {
    localStorage.setItem('pos_shift_close_notifs', JSON.stringify(shiftCloseNotifs));
  }, [shiftCloseNotifs]);

  useEffect(() => {
    localStorage.setItem('pos_system_notifications', JSON.stringify(notifications));
  }, [notifications]);

  const addShiftCloseNotif = useCallback((employeeName, time, revenue) => {
    const notif = {
      id: Date.now() + Math.random(),
      employeeName, time, revenue,
      date: new Date().toLocaleDateString('en-CA'),
      read: false,
      createdAt: Date.now(),
    };
    setShiftCloseNotifs(prev => [notif, ...prev]);
  }, []);

  const clearShiftCloseNotifs = () => setShiftCloseNotifs([]);
  const markShiftCloseNotifRead = (id) =>
    setShiftCloseNotifs(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));

  const tokenRef = useRef(currentUser?.token ?? null)
  tokenRef.current = currentUser?.token ?? null
  const retryTimerRef = useRef(null)

  const { refreshSocket } = useSocketActions();
  const refreshSocketRef = useRef(refreshSocket)
  refreshSocketRef.current = refreshSocket

  const logout = useCallback(() => {
    setCurrentUser(null);
    localStorage.removeItem('pos_system_user');
    refreshSocketRef.current?.();
    window.location.href = '/login';
  }, []);

  // ── CENTRAL AUTH FETCH — auto-logout on 401 ───────────────────────────
  const authFetch = useCallback(async (url, options = {}) => {
    const token = tokenRef.current
    if (!token) return null
    const res = await fetch(url, {
      ...options,
      headers: {
        ...(options.headers || {}),
        Authorization: `Bearer ${token}`,
      },
    })
    if (res.status === 401) {
      console.warn('🔒 Session expired — redirecting to login')
      setCurrentUser(null)
      localStorage.removeItem('pos_system_user')
      localStorage.setItem('pos_session_expired', '1')
      refreshSocketRef.current?.()
      window.location.href = '/login'
      return null
    }
    return res
  }, [])

  const authFetchRef = useRef(authFetch)
  authFetchRef.current = authFetch

  // ── SETUP CHECK ────────────────────────────────────────────────────────
  const runSetupCheck = useCallback(async () => {
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current)
      retryTimerRef.current = null
    }
    try {
      const res = await fetch(`${API_BASE_URL}/api/setup/status`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setConnectionError(false)
      setIsSetupComplete(data.isSetup && data.hasOwner)
      if (data.isSetup) {
        // Public branding endpoint — safe pre-login, returns only logo/companyName/brandColors.
        // Full settings (/details) are fetched after login via refreshSettings().
        const brandingRes = await fetch(`${API_BASE_URL}/api/setup/branding`)
        if (brandingRes.ok) {
          const brandingData = await brandingRes.json()
          if (brandingData.success && brandingData.branding) {
            // Merge branding into existing settings without nuking fields already loaded
            setSettings(prev => ({ ...(prev || {}), ...brandingData.branding }))
          }
        }
      }
    } catch (err) {
      console.error('Setup check failed:', err)
      setConnectionError(true)
      retryTimerRef.current = setTimeout(runSetupCheck, 5000)
    }
  }, [])

  useEffect(() => {
    runSetupCheck()
    return () => { if (retryTimerRef.current) clearTimeout(retryTimerRef.current) }
  }, [runSetupCheck])

  // ── FETCH HELPERS — all use authFetch ─────────────────────────────────
  const fetchProducts = useCallback(async () => {
    try {
      const user = JSON.parse(localStorage.getItem('pos_system_user') || '{}')
      const params = new URLSearchParams()
      if (user.role !== 'owner' && user.store) params.set('store', user.store)
      const res = await authFetchRef.current(`${API_BASE_URL}/api/products?${params}`)
      if (!res || !res.ok) throw new Error(`Status: ${res?.status}`)
      const data = await res.json()
      setProducts(data.success && Array.isArray(data.products) ? data.products : [])
    } catch (err) { console.error('Error fetching products:', err); setProducts([]) }
  }, [])

  const fetchSales = useCallback(async () => {
    try {
      const res = await authFetchRef.current(`${API_BASE_URL}/api/sales`)
      if (!res || !res.ok) throw new Error(`Status: ${res?.status}`)
      const data = await res.json()
      setSales(data.success && Array.isArray(data.sales) ? data.sales : [])
    } catch (err) { console.error('Error fetching sales:', err); setSales([]) }
  }, [])

  const fetchReturns = useCallback(async () => {
    try {
      const res = await authFetchRef.current(`${API_BASE_URL}/api/returns`)
      if (!res || !res.ok) throw new Error(`Status: ${res?.status}`)
      const data = await res.json()
      setReturns(data.success && Array.isArray(data.returns) ? data.returns : [])
    } catch (err) { console.error('Error fetching returns:', err); setReturns([]) }
  }, [])

  const fetchVoidRequests = useCallback(async () => {
    try {
      const role = JSON.parse(localStorage.getItem('pos_system_user') || '{}')?.role
      if (role !== 'owner' && role !== 'manager') return
      const res = await authFetchRef.current(`${API_BASE_URL}/api/void-requests`)
      if (!res || !res.ok) return
      const data = await res.json()
      setVoidRequests(data.success && Array.isArray(data.requests) ? data.requests : [])
    } catch (err) { console.error('fetchVoidRequests error:', err) }
  }, [])

  const fetchUsers = useCallback(async () => {
    try {
      const res = await authFetchRef.current(`${API_BASE_URL}/api/auth/employees`)
      if (!res || !res.ok) throw new Error(`Status: ${res?.status}`)
      const data = await res.json()
      if (Array.isArray(data)) setUsers(data)
      else if (data.success && Array.isArray(data.users)) setUsers(data.users)
      else setUsers([])
    } catch (err) { console.error('Error fetching users:', err.message); setUsers([]) }
  }, [])

  const fetchArchives = useCallback(async () => {
    try {
      const res = await authFetchRef.current(`${API_BASE_URL}/api/archives`)
      if (!res || !res.ok) throw new Error(`Status: ${res?.status}`)
      const data = await res.json()
      const archivesArray = data.success && Array.isArray(data.archives) ? data.archives : [];
      setDailyArchives(archivesArray);
      const role = JSON.parse(localStorage.getItem('pos_system_user') || '{}')?.role;
      if (role === 'owner') {
        const todayStr = new Date().toLocaleDateString('en-CA');
        const todayArchives = archivesArray.filter(a => {
          if (!a?.date) return false;
          return new Date(a.date).toLocaleDateString('en-CA') === todayStr;
        });
        setShiftCloseNotifs(prev => {
          const existingNames = new Set(prev.map(n => n.employeeName));
          const newNotifs = todayArchives
            .filter(a => !existingNames.has(a.employeeName))
            .map(a => ({
              id: a._id || (a.employeeName + a.date),
              employeeName: a.employeeName,
              time: a.closedAt
                ? new Date(a.closedAt).toLocaleTimeString()
                : a.createdAt ? new Date(a.createdAt).toLocaleTimeString() : 'unknown time',
              revenue: a.revenue || 0,
              date: todayStr, read: false, createdAt: Date.now(),
            }));
          return newNotifs.length > 0 ? [...newNotifs, ...prev] : prev;
        });
      }
    } catch (err) { console.error('Error fetching archives:', err); setDailyArchives([]) }
  }, [])

  const fetchStores = useCallback(async () => {
    try {
      const res = await authFetchRef.current(`${API_BASE_URL}/api/stores`)
      if (!res || !res.ok) throw new Error(`Status: ${res?.status}`)
      const data = await res.json()
      setStores(data.success && Array.isArray(data.stores) ? data.stores : [])
    } catch (err) { console.error('Error fetching stores:', err); setStores([]) }
  }, [])

  const fetchCategories = useCallback(async () => {
    try {
      const res = await authFetchRef.current(`${API_BASE_URL}/api/categories`)
      if (!res || !res.ok) throw new Error(`Status: ${res?.status}`)
      const data = await res.json()
      setCategories(data.success && Array.isArray(data.categories) ? data.categories : [])
    } catch (err) { console.error('Error fetching categories:', err); setCategories([]) }
  }, [])

  const fetchSuppliers = useCallback(async () => {
    try {
      const res = await authFetchRef.current(`${API_BASE_URL}/api/suppliers?all=true`)
      if (!res || !res.ok) throw new Error(`Status: ${res?.status}`)
      const data = await res.json()
      setSuppliers(data.success && Array.isArray(data.suppliers) ? data.suppliers : [])
    } catch (err) { console.error('Error fetching suppliers:', err); setSuppliers([]) }
  }, [])

  // ── CUSTOMERS ──────────────────────────────────────────────────────────
  const fetchCustomers = useCallback(async (filters = {}) => {
    try {
      const params = new URLSearchParams();
      if (filters.store) params.set('store', filters.store);
      if (filters.search) params.set('search', filters.search);
      if (filters.overdue) params.set('overdue', 'true');
      if (filters.blacklisted) params.set('blacklisted', 'true');
      const res = await authFetchRef.current(`${API_BASE_URL}/api/customers?${params}`)
      if (!res || !res.ok) throw new Error(`Status: ${res?.status}`)
      const data = await res.json()
      return Array.isArray(data) ? data : [];
    } catch (err) { console.error('Error fetching customers:', err); return []; }
  }, []);

  const fetchCustomer = useCallback(async (customerId) => {
    try {
      const res = await authFetchRef.current(`${API_BASE_URL}/api/customers/${customerId}`)
      if (!res || !res.ok) throw new Error(`Status: ${res?.status}`)
      return await res.json();
    } catch (err) { console.error('Error fetching customer:', err); return null; }
  }, []);

  const recordRepayment = useCallback(async (customerId, amount, notes = '') => {
    try {
      const res = await authFetchRef.current(`${API_BASE_URL}/api/customers/${customerId}/repayments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: Number(amount), notes })
      });
      const data = await res.json();
      if (res.ok) return { success: true, ...data };
      return { success: false, message: data.error || 'Failed to record repayment' };
    } catch (err) { console.error('Repayment error:', err); return { success: false, message: 'Network error' }; }
  }, []);

  const blacklistCustomer = useCallback(async (customerId, blacklisted, reason = '') => {
    try {
      const res = await authFetchRef.current(`${API_BASE_URL}/api/customers/${customerId}/blacklist`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blacklisted, reason })
      });
      const data = await res.json();
      if (res.ok) return { success: true, customer: data.customer };
      return { success: false, message: data.error || 'Failed to update blacklist' };
    } catch (err) { console.error('Blacklist error:', err); return { success: false, message: 'Network error' }; }
  }, []);

  const checkCustomerCredit = useCallback(async (name, phone, store) => {
    try {
      const params = new URLSearchParams({ search: phone || name, store });
      const res = await authFetchRef.current(`${API_BASE_URL}/api/customers?${params}`)
      if (!res || !res.ok) return null;
      const data = await res.json();
      if (!Array.isArray(data) || data.length === 0) return null;
      const match = phone
        ? data.find(c => c.phone === phone)
        : data.find(c => c.name.toLowerCase() === name.toLowerCase());
      return match || null;
    } catch { return null; }
  }, []);

  // ── PURCHASE ORDERS ────────────────────────────────────────────────────
  const fetchPurchaseOrders = useCallback(async (filters = {}) => {
    try {
      const params = new URLSearchParams();
      if (filters.store) params.set('store', filters.store);
      if (filters.status) params.set('status', filters.status);
      if (filters.supplierId) params.set('supplierId', filters.supplierId);
      if (filters.paymentStatus) params.set('paymentStatus', filters.paymentStatus);
      if (filters.source) params.set('source', filters.source);
      if (filters.from) params.set('from', filters.from);
      if (filters.to) params.set('to', filters.to);
      const res = await authFetchRef.current(`${API_BASE_URL}/api/purchase-orders?${params}`)
      if (!res || !res.ok) throw new Error(`Status: ${res?.status}`)
      const data = await res.json()
      return data.purchaseOrders || [];
    } catch (err) { console.error('fetchPurchaseOrders error:', err); return []; }
  }, []);

  const fetchPurchaseOrder = useCallback(async (id) => {
    try {
      const res = await authFetchRef.current(`${API_BASE_URL}/api/purchase-orders/${id}`)
      if (!res || !res.ok) throw new Error(`Status: ${res?.status}`)
      const data = await res.json()
      return data.purchaseOrder || null;
    } catch (err) { console.error('fetchPurchaseOrder error:', err); return null; }
  }, []);

  const createPurchaseOrder = useCallback(async (payload) => {
    try {
      const res = await authFetchRef.current(`${API_BASE_URL}/api/purchase-orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      return res.ok ? { success: true, purchaseOrder: data.purchaseOrder } : { success: false, message: data.message };
    } catch { return { success: false, message: 'Network error' }; }
  }, []);

  const updatePurchaseOrder = useCallback(async (id, payload) => {
    try {
      const res = await authFetchRef.current(`${API_BASE_URL}/api/purchase-orders/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      return res.ok ? { success: true, purchaseOrder: data.purchaseOrder } : { success: false, message: data.message };
    } catch { return { success: false, message: 'Network error' }; }
  }, []);

  const sendPurchaseOrder = useCallback(async (id) => {
    try {
      const res = await authFetchRef.current(`${API_BASE_URL}/api/purchase-orders/${id}/send`, { method: 'PATCH' });
      const data = await res.json();
      return res.ok ? { success: true, purchaseOrder: data.purchaseOrder } : { success: false, message: data.message };
    } catch { return { success: false, message: 'Network error' }; }
  }, []);

  const receivePurchaseOrder = useCallback(async (id, items) => {
    try {
      const res = await authFetchRef.current(`${API_BASE_URL}/api/purchase-orders/${id}/receive`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items })
      });
      const data = await res.json();
      if (res.ok) { await fetchProducts(); return { success: true, purchaseOrder: data.purchaseOrder, stockUpdates: data.stockUpdates, wasExpiredItems: data.wasExpiredItems || [] }; }
      return { success: false, message: data.message };
    } catch { return { success: false, message: 'Network error' }; }
  }, [fetchProducts]);

  const cancelPurchaseOrder = useCallback(async (id, reason = '') => {
    try {
      const res = await authFetchRef.current(`${API_BASE_URL}/api/purchase-orders/${id}/cancel`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason })
      });
      const data = await res.json();
      return res.ok ? { success: true } : { success: false, message: data.message };
    } catch { return { success: false, message: 'Network error' }; }
  }, []);

  const deletePurchaseOrder = useCallback(async (id) => {
    try {
      const res = await authFetchRef.current(`${API_BASE_URL}/api/purchase-orders/${id}`, { method: 'DELETE' });
      const data = await res.json();
      return res.ok ? { success: true } : { success: false, message: data.message };
    } catch { return { success: false, message: 'Network error' }; }
  }, []);

  // ── EXPENSES ───────────────────────────────────────────────────────────
  const fetchExpenses = useCallback(async (filters = {}) => {
    try {
      const params = new URLSearchParams();
      if (filters.store) params.set('store', filters.store);
      if (filters.date) params.set('date', filters.date);
      if (filters.category) params.set('category', filters.category);
      if (filters.from) params.set('from', filters.from);
      if (filters.to) params.set('to', filters.to);
      const res = await authFetchRef.current(`${API_BASE_URL}/api/expenses?${params}`)
      if (!res || !res.ok) throw new Error(`Status: ${res?.status}`)
      const data = await res.json()
      return data.expenses || [];
    } catch (err) { console.error('fetchExpenses error:', err); return []; }
  }, []);

  const fetchExpenseSummary = useCallback(async (filters = {}) => {
    try {
      const params = new URLSearchParams();
      if (filters.store) params.set('store', filters.store);
      if (filters.date) params.set('date', filters.date);
      if (filters.from) params.set('from', filters.from);
      if (filters.to) params.set('to', filters.to);
      const res = await authFetchRef.current(`${API_BASE_URL}/api/expenses/summary?${params}`)
      if (!res || !res.ok) throw new Error(`Status: ${res?.status}`)
      return await res.json();
    } catch (err) { console.error('fetchExpenseSummary error:', err); return { summary: [], grandTotal: 0 }; }
  }, []);

  const logExpense = useCallback(async (payload) => {
    try {
      const res = await authFetchRef.current(`${API_BASE_URL}/api/expenses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      return res.ok ? { success: true, expense: data.expense } : { success: false, message: data.message };
    } catch { return { success: false, message: 'Network error' }; }
  }, []);

  const deleteExpense = useCallback(async (id, reason = '') => {
    try {
      const res = await authFetchRef.current(`${API_BASE_URL}/api/expenses/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason })
      });
      const data = await res.json();
      return res.ok ? { success: true } : { success: false, message: data.message };
    } catch { return { success: false, message: 'Network error' }; }
  }, []);

  // ── PETTY CASH ─────────────────────────────────────────────────────────
  const fetchPettyCashToday = useCallback(async (store) => {
    try {
      const params = new URLSearchParams();
      if (store) params.set('store', store);
      const res = await authFetchRef.current(`${API_BASE_URL}/api/petty-cash/today?${params}`)
      if (!res || !res.ok) throw new Error(`Status: ${res?.status}`)
      return await res.json();
    } catch (err) { console.error('fetchPettyCashToday error:', err); return { record: null }; }
  }, []);

  const fetchPettyCashHistory = useCallback(async (filters = {}) => {
    try {
      const params = new URLSearchParams();
      if (filters.store) params.set('store', filters.store);
      if (filters.from) params.set('from', filters.from);
      if (filters.to) params.set('to', filters.to);
      const res = await authFetchRef.current(`${API_BASE_URL}/api/petty-cash/history?${params}`)
      if (!res || !res.ok) throw new Error(`Status: ${res?.status}`)
      const data = await res.json()
      return data.records || [];
    } catch (err) { console.error('fetchPettyCashHistory error:', err); return []; }
  }, []);

  const openPettyCash = useCallback(async (store, openingFloat = 0, notes = '') => {
    try {
      const res = await authFetchRef.current(`${API_BASE_URL}/api/petty-cash/open`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ store, openingFloat: Number(openingFloat), notes })
      });
      const data = await res.json();
      return res.ok ? { success: true, record: data.record } : { success: false, message: data.message };
    } catch { return { success: false, message: 'Network error' }; }
  }, []);

  const addPettyCashTransaction = useCallback(async (store, type, amount, description = '', expenseCategory = 'other') => {
    try {
      const res = await authFetchRef.current(`${API_BASE_URL}/api/petty-cash/transaction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ store, type, amount: Number(amount), description, expenseCategory })
      });
      const data = await res.json();
      return res.ok ? { success: true, record: data.record } : { success: false, message: data.message };
    } catch { return { success: false, message: 'Network error' }; }
  }, []);

  const closePettyCash = useCallback(async (store, closingFloat, notes = '') => {
    try {
      const res = await authFetchRef.current(`${API_BASE_URL}/api/petty-cash/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ store, closingFloat: Number(closingFloat), notes })
      });
      const data = await res.json();
      return res.ok ? { success: true, record: data.record } : { success: false, message: data.message };
    } catch { return { success: false, message: 'Network error' }; }
  }, []);

  // ── MESSAGES ───────────────────────────────────────────────────────────
  const fetchConversations = useCallback(async () => {
    try {
      const res = await authFetchRef.current(`${API_BASE_URL}/api/messages/conversations`)
      if (!res || !res.ok) throw new Error(`Status: ${res?.status}`)
      const data = await res.json()
      setConversations(data.success ? data.conversations : []);
    } catch (err) { console.error('Error fetching conversations:', err); setConversations([]); }
  }, []);

  const fetchThread = useCallback(async (userId) => {
    try {
      const res = await authFetchRef.current(`${API_BASE_URL}/api/messages/thread/${userId}`)
      if (!res || !res.ok) throw new Error(`Status: ${res?.status}`)
      const data = await res.json()
      if (data.success) { setMessages(data.messages); fetchConversations(); }
      return data.messages || [];
    } catch (err) { console.error('Error fetching thread:', err); return []; }
  }, [fetchConversations]);

  const sendMessage = useCallback(async (receiverId, content) => {
    try {
      const res = await authFetchRef.current(`${API_BASE_URL}/api/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receiverId, content })
      });
      const data = await res.json();
      if (data.success) { setMessages(prev => [...prev, data.message]); fetchConversations(); }
      return data;
    } catch (err) { console.error('Send message error:', err); return { success: false }; }
  }, [fetchConversations]);

  const sendBroadcast = useCallback(async (content) => {
    try {
      const res = await authFetchRef.current(`${API_BASE_URL}/api/messages/broadcast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content })
      });
      const data = await res.json();
      if (data.success) { setMessages(prev => [...prev, data.message]); fetchConversations(); }
      return data;
    } catch (err) { console.error('Broadcast error:', err); return { success: false }; }
  }, [fetchConversations]);

  const fetchUnreadMsgCount = useCallback(async () => {
    try {
      const res = await authFetchRef.current(`${API_BASE_URL}/api/messages/unread-count`)
      if (!res || !res.ok) return;
      const data = await res.json()
      if (data.success) setUnreadMsgCount(data.unreadCount);
    } catch (err) { console.error('Unread count error:', err); }
  }, []);

  // ── FETCH ON USER CHANGE ───────────────────────────────────────────────
  const currentUserRef = useRef(currentUser)
  currentUserRef.current = currentUser

  useEffect(() => {
    if (!currentUser?.token) return
    setUnreadMsgCount(0);
    const role = currentUser.role
    const fetches = [
      () => fetchProducts(),
      () => fetchSales(),
      () => fetchReturns(),
      () => fetchArchives(),
      () => fetchStores(),
      () => fetchCategories(),
      () => fetchSuppliers(),
      () => fetchConversations(),
      () => fetchUnreadMsgCount(),
      () => (role === 'owner' || role === 'manager') && fetchUsers(),
      () => (role === 'owner' || role === 'manager') && fetchVoidRequests(),
    ];
    const timers = fetches.map((fn, i) => setTimeout(fn, i * 200));
    return () => timers.forEach(clearTimeout);
  }, [
    currentUser?.token, currentUser?.role,
    fetchUsers, fetchProducts, fetchSales, fetchReturns,
    fetchArchives, fetchStores, fetchCategories,
    fetchSuppliers, fetchConversations, fetchUnreadMsgCount, fetchVoidRequests,
  ]);

  // ── LOGIN ──────────────────────────────────────────────────────────────
  const login = async (username, password) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      })
      if (!res.ok) throw new Error(`Status: ${res.status}`);
      const data = await res.json()
      if (data.success) {
        const userData = {
          token: data.token,
          role: data.role,
          fullname: data.fullname || data.name,
          name: data.fullname || data.name,
          username: data.username,
          _id: data.id || data._id,
          id: data.id,
          store: data.store
        }
        setCurrentUser(userData)
        localStorage.setItem('pos_system_user', JSON.stringify(userData))
        tokenRef.current = data.token
        refreshSocketRef.current?.();
        // Fetch full settings now that we have a valid token — populates logo, tax, SMTP, etc.
        try {
          const settingsRes = await fetch(`${API_BASE_URL}/api/setup/details`, {
            headers: { Authorization: `Bearer ${data.token}` }
          })
          if (settingsRes.ok) {
            const settingsData = await settingsRes.json()
            if (settingsData.success && settingsData.settings) {
              setSettings(settingsData.settings)
              localStorage.setItem('pos_system_settings', JSON.stringify(settingsData.settings))
            }
          }
        } catch { /* non-fatal — branding already loaded from /branding */ }
        return { success: true, role: data.role }
      }
      return { success: false, message: data.message || 'Login failed' }
    } catch (err) { console.error('Login error:', err); return { success: false, message: 'Server error' } }
  }

  // ── SETUP OWNER ────────────────────────────────────────────────────────
  const validatePassword = (password) => {
    if (!password) return false;
    return /[A-Z]/.test(password) && /[0-9]/.test(password);
  };

  const setupOwner = async (formData) => {
    const password = formData.get('ownerPassword');
    if (!validatePassword(password)) {
      return { success: false, message: 'Password must contain at least one uppercase letter and one number.' };
    }
    try {
      const res = await fetch(`${API_BASE_URL}/api/setup/initialize`, { method: 'POST', body: formData });
      const data = await res.json();
      if (res.ok && data.success) { setIsSetupComplete(true); return { success: true }; }
      if (data.error && data.error.includes('E11000')) return { success: false, message: 'This email is already registered.' };
      return { success: false, message: data.error || data.message || 'Setup failed' };
    } catch (err) { console.error('Setup failed:', err); return { success: false, message: 'Could not connect to server.' }; }
  };

  // ── RECORD SALE ────────────────────────────────────────────────────────
  const recordMultipleSales = async (cartItems, paymentInfo = {}) => {
    try {
      const res = await authFetchRef.current(`${API_BASE_URL}/api/sales`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          store: currentUserRef.current?.store || 'Main Store',
          cashier: currentUserRef.current?.fullname || currentUserRef.current?.username || 'Unknown',
          items: cartItems.map(item => ({
            productId: item.productId || item._id || item.id,
            qty: item.qty,
            price: item.sellPrice,
            unit: item.unit || 'pcs',
          })),
          total: cartItems.reduce((sum, i) => sum + i.total, 0),
          paymentInfo: {
            paymentMethod: paymentInfo.paymentMethod,
            mpesaPhone: paymentInfo.mpesaPhone || '',
            customerName: paymentInfo.customerName || '',
            customerPhone: paymentInfo.customerPhone || '',
            promiseDate: paymentInfo.promiseDate || '',
            cashPart: Number(paymentInfo.cashPart) || 0,
            mpesaPart: Number(paymentInfo.mpesaPart) || 0,
            discount: Number(paymentInfo.discount) || 0,
            finalTotal: Number(paymentInfo.finalTotal) || cartItems.reduce((s, i) => s + i.total, 0),
            cashGiven: Number(paymentInfo.cashGiven) || 0,
            change: Number(paymentInfo.change) || 0,
            cardApprovalCode: paymentInfo.cardApprovalCode || '',
            bankReference: paymentInfo.bankReference || '',
          }
        })
      });
      const data = await res.json();
      if (data.success) {
        fetchSales(); fetchProducts();
        if (paymentInfo.paymentMethod === 'credit' && data.sale?._id) {
          try {
            await authFetchRef.current(`${API_BASE_URL}/api/customers/from-sale`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                customerName: paymentInfo.customerName || '',
                phone: paymentInfo.customerPhone || '',
                store: currentUserRef.current?.store || 'Main Store',
                saleId: data.sale._id,
              })
            })
          } catch (err) {
            console.error('Customer link error:', err)
          }
        }
        return { success: true, ...data };
      }
      return { success: false, error: data.error || 'Failed to record sale' };
    } catch (err) { console.error('Sale Recording Error:', err); return { success: false, error: 'Failed to record sale' }; }
  };

  // ── INITIATE M-PESA STK PUSH ───────────────────────────────────────────
  // Creates a pending sale on the backend (stock reserved) and fires the
  // real Safaricom STK push.  Returns { success, checkoutRequestId, saleId }.
  // The caller listens on socket event "mpesa_result" for the final outcome.
  const initiateMpesaPayment = async ({ phone, amount, cartItems, discount, finalTotal, customerName }) => {
    try {
      const res = await authFetchRef.current(`${API_BASE_URL}/api/mpesa/stk-push`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone,
          amount,
          finalTotal:   Number(finalTotal)  || amount,
          discount:     Number(discount)    || 0,
          customerName: customerName        || 'Walk-in Customer',
          cartItems: cartItems.map(item => ({
            productId: item.productId || item._id || item.id,
            qty:       item.qty,
            price:     item.sellPrice,
            unit:      item.unit || 'pcs',
          })),
        }),
      });
      const data = await res.json();
      return data; // { success, checkoutRequestId, saleId } on success
    } catch (err) {
      console.error('M-Pesa STK push error:', err);
      return { success: false, message: 'Failed to reach the payment server.' };
    }
  };

  const checkMpesaStatus = async (checkoutRequestId) => {
    try {
      const res = await authFetchRef.current(
        `${API_BASE_URL}/api/mpesa/status/${checkoutRequestId}`
      )
      return await res.json()
    } catch (err) {
      console.error('M-Pesa status check error:', err)
      return { success: false }
    }
  }

  // Sends a real STK push for just the M-Pesa portion of a split payment.
  // No sale document is created — the callback fires "mpesa_verify_result"
  // on the cashier's socket room.  Returns { success, checkoutRequestId }.
  const initiateSplitMpesaVerify = async ({ phone, amount }) => {
    try {
      const res = await authFetchRef.current(`${API_BASE_URL}/api/mpesa/stk-verify`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ phone, amount: Number(amount) }),
      })
      const data = await res.json()
      return data
    } catch (err) {
      console.error('M-Pesa split verify error:', err)
      return { success: false, message: 'Failed to reach the payment server.' }
    }
  }

  // Queries Safaricom directly for the authoritative status before a retry.
  const queryMpesaStatus = async (checkoutRequestId) => {
    try {
      const res = await authFetchRef.current(
        `${API_BASE_URL}/api/mpesa/query/${checkoutRequestId}`
      )
      return await res.json()
    } catch (err) {
      console.error('M-Pesa query error:', err)
      return { success: false }
    }
  }

  // ── RETURNS ────────────────────────────────────────────────────────────
  const processReturn = async (saleId, returnItems, reason, customerName) => {
    try {
      const res = await authFetchRef.current(`${API_BASE_URL}/api/returns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ saleId, items: returnItems, reason, customerName })
      })
      const data = await res.json()
      fetchReturns()
      return { success: true, returnId: data._id }
    } catch (err) { console.error('Operation failed:', err); return { success: false } }
  }

  const approveReturn = async (returnId) => {
    try {
      const res = await authFetchRef.current(`${API_BASE_URL}/api/returns/${returnId}/approve`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      if (!res || !res.ok) {
        const data = await res?.json().catch(() => ({}))
        return { success: false, message: data?.message || 'Failed to approve return.' }
      }
      fetchReturns(); fetchProducts(); fetchSales()
      return { success: true }
    } catch (err) { console.error('approveReturn error:', err); return { success: false, message: 'Network error.' } }
  }

  const rejectReturn = async (returnId) => {
    try {
      await authFetchRef.current(`${API_BASE_URL}/api/returns/${returnId}/reject`, { method: 'PATCH' })
      fetchReturns(); fetchSales()
      return true
    } catch (err) { console.error('Operation failed:', err); return false }
  }

  // ── USER MANAGEMENT ────────────────────────────────────────────────────
  const addUser = async (form) => {
    try {
      const res = await authFetchRef.current(`${API_BASE_URL}/api/auth/register`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form)
      });
      const data = await res.json();
      if (data.success) fetchUsers();
      return data;
    } catch (err) { console.error('Operation failed:', err); return { success: false }; }
  };

  const updateUser = async (id, form) => {
    try {
      const res = await authFetchRef.current(`${API_BASE_URL}/api/auth/${id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form)
      })
      const data = await res.json()
      if (data.success) fetchUsers()
      return data
    } catch (err) { console.error('Operation failed:', err); return { success: false }; }
  }

  const deleteUser = async (id) => {
    try {
      const res = await authFetchRef.current(`${API_BASE_URL}/api/auth/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.success) setUsers(prev => prev.filter(u => u._id !== id))
      return data
    } catch (err) { console.error('Operation failed:', err); return { success: false }; }
  }

  const toggleUserStatus = async (id) => {
    try {
      const res = await authFetchRef.current(`${API_BASE_URL}/api/auth/${id}/toggle`, { method: 'PATCH' })
      if (!res || !res.ok) throw new Error(`Server rejected request with status: ${res?.status}`);
      const data = await res.json()
      if (data.success) fetchUsers()
      return data
    } catch (err) { console.error('Staff toggle failed:', err.message); return { success: false, message: err.message }; }
  }

  // ── SETTINGS UPDATE ────────────────────────────────────────────────────
  const updateSettings = async (newSettings) => {
    try {
      const formData = new FormData()
      Object.keys(newSettings).forEach(key => { if (key !== 'logoFile') formData.append(key, newSettings[key]) })
      if (newSettings.logoFile) formData.append('logo', newSettings.logoFile)
      const res = await authFetchRef.current(`${API_BASE_URL}/api/setup/update`, { method: 'PUT', body: formData })
      const data = await res.json()
      if (data.success) { setSettings(data.settings); localStorage.setItem('pos_system_settings', JSON.stringify(data.settings)); return { success: true } }
      return { success: false }
    } catch (err) { console.error('Settings update failed:', err); return { success: false } }
  }

  // ── NOTIFICATIONS ──────────────────────────────────────────────────────
  const addNotification = useCallback((message, type = 'info', target = 'owner') => {
    const notif = {
      id: Date.now() + Math.random(),
      message, type, target,
      read: false,
      date: new Date().toLocaleDateString('en-CA'),
      time: new Date().toLocaleTimeString(),
      createdAt: Date.now(),
    }
    setNotifications(prev => [notif, ...prev])
  }, [])

  const markNotificationRead = (id) => setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
  const markAllNotificationsRead = (target) => setNotifications(prev => prev.map(n => (n.target === target || n.target === 'all') ? { ...n, read: true } : n))
  const clearNotifications = (target) => setNotifications(prev => prev.filter(n => n.target !== target && n.target !== 'all'))

  // ── SOCKET LISTENERS ───────────────────────────────────────────────────
  const socket = useSocket();

  useEffect(() => {
    if (!socket) return;

    const onAdminShiftNotification = (data) => {
      const role = JSON.parse(localStorage.getItem('pos_system_user') || '{}')?.role;
      console.log('adminShiftNotification received, role:', role, 'data:', data)
      if (role !== 'owner') return;
      const name = data.employeeName || 'An employee';
      const time = data.time || new Date().toLocaleTimeString();
      const revenue = data.revenue ?? 0;
      addNotification(`🔒 ${name} closed shift at ${time}`, 'info', 'owner');
      addShiftCloseNotif(name, time, revenue);
      fetchArchives(); fetchSales();
    };

    const onSyncSystemData = () => {
      fetchSales(); fetchReturns(); fetchProducts();
    };

    const onNewReturnRequest = (data) => {
      const role = JSON.parse(localStorage.getItem('pos_system_user') || '{}')?.role
      if (role !== 'owner' && role !== 'manager') return
      const target = role === 'owner' ? 'owner' : (currentUserRef.current?.fullname || 'manager')
      addNotification(
        `🔄 ${data.requesterName} submitted a return request — KSh ${(data.refundAmount || 0).toLocaleString()}. Reason: ${data.reason || '—'}`,
        'warning', target
      )
      fetchReturns()
    };

    const onReturnNeedsOwnerApproval = (data) => {
      const role = JSON.parse(localStorage.getItem('pos_system_user') || '{}')?.role
      if (role !== 'owner') return
      addNotification(
        `🔄 ${data.requesterName || 'A return'} advanced to owner approval — KSh ${(data.refundAmount || 0).toLocaleString()}`,
        'warning', 'owner'
      )
      fetchReturns()
    };

    const onPinUsed = (data) => {
      const actionLabel = {
        void_cashier:              'void authorization',
        void_manager_onsite:       'void authorization',
        void_owner_pin:            'void request PIN approval',
        void_items_cashier:        'item void authorization',
        void_items_manager_onsite: 'item void authorization',
        return_stage1:             'return stage-1 approval',
        return_stage2:             'return final approval',
      }[data.actionType] || 'approval'
      // A1: use role-appropriate target so managers with/without fullname both receive the notification
      const user = currentUserRef.current
      const role = user?.role || JSON.parse(localStorage.getItem('pos_system_user') || '{}')?.role
      const target = role === 'owner' ? 'owner' : (user?.fullname || user?.username || 'all')
      addNotification(
        `Your PIN was used for ${actionLabel} by ${data.usedBy || 'someone'} — ${data.store || ''}`,
        'info', target
      )
    };

    const onNewVoidRequest = (data) => {
      const role = JSON.parse(localStorage.getItem('pos_system_user') || '{}')?.role
      if (role !== 'owner') return
      addNotification(
        `${data.requestedBy} requested remote void for Sale #${data.receiptId || ''} — KSh ${(data.total || 0).toLocaleString()}. Reason: ${data.reason || '—'}`,
        'warning', 'owner'
      )
      fetchVoidRequests()
    };

    const onVoidApproved = (data) => {
      const user = currentUserRef.current
      const target = user?.fullname || user?.username || 'all'
      addNotification(data.message || 'Your void request was approved.', 'success', target)
      fetchSales(); fetchProducts()
    };

    const onVoidRejected = (data) => {
      const user = currentUserRef.current
      const target = user?.fullname || user?.username || 'all'
      addNotification(data.message || 'Your void request was rejected.', 'error', target)
    };

    const onReturnUpdated = (data) => {
      const user = currentUserRef.current
      if (!user) return
      addNotification(
        data.message || 'Your return request was updated',
        data.status === 'approved' ? 'success' : 'error',
        user.fullname || user.username
      )
      fetchReturns()
      fetchSales()
    };

    const onSaleVoided = (data) => {
      const role = JSON.parse(localStorage.getItem('pos_system_user') || '{}')?.role;
      if (role !== 'owner') return;
      const name = data.voidedBy || 'A manager';
      const cashier = data.cashier || 'unknown cashier';
      const receipt = data.receiptId || '';
      const total = data.total || 0;
      addNotification(
        `🚫 ${name} voided sale ${receipt} (${cashier}) — KSh ${total.toLocaleString()}. Reason: ${data.voidReason || '—'}`,
        'warning', 'owner'
      );
      fetchSales(); fetchProducts();
    };

    const onAutoExpiredCheck = (data) => {
      const role = JSON.parse(localStorage.getItem('pos_system_user') || '{}')?.role;
      if (role !== 'owner') return;
      fetchProducts();
      addNotification(`⚠️ Auto-check moved ${data.moved} expired product(s) to expired stock.`, 'info', 'owner');
    };

    const onExpiredStockMoved = (data) => {
      const role = JSON.parse(localStorage.getItem('pos_system_user') || '{}')?.role;
      if (role !== 'owner' && role !== 'manager') return;
      addNotification(
        `⚠️ ${data.productName} expired — ${data.quantity} moved to expired stock (loss: KSh ${(data.totalLoss || 0).toLocaleString()})`,
        'warning', 'owner'
      );
    };

    const onAutoPOSuggested = (data) => {
      const role = JSON.parse(localStorage.getItem('pos_system_user') || '{}')?.role;
      if (role !== 'owner' && role !== 'manager') return;
      addNotification(
        `📝 A purchase order was auto-drafted for ${data.store} — review it in Purchase Orders.`,
        'info', 'owner'
      );
    };

    const onOverdueCustomers = (data) => {
      const role = JSON.parse(localStorage.getItem('pos_system_user') || '{}')?.role;
      if (role !== 'owner') return;
      const count = data.count || 0;
      addNotification(
        `⏰ ${count} customer${count !== 1 ? 's have' : ' has'} passed their payment deadline. Visit Debtors to follow up.`,
        'warning', 'owner'
      );
    };

    const onLowStockAlert = (data) => {
      const role = JSON.parse(localStorage.getItem('pos_system_user') || '{}')?.role;
      if (role !== 'owner' && role !== 'manager') return;
      addNotification(
        `⚠️ Low stock: ${data.productName} — only ${data.stock} ${data.unit || 'pcs'} left (reorder at ${data.reorderLevel})`,
        'warning', 'owner'
      );
    };

    const onCategoryChanged = () => {
      fetchCategories();
    };

    const onProductChanged = () => {
      fetchProducts();
    };

    const onStoreChanged = (data) => {
      fetchStores();
      // A rename invalidates any cached manager-{oldName} room membership —
      // force a full socket reconnect so the client rejoins under the new name.
      if (data?.renamed) refreshSocketRef.current?.();
    };

    const onSupplierChanged = () => {
      fetchSuppliers();
    };

    const onStaffChanged = () => {
      fetchUsers();
    };

    const onAccountDeactivated = () => {
      logout();
    };

    const onRepaymentRecorded = (data) => {
      const role = JSON.parse(localStorage.getItem('pos_system_user') || '{}')?.role;
      if (role !== 'owner' && role !== 'manager') return;
      addNotification(
        `💰 ${data.customerName} repaid KSh ${(data.amount || 0).toLocaleString()} — balance now KSh ${(data.newBalance || 0).toLocaleString()}`,
        'success', 'owner'
      );
    };

    const onPOChanged = (data) => {
      const role = JSON.parse(localStorage.getItem('pos_system_user') || '{}')?.role;
      if (role !== 'owner' && role !== 'manager') return;
      const verb = data.status === 'sent' ? 'sent to supplier' : data.status === 'cancelled' ? 'cancelled' : 'created';
      addNotification(`📋 PO ${data.poNumber} for ${data.supplierName} was ${verb} (${data.store})`, 'info', 'owner');
    };

    const onStockReceived = (data) => {
      const role = JSON.parse(localStorage.getItem('pos_system_user') || '{}')?.role;
      if (role !== 'owner' && role !== 'manager') return;
      fetchProducts();
      addNotification(
        `📦 Stock received from ${data.supplierName} on PO ${data.poNumber} — by ${data.receivedBy}`,
        'info', 'owner'
      );
    };

    const onPettyCashAutoClosed = (data) => {
      const role = JSON.parse(localStorage.getItem('pos_system_user') || '{}')?.role;
      if (role !== 'owner') return;
      addNotification(
        `🔒 Petty cash for ${data.store} was auto-closed at midnight (KSh ${(data.closingFloat || 0).toLocaleString()}). No physical count was done — verify tomorrow morning.`,
        'warning', 'owner'
      );
    };

    const onExpenseLogged = (data) => {
      const role = JSON.parse(localStorage.getItem('pos_system_user') || '{}')?.role;
      if (role !== 'owner') return;
      addNotification(
        `💸 Expense logged: KSh ${data.amount?.toLocaleString()} (${data.category}) by ${data.recordedBy}`,
        'info', 'owner'
      );
    };

    const onNewMessage = (data) => {
      const msg = data?.message;
      const user = currentUserRef.current;
      if (!msg) return;
      const senderId = String(msg.senderId);
      const currentId = String(user?._id || user?.id || '');
      if (senderId === currentId) { fetchConversations(); return; }

      setUnreadMsgCount(prev => prev + 1);
      fetchConversations();
      setMessages(prev => {
        const exists = prev.some(m => String(m._id) === String(msg._id));
        if (exists) return prev;
        return [...prev, msg];
      });
    };

    socket.on('adminShiftNotification', onAdminShiftNotification);
    socket.on('sync_system_data', onSyncSystemData);
    socket.on('newReturnRequest', onNewReturnRequest);
    socket.on('returnNeedsOwnerApproval', onReturnNeedsOwnerApproval);
    socket.on('returnUpdated', onReturnUpdated);
    socket.on('saleVoided', onSaleVoided);
    socket.on('pinUsed', onPinUsed);
    socket.on('newVoidRequest', onNewVoidRequest);
    socket.on('voidApproved', onVoidApproved);
    socket.on('voidRejected', onVoidRejected);
    socket.on('autoExpiredCheck', onAutoExpiredCheck);
    socket.on('expiredStockMoved', onExpiredStockMoved);
    socket.on('autoPOSuggested', onAutoPOSuggested);
    socket.on('overdueCustomers', onOverdueCustomers);
    socket.on('lowStockAlert', onLowStockAlert);
    socket.on('stockReceived', onStockReceived);
    socket.on('pettyCashAutoClosed', onPettyCashAutoClosed);
    socket.on('expenseLogged', onExpenseLogged);
    socket.on('new_message', onNewMessage);
    socket.on('categoryCreated', onCategoryChanged);
    socket.on('categoryUpdated', onCategoryChanged);
    socket.on('categoryDeleted', onCategoryChanged);
    socket.on('productCreated', onProductChanged);
    socket.on('productUpdated', onProductChanged);
    socket.on('productDeleted', onProductChanged);
    socket.on('storeCreated', onStoreChanged);
    socket.on('storeUpdated', onStoreChanged);
    socket.on('storeDeleted', onStoreChanged);
    socket.on('supplierCreated', onSupplierChanged);
    socket.on('supplierUpdated', onSupplierChanged);
    socket.on('supplierDeleted', onSupplierChanged);
    socket.on('supplierArchived', onSupplierChanged);
    socket.on('poCreated', onPOChanged);
    socket.on('poSent', onPOChanged);
    socket.on('poCancelled', onPOChanged);
    socket.on('repaymentRecorded', onRepaymentRecorded);
    socket.on('staffCreated', onStaffChanged);
    socket.on('staffUpdated', onStaffChanged);
    socket.on('staffToggled', onStaffChanged);
    socket.on('staffDeleted', onStaffChanged);
    socket.on('accountDeactivated', onAccountDeactivated);

    return () => {
      socket.off('adminShiftNotification', onAdminShiftNotification);
      socket.off('sync_system_data', onSyncSystemData);
      socket.off('newReturnRequest', onNewReturnRequest);
      socket.off('returnNeedsOwnerApproval', onReturnNeedsOwnerApproval);
      socket.off('returnUpdated', onReturnUpdated);
      socket.off('saleVoided', onSaleVoided);
      socket.off('pinUsed', onPinUsed);
      socket.off('newVoidRequest', onNewVoidRequest);
      socket.off('voidApproved', onVoidApproved);
      socket.off('voidRejected', onVoidRejected);
      socket.off('autoExpiredCheck', onAutoExpiredCheck);
      socket.off('expiredStockMoved', onExpiredStockMoved);
      socket.off('autoPOSuggested', onAutoPOSuggested);
      socket.off('overdueCustomers', onOverdueCustomers);
      socket.off('lowStockAlert', onLowStockAlert);
      socket.off('stockReceived', onStockReceived);
      socket.off('pettyCashAutoClosed', onPettyCashAutoClosed);
      socket.off('expenseLogged', onExpenseLogged);
      socket.off('new_message', onNewMessage);
      socket.off('categoryCreated', onCategoryChanged);
      socket.off('categoryUpdated', onCategoryChanged);
      socket.off('categoryDeleted', onCategoryChanged);
      socket.off('productCreated', onProductChanged);
      socket.off('productUpdated', onProductChanged);
      socket.off('productDeleted', onProductChanged);
      socket.off('storeCreated', onStoreChanged);
      socket.off('storeUpdated', onStoreChanged);
      socket.off('storeDeleted', onStoreChanged);
      socket.off('supplierCreated', onSupplierChanged);
      socket.off('supplierUpdated', onSupplierChanged);
      socket.off('supplierDeleted', onSupplierChanged);
      socket.off('supplierArchived', onSupplierChanged);
      socket.off('poCreated', onPOChanged);
      socket.off('poSent', onPOChanged);
      socket.off('poCancelled', onPOChanged);
      socket.off('repaymentRecorded', onRepaymentRecorded);
      socket.off('staffCreated', onStaffChanged);
      socket.off('staffUpdated', onStaffChanged);
      socket.off('staffToggled', onStaffChanged);
      socket.off('staffDeleted', onStaffChanged);
      socket.off('accountDeactivated', onAccountDeactivated);
    };
  }, [socket, addNotification, fetchArchives, fetchSales, fetchReturns,
    fetchProducts, addShiftCloseNotif, fetchConversations, fetchVoidRequests, fetchCategories, fetchStores,
    fetchSuppliers, fetchUsers, logout]);

  // ── VOID SALE ──────────────────────────────────────────────────────────
  const voidSale = async (saleId, approverPin, reason, voidType = 'whole', items = []) => {
    try {
      const endpoint = voidType === 'items'
        ? `${API_BASE_URL}/api/sales/${saleId}/void-items`
        : `${API_BASE_URL}/api/sales/${saleId}/void`
      const body = { reason }
      if (approverPin) body.approverPin = approverPin
      if (voidType === 'items') body.items = items
      const res = await authFetchRef.current(endpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      const data = await res.json()
      if (data.success) { fetchSales(); fetchProducts(); return { success: true, ...data } }
      return { success: false, message: data.message || 'Failed to void sale.' }
    } catch (err) { console.error('Void sale error:', err); return { success: false, message: 'Network error. Please try again.' } }
  }

  const submitRemoteVoid = async (saleId, reason, voidType = 'whole', items = []) => {
    try {
      const res = await authFetchRef.current(`${API_BASE_URL}/api/void-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ saleId, reason, voidType, items })
      })
      const data = await res.json()
      if (data.success) { fetchVoidRequests(); return { success: true } }
      return { success: false, message: data.message || 'Failed to submit void request.' }
    } catch (err) { console.error('submitRemoteVoid error:', err); return { success: false, message: 'Network error.' } }
  }

  const approveVoidRequest = async (id) => {
    try {
      const res = await authFetchRef.current(`${API_BASE_URL}/api/void-requests/${id}/approve`, { method: 'PATCH' })
      const data = await res.json()
      if (data.success) { fetchVoidRequests(); fetchSales(); fetchProducts(); return { success: true } }
      return { success: false, message: data.message }
    } catch (err) { console.error('approveVoidRequest error:', err); return { success: false, message: 'Network error.' } }
  }

  const rejectVoidRequest = async (id) => {
    try {
      const res = await authFetchRef.current(`${API_BASE_URL}/api/void-requests/${id}/reject`, { method: 'PATCH' })
      const data = await res.json()
      if (data.success) { fetchVoidRequests(); return { success: true } }
      return { success: false, message: data.message }
    } catch (err) { console.error('rejectVoidRequest error:', err); return { success: false, message: 'Network error.' } }
  }

  const approveVoidRequestWithPin = async (id, approverPin) => {
    try {
      const res = await authFetchRef.current(`${API_BASE_URL}/api/void-requests/${id}/approve-pin`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approverPin }),
      })
      const data = await res.json()
      if (data.success) { fetchVoidRequests(); fetchSales(); fetchProducts(); return { success: true } }
      return { success: false, message: data.message }
    } catch (err) { console.error('approveVoidRequestWithPin error:', err); return { success: false, message: 'Network error.' } }
  }

  const approveReturnStage1 = async (returnId, approverPin) => {
    try {
      const res = await authFetchRef.current(`${API_BASE_URL}/api/returns/${returnId}/approve-stage1`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approverPin })
      })
      const data = await res.json()
      if (data.success) { fetchReturns(); return { success: true } }
      return { success: false, message: data.message || 'Failed to approve.' }
    } catch (err) { console.error('approveReturnStage1 error:', err); return { success: false, message: 'Network error.' } }
  }

  const approveReturnWithPin = async (returnId, approverPin) => {
    try {
      const res = await authFetchRef.current(`${API_BASE_URL}/api/returns/${returnId}/approve`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approverPin })
      })
      const data = await res.json()
      if (data.success) { fetchReturns(); fetchSales(); fetchProducts(); return { success: true } }
      return { success: false, message: data.message || 'Failed to approve.' }
    } catch (err) { console.error('approveReturnWithPin error:', err); return { success: false, message: 'Network error.' } }
  }

  // ── SHIFT CLOSE ────────────────────────────────────────────────────────
  const closeShift = async ({ actualCash = 0 } = {}) => {
    const today = new Date().toLocaleDateString('en-CA');
    const employeeName = currentUserRef.current?.fullname || currentUserRef.current?.username || 'Unknown'
    const alreadyClosed = dailyArchives.find(a => a.employeeName === employeeName && a.date === today)
    if (alreadyClosed) return { success: false, message: 'You have already closed your shift today.' }
    const empTodaySales = sales.filter(s => {
      const saleDate = new Date(s.date).toLocaleDateString('en-CA')
      return saleDate === today && s.cashier === employeeName && !s.returned && !s.voided
    })
    const revenue = empTodaySales.reduce((sum, s) => {
      const gross = s.items?.reduce((rv, item) => {
        if (item.voidStatus === 'voided') return rv
        return rv + (item.price || 0) * Math.max(0, (item.qty || 0) - (item.voidedQty || 0) - (item.returnedQty || 0))
      }, 0) || 0
      const taxFactor = s.taxRate > 0 ? 1 / (1 + s.taxRate) : 1
      return sum + gross * taxFactor
    }, 0)
    const transactions = empTodaySales.length
    const itemsSold = empTodaySales.reduce((sum, s) =>
      sum + (s.items?.reduce((q, item) => {
        if (item.voidStatus === 'voided') return q
        return q + Math.max(0, (item.qty || 0) - (item.voidedQty || 0) - (item.returnedQty || 0))
      }, 0) || 0), 0)
    try {
      const res = await authFetchRef.current(`${API_BASE_URL}/api/archives`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeName, date: today, revenue, transactions, itemsSold, openingFloat: 0, actualCash: Number(actualCash) || 0 })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        fetchArchives();
        setShiftCloses(prev => [{ employeeName, date: today }, ...prev]);
        addNotification('✅ Your shift has been closed.', 'success', employeeName);

        // Tell the server in real time so owner sees notification instantly
        if (socket) {
          socket.emit('shift-closed', {
            employeeName,
            time: new Date().toLocaleTimeString(),
            revenue,
            store: currentUserRef.current?.store || '',
          });
        }

        return { success: true, archive: data.archive };
      }
      return { success: false, message: data.message || 'Server refused to close shift' };
    } catch (err) { console.error('Error saving archive:', err); return { success: false, message: 'Network error or Server is down' }; }
  }

  const hasClosedShiftToday = () => {
    const today = new Date().toLocaleDateString('en-CA');
    const employeeName = currentUserRef.current?.fullname || currentUserRef.current?.username;
    return dailyArchives.some(s => s.employeeName === employeeName && s.date === today);
  }

  // ── MIDNIGHT RESET ─────────────────────────────────────────────────────
  useEffect(() => {
    const interval = setInterval(() => {
      const today = new Date().toLocaleDateString('en-CA')
      const lastReset = localStorage.getItem('pos_system_last_reset')
      if (lastReset !== today) {
        localStorage.setItem('pos_system_last_reset', today)
        setShiftCloses([])
        setNotifications([])
        if (tokenRef.current) fetchSales()
      }
    }, 60000)
    return () => clearInterval(interval)
  }, [fetchSales])

  // ── SYNC ENGINE ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!tokenRef.current) return;
    const syncData = () => { fetchProducts(); fetchSales(); }
    window.addEventListener('focus', syncData);
    const interval = setInterval(syncData, 5 * 60 * 1000);
    return () => { window.removeEventListener('focus', syncData); clearInterval(interval); };
  }, [currentUser?.token, fetchProducts, fetchSales]);

  // ── DERIVED VALUES ─────────────────────────────────────────────────────
  const today = new Date().toLocaleDateString('en-CA');

  const todaySales = sales.filter(s => {
    const saleDate = new Date(s.date).toLocaleDateString('en-CA')
    return saleDate === today && !s.returned && !s.voided && s.status !== 'pending'
  })

  const totalRevenue = sales.reduce((sum, s) => {
    if (s.returned || s.status === 'pending') return sum
    const returnedValue = s.items?.reduce((rv, item) => {
      if (item.returnStatus === 'approved') return rv + (item.price || 0) * Math.max(0, item.qty - (item.voidedQty || 0) - (item.returnedQty || 0))
      return rv
    }, 0) || 0
    const gross = (s.total || 0) - returnedValue
    const taxFactor = s.taxRate > 0 ? 1 / (1 + s.taxRate) : 1
    return sum + gross * taxFactor
  }, 0)

  const lowStockProducts = products.filter(p => p.stock <= (settings?.lowStockThreshold || 5))
  const pendingReturns = returns.filter(r => r.status === 'pending_manager' || r.status === 'pending_owner')
  const pendingVoidRequests = voidRequests.filter(r => r.status === 'pending_owner')
  const todayShiftCloses = dailyArchives.filter(s => s.date === today);

  const myNotifications = notifications.filter(n =>
    n.target === 'all' ||
    (currentUser?.role === 'owner' && (n.target === 'owner' || n.target === 'all')) ||
    ((currentUser?.role === 'cashier' || currentUser?.role === 'employee' || currentUser?.role === 'manager') &&
      (n.target === 'all' || n.target === 'employee' ||
        n.target === currentUser?.fullname || n.target === currentUser?.username)
    )
  )

  const isOwner = currentUser?.role === 'owner';
  const isManager = currentUser?.role === 'manager';
  const isCashier = currentUser?.role === 'cashier' || currentUser?.role === 'employee';

  const shiftCloseUnread = isOwner ? shiftCloseNotifs.filter(n => !n.read).length : 0;
  const unreadCount = myNotifications.filter(n => !n.read).length + shiftCloseUnread;

  // ── PROVIDER ───────────────────────────────────────────────────────────
  return (
    <AppContext.Provider value={{
      socket,
      settings, setSettings, updateSettings,
      isSetupComplete, connectionError, retrySetupCheck: runSetupCheck, setupOwner,
      currentUser, login, logout,
      isOwner,
      isEmployee: currentUser?.role === 'employee',
      isManager,
      isCashier,
      canAccessReports: isOwner || isManager,
      users, setUsers,
      fetchUsers, addUser, updateUser, deleteUser, toggleUserStatus,
      products, fetchProducts,
      sales, fetchSales, recordMultipleSales, initiateMpesaPayment, checkMpesaStatus, initiateSplitMpesaVerify, queryMpesaStatus,
      todaySales, totalRevenue,
      returns, pendingReturns, fetchReturns,
      processReturn, approveReturn, rejectReturn,
      approveReturnStage1, approveReturnWithPin,
      voidRequests, pendingVoidRequests, fetchVoidRequests,
      submitRemoteVoid, approveVoidRequest, rejectVoidRequest, approveVoidRequestWithPin,
      notifications, myNotifications, unreadCount,
      addNotification, markNotificationRead,
      markAllNotificationsRead, clearNotifications,
      shiftCloses, todayShiftCloses,
      closeShift, hasClosedShiftToday,
      voidSale,
      dailyArchives, fetchArchives,
      lowStockProducts, today,
      stores, setStores, fetchStores,
      categories, setCategories, fetchCategories,
      suppliers, setSuppliers, fetchSuppliers,
      shiftCloseNotifs, addShiftCloseNotif,
      clearShiftCloseNotifs, markShiftCloseNotifRead,
      messages, setMessages,
      conversations, fetchConversations,
      fetchThread, sendMessage, sendBroadcast,
      unreadMsgCount, setUnreadMsgCount, fetchUnreadMsgCount,
      // Customers
      fetchCustomers, fetchCustomer,
      recordRepayment, blacklistCustomer, checkCustomerCredit,
      // Phase 6: Purchase Orders
      fetchPurchaseOrders, fetchPurchaseOrder,
      createPurchaseOrder, updatePurchaseOrder,
      sendPurchaseOrder, receivePurchaseOrder,
      cancelPurchaseOrder, deletePurchaseOrder,
      // Phase 6: Expenses
      fetchExpenses, fetchExpenseSummary, logExpense, deleteExpense,
      // Phase 6: Petty Cash
      fetchPettyCashToday, fetchPettyCashHistory,
      openPettyCash, addPettyCashTransaction, closePettyCash,
      sidebarOpen, setSidebarOpen,
    }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  return useContext(AppContext)
}
