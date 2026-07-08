import { MdAttachMoney, MdInventory, MdReceipt } from 'react-icons/md'
import { fmtQty } from '@/utils/utils'

export default function SalesStats({ isOwner, filtered, category, currency = 'KSh' }) {

  // Exclude voided sales from all calculations
  const activeFiltered = filtered.filter(sale => !sale.voided)

  const totalRevenue = activeFiltered.reduce((sum, sale) => {
    const taxFactor = sale.taxRate > 0 ? 1 / (1 + sale.taxRate) : 1
    const itemRevenue = sale.items
      ?.filter(item => category === 'All' || item.productId?.category === category)
      .reduce((itemSum, item) => {
        if (item.voidStatus === 'voided') return itemSum
        const qty = Math.max(0, (item.qty || 0) - (item.voidedQty || 0) - (item.returnedQty || 0))
        return itemSum + (item.price * qty)
      }, 0) || 0
    return sum + itemRevenue * taxFactor
  }, 0)

  const totalItemsSold = activeFiltered.reduce((sum, sale) => {
    const itemCount = sale.items
      ?.filter(item => category === 'All' || item.productId?.category === category)
      .reduce((itemSum, item) => {
        if (item.voidStatus === 'voided') return itemSum
        const qty = Math.max(0, (item.qty || 0) - (item.voidedQty || 0) - (item.returnedQty || 0))
        return itemSum + qty
      }, 0) || 0
    return sum + itemCount
  }, 0)

  const transactionCount = activeFiltered.filter(sale =>
    sale.items?.some(item => {
      const matchCat = category === 'All' || item.productId?.category === category
      if (!matchCat || item.voidStatus === 'voided') return false
      const qty = Math.max(0, (item.qty || 0) - (item.voidedQty || 0) - (item.returnedQty || 0))
      return qty > 0
    })
  ).length
  const cards = [
    {
      label: isOwner ? 'Total Revenue' : 'Your Revenue (30 days)',
      value: `${currency} ${Math.round(totalRevenue).toLocaleString()}`,
      icon: <MdAttachMoney />,
      color: 'var(--primary)',
      bg: 'var(--primary-light)',
    },
    {
      label: 'Transactions',
      value: transactionCount,
      icon: <MdReceipt />,
      color: 'var(--badge-success-text)',
      bg: 'var(--success-light)',
    },
    {
      label: 'Items Sold',
      value: fmtQty(totalItemsSold),
      icon: <MdInventory />,
      color: 'var(--badge-warning-text)',
      bg: 'var(--warning-light)',
    },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3 mb-3">
      {cards.map((card, i) => (
        <div
          key={i}
          className="rounded-xl p-3 flex items-center gap-3"
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-soft)',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center text-xl flex-shrink-0"
            style={{ background: card.bg, color: card.color }}
          >
            {card.icon}
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
              {card.label}
            </div>
            <div className="text-base font-bold mt-0.5" style={{ color: 'var(--text-primary)' }}>
              {card.value}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
