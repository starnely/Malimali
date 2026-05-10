import { MdClose, MdPerson } from 'react-icons/md'

export default function EmployeeSalesModal({ employee, sales, products = [], date, onClose }) {
  // ✅ Fixed: was s.soldBy → s.cashier, s.date === date → startsWith
  const employeeSales = sales.filter(s =>
    s.cashier === employee &&
    s.date?.startsWith(date) &&
    !s.returned
  )

  // ✅ Fixed: was s.qty (doesn't exist) → sum items array
  const totalItems = employeeSales.reduce((sum, s) =>
    sum + (s.items?.reduce((q, i) => q + i.qty, 0) || 0), 0)

  const totalRevenue = employeeSales.reduce((sum, s) => sum + (s.total || 0), 0)

  // ✅ Profit calculated from buyPrice
  const productMap = {}
  products.forEach(p => { productMap[String(p._id)] = p.buyPrice || 0 })
  const totalProfit = employeeSales.reduce((sum, sale) =>
    sum + (sale.items?.reduce((s2, item) => {
      const buy  = productMap[String(item.productId?._id || item.productId)] || 0
      return s2 + (item.price - buy) * item.qty
    }, 0) || 0), 0)

  const displayDate = new Date(date + 'T00:00:00').toLocaleDateString('en-KE', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  })

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.45)',
      display: 'flex', alignItems: 'center',
      justifyContent: 'center', zIndex: 1000, padding: '1rem'
    }}>
      <div style={{
        background: '#fff', borderRadius: '12px',
        width: '100%', maxWidth: '640px',
        maxHeight: '85vh', overflow: 'hidden',
        display: 'flex', flexDirection: 'column'
      }}>
        {/* Header */}
        <div style={{
          padding: '1.25rem 1.5rem',
          borderBottom: '0.5px solid #eee',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '36px', height: '36px', borderRadius: '50%',
              background: '#E6F1FB', display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <MdPerson style={{ color: '#185FA5', fontSize: '20px' }} />
            </div>
            <div>
              <div style={{ fontSize: '15px', fontWeight: '600', color: '#333' }}>{employee}</div>
              <div style={{ fontSize: '12px', color: '#888' }}>{displayDate}</div>
            </div>
          </div>
          <MdClose onClick={onClose} style={{ fontSize: '22px', color: '#aaa', cursor: 'pointer' }} />
        </div>

        {/* Summary */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '12px', padding: '1rem 1.5rem',
          borderBottom: '0.5px solid #eee'
        }}>
          {[
            { label: 'Transactions', value: employeeSales.length,              color: '#185FA5', bg: '#E6F1FB' },
            { label: 'Items sold',   value: totalItems,                         color: '#3B6D11', bg: '#EAF3DE' },
            { label: 'Revenue',      value: `KSh ${totalRevenue.toLocaleString()}`, color: '#BA7517', bg: '#FAEEDA' },
            { label: 'Profit',       value: `KSh ${totalProfit.toLocaleString()}`,  color: '#533AB7', bg: '#EEEDFE' },
          ].map((card, i) => (
            <div key={i} style={{ background: card.bg, borderRadius: '8px', padding: '10px 12px', textAlign: 'center' }}>
              <div style={{ fontSize: '11px', color: card.color, marginBottom: '4px' }}>{card.label}</div>
              <div style={{ fontSize: '15px', fontWeight: '600', color: card.color }}>{card.value}</div>
            </div>
          ))}
        </div>

        {/* Sales list */}
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {employeeSales.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: '#aaa', fontSize: '14px' }}>
              No sales recorded for this date.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f9f9f9', position: 'sticky', top: 0 }}>
                  {['#', 'Receipt', 'Items', 'Revenue', 'Profit', 'Time'].map(h => (
                    <th key={h} style={{
                      fontSize: '12px', color: '#aaa', fontWeight: '500',
                      textAlign: 'left', padding: '10px 16px',
                      borderBottom: '0.5px solid #eee'
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {employeeSales.map((sale, i) => {
                  const saleItems = sale.items?.reduce((q, it) => q + it.qty, 0) || 0
                  const saleProfit = sale.items?.reduce((s2, item) => {
                    const buy = productMap[String(item.productId?._id || item.productId)] || 0
                    return s2 + (item.price - buy) * item.qty
                  }, 0) || 0
                  return (
                    <tr key={sale._id} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                      <td style={{ padding: '10px 16px', fontSize: '13px', color: '#aaa' }}>{i + 1}</td>
                      <td style={{ padding: '10px 16px', fontSize: '12px', color: '#185FA5', fontWeight: '600' }}>
                        {sale.receiptId || '—'}
                      </td>
                      <td style={{ padding: '10px 16px', fontSize: '13px', color: '#333' }}>{saleItems}</td>
                      <td style={{ padding: '10px 16px', fontSize: '13px', color: '#185FA5', fontWeight: '500' }}>
                        KSh {(sale.total || 0).toLocaleString()}
                      </td>
                      <td style={{ padding: '10px 16px', fontSize: '13px', color: '#3B6D11', fontWeight: '500' }}>
                        KSh {saleProfit.toLocaleString()}
                      </td>
                      <td style={{ padding: '10px 16px', fontSize: '13px', color: '#888' }}>
                        {sale.time || '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr style={{ background: '#f0f7ff' }}>
                  <td colSpan={2} style={{ padding: '10px 16px', fontSize: '13px', fontWeight: '600', color: '#333' }}>Total</td>
                  <td style={{ padding: '10px 16px', fontSize: '13px', fontWeight: '600', color: '#333' }}>{totalItems}</td>
                  <td style={{ padding: '10px 16px', fontSize: '13px', fontWeight: '600', color: '#185FA5' }}>
                    KSh {totalRevenue.toLocaleString()}
                  </td>
                  <td style={{ padding: '10px 16px', fontSize: '13px', fontWeight: '600', color: '#3B6D11' }}>
                    KSh {totalProfit.toLocaleString()}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
