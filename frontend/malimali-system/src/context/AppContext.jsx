import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { io } from 'socket.io-client'

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
  const [settings, setSettings] = useState(() =>
    load('malimali_settings', {
      businessName: 'Malimali POS',
      currency: 'KSh',
      lowStockThreshold: 5,
      paymentMethods: ['cash', 'mpesa', 'split', 'credit'],
      receiptPrefix: 'RCP',
    })
  )
  useEffect(() => {
    localStorage.setItem('malimali_settings', JSON.stringify(settings))
  }, [settings])

  // ── CORE STATE ────────────────────────────────────────────────────────
  // Updated to null to trigger the Loading state in App.jsx during initialization
  const [isSetupComplete, setIsSetupComplete] = useState(null)
  const [currentUser, setCurrentUser] = useState(() => load('malimali_current_user', null))
  const [users, setUsers] = useState([])
  const [products, setProducts] = useState([])
  const [sales, setSales] = useState([])
  const [returns, setReturns] = useState([])
  const [stockInLog, setStockInLog] = useState([])
  const [dailyArchives, setDailyArchives] = useState([])
  const [notifications, setNotifications] = useState(() => load('malimali_notifications', []))
  const [shiftCloses, setShiftCloses] = useState(() => load('malimali_shift_closes', []))

  const tokenRef = useRef(currentUser?.token ?? null)
  tokenRef.current = currentUser?.token ?? null

  // ── CHECK SETUP ───────────────────────────────────────────────────────
  // ── CHECK SETUP ───────────────────────────────────────────────────────
  useEffect(() => {
    const checkSetup = async () => {
      try {
        // 1. Try to load settings from LocalStorage first for instant display
        const savedSettings = localStorage.getItem('pos_settings');
        if (savedSettings) {
          setSettings(JSON.parse(savedSettings));
        }

        const res = await fetch("http://localhost:5000/api/setup/status");

        if (!res.ok) {
          throw new Error(`Server responded with ${res.status}`);
        }

        const data = await res.json();

        // 2. Update status
        setIsSetupComplete(data.isSetup);

        // 3. If settings exist, save them to state AND localStorage
        if (data.settings) {
          setSettings(data.settings);
          localStorage.setItem('pos_settings', JSON.stringify(data.settings));
        }

      } catch (err) {
        console.error("Error checking setup:", err);
        setIsSetupComplete(false);
      }
    };

    checkSetup();
  }, []);

  // ── FETCH HELPERS ─────────────────────────────────────────────────────
  const fetchProducts = useCallback(async (overrideToken) => {
    try {
      const authToken = overrideToken ?? tokenRef.current
      if (!authToken) return
      const res = await fetch("http://localhost:5000/products", { headers: { Authorization: `Bearer ${authToken}` } })
      const data = await res.json()
      setProducts(Array.isArray(data) ? data : [])
    } catch (err) { console.error("Error fetching products:", err); setProducts([]) }
  }, [])

  const fetchSales = useCallback(async (overrideToken) => {
    try {
      const authToken = overrideToken ?? tokenRef.current
      if (!authToken) return
      const res = await fetch("http://localhost:5000/sales", { headers: { Authorization: `Bearer ${authToken}` } })
      const data = await res.json()
      setSales(Array.isArray(data) ? data : [])
    } catch (err) { console.error("Error fetching sales:", err); setSales([]) }
  }, [])

  const fetchReturns = useCallback(async (overrideToken) => {
    try {
      const authToken = overrideToken ?? tokenRef.current
      if (!authToken) return
      const res = await fetch("http://localhost:5000/returns", { headers: { Authorization: `Bearer ${authToken}` } })
      const data = await res.json()
      setReturns(Array.isArray(data) ? data : [])
    } catch (err) { console.error("Error fetching returns:", err); setReturns([]) }
  }, [])

  const fetchStockIn = useCallback(async (overrideToken) => {
    try {
      const authToken = overrideToken ?? tokenRef.current
      if (!authToken) return
      const res = await fetch("http://localhost:5000/stockin", { headers: { Authorization: `Bearer ${authToken}` } })
      const data = await res.json()
      setStockInLog(Array.isArray(data) ? data : [])
    } catch (err) { console.error("Error fetching stock-in:", err); setStockInLog([]) }
  }, [])

  const fetchUsers = useCallback(async (overrideToken) => {
    try {
      const authToken = overrideToken ?? tokenRef.current
      if (!authToken) return
      const res = await fetch("http://localhost:5000/auth/employees", { headers: { Authorization: `Bearer ${authToken}` } })
      const data = await res.json()
      setUsers(Array.isArray(data) ? data : [])
    } catch (err) { console.error("Error fetching users:", err); setUsers([]) }
  }, [])

  const fetchArchives = useCallback(async (overrideToken) => {
    try {
      const authToken = overrideToken ?? tokenRef.current
      if (!authToken) return
      const res = await fetch("http://localhost:5000/archives", { headers: { Authorization: `Bearer ${authToken}` } })
      const data = await res.json()
      const archivesArray = Array.isArray(data) ? data : [];
      setDailyArchives(archivesArray)
      const today = new Date().toISOString().split('T')[0];
      const closesToday = archivesArray.filter(a => a.date === today);
      setShiftCloses(closesToday);
    } catch (err) {
      console.error("Error fetching archives:", err);
      setDailyArchives([])
    }
  }, [])

  // ── FETCH ON USER CHANGE ──────────────────────────────────────────────
  useEffect(() => {
    if (!currentUser?.token) return
    const t = currentUser.token
    fetchProducts(t); fetchSales(t); fetchReturns(t); fetchStockIn(t); fetchArchives(t)
    if (currentUser.role === 'owner') fetchUsers(t)
  }, [currentUser, fetchProducts, fetchSales, fetchReturns, fetchStockIn, fetchArchives, fetchUsers])

  // ── LOGIN / LOGOUT ────────────────────────────────────────────────────
  const login = async (username, password) => {
    try {
      const res = await fetch("http://localhost:5000/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      })
      const data = await res.json()
      if (data.success) {
        const userData = { token: data.token, role: data.role, name: data.name, id: data.id }
        setCurrentUser(userData)
        localStorage.setItem("malimali_current_user", JSON.stringify(userData))
        tokenRef.current = data.token
        fetchProducts(data.token); fetchSales(data.token); fetchReturns(data.token)
        fetchStockIn(data.token); fetchArchives(data.token)
        if (data.role === 'owner') fetchUsers(data.token)
        return { success: true, role: data.role }
      }
      return { success: false, message: data.message || "Login failed" }
    } catch (err) {
      console.error("Login error:", err)
      return { success: false, message: "Server error" }
    }
  }

  const logout = () => {
    setCurrentUser(null)
    localStorage.removeItem("malimali_current_user")
    window.location.href = '/login'
  }

  // ── SETUP OWNER ───────────────────────────────────────────────────────
  // ── SETUP OWNER ───────────────────────────────────────────────────────
  const validatePassword = (password) => /[A-Z]/.test(password) && /[0-9]/.test(password);

  const setupOwner = async (formData) => {
    // 1. Client-side Password Validation
    const password = formData.get('adminPassword');
    if (!validatePassword(password)) {
      return {
        success: false,
        message: "Password must contain at least one uppercase letter and one number."
      };
    }

    try {
      // 2. Send request to the /initialize route
      const res = await fetch("http://localhost:5000/api/setup/initialize", {
        method: "POST",
        body: formData // No Headers needed, browser sets boundary for FormData
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setIsSetupComplete(true);
        return { success: true };
      } else {
        return {
          success: false,
          message: data.error || data.message || "Setup failed"
        };
      }
    } catch (err) {
      console.error("Setup Operation failed:", err);
      return { success: false, message: "Could not connect to server." };
    }
  };

  // ── STOCK-IN ──────────────────────────────────────────────────────────
  const addStockIn = async (form) => {
    try {
      const res = await fetch("http://localhost:5000/stockin", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenRef.current}` },
        body: JSON.stringify(form)
      })
      const data = await res.json()
      if (data.success) { fetchStockIn(); fetchProducts() }
      return data
    } catch (err) { console.error("Operation failed:", err); return { success: false } }
  }

  // ── RECORD SALE ───────────────────────────────────────────────────────
  const recordMultipleSales = async (cartItems, paymentInfo = {}) => {
    try {
      const res = await fetch("http://localhost:5000/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenRef.current}` },
        body: JSON.stringify({
          items: cartItems.map(item => ({ productId: item._id || item.id, qty: item.qty, price: item.sellPrice })),
          total: cartItems.reduce((sum, i) => sum + i.total, 0),
          paymentInfo: {
            paymentMethod: paymentInfo.paymentMethod,
            mpesaPhone: paymentInfo.mpesaPhone || "",
            customerName: paymentInfo.customerName || "",
            cashPart: paymentInfo.cashPart || 0,
            mpesaPart: paymentInfo.mpesaPart || 0,
            discount: paymentInfo.discount || 0,
            finalTotal: paymentInfo.finalTotal || cartItems.reduce((s, i) => s + i.total, 0),
            cashGiven: paymentInfo.cashGiven || 0,
            change: paymentInfo.change || 0,
          }
        })
      })
      const data = await res.json()
      if (data.success) { fetchSales(); fetchProducts(); return { success: true, ...data } }
      return { success: false, error: data.error || 'Failed to record sale' }
    } catch (err) {
      console.error("Sale Recording Error:", err);
      return { success: false, error: 'Failed to record sale' };
    }
  }

  // ── RETURNS ───────────────────────────────────────────────────────────
  const processReturn = async (saleId, returnItems, reason, customerName) => {
    try {
      const res = await fetch("http://localhost:5000/returns", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenRef.current}` },
        body: JSON.stringify({ saleId, items: returnItems, reason, customerName })
      })
      const data = await res.json()
      fetchReturns()
      return { success: true, returnId: data._id }
    } catch (err) { console.error("Operation failed:", err); return { success: false } }
  }

  const approveReturn = async (returnId) => {
    try {
      await fetch(`http://localhost:5000/returns/${returnId}/approve`, {
        method: "PATCH", headers: { Authorization: `Bearer ${tokenRef.current}` }
      })
      fetchReturns(); fetchProducts(); fetchSales()
      return true
    } catch (err) { console.error("Operation failed:", err); return false }
  }

  const rejectReturn = async (returnId) => {
    try {
      await fetch(`http://localhost:5000/returns/${returnId}/reject`, {
        method: "PATCH", headers: { Authorization: `Bearer ${tokenRef.current}` }
      })
      fetchReturns(); fetchSales()
      return true
    } catch (err) { console.error("Operation failed:", err); return false }
  }

  // ── USER MANAGEMENT ───────────────────────────────────────────────────
  const addUser = async (form) => {
    try {
      const res = await fetch("http://localhost:5000/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenRef.current}` },
        body: JSON.stringify({ ...form, role: "employee" })
      })
      const data = await res.json()
      if (data.success) fetchUsers()
      return data
    } catch (err) { console.error("Operation failed:", err); return { success: false }; }
  }

  const updateUser = async (id, form) => {
    try {
      const res = await fetch(`http://localhost:5000/auth/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenRef.current}` },
        body: JSON.stringify(form)
      })
      const data = await res.json()
      if (data.success) fetchUsers()
      return data
    } catch (err) { console.error("Operation failed:", err); return { success: false }; }
  }

  const deleteUser = async (id) => {
    try {
      const res = await fetch(`http://localhost:5000/auth/${id}`, {
        method: "DELETE", headers: { Authorization: `Bearer ${tokenRef.current}` }
      })
      const data = await res.json()
      if (data.success) setUsers(prev => prev.filter(u => u._id !== id))
      return data
    } catch (err) { console.error("Operation failed:", err); return { success: false }; }
  }

  const toggleUserStatus = async (id) => {
    try {
      const res = await fetch(`http://localhost:5000/auth/${id}/toggle`, {
        method: "PATCH", headers: { Authorization: `Bearer ${tokenRef.current}` }
      })
      const data = await res.json()
      if (data.success) fetchUsers()
      return data
    } catch (err) { console.error("Operation failed:", err); return { success: false }; }
  }

  // ── WHITE LABEL SETTINGS UPDATE ───────────────────────────────────────
  const updateSettings = async (newSettings) => {
    try {
      const formData = new FormData()
      Object.keys(newSettings).forEach(key => {
        if (key !== 'logoFile') formData.append(key, newSettings[key])
      })
      if (newSettings.logoFile) formData.append('logo', newSettings.logoFile)

      const res = await fetch("http://localhost:5000/auth/settings", {
        method: "PUT",
        headers: { Authorization: `Bearer ${tokenRef.current}` },
        body: formData
      })
      const data = await res.json()
      if (data.success) {
        setSettings(data.settings)
        localStorage.setItem('malimali_settings', JSON.stringify(data.settings))
        return { success: true }
      }
      return { success: false }
    } catch (err) { console.error("Settings update failed:", err); return { success: false } }
  }

  // ── NOTIFICATIONS ─────────────────────────────────────────────────────
  const addNotification = useCallback((message, type = 'info', target = 'owner') => {
    const notif = {
      id: Date.now() + Math.random(),
      message, type, target,
      read: false,
      date: new Date().toISOString().split('T')[0],
      time: new Date().toLocaleTimeString(),
      createdAt: Date.now(),
    }
    setNotifications(prev => [notif, ...prev])
  }, [])

  const markNotificationRead = (id) => setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
  const markAllNotificationsRead = (target) => setNotifications(prev => prev.map(n => (n.target === target || n.target === 'all') ? { ...n, read: true } : n))
  const clearNotifications = (target) => setNotifications(prev => prev.filter(n => n.target !== target && n.target !== 'all'))

  // ── SHIFT CLOSE ───────────────────────────────────────────────────────
  const closeShift = async () => {
    const today = new Date().toISOString().split("T")[0]
    const time = new Date().toLocaleTimeString()
    const employeeName = currentUser?.name || "Unknown"

    const alreadyClosed = shiftCloses.find(s => s.employeeName === employeeName && s.date === today)
    if (alreadyClosed) return { success: false, message: "You have already closed your shift today." }

    const empTodaySales = sales.filter(s => {
      const saleDate = new Date(s.date).toISOString().split("T")[0]
      return saleDate === today && s.cashier === employeeName && !s.returned
    })

    const revenue = empTodaySales.reduce((sum, s) => sum + (s.total || 0), 0)
    const transactions = empTodaySales.length
    const itemsSold = empTodaySales.reduce((sum, s) =>
      sum + (s.items?.reduce((q, i) => q + i.qty, 0) || 0), 0)

    try {
      const res = await fetch("http://localhost:5000/archives", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenRef.current}` },
        body: JSON.stringify({ employeeName, date: today, revenue, transactions, itemsSold })
      })
      const data = await res.json().catch(() => ({}));

      if (res.ok && data.success) {
        fetchArchives();
        setShiftCloses(prev => [{ employeeName, date: today }, ...prev]);
        addNotification(`🔒 ${employeeName} closed shift at ${time}`, "info", "owner");
        addNotification(`✅ Your shift has been closed.`, "success", employeeName);
        return { success: true };
      }
      return { success: false, message: data.message || "Server refused to close shift" };
    } catch (err) {
      console.error("Error saving archive:", err);
      return { success: false, message: "Network error or Server is down" };
    }
  }

  const hasClosedShiftToday = () => {
    const today = new Date().toISOString().split("T")[0]
    return shiftCloses.some(s => s.employeeName === currentUser?.name && s.date === today)
  }

  // ── MIDNIGHT RESET ────────────────────────────────────────────────────
  useEffect(() => {
    const interval = setInterval(() => {
      const today = new Date().toISOString().split('T')[0]
      const lastReset = localStorage.getItem('malimali_last_reset')
      if (lastReset !== today) {
        localStorage.setItem('malimali_last_reset', today)
        setShiftCloses([])
        setNotifications([])
        if (tokenRef.current) fetchSales()
      }
    }, 60000)
    return () => clearInterval(interval)
  }, [fetchSales])

  // ── SYNC ENGINE ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!currentUser?.token) return;
    const syncData = () => { fetchProducts(); };
    window.addEventListener('focus', syncData);
    const interval = setInterval(syncData, 5 * 60 * 1000);
    return () => {
      window.removeEventListener('focus', syncData);
      clearInterval(interval);
    };
  }, [currentUser, fetchProducts]);

  // ── DERIVED VALUES ────────────────────────────────────────────────────
  const today = new Date().toISOString().split('T')[0]
  const todaySales = sales.filter(s => s.date?.startsWith(today) && !s.returned)
  const totalRevenue = sales.reduce((sum, s) => {
    if (s.returned) return sum
    const returnedValue = s.items?.reduce((rv, item) => {
      if (item.returnStatus === 'approved') return rv + (item.price || 0) * item.qty
      return rv
    }, 0) || 0
    return sum + (s.total || 0) - returnedValue
  }, 0)

  const lowStockProducts = products.filter(p => p.stock <= (settings.lowStockThreshold || 5))
  const pendingReturns = returns.filter(r => r.status === 'pending')
  const todayShiftCloses = shiftCloses.filter(s => s.date === today)
  const myNotifications = notifications.filter(n =>
    n.target === 'all' ||
    (currentUser?.role === 'owner' && n.target === 'owner') ||
    (currentUser?.role === 'employee' && (n.target === currentUser?.name || n.target === 'employee'))
  )
  const unreadCount = myNotifications.filter(n => !n.read).length

  const [socket, setSocket] = useState(null)

  useEffect(() => {
    const newSocket = io("http://localhost:5000");
    setSocket(newSocket);
    if (currentUser?.role === 'owner') {
      newSocket.emit("join-owner-room");
    }
    return () => newSocket.close();
  }, [currentUser]);

  useEffect(() => {
    if (!socket) return;
    socket.on("adminShiftNotification", (data) => {
      if (currentUser?.role === 'owner') {
        const name = data.employeeName || data.cashier || data.name || "An employee";
        addNotification(`🔒 ${name} has closed their shift.`, "info", "owner");
        fetchArchives();
        fetchSales();
      }
    });
    return () => { socket.off("adminShiftNotification"); };
  }, [socket, currentUser, addNotification, fetchArchives, fetchSales]);

  // ── PROVIDER ──────────────────────────────────────────────────────────
  return (
    <AppContext.Provider value={{
      socket,
      settings, setSettings, updateSettings,
      isSetupComplete, setupOwner,
      currentUser, login, logout,
      isOwner: currentUser?.role === 'owner',
      isEmployee: currentUser?.role === 'employee',
      users, setUsers,
      fetchUsers, addUser, updateUser, deleteUser, toggleUserStatus,
      products, fetchProducts,
      sales, fetchSales, recordMultipleSales,
      todaySales, totalRevenue,
      returns, pendingReturns, fetchReturns,
      processReturn, approveReturn, rejectReturn,
      notifications, myNotifications, unreadCount,
      addNotification, markNotificationRead,
      markAllNotificationsRead, clearNotifications,
      shiftCloses, todayShiftCloses,
      closeShift, hasClosedShiftToday,
      dailyArchives, fetchArchives,
      lowStockProducts, today,
      stockInLog, addStockIn, fetchStockIn
    }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  return useContext(AppContext)
}