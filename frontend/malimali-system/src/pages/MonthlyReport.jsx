import { useState, useMemo } from 'react'
import { MdChevronLeft, MdChevronRight, MdTrendingUp, MdAttachMoney, MdInventory, MdPerson } from 'react-icons/md'
import { useApp } from '@/context/AppContext'

const CATEGORIES = ['All', 'Furniture', 'Bedding', 'Utensils', 'Cleaning', 'Accessories']

export default function MonthlyReport() {
  const { sales, products } = useApp()
  const now = new Date()
  const [year, setYear]   = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())

  const monthName = new Date(year, month).toLocaleDateString('en-KE', {
    month: 'long', year: 'numeric'
  })

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(y => y - 1) }
    else setMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(y => y + 1) }
    else setMonth(m => m + 1)
  }
  const isNextDisabled = year === now.getFullYear() && month === now.getMonth()

  // ── Product buyPrice map ───────────────────────────────────────────
  const productMap = useMemo(() => {
    const m = {}
    products.forEach(p => { m[String(p._id)] = { buyPrice: p.buyPrice || 0, name: p.name, category: p.category } })
    return m
  }, [products])

  // ── Filter sales for selected month ───────────────────────────────
  // ✅ Fixed: was s.date === dateStr (exact string) — now compares year/month properly
  const monthSales = useMemo(() =>
    sales.filter(s => {
      if (!s.date) return false
      const d = new Date(s.date)
      return d.getFullYear() === year && d.getMonth() === month && !s.returned
    }),
    [sales, year, month]
  )

  // ── Summary ────────────────────────────────────────────────────────
  const totalRevenue = monthSales.reduce((sum, s) => sum + (s.total || 0), 0)

  // ✅ Fixed: profit calculated from items × (sellPrice - buyPrice)
  const totalProfit = monthSales.reduce((sum, sale) =>
    sum + (sale.items?.reduce((s2, item) => {
      const buy = productMap[String(item.productId?._id || item.productId)]?.buyPrice || 0
      return s2 + (item.price - buy) * item.qty
    }, 0) || 0), 0)

  // ✅ Fixed: was s.qty (doesn't exist) → items sum
  const totalItems = monthSales.reduce((sum, s) =>
    sum + (s.items?.reduce((q, i) => q + i.qty, 0) || 0), 0)

  // ── Daily data ─────────────────────────────────────────────────────
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const dailyData = useMemo(() => Array.from({ length: daysInMonth }, (_, idx) => {
    const day     = idx + 1
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    const daySales = monthSales.filter(s => s.date?.startsWith(dateStr))
    const revenue  = daySales.reduce((sum, s) => sum + (s.total || 0), 0)
    const profit   = daySales.reduce((sum, sale) =>
      sum + (sale.items?.reduce((s2, item) => {
        const buy = productMap[String(item.productId?._id || item.productId)]?.buyPrice || 0
        return s2 + (item.price - buy) * item.qty
      }, 0) || 0), 0)
    const items = daySales.reduce((sum, s) =>
      sum + (s.items?.reduce((q, i) => q + i.qty, 0) || 0), 0)
    return { day, date: dateStr, revenue, profit, items, transactions: daySales.length }
  }), [monthSales, daysInMonth, year, month, productMap])

  const maxRevenue = Math.max(...dailyData.map(d => d.revenue), 1)

  // ── Top products ───────────────────────────────────────────────────
  // ✅ Fixed: was grouping by s.name (doesn't exist) → use items[].productId
  const productSalesMap = useMemo(() => {
    const m = {}
    monthSales.forEach(sale => {
      sale.items?.forEach(item => {
        const id   = String(item.productId?._id || item.productId)
        const info = productMap[id]
        const name = info?.name || id
        if (!m[name]) m[name] = { qty: 0, revenue: 0 }
        m[name].qty     += item.qty
        m[name].revenue += item.qty * item.price
      })
    })
    return m
  }, [monthSales, productMap])

  const topProducts = Object.entries(productSalesMap)
    .sort((a, b) => b[1].revenue - a[1].revenue)
    .slice(0, 5)

  // ── Employee performance ───────────────────────────────────────────
  // ✅ Fixed: was s.soldBy → s.cashier, s.qty → items sum
  const empMap = useMemo(() => {
    const m = {}
    monthSales.forEach(s => {
      const name = s.cashier || 'Unknown'
      if (!m[name]) m[name] = { qty: 0, revenue: 0, count: 0, profit: 0 }
      m[name].revenue += s.total || 0
      m[name].count   += 1
      m[name].qty     += s.items?.reduce((q, i) => q + i.qty, 0) || 0
      m[name].profit  += s.items?.reduce((s2, item) => {
        const buy = productMap[String(item.productId?._id || item.productId)]?.buyPrice || 0
        return s2 + (item.price - buy) * item.qty
      }, 0) || 0
    })
    return m
  }, [monthSales, productMap])

  const empPerformance  = Object.entries(empMap).sort((a, b) => b[1].revenue - a[1].revenue)
  const maxEmpRevenue   = Math.max(...empPerformance.map(e => e[1].revenue), 1)

  return (
    <div style={{ padding: '1.5rem', background: '#f4f6f9', minHeight: '100vh' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '8px' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: '600', color: '#333' }}>Monthly Report</h1>
          <p style={{ fontSize: '13px', color: '#888', marginTop: '2px' }}>Business performance overview</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#fff', border: '0.5px solid #ddd', borderRadius: '10px', padding: '6px 12px' }}>
          <MdChevronLeft onClick={prevMonth} style={{ fontSize: '22px', cursor: 'pointer', color: '#555' }} />
          <span style={{ fontSize: '14px', fontWeight: '500', color: '#333', minWidth: '140px', textAlign: 'center' }}>{monthName}</span>
          <MdChevronRight
            onClick={isNextDisabled ? undefined : nextMonth}
            style={{ fontSize: '22px', cursor: isNextDisabled ? 'default' : 'pointer', color: isNextDisabled ? '#ccc' : '#555' }}
          />
        </div>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: '12px', marginBottom: '1.5rem' }}>
        {[
          { label: 'Total revenue',  value: `KSh ${totalRevenue.toLocaleString()}`, icon: <MdAttachMoney />, color: '#185FA5', bg: '#E6F1FB' },
          { label: 'Total profit',   value: `KSh ${totalProfit.toLocaleString()}`,  icon: <MdTrendingUp />,  color: '#3B6D11', bg: '#EAF3DE' },
          { label: 'Items sold',     value: totalItems,                              icon: <MdInventory />,   color: '#BA7517', bg: '#FAEEDA' },
          { label: 'Transactions',   value: monthSales.length,                      icon: <MdPerson />,      color: '#533AB7', bg: '#EEEDFE' },
        ].map((card, i) => (
          <div key={i} style={{ background: '#fff', border: '0.5px solid #e0e0e0', borderLeft: `3px solid ${card.color}`, borderRadius: '12px', padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: card.bg, color: card.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', flexShrink: 0 }}>{card.icon}</div>
            <div>
              <div style={{ fontSize: '12px', color: '#888', marginBottom: '4px' }}>{card.label}</div>
              <div style={{ fontSize: '18px', fontWeight: '600', color: '#333' }}>{card.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Daily bar chart */}
      <div style={{ background: '#fff', border: '0.5px solid #e0e0e0', borderRadius: '12px', padding: '1.5rem', marginBottom: '1rem' }}>
        <h2 style={{ fontSize: '15px', fontWeight: '600', color: '#333', marginBottom: '1.25rem' }}>Daily revenue — {monthName}</h2>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', height: '140px', overflowX: 'auto', paddingBottom: '4px' }}>
          {dailyData.map((d, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', flex: '1', minWidth: '24px' }}>
              <div
                title={`Day ${d.day}: KSh ${d.revenue.toLocaleString()}`}
                style={{
                  width: '100%', borderRadius: '4px 4px 0 0',
                  background: d.revenue > 0 ? '#185FA5' : '#f0f0f0',
                  height: `${Math.max((d.revenue / maxRevenue) * 110, d.revenue > 0 ? 4 : 0)}px`,
                  transition: 'height 0.3s', cursor: 'pointer'
                }}
              />
              <span style={{ fontSize: '10px', color: '#aaa' }}>{d.day}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
        {/* Daily breakdown table */}
        <div style={{ background: '#fff', border: '0.5px solid #e0e0e0', borderRadius: '12px', padding: '1.5rem' }}>
          <h2 style={{ fontSize: '15px', fontWeight: '600', color: '#333', marginBottom: '1rem' }}>Day by day breakdown</h2>
          <div style={{ overflowY: 'auto', maxHeight: '320px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f9f9f9' }}>
                  {['Date', 'Items', 'Revenue', 'Profit'].map(h => (
                    <th key={h} style={{ fontSize: '12px', color: '#aaa', fontWeight: '500', textAlign: 'left', padding: '8px 12px', borderBottom: '0.5px solid #eee', position: 'sticky', top: 0, background: '#f9f9f9' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dailyData.filter(d => d.revenue > 0).map((d, i) => (
                  <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                    <td style={{ padding: '8px 12px', fontSize: '13px', color: '#333' }}>
                      {new Date(d.date + 'T00:00:00').toLocaleDateString('en-KE', { weekday: 'short', day: 'numeric', month: 'short' })}
                    </td>
                    <td style={{ padding: '8px 12px', fontSize: '13px', color: '#333' }}>{d.items}</td>
                    <td style={{ padding: '8px 12px', fontSize: '13px', color: '#185FA5', fontWeight: '500' }}>KSh {d.revenue.toLocaleString()}</td>
                    <td style={{ padding: '8px 12px', fontSize: '13px', color: d.profit >= 0 ? '#3B6D11' : '#A32D2D', fontWeight: '500' }}>KSh {d.profit.toLocaleString()}</td>
                  </tr>
                ))}
                {dailyData.filter(d => d.revenue > 0).length === 0 && (
                  <tr><td colSpan={4} style={{ padding: '2rem', textAlign: 'center', color: '#aaa', fontSize: '13px' }}>No sales this month.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Top 5 products */}
          <div style={{ background: '#fff', border: '0.5px solid #e0e0e0', borderRadius: '12px', padding: '1.25rem' }}>
            <h2 style={{ fontSize: '15px', fontWeight: '600', color: '#333', marginBottom: '1rem' }}>Top products</h2>
            {topProducts.length === 0 ? (
              <p style={{ fontSize: '13px', color: '#aaa', textAlign: 'center', padding: '1rem 0' }}>No sales this month.</p>
            ) : (
              topProducts.map(([name, data], i) => (
                <div key={i} style={{ marginBottom: i < topProducts.length - 1 ? '10px' : '0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '12px', color: '#333', fontWeight: '500' }}>{name}</span>
                    <span style={{ fontSize: '12px', color: '#185FA5', fontWeight: '500' }}>KSh {data.revenue.toLocaleString()}</span>
                  </div>
                  <div style={{ height: '4px', background: '#f0f0f0', borderRadius: '2px' }}>
                    <div style={{ height: '100%', borderRadius: '2px', width: `${Math.round((data.revenue / (topProducts[0][1].revenue || 1)) * 100)}%`, background: '#185FA5' }} />
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Employee performance */}
          <div style={{ background: '#fff', border: '0.5px solid #e0e0e0', borderRadius: '12px', padding: '1.25rem' }}>
            <h2 style={{ fontSize: '15px', fontWeight: '600', color: '#333', marginBottom: '1rem' }}>Employee performance</h2>
            {empPerformance.length === 0 ? (
              <p style={{ fontSize: '13px', color: '#aaa', textAlign: 'center', padding: '1rem 0' }}>No sales this month.</p>
            ) : (
              empPerformance.map(([name, data], i) => (
                <div key={i} style={{ marginBottom: i < empPerformance.length - 1 ? '12px' : '0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <div>
                      <span style={{ fontSize: '12px', color: '#333', fontWeight: '500' }}>{name}</span>
                      <span style={{ fontSize: '11px', color: '#aaa', marginLeft: '6px' }}>{data.count} sales · {data.qty} items</span>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '12px', color: '#3B6D11', fontWeight: '500' }}>KSh {data.revenue.toLocaleString()}</div>
                      <div style={{ fontSize: '11px', color: '#533AB7' }}>Profit: KSh {data.profit.toLocaleString()}</div>
                    </div>
                  </div>
                  <div style={{ height: '4px', background: '#f0f0f0', borderRadius: '2px' }}>
                    <div style={{ height: '100%', borderRadius: '2px', width: `${Math.round((data.revenue / maxEmpRevenue) * 100)}%`, background: '#3B6D11' }} />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
