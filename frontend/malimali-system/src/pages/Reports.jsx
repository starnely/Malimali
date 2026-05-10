import { useState, useEffect } from 'react'
import { MdAttachMoney, MdTrendingUp, MdInventory, MdWarning, MdPointOfSale, MdBarChart } from 'react-icons/md'
import { useApp } from '@/context/AppContext'
import styles from '@/styles/Reports.module.css'

const categories = ['All', 'Furniture', 'Bedding', 'Utensils', 'Cleaning']

export default function Reports() {
  const { products, sales, fetchSales } = useApp()
  const [category, setCategory] = useState('All')
  const [sortBy, setSortBy] = useState('profit')

  // ✅ Refresh sales when Reports mounts so data is always current
  useEffect(() => { fetchSales() }, [])

  const activeSales = sales.filter(s => !s.returned)

  // ✅ Fixed: was matching by s.name === product.name (wrong — sales don't have .name)
  // Now correctly aggregates from items[].productId which is populated from backend
  const productPerformance = products.map(product => {
    let qtySold = 0
    let totalRevenue = 0

    activeSales.forEach(sale => {
      sale.items?.forEach(item => {
        // item.productId is populated object from backend: { _id, name, category }
        const itemProductId = item.productId?._id || item.productId
        if (String(itemProductId) === String(product._id)) {
          qtySold += item.qty
          totalRevenue += item.qty * item.price
        }
      })
    })

    const totalCost = qtySold * (product.buyPrice || 0)
    const profit = totalRevenue - totalCost
    return { ...product, qtySold, totalRevenue, totalCost, profit }
  })

  const filtered = productPerformance
    .filter(p => category === 'All' || p.category === category)
    .sort((a, b) => {
      if (sortBy === 'profit')   return b.profit - a.profit
      if (sortBy === 'revenue')  return b.totalRevenue - a.totalRevenue
      if (sortBy === 'qty')      return b.qtySold - a.qtySold
      return 0
    })

  const totalRevenue      = activeSales.reduce((s, sale) => s + (sale.total || 0), 0)
  const totalCost         = productPerformance.reduce((s, p) => s + p.totalCost, 0)
  const totalProfit       = totalRevenue - totalCost
  const totalStockValue   = products.reduce((s, p) => s + (p.stock || 0) * (p.buyPrice || 0), 0)
  const lowStockCount     = products.filter(p => p.stock <= 5).length
  const profitMargin      = totalRevenue > 0 ? Math.round((totalProfit / totalRevenue) * 100) : 0

  const categoryTotals = categories
    .filter(c => c !== 'All')
    .map(cat => {
      const items = productPerformance.filter(p => p.category === cat)
      return {
        name: cat,
        revenue: items.reduce((s, p) => s + p.totalRevenue, 0),
        profit:  items.reduce((s, p) => s + p.profit, 0),
      }
    })
    .sort((a, b) => b.profit - a.profit)

  const maxCatProfit = Math.max(...categoryTotals.map(c => c.profit), 1)
  const maxProfit    = Math.max(...filtered.map(p => p.profit), 1)

  return (
    <div className="p-6 bg-gray-100 min-h-screen animate-fadeIn">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-800">Reports</h1>
        <p className="text-sm text-gray-500 mt-1">Full business performance summary</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Total revenue',    value: `KSh ${totalRevenue.toLocaleString()}`,    icon: <MdAttachMoney />, color: 'blue'   },
          { label: 'Total profit',     value: `KSh ${totalProfit.toLocaleString()}`,     icon: <MdTrendingUp />,  color: 'green'  },
          { label: 'Profit margin',    value: `${profitMargin}%`,                        icon: <MdBarChart />,    color: 'yellow' },
          { label: 'Stock value',      value: `KSh ${totalStockValue.toLocaleString()}`, icon: <MdInventory />,   color: 'purple' },
          { label: 'Total cost',       value: `KSh ${totalCost.toLocaleString()}`,       icon: <MdPointOfSale />, color: 'indigo' },
          { label: 'Low stock items',  value: lowStockCount,                             icon: <MdWarning />,     color: 'red'    },
        ].map((card, i) => (
          <div key={i} className={`${styles.card} ${styles[`card-${card.color}`]} animate-slideUp`}>
            <div className={`${styles.icon} ${styles[`icon-${card.color}`]}`}>{card.icon}</div>
            <div>
              <div className="text-xs text-gray-500 mb-1">{card.label}</div>
              <div className="text-lg font-semibold text-gray-800">{card.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Category performance */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 mb-4 animate-slideUp">
        <h2 className="text-sm font-semibold text-gray-800 mb-5">Profit by category</h2>
        <div className="flex flex-col gap-4">
          {categoryTotals.map((cat, i) => (
            <div key={i}>
              <div className="flex justify-between mb-1 flex-wrap gap-2">
                <span className="text-sm font-medium text-gray-800">{cat.name}</span>
                <div className="flex gap-4">
                  <span className="text-xs text-gray-500">Revenue: KSh {cat.revenue.toLocaleString()}</span>
                  <span className="text-sm font-medium text-green-700">Profit: KSh {cat.profit.toLocaleString()}</span>
                </div>
              </div>
              <div className="h-2 bg-gray-200 rounded overflow-hidden">
                <div
                  className="h-full rounded bg-blue-700 transition-all duration-500"
                  style={{ width: `${Math.round((cat.profit / maxCatProfit) * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Product performance */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 animate-slideUp">
        <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
          <h2 className="text-sm font-semibold text-gray-800">Product performance</h2>
          <div className="flex gap-2 flex-wrap">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={`px-3 py-1.5 rounded-md text-xs border border-gray-300 transition ${
                  category === cat ? 'bg-blue-700 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'
                }`}
              >
                {cat}
              </button>
            ))}
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
              className="px-2 py-1.5 border border-gray-300 rounded-md text-xs bg-white text-gray-600 outline-none"
            >
              <option value="profit">Sort by Profit</option>
              <option value="revenue">Sort by Revenue</option>
              <option value="qty">Sort by Qty Sold</option>
            </select>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse min-w-[600px]">
            <thead>
              <tr className="bg-gray-50">
                {['#', 'Product', 'Category', 'Qty Sold', 'Revenue', 'Cost', 'Profit', 'Margin', ''].map(h => (
                  <th key={h} className="text-xs text-gray-400 font-medium text-left px-4 py-2 border-b border-gray-200">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((p, i) => {
                const margin   = p.totalRevenue > 0 ? Math.round((p.profit / p.totalRevenue) * 100) : 0
                const barWidth = Math.max(0, Math.round((p.profit / maxProfit) * 100))
                return (
                  <tr key={p._id} className={`${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'} ${styles.rowHover} animate-fadeIn`}>
                    <td className={styles.td}>{i + 1}</td>
                    <td className={`${styles.td} font-medium text-gray-800`}>{p.name}</td>
                    <td className={`${styles.td} text-gray-500`}>{p.category}</td>
                    <td className={styles.td}>{p.qtySold}</td>
                    <td className={styles.td}>KSh {p.totalRevenue.toLocaleString()}</td>
                    <td className={`${styles.td} text-gray-500`}>KSh {p.totalCost.toLocaleString()}</td>
                    <td className={`${styles.td} font-semibold ${p.profit >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                      KSh {p.profit.toLocaleString()}
                    </td>
                    <td className={styles.td}>{margin}%</td>
                    <td className={`${styles.td} w-20`}>
                      <div className="h-1 bg-gray-200 rounded">
                        <div className="h-full rounded bg-blue-700 transition-all duration-500" style={{ width: `${barWidth}%` }} />
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
