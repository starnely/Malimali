import SaleCard from './SaleCard'
import { fmtQty } from '@/utils/utils'

const DAY_COLORS = [
  { bg: 'var(--primary-light)', border: 'var(--primary-muted)', header: 'var(--primary-light)', text: 'var(--badge-primary-text)' }, // Sun
  { bg: 'var(--success-light)', border: 'var(--success)', header: 'var(--success-light)', text: 'var(--badge-success-text)' }, // Mon
  { bg: 'var(--info-light)', border: 'var(--info)', header: 'var(--info-light)', text: 'var(--badge-info-text)' }, // Tue
  { bg: 'var(--warning-light)', border: 'var(--warning)', header: 'var(--warning-light)', text: 'var(--badge-warning-text)' }, // Wed
  { bg: 'var(--danger-light)', border: 'var(--danger)', header: 'var(--danger-light)', text: 'var(--badge-danger-text)' }, // Thu
  { bg: 'var(--primary-light)', border: 'var(--primary)', header: 'var(--primary-light)', text: 'var(--badge-primary-text)' }, // Fri
  { bg: 'var(--success-light)', border: 'var(--success-dark)', header: 'var(--success-light)', text: 'var(--badge-success-text)' }, // Sat
]

function getColorForDate(date) {
  const day = new Date(date + 'T00:00:00').getDay()
  return DAY_COLORS[day]
}

export default function DateGroup({ date, sales, isOwner, setReturnModal, setVoidModal, category }) {
  const color = getColorForDate(date)

  const dateTotal = sales.reduce((sum, s) => {
    if (s.voided) return sum
    const itemSum = s.items
      ?.filter(item => category === 'All' || item.productId?.category === category)
      .reduce((iSum, i) => {
        if (i.voidStatus === 'voided') return iSum
        const qty = Math.max(0, (i.qty || 0) - (i.voidedQty || 0) - (i.returnedQty || 0))
        return iSum + (i.price * qty)
      }, 0)
    return sum + itemSum
  }, 0)

  const dayQty = sales.reduce((sum, s) => {
    if (s.voided) return sum
    const itemQty = s.items
      ?.filter(item => category === 'All' || item.productId?.category === category)
      .reduce((q, i) => {
        if (i.voidStatus === 'voided') return q
        const qty = Math.max(0, (i.qty || 0) - (i.voidedQty || 0) - (i.returnedQty || 0))
        return q + qty
      }, 0)
    return sum + itemQty
  }, 0)

  return (
    <div
      className="mb-4 rounded-xl overflow-hidden"
      style={{ border: `1px solid ${color.border}` }}
    >
      {/* Date header */}
      <div
        className="px-4 py-2.5 flex justify-between items-center"
        style={{ background: color.header }}
      >
        <span className="text-sm font-bold" style={{ color: color.text }}>
          {new Date(date + 'T00:00:00').toLocaleDateString('en-KE', {
            weekday: 'long', year: 'numeric', month: 'short', day: 'numeric'
          })}
        </span>
        <div className="flex items-center gap-4">
          <span className="text-xs font-semibold" style={{ color: color.text, opacity: 0.7 }}>
            {fmtQty(dayQty)} items
          </span>
          <span className="text-sm font-black" style={{ color: color.text }}>
            KSh {dateTotal.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Sales list */}
      <div style={{ background: color.bg }}>
        {sales
          .sort((a, b) => new Date(b.date) - new Date(a.date))
          .map(sale => (
            <SaleCard
              key={sale._id}
              sale={sale}
              onReturn={() => setReturnModal(sale)}
              onVoid={setVoidModal ? () => setVoidModal(sale) : undefined}
              isOwner={isOwner}
              category={category}
            />
          ))}
      </div>
    </div>
  )
}
