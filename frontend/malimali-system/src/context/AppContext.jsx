import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { useSocket, useSocketActions } from './SocketContext';

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

  // ── GENERIC SETTINGS ──────────────────────────────────────────────────────────
  const [settings, setSettings] = useState(() =>
    load('pos_system_settings', {
      businessName: 'My POS Shop',
      currency: 'KSh',
      lowStockThreshold: 5,
      paymentMethods: ['cash', 'mpesa', 'split', 'credit'],
      receiptPrefix: 'RCP',
    })
  )

  useEffect(() => {
    if (settings) {
      localStorage.setItem('pos_system_settings', JSON.stringify(settings));
      // Update document title to the client's shop name
      document.title = `${settings.companyName || 'POS'} - Management`;
    }
  }, [settings]);


  // ── CORE STATE ────────────────────────────────────────────────────────
  // Updated to null to trigger the Loading state in App.jsx during initialization
  const [isSetupComplete, setIsSetupComplete] = useState(null)
  const [currentUser, setCurrentUser] = useState(() => load('pos_system_user', null))
  const [users, setUsers] = useState([])
  const [products, setProducts] = useState([])
  const [sales, setSales] = useState([])
  const [returns, setReturns] = useState([])
  const [stockInLog, setStockInLog] = useState([])
  const [dailyArchives, setDailyArchives] = useState([])
  const [notifications, setNotifications] = useState(() => load('pos_system_notifications', []))
  const [shiftCloses, setShiftCloses] = useState(() => load('pos_system_shift_closes', []));

  const tokenRef = useRef(currentUser?.token ?? null)
  tokenRef.current = currentUser?.token ?? null

  const { refreshSocket } = useSocketActions();

  // ── CHECK SETUP ON LOAD ───────────────────────────────────────────────────────
  useEffect(() => {
    const checkSetup = async () => {
      try {
        const res = await fetch("http://localhost:5000/api/setup/status");

        if (!res.ok) {
          throw new Error(`Server responded with ${res.status}`);
        }

        const data = await res.json();

        /// If the backend has settings, we use them!
        setIsSetupComplete(data.isSetup && data.hasOwner);

        // 3. If settings exist, save them to state AND localStorage
        if (data.isSetup) {
          // We need a route to fetch the actual settings details
          const settingsRes = await fetch("http://localhost:5000/api/setup/details");
          const settingsData = await settingsRes.json();
          setSettings(settingsData);

          localStorage.setItem('pos_system_settings', JSON.stringify(settingsData));
        }

      } catch (err) {
        console.error("Setup check failed:", err);
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
      const res = await fetch("http://localhost:5000/api/products", { headers: { Authorization: `Bearer ${authToken}` } })
      const data = await res.json()
      setProducts(Array.isArray(data) ? data : [])
    } catch (err) { console.error("Error fetching products:", err); setProducts([]) }
  }, [])

  const fetchSales = useCallback(async (overrideToken) => {
    try {
      const authToken = overrideToken ?? tokenRef.current
      if (!authToken) return
      const res = await fetch("http://localhost:5000/api/sales", { headers: { Authorization: `Bearer ${authToken}` } })
      const data = await res.json()
      setSales(Array.isArray(data) ? data : [])
    } catch (err) { console.error("Error fetching sales:", err); setSales([]) }
  }, [])

  const fetchReturns = useCallback(async (overrideToken) => {
    try {
      const authToken = overrideToken ?? tokenRef.current
      if (!authToken) return
      const res = await fetch("http://localhost:5000/api/returns", { headers: { Authorization: `Bearer ${authToken}` } })
      const data = await res.json()
      setReturns(Array.isArray(data) ? data : [])
    } catch (err) { console.error("Error fetching returns:", err); setReturns([]) }
  }, [])

  const fetchStockIn = useCallback(async (overrideToken) => {
    try {
      const authToken = overrideToken ?? tokenRef.current
      if (!authToken) return
      const res = await fetch("http://localhost:5000/api/stockin", { headers: { Authorization: `Bearer ${authToken}` } })
      const data = await res.json()
      setStockInLog(Array.isArray(data) ? data : [])
    } catch (err) { console.error("Error fetching stock-in:", err); setStockInLog([]) }
  }, [])

  const fetchUsers = useCallback(async (overrideToken) => {
    try {
      const authToken = overrideToken ?? tokenRef.current
      if (!authToken) return
      const res = await fetch("http://localhost:5000/api/auth/employees", { headers: { Authorization: `Bearer ${authToken}` } })
      const data = await res.json()
      setUsers(Array.isArray(data) ? data : [])
    } catch (err) { console.error("Error fetching users:", err); setUsers([]) }
  }, [])

  const fetchArchives = useCallback(async (overrideToken) => {
    try {
      const authToken = overrideToken ?? tokenRef.current
      if (!authToken) return
      const res = await fetch("http://localhost:5000/api/archives", { headers: { Authorization: `Bearer ${authToken}` } })
      const data = await res.json()
      const archivesArray = Array.isArray(data) ? data : [];
      setDailyArchives(archivesArray)
      const today = new Date().toLocaleDateString('en-CA');
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
      const res = await fetch("http://localhost:5000/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      })
      const data = await res.json()
      if (data.success) {
        const userData = {
          token: data.token,
          role: data.role,
          name: data.name,
          id: data.id,
          store: data.store
        }
        setCurrentUser(userData)
        localStorage.setItem("pos_system_user", JSON.stringify(userData))
        tokenRef.current = data.token
        refreshSocket();
        fetchProducts(data.token); fetchSales(data.token); fetchReturns(data.token)
        fetchStockIn(data.token);
        fetchArchives(data.token)
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
    localStorage.removeItem("pos_system_user")
    refreshSocket(); // <--- Add this!
    window.location.href = '/login'
  }

  // ── SETUP OWNER ───────────────────────────────────────────────────────
  // ── SETUP OWNER ───────────────────────────────────────────────────────
  const validatePassword = (password) => {
    if (!password) return false;
    return /[A-Z]/.test(password) && /[0-9]/.test(password);
  };

  const setupOwner = async (formData) => {
    // ✅ FIXED KEY: Matches 'ownerPassword' from your SetupWizard.jsx
    const password = formData.get('ownerPassword');

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
        if (data.error && data.error.includes("E11000")) {
          return {
            success: false,
            message: "This email is already registered. Please use a different email or log in."
          };
        }
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
      const res = await fetch("http://localhost:5000/api/stockin", {
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
      const res = await fetch("http://localhost:5000/api/sales", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokenRef.current}`
        },
        body: JSON.stringify({
          // Include the store context from the current user session
          store: currentUser?.store || "Main Store",
          cashier: currentUser?.name || "Unknown",
          items: cartItems.map(item => ({
            productId: item._id || item.id,
            qty: item.qty,
            price: item.sellPrice
          })),
          total: cartItems.reduce((sum, i) => sum + i.total, 0),
          paymentInfo: {
            paymentMethod: paymentInfo.paymentMethod,
            mpesaPhone: paymentInfo.mpesaPhone || "",
            customerName: paymentInfo.customerName || "",
            cashPart: Number(paymentInfo.cashPart) || 0,
            mpesaPart: Number(paymentInfo.mpesaPart) || 0,
            discount: Number(paymentInfo.discount) || 0,
            finalTotal: Number(paymentInfo.finalTotal) || cartItems.reduce((s, i) => s + i.total, 0),
            cashGiven: Number(paymentInfo.cashGiven) || 0,
            change: Number(paymentInfo.change) || 0,
          }
        })
      });

      const data = await res.json();
      if (data.success) {
        fetchSales();
        fetchProducts();
        return { success: true, ...data };
      }
      return { success: false, error: data.error || 'Failed to record sale' };
    } catch (err) {
      console.error("Sale Recording Error:", err);
      return { success: false, error: 'Failed to record sale' };
    }
  };

  // ── RETURNS ───────────────────────────────────────────────────────────
  const processReturn = async (saleId, returnItems, reason, customerName) => {
    try {
      const res = await fetch("http://localhost:5000/api/returns", {
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
      await fetch(`http://localhost:5000/api/returns/${returnId}/approve`, {
        method: "PATCH", headers: { Authorization: `Bearer ${tokenRef.current}` }
      })
      fetchReturns(); fetchProducts(); fetchSales()
      return true
    } catch (err) { console.error("Operation failed:", err); return false }
  }

  const rejectReturn = async (returnId) => {
    try {
      await fetch(`http://localhost:5000/api/returns/${returnId}/reject`, {
        method: "PATCH", headers: { Authorization: `Bearer ${tokenRef.current}` }
      })
      fetchReturns(); fetchSales()
      return true
    } catch (err) { console.error("Operation failed:", err); return false }
  }

  // ── USER MANAGEMENT ───────────────────────────────────────────────────
  const addUser = async (form) => {
    try {
      const res = await fetch("http://localhost:5000/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokenRef.current}`
        },
        // Send the full form which should now include 'role' and 'store'
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (data.success) fetchUsers();
      return data;
    } catch (err) {
      console.error("Operation failed:", err);
      return { success: false };
    }
  };

  const updateUser = async (id, form) => {
    try {
      const res = await fetch(`http://localhost:5000/api/auth/${id}`, {
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
      const res = await fetch(`http://localhost:5000/api/auth/${id}`, {
        method: "DELETE", headers: { Authorization: `Bearer ${tokenRef.current}` }
      })
      const data = await res.json()
      if (data.success) setUsers(prev => prev.filter(u => u._id !== id))
      return data
    } catch (err) { console.error("Operation failed:", err); return { success: false }; }
  }

  const toggleUserStatus = async (id) => {
    try {
      const res = await fetch(`http://localhost:5000/api/auth/${id}/toggle`, {
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

      const res = await fetch("http://localhost:5000/api/auth/settings", {
        method: "PUT",
        headers: { Authorization: `Bearer ${tokenRef.current}` },
        body: formData
      })
      const data = await res.json()
      if (data.success) {
        setSettings(data.settings)
        localStorage.setItem('pos_system_settings', JSON.stringify(data.settings))
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
      date: new Date().toLocaleDateString('en-CA'),
      time: new Date().toLocaleTimeString(),
      createdAt: Date.now(),
    }
    setNotifications(prev => [notif, ...prev])
  }, [])

  const markNotificationRead = (id) => setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
  const markAllNotificationsRead = (target) => setNotifications(prev => prev.map(n => (n.target === target || n.target === 'all') ? { ...n, read: true } : n))
  const clearNotifications = (target) => setNotifications(prev => prev.filter(n => n.target !== target && n.target !== 'all'))

  // ── 2. DEFINE SOCKET LISTENER AFTER NOTIFICATIONS ──────────────────────────
  const socket = useSocket();

  useEffect(() => {
    if (!socket) return;

    socket.on("adminShiftNotification", (data) => {
      const role = JSON.parse(localStorage.getItem('pos_system_user') || '{}')?.role;
      if (role !== 'owner') return;
      const name = data.employeeName || "An employee";
      const time = data.time || new Date().toLocaleTimeString();
      addNotification(`🔒 ${name} closed shift at ${time}`, "info", "owner");
      fetchArchives();
      fetchSales();
    });

    // ── Triggered after return approval, stock-in, or any backend data change
    socket.on("sync_system_data", () => {
      fetchSales();
      fetchReturns();
      fetchArchives();
      fetchProducts();
    });

    return () => {
      socket.off("adminShiftNotification");
      socket.off("sync_system_data");
    };
  }, [socket, addNotification, fetchArchives, fetchSales, fetchReturns, fetchProducts]);

  // ── SHIFT CLOSE ───────────────────────────────────────────────────────
  const closeShift = async () => {
    const today = new Date().toLocaleDateString('en-CA')
    const employeeName = currentUser?.name || "Unknown"

    const alreadyClosed = shiftCloses.find(s => s.employeeName === employeeName && s.date === today)
    if (alreadyClosed) return { success: false, message: "You have already closed your shift today." }

    const empTodaySales = sales.filter(s => {
      const saleDate = new Date(s.date).toLocaleDateString('en-CA')
      return saleDate === today && s.cashier === employeeName && !s.returned
    })

    const revenue = empTodaySales.reduce((sum, s) => sum + (s.total || 0), 0)
    const transactions = empTodaySales.length
    const itemsSold = empTodaySales.reduce((sum, s) =>
      sum + (s.items?.reduce((q, i) => q + i.qty, 0) || 0), 0)

    try {
      const res = await fetch("http://localhost:5000/api/archives", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokenRef.current}`
        },
        body: JSON.stringify({ employeeName, date: today, revenue, transactions, itemsSold })
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok && data.success) {

        if (socket) {
          socket.emit("shift-closed", {
            employeeName,
            time: new Date().toLocaleTimeString()
          });
        }

        fetchArchives();
        setShiftCloses(prev => [{ employeeName, date: today }, ...prev]);
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
    const today = new Date().toLocaleDateString('en-CA');
    return shiftCloses.some(s => s.employeeName === currentUser?.name && s.date === today)
  }

  // ── MIDNIGHT RESET ────────────────────────────────────────────────────
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

  // ── SYNC ENGINE ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!currentUser?.token) return;
    const syncData = () => { fetchProducts(); fetchSales(); }
    window.addEventListener('focus', syncData);
    const interval = setInterval(syncData, 5 * 60 * 1000);
    return () => {
      window.removeEventListener('focus', syncData);
      clearInterval(interval);
    };
  }, [currentUser, fetchProducts, fetchSales]);

  // ── DERIVED VALUES ────────────────────────────────────────────────────
  const today = new Date().toLocaleDateString('en-CA');
  const todaySales = sales.filter(s => {
    const saleDate = new Date(s.date).toLocaleDateString('en-CA')
    return saleDate === today && !s.returned
  })
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
  const isOwner = currentUser?.role === 'owner';
  const isManager = currentUser?.role === 'manager';
  const isCashier = currentUser?.role === 'cashier' || currentUser?.role === 'employee';


  // ── PROVIDER ──────────────────────────────────────────────────────────
  return (
    <AppContext.Provider value={{
      socket,
      settings, setSettings, updateSettings,
      isSetupComplete, setupOwner,
      currentUser, login, logout,
      isOwner: currentUser?.role === 'owner',
      isEmployee: currentUser?.role === 'employee',
      isManager,
      isCashier,
      canAccessReports: isOwner || isManager,
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