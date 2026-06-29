import { useState } from 'react'
import {
  MdAttachMoney, MdTrendingUp, MdInventory, MdWarning,
  MdPointOfSale, MdBarChart, MdStorefront, MdCalendarMonth,
  MdLeaderboard, MdDownload
} from 'react-icons/md'
import { useApp } from '@/context/AppContext'
import { fmtQty } from '@/utils/utils'
import styles from '@/styles/Reports.module.css'
import * as XLSX from 'xlsx'
import MonthlyReport from './MonthlyReport'

const TABS = [
  { id: 'summary', label: 'Product Summary', icon: <MdLeaderboard /> },
  { id: 'monthly', label: 'Monthly Report', icon: <MdCalendarMonth /> },
]

const XL_PRIMARY = '185FA5'
const XL_PRIMARY_DARK = '0C447C'
const XL_PRIMARY_LIGHT = 'E6F1FB'

export default function Reports() {
  const { products, sales: allSales, currentUser, isOwner, stores } = useApp()

  const categories = ['All', ...Array.from(new Set(products.map(p => p.category).filter(Boolean))).sort()]
  const [category, setCategory] = useState('All')
  const [sortBy, setSortBy] = useState('profit')
  const [selectedStore, setSelectedStore] = useState(isOwner ? 'All' : currentUser.store)
  const [activeTab, setActiveTab] = useState('summary')

  const sales = (() => {
    if (isOwner && selectedStore === 'All') return allSales
    if (isOwner) return allSales.filter(s => s.store === selectedStore)
    return allSales.filter(s => s.store === currentUser.store)
  })()

  // ── Exclude both returned and voided sales from all calculations ──
  const activeSales = sales.filter(s => !s.returned && !s.voided)

  const activeQtyR = (item) => {
    if (item.voidStatus === 'voided') return 0
    return Math.max(0, (item.qty || 0) - (item.voidedQty || 0) - (item.returnedQty || 0))
  }

  const productPerformance = products.map(product => {
    let qtySold = 0, totalRevenue = 0
    activeSales.forEach(sale => {
      sale.items?.forEach(item => {
        const id = item.productId?._id || item.productId
        if (String(id) !== String(product._id)) return
        if (item.voidStatus === 'voided') return
        const qty = activeQtyR(item)
        qtySold += qty
        totalRevenue += qty * item.price
      })
    })
    const totalCost = qtySold * (product.buyPrice || 0)
    return { ...product, qtySold, totalRevenue, totalCost, profit: totalRevenue - totalCost }
  })

  const filtered = productPerformance
    .filter(p => category === 'All' || p.category === category)
    .sort((a, b) =>
      sortBy === 'profit' ? b.profit - a.profit :
        sortBy === 'revenue' ? b.totalRevenue - a.totalRevenue :
          sortBy === 'qty' ? b.qtySold - a.qtySold : 0
    )

  const totalRevenue = activeSales.reduce((sum, sale) => {
    return sum + (sale.items?.reduce((rv, item) => {
      if (item.voidStatus === 'voided') return rv
      return rv + (item.price || 0) * activeQtyR(item)
    }, 0) || 0)
  }, 0)
  const totalCost = productPerformance.reduce((s, p) => s + p.totalCost, 0)
  const totalProfit = totalRevenue - totalCost
  const totalStockValue = products.reduce((s, p) => s + (p.stock || 0) * (p.buyPrice || 0), 0)
  const lowStockCount = products.filter(p => p.stock <= 5).length
  const profitMargin = totalRevenue > 0 ? Math.round((totalProfit / totalRevenue) * 100) : 0

  const categoryTotals = categories.filter(c => c !== 'All').map(cat => {
    const items = productPerformance.filter(p => p.category === cat)
    return {
      name: cat,
      revenue: items.reduce((s, p) => s + p.totalRevenue, 0),
      profit: items.reduce((s, p) => s + p.profit, 0),
    }
  }).sort((a, b) => b.profit - a.profit)

  const maxCatProfit = Math.max(...categoryTotals.map(c => c.profit), 1)
  const maxProfit = Math.max(...filtered.map(p => p.profit), 1)

  // ── XLSX Export ────────────────────────────────────────────────────
  const handleDownloadCSV = () => {
    const fmt = n => Number(n).toLocaleString('en-KE')
    const ws = {}, merges = []
    let r = 0

    const sc = (row, col, value, style) => {
      const addr = XLSX.utils.encode_cell({ r: row, c: col })
      ws[addr] = { v: value, t: typeof value === 'number' ? 'n' : 's', s: style }
    }
    const mc = (row, from, to) => merges.push({ s: { r: row, c: from }, e: { r: row, c: to } })

    const titleStyle = { font: { bold: true, sz: 14, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: XL_PRIMARY } }, alignment: { horizontal: 'left' } }
    const metaStyle = { font: { bold: false, sz: 11, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: XL_PRIMARY } }, alignment: { horizontal: 'left' } }
    const secStyle = { font: { bold: true, sz: 11, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: XL_PRIMARY_DARK } }, alignment: { horizontal: 'left' } }
    const hdrStyle = { font: { bold: true, sz: 10, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '2D7DD2' } }, alignment: { horizontal: 'center' }, border: { top: { style: 'thin', color: { rgb: 'FFFFFF' } }, bottom: { style: 'thin', color: { rgb: 'FFFFFF' } }, left: { style: 'thin', color: { rgb: 'FFFFFF' } }, right: { style: 'thin', color: { rgb: 'FFFFFF' } } } }
    const totStyle = { font: { bold: true, sz: 10, color: { rgb: XL_PRIMARY_DARK } }, fill: { fgColor: { rgb: XL_PRIMARY_LIGHT } }, alignment: { horizontal: 'center' }, border: { top: { style: 'medium', color: { rgb: '2D7DD2' } }, bottom: { style: 'medium', color: { rgb: '2D7DD2' } }, left: { style: 'thin', color: { rgb: 'CCE0F5' } }, right: { style: 'thin', color: { rgb: 'CCE0F5' } } } }
    const cel = (i) => ({ font: { sz: 10, color: { rgb: '333333' } }, fill: { fgColor: { rgb: i % 2 === 0 ? 'FFFFFF' : 'F0F6FD' } }, alignment: { horizontal: 'center' }, border: { top: { style: 'thin', color: { rgb: 'E0E0E0' } }, bottom: { style: 'thin', color: { rgb: 'E0E0E0' } }, left: { style: 'thin', color: { rgb: 'E0E0E0' } }, right: { style: 'thin', color: { rgb: 'E0E0E0' } } } })
    const lft = (i) => ({ ...cel(i), alignment: { horizontal: 'left' } })
    const grn = (i) => ({ ...cel(i), font: { sz: 10, color: { rgb: '2E7D32' }, bold: true } })
    const red = (i) => ({ ...cel(i), font: { sz: 10, color: { rgb: 'C62828' }, bold: true } })
    const kvL = { font: { bold: true, sz: 10, color: { rgb: '555555' } }, fill: { fgColor: { rgb: 'F8FAFB' } }, alignment: { horizontal: 'left' }, border: { top: { style: 'thin', color: { rgb: 'E0E0E0' } }, bottom: { style: 'thin', color: { rgb: 'E0E0E0' } }, left: { style: 'thin', color: { rgb: 'E0E0E0' } }, right: { style: 'thin', color: { rgb: 'E0E0E0' } } } }
    const kvV = { font: { bold: true, sz: 11, color: { rgb: XL_PRIMARY } }, fill: { fgColor: { rgb: XL_PRIMARY_LIGHT } }, alignment: { horizontal: 'right' }, border: { top: { style: 'thin', color: { rgb: 'E0E0E0' } }, bottom: { style: 'thin', color: { rgb: 'E0E0E0' } }, left: { style: 'thin', color: { rgb: 'E0E0E0' } }, right: { style: 'thin', color: { rgb: 'E0E0E0' } } } }

    const COLS = 8

    sc(r, 0, 'PRODUCT PERFORMANCE REPORT', titleStyle); mc(r, 0, COLS - 1); r++
    sc(r, 0, `Branch: ${selectedStore}`, metaStyle); mc(r, 0, COLS - 1); r++
    sc(r, 0, `Filter: ${category} | Sort: ${sortBy.charAt(0).toUpperCase() + sortBy.slice(1)}`, metaStyle); mc(r, 0, COLS - 1); r++
    sc(r, 0, `Generated: ${new Date().toLocaleDateString('en-KE', { day: '2-digit', month: 'long', year: 'numeric' })}`, { ...metaStyle, font: { sz: 10, color: { rgb: 'CCE0F5' } } }); mc(r, 0, COLS - 1); r++
    r++

    sc(r, 0, 'SUMMARY', secStyle); mc(r, 0, COLS - 1); r++
    const kpis = [
      ['Total Revenue', `KSh ${fmt(totalRevenue)}`, 'Total Cost', `KSh ${fmt(totalCost)}`],
      ['Total Profit', `KSh ${fmt(totalProfit)}`, 'Profit Margin', `${profitMargin}%`],
      ['Stock Value', `KSh ${fmt(totalStockValue)}`, 'Low Stock Items', String(lowStockCount)],
    ]
    kpis.forEach(([l1, v1, l2, v2]) => {
      sc(r, 0, l1, kvL); sc(r, 1, v1, kvV)
      sc(r, 2, '', { fill: { fgColor: { rgb: 'FFFFFF' } } }); sc(r, 3, '', { fill: { fgColor: { rgb: 'FFFFFF' } } })
      sc(r, 4, l2, kvL); sc(r, 5, v2, kvV)
      sc(r, 6, '', { fill: { fgColor: { rgb: 'FFFFFF' } } }); sc(r, 7, '', { fill: { fgColor: { rgb: 'FFFFFF' } } })
      r++
    })
    r++

    sc(r, 0, 'CATEGORY BREAKDOWN', secStyle); mc(r, 0, COLS - 1); r++
      ;['Category', 'Revenue (KSh)', 'Profit (KSh)', 'Margin %', '', '', '', ''].forEach((h, c) => sc(r, c, h, h ? hdrStyle : { fill: { fgColor: { rgb: '2D7DD2' } } })); r++
    categoryTotals.forEach((cat, i) => {
      const margin = cat.revenue > 0 ? ((cat.profit / cat.revenue) * 100).toFixed(1) + '%' : '0.0%'
      sc(r, 0, cat.name, lft(i)); sc(r, 1, cat.revenue, cel(i)); sc(r, 2, cat.profit, grn(i)); sc(r, 3, margin, cel(i))
      for (let c = 4; c < COLS; c++) sc(r, c, '', cel(i))
      r++
    })
    r++

    sc(r, 0, `PRODUCT PERFORMANCE${category !== 'All' ? ' — ' + category : ''}`, secStyle); mc(r, 0, COLS - 1); r++
      ;['#', 'Product', 'Category', 'Qty Sold', 'Revenue (KSh)', 'Cost (KSh)', 'Profit (KSh)', 'Margin %'].forEach((h, c) => sc(r, c, h, hdrStyle)); r++
    filtered.forEach((p, i) => {
      const margin = p.totalRevenue > 0 ? ((p.profit / p.totalRevenue) * 100).toFixed(1) + '%' : '0.0%'
      sc(r, 0, i + 1, cel(i)); sc(r, 1, p.name, lft(i)); sc(r, 2, p.category, lft(i)); sc(r, 3, p.qtySold, cel(i))
      sc(r, 4, p.totalRevenue, cel(i)); sc(r, 5, p.totalCost, cel(i))
      sc(r, 6, p.profit, p.profit >= 0 ? grn(i) : red(i)); sc(r, 7, margin, cel(i))
      r++
    })
    sc(r, 0, 'TOTAL', totStyle); sc(r, 1, '', totStyle); sc(r, 2, '', totStyle)
    sc(r, 3, filtered.reduce((s, p) => s + p.qtySold, 0), totStyle)
    sc(r, 4, filtered.reduce((s, p) => s + p.totalRevenue, 0), totStyle)
    sc(r, 5, filtered.reduce((s, p) => s + p.totalCost, 0), totStyle)
    sc(r, 6, filtered.reduce((s, p) => s + p.profit, 0), { ...totStyle, font: { bold: true, sz: 10, color: { rgb: '2E7D32' } } })
    const tRev = filtered.reduce((s, p) => s + p.totalRevenue, 0)
    const tPro = filtered.reduce((s, p) => s + p.profit, 0)
    sc(r, 7, tRev > 0 ? ((tPro / tRev) * 100).toFixed(1) + '%' : '0%', totStyle)
    r++

    ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r, c: COLS - 1 } })
    ws['!merges'] = merges
    ws['!cols'] = [{ wch: 6 }, { wch: 26 }, { wch: 16 }, { wch: 12 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 11 }]
    ws['!rows'] = Array.from({ length: r }, (_, i) => ({ hpt: i < 4 ? 22 : 18 }))

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Product Summary')
    XLSX.writeFile(wb, `product-summary-${selectedStore.replace(/\s+/g, '-')}-${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  return (
    <div className="flex flex-col min-h-full md:h-full md:overflow-hidden" style={{ background: 'var(--bg-page)' }}>

      <div className="flex-shrink-0 px-6 pt-6 pb-2">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
          <div>
            <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Business Reports</h1>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
              {isOwner ? `Viewing analytics for: ${selectedStore}` : `Performance for ${currentUser.store}`}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {isOwner && activeTab === 'summary' && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl transition-all"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--primary-muted)', boxShadow: 'var(--shadow-card)' }}>
                <MdStorefront style={{ color: 'var(--primary)', fontSize: '18px' }} />
                <span className="text-xs font-bold uppercase tracking-wider hidden sm:inline" style={{ color: 'var(--text-muted)' }}>Branch:</span>
                <select value={selectedStore} onChange={e => setSelectedStore(e.target.value)}
                  className="bg-transparent text-sm font-semibold outline-none cursor-pointer" style={{ color: 'var(--text-primary)' }}>
                  <option value="All">✨ All Locations</option>
                  {stores?.map(st => <option key={st._id} value={st.name}>📍 {st.name}</option>)}
                </select>
              </div>
            )}
            {activeTab === 'summary' && (
              <button onClick={handleDownloadCSV}
                className="flex items-center gap-2 text-xs font-bold px-4 py-2 rounded-xl text-white transition-all"
                style={{ background: 'var(--primary)' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--primary-dark)'}
                onMouseLeave={e => e.currentTarget.style.background = 'var(--primary)'}>
                <MdDownload className="text-base" /> Download Excel
              </button>
            )}
          </div>
        </div>

        <div className="flex gap-1 p-1 rounded-xl w-fit mb-2"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-soft)', boxShadow: 'var(--shadow-card)' }}>
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
              style={activeTab === tab.id
                ? { background: 'var(--primary)', color: '#fff' }
                : { background: 'transparent', color: 'var(--text-muted)' }
              }
              onMouseEnter={e => { if (activeTab !== tab.id) e.currentTarget.style.background = 'var(--bg-muted)' }}
              onMouseLeave={e => { if (activeTab !== tab.id) e.currentTarget.style.background = 'transparent' }}
            >
              <span>{tab.icon}</span>{tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="md:flex-1 md:overflow-y-auto px-6 pb-6">
        {activeTab === 'summary' && (
          <div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
              {[
                { label: 'Total Revenue', value: `KSh ${totalRevenue.toLocaleString()}`, icon: <MdAttachMoney />, color: 'blue' },
                { label: 'Total Profit', value: `KSh ${totalProfit.toLocaleString()}`, icon: <MdTrendingUp />, color: 'green' },
                { label: 'Profit Margin', value: `${profitMargin}%`, icon: <MdBarChart />, color: 'yellow' },
                { label: 'Stock Value', value: `KSh ${totalStockValue.toLocaleString()}`, icon: <MdInventory />, color: 'purple' },
                { label: 'Total Cost', value: `KSh ${totalCost.toLocaleString()}`, icon: <MdPointOfSale />, color: 'indigo' },
                { label: 'Low Stock Items', value: lowStockCount, icon: <MdWarning />, color: 'red' },
              ].map((card, i) => (
                <div key={i} className={`${styles.card} ${styles[`card-${card.color}`]}`}>
                  <div className={`${styles.icon} ${styles[`icon-${card.color}`]}`}>{card.icon}</div>
                  <div>
                    <div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>{card.label}</div>
                    <div className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{card.value}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-xl p-5 mb-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-soft)', boxShadow: 'var(--shadow-card)' }}>
              <h2 className="text-sm font-bold mb-4" style={{ color: 'var(--text-primary)' }}>Profit by Category</h2>
              <div className="flex flex-col gap-4">
                {categoryTotals.map((cat, i) => (
                  <div key={i}>
                    <div className="flex justify-between mb-1 flex-wrap gap-2">
                      <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{cat.name}</span>
                      <div className="flex gap-4">
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Revenue: KSh {cat.revenue.toLocaleString()}</span>
                        <span className="text-sm font-semibold" style={{ color: 'var(--success-dark)' }}>Profit: KSh {cat.profit.toLocaleString()}</span>
                      </div>
                    </div>
                    <div className="h-2 rounded overflow-hidden" style={{ background: 'var(--bg-muted)' }}>
                      <div className="h-full rounded transition-all duration-500"
                        style={{ width: `${Math.round((cat.profit / maxCatProfit) * 100)}%`, background: 'var(--primary)' }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl p-5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-soft)', boxShadow: 'var(--shadow-card)' }}>
              <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
                <h2 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Product Performance</h2>
                <div className="flex gap-2 flex-wrap">
                  {categories.map(cat => (
                    <button key={cat} onClick={() => setCategory(cat)}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium transition"
                      style={category === cat
                        ? { background: 'var(--primary)', color: '#fff', border: '1px solid var(--primary)' }
                        : { background: 'var(--bg-card)', color: 'var(--text-secondary)', border: '1px solid var(--border-medium)' }
                      }>
                      {cat}
                    </button>
                  ))}
                  <select value={sortBy} onChange={e => setSortBy(e.target.value)}
                    className="px-2 py-1.5 rounded-lg text-xs outline-none"
                    style={{ border: '1px solid var(--border-medium)', background: 'var(--bg-card)', color: 'var(--text-secondary)' }}>
                    <option value="profit">Sort by Profit</option>
                    <option value="revenue">Sort by Revenue</option>
                    <option value="qty">Sort by Qty Sold</option>
                  </select>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse" style={{ minWidth: '600px' }}>
                  <thead>
                    <tr style={{ background: 'var(--sidebar-bg)' }}>
                      {['#', 'Product', 'Category', 'Qty Sold', 'Revenue', 'Cost', 'Profit', 'Margin', ''].map(h => (
                        <th key={h} className="text-left text-[10px] font-black uppercase tracking-widest text-white px-4 py-2">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((p, i) => {
                      const margin = p.totalRevenue > 0 ? Math.round((p.profit / p.totalRevenue) * 100) : 0
                      const barWidth = Math.max(0, Math.round((p.profit / maxProfit) * 100))
                      return (
                        <tr key={p._id} className={styles.rowHover}
                          style={{ background: i % 2 === 0 ? 'transparent' : 'var(--bg-muted)', borderBottom: '1px solid var(--border-soft)' }}>
                          <td className={styles.td}>{i + 1}</td>
                          <td className={styles.td} style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{p.name}</td>
                          <td className={styles.td}>{p.category}</td>
                          <td className={styles.td}>{fmtQty(p.qtySold)}</td>
                          <td className={styles.td}>KSh {p.totalRevenue.toLocaleString()}</td>
                          <td className={styles.td}>KSh {p.totalCost.toLocaleString()}</td>
                          <td className={styles.td} style={{ fontWeight: '600', color: p.profit >= 0 ? 'var(--success-dark)' : 'var(--danger)' }}>
                            KSh {p.profit.toLocaleString()}
                          </td>
                          <td className={styles.td}>{margin}%</td>
                          <td className={styles.td} style={{ width: '80px' }}>
                            <div className="h-1 rounded" style={{ background: 'var(--bg-muted)' }}>
                              <div className="h-full rounded transition-all duration-500" style={{ width: `${barWidth}%`, background: 'var(--primary)' }} />
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
        )}

        {activeTab === 'monthly' && <MonthlyReport />}
      </div>
    </div>
  )
}
