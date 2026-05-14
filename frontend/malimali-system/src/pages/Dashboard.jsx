import { useState, useMemo, useEffect } from 'react'
import { MdCheckCircle, MdBarChart, MdAccessTime } from 'react-icons/md'
import { useApp } from '@/context/AppContext'
import { useNavigate } from 'react-router-dom'
import EmployeeSalesModal from '@/components/modals/EmployeeSalesModal'
import DailySummaryModal from '@/components/modals/DailySummaryModal'
import styles from '@/styles/Dashboard.module.css'
import Button from '@/components/Button'
import PendingReturnsPanel from '@/components/panels/PendingReturnsPanel'

export default function Dashboard() {
  const {
    socket,
    products, sales, todaySales,
    lowStockProducts, pendingReturns,
    shiftCloses,
    fetchSales, fetchArchives, fetchProducts, settings
  } = useApp()

  // 1. Unified Sync Function
  const syncAllData = useMemo(() => () => {
    fetchSales();
    fetchArchives();
    fetchProducts();
  }, [fetchSales, fetchArchives, fetchProducts]);

  useEffect(() => {
    syncAllData();

    if (socket) {
      // Listen for sales
      socket.on("newSale", (data) => {
        console.log(`⚡ Sale by ${data.cashier}: Syncing...`);
        syncAllData();
      });

      // Listen for stock updates
      socket.on("productsUpdated", () => {
        fetchProducts();
      });

      // Listen for shift closures
      socket.on("adminShiftNotification", () => {
        console.log("🔒 Shift closed notification received. Refreshing archives...");
        fetchArchives(); // Specifically refresh archives to update status badges
      });
    }

    const interval = setInterval(syncAllData, 5 * 60 * 1000);

    return () => {
      clearInterval(interval);
      if (socket) {
        socket.off("newSale");
        socket.off("productsUpdated");
        socket.off("adminShiftNotification");
      }
    };
  }, [socket, syncAllData, fetchArchives, fetchProducts]);

  const navigate = useNavigate()
  const [selectedEmployee, setSelectedEmployee] = useState(null)
  const [showDailySummary, setShowDailySummary] = useState(false)

  // Current Date string for comparison (YYYY-MM-DD)
  const today = new Date().toLocaleDateString('en-CA');

  // Ensure arrays exist
  const safeProducts = useMemo(() => products ?? [], [products]);
  const safeTodaySales = useMemo(() => todaySales ?? [], [todaySales]);
  const safeLowStock = useMemo(() => lowStockProducts ?? [], [lowStockProducts]);
  const safeReturns = useMemo(() => pendingReturns ?? [], [pendingReturns]);
  const safeShiftCloses = useMemo(() => shiftCloses ?? [], [shiftCloses]);

  // 2. Identify Employees who closed TODAY
  const closedTodayNames = useMemo(() => {
    return safeShiftCloses
      .filter(archive => {
        if (!archive || !archive.date) return false;
        // Convert any date format to YYYY-MM-DD
        const archiveDate = new Date(archive.date).toLocaleDateString('en-CA');
        return archiveDate === today;
      })
      .map(a => (a.employeeName || "").toLowerCase().trim());
  }, [safeShiftCloses, today]);

  // 3. Product map for profit
  const productMap = useMemo(() => {
    const m = {}
    safeProducts.forEach(p => { m[String(p._id)] = p.buyPrice || 0 })
    return m
  }, [safeProducts])

  const calcProfit = (salesArr) =>
    salesArr.reduce((sum, sale) => {
      if (sale.returned) return sum

      return sum + (sale.items?.reduce((s2, item) => {
        // Only calculate profit for items kept by the customer
        if (item.returnStatus === 'approved') return s2;

        const buy = productMap[String(item.productId?._id || item.productId)] || 0
        if (item.returnStatus === 'approved') return s2
        return s2 + (item.price - buy) * item.qty
      }, 0) || 0)
    }, 0)

  const calcRevenue = (salesArr) =>
    salesArr.reduce((sum, s) => {
      // If the entire sale was voided/returned, skip it entirely
      if (s.returned) return sum;

      const validItemsValue = s.items?.reduce((rv, item) => {
        // ONLY count items that are NOT approved returns
        if (item.returnStatus !== 'approved') {
          return rv + (item.price || 0) * item.qty;
        }
        return rv;
      }, 0) || 0;

      return sum + validItemsValue;
    }, 0);

  const allSales = sales ?? []
  const allRevenue = calcRevenue(allSales)
  const allProfit = calcProfit(allSales)
  const todayRevenue = calcRevenue(safeTodaySales)
  const todayProfit = calcProfit(safeTodaySales)
  const todayQty = safeTodaySales.reduce((sum, s) =>
    sum + (s.items?.reduce((q, i) => q + i.qty, 0) || 0), 0)
  const totalStock = safeProducts.reduce((sum, p) => sum + (p.stock || 0), 0)

  // 4. Final Seller Stats with refined closure check
  const todaySellers = [...new Set(safeTodaySales.map(s => s.cashier).filter(Boolean))]
  const sellerStats = todaySellers.map(seller => {
    const sellerSales = safeTodaySales.filter(s => s.cashier === seller)

    // Check if this specific seller is in today's closed list
    const sellerNameLower = (seller || "").toLowerCase().trim();

    // 2. Check if ANY name in the closed list matches this seller
    const hasClosed = closedTodayNames.some(closedName =>
      (closedName || "").toLowerCase().trim() === sellerNameLower
    );

    const revenue = calcRevenue(sellerSales)
    const profit = calcProfit(sellerSales)
    const qty = sellerSales.reduce((sum, s) =>
      sum + (s.items?.reduce((q, i) => q + i.qty, 0) || 0), 0)

    return {
      name: seller,
      total: revenue,
      profit,
      qty,
      count: sellerSales.length,
      hasClosed,
    }
  }).sort((a, b) => b.total - a.total)

  return (
    <div className="p-6 bg-gray-100 min-h-screen animate-fadeIn">
      {/* Header */}
      <div className="flex justify-between items-start mb-6 flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold text-gray-800">{settings.companyName || "POS System"}</h1>
          <p className="text-xs text-gray-500 mt-1">
            {new Date().toLocaleDateString('en-KE', {
              weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
            })}
          </p>
        </div>
        <Button onClick={() => setShowDailySummary(true)} variant="primary">
          <MdBarChart className="text-lg" /> Daily Summary
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 mb-6 grid-cols-[repeat(auto-fit,minmax(200px,1fr))]">
        <Card title="Total Stock" value={totalStock} color="blue" />
        <Card title="Total Revenue" value={`KSh ${allRevenue.toLocaleString()}`} color="green" />
        <Card title="Total Profit" value={`KSh ${allProfit.toLocaleString()}`} color="purple" />
        <Card
          title="Today Revenue"
          value={`KSh ${todayRevenue.toLocaleString()}`}
          color="yellow"
          sub={`${todayQty} items · Profit KSh ${todayProfit.toLocaleString()}`}
        />
        <Card
          title="Low Stock"
          value={safeLowStock.length}
          color="red"
          sub="click to restock"
          onClick={() => navigate('/products', { state: { filter: 'lowStock' } })}
          clickable
        />
        <Card
          title="Pending Returns"
          value={safeReturns.length}
          color="gray"
          sub={safeReturns.length > 0 ? 'click to review' : undefined}
          onClick={() => {
            const element = document.getElementById('returns-section');
            if (element) {
              element.scrollIntoView({ behavior: 'smooth' });
            }
          }}
          clickable={safeReturns.length > 0}
        />
      </div>

      {safeReturns.length > 0 && (
        <div id="returns-section" className="mb-6 scroll-mt-6">
          <PendingReturnsPanel pendingReturns={safeReturns} />
        </div>
      )}

      {/* Sales by Employee Today */}
      <div className={styles.box}>
        <h2 className={styles.title}>Sales by Employee Today</h2>
        {sellerStats.length === 0 ? (
          <p className={styles.empty}>No sales today</p>
        ) : (
          <div className={styles.grid}>
            {sellerStats.map((s, i) => (
              <div
                key={i}
                className={`${styles.employeeCard} animate-slideUp cursor-pointer hover:shadow-md transition-all duration-200`}
                onClick={() => setSelectedEmployee(s.name)}
              >
                <div className="flex justify-between items-center mb-2">
                  <span className="font-semibold text-gray-800">{s.name}</span>
                  {s.hasClosed ? (
                    <span className="flex items-center gap-1 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                      <MdCheckCircle className="text-xs" /> Shift Closed
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-medium">
                      <MdAccessTime className="text-xs" /> Still Working
                    </span>
                  )}
                </div>
                <div className={styles.muted}>{s.count} sales · {s.qty} items</div>
                <div className="text-blue-700 font-semibold mt-1">KSh {s.total.toLocaleString()}</div>
                <div className="text-green-700 text-xs mt-1">Profit: KSh {s.profit.toLocaleString()}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Low Stock Alerts */}
      <div className={styles.box}>
        <h2 className={styles.title}>Low Stock Alerts</h2>
        {safeLowStock.length === 0 ? (
          <p className={styles.empty}>All products are well stocked</p>
        ) : (
          safeLowStock.map(p => (
            <div
              key={p._id}
              className={`${styles.row} animate-fadeIn cursor-pointer hover:bg-yellow-50 transition-colors duration-150`}
              onClick={() => navigate('/products', { state: { filter: 'lowStock' } })}
            >
              <div>
                <div className="text-sm text-gray-800">{p.name}</div>
                <div className="text-xs text-gray-400">{p.category}</div>
              </div>
              <span className="text-xs font-semibold px-2 py-1 rounded-md bg-yellow-100 text-yellow-700">
                {p.stock} left
              </span>
            </div>
          ))
        )}
      </div>

      {/* Modals */}
      {selectedEmployee && (
        <EmployeeSalesModal
          employee={selectedEmployee}
          sales={allSales}
          products={safeProducts}
          date={today}
          onClose={() => setSelectedEmployee(null)}
        />
      )}
      {showDailySummary && (
        <DailySummaryModal onClose={() => setShowDailySummary(false)} />
      )}
    </div>
  )
}

function Card({ title, value, color, sub, onClick, clickable }) {
  return (
    <div
      className={`
        ${styles.card} ${styles[`card-${color}`]} animate-slideUp
        ${clickable ? 'cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all duration-200' : ''}
      `}
      onClick={clickable ? onClick : undefined}
    >
      <div className="flex items-start gap-3">
        <div className={`${styles.icon} ${styles[`icon-${color}`]}`}>
          <MdCheckCircle />
        </div>
        <div className="flex-1">
          <div className="text-xs text-gray-500 mb-1">{title}</div>
          <div className="text-xl font-bold text-gray-800">{value}</div>
          {sub && <div className="text-xs text-gray-400 mt-1">{sub}</div>}
        </div>
      </div>
    </div>
  )
}