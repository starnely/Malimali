import React, { useMemo } from 'react';
import { MdClose, MdPerson } from 'react-icons/md';

export default function EmployeeSalesModal({ employee, sales, products = [], date, onClose }) {
  // 1. Optimize calculations with useMemo so they don't re-run on every small state change
  const { employeeSales, totalItems, totalRevenue, totalProfit, productMap } = useMemo(() => {
    const pMap = {};
    products.forEach(p => { pMap[String(p._id)] = p.buyPrice || 0; });

    const filtered = sales.filter(s =>
      s.cashier === employee &&
      s.date?.startsWith(date) &&
      !s.returned
    );

    let itemsCount = 0;
    let revenue = 0;
    let profit = 0;

    filtered.forEach(sale => {
      revenue += (sale.total || 0);
      sale.items?.forEach(item => {
        itemsCount += (item.qty || 0);
        const buy = pMap[String(item.productId?._id || item.productId)] || 0;
        profit += (item.price - buy) * item.qty;
      });
    });

    return { employeeSales: filtered, totalItems: itemsCount, totalRevenue: revenue, totalProfit: profit, productMap: pMap };
  }, [employee, sales, products, date]);

  const displayDate = new Date(date + 'T00:00:00').toLocaleDateString('en-KE', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  return (
    <>
      <style>
        {`
          @media print {
            .no-print { display: none !important; }
            .print-only { display: block !important; }
            * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            .modal-overlay { background: white !important; position: static !important; padding: 0 !important; }
            .modal-container { 
              box-shadow: none !important; 
              border: none !important; 
              width: 100% !important; 
              max-width: none !important; 
              max-height: none !important;
            }
            .scroll-area { overflow: visible !important; height: auto !important; }
            table { width: 100% !important; border: 1px solid #eee !important; }
          }
        `}
      </style>

      <div className="modal-overlay" style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'center',
        justifyContent: 'center', zIndex: 1000, padding: '1rem'
      }}>
        <div className="modal-container" style={{
          background: '#fff', borderRadius: '12px',
          width: '100%', maxWidth: '640px',
          maxHeight: '85vh', overflow: 'hidden',
          display: 'flex', flexDirection: 'column', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)'
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
            <MdClose className="no-print" onClick={onClose} style={{ fontSize: '22px', color: '#aaa', cursor: 'pointer' }} />
          </div>

          {/* Summary Cards */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '12px', padding: '1rem 1.5rem',
            borderBottom: '0.5px solid #eee'
          }}>
            {[
              { label: 'Transactions', value: employeeSales.length, color: '#185FA5', bg: '#E6F1FB' },
              { label: 'Items sold', value: totalItems, color: '#3B6D11', bg: '#EAF3DE' },
              { label: 'Revenue', value: `KSh ${totalRevenue.toLocaleString()}`, color: '#BA7517', bg: '#FAEEDA' },
              { label: 'Profit', value: `KSh ${totalProfit.toLocaleString()}`, color: '#533AB7', bg: '#EEEDFE' },
            ].map((card, i) => (
              <div key={i} style={{ background: card.bg, borderRadius: '8px', padding: '10px 12px', textAlign: 'center' }}>
                <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px', color: card.color, marginBottom: '4px' }}>{card.label}</div>
                <div style={{ fontSize: '14px', fontWeight: '700', color: card.color }}>{card.value}</div>
              </div>
            ))}
          </div>

          {/* Sales list */}
          <div className="scroll-area" style={{ overflowY: 'auto', flex: 1 }}>
            {employeeSales.length === 0 ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: '#aaa', fontSize: '14px' }}>
                No sales recorded for this date.
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f9f9f9', position: 'sticky', top: 0, zIndex: 10 }}>
                    {['#', 'Receipt', 'Items', 'Revenue', 'Profit', 'Time'].map(h => (
                      <th key={h} style={{
                        fontSize: '11px', color: '#999', fontWeight: '600', textTransform: 'uppercase',
                        textAlign: 'left', padding: '12px 16px', borderBottom: '1px solid #eee'
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {employeeSales.map((sale, i) => {
                    const saleItems = sale.items?.reduce((q, it) => q + it.qty, 0) || 0;
                    const saleProfit = sale.items?.reduce((s2, item) => {
                      const buy = productMap[String(item.productId?._id || item.productId)] || 0;
                      return s2 + (item.price - buy) * item.qty;
                    }, 0) || 0;
                    return (
                      <tr key={sale._id} style={{ borderBottom: '0.5px solid #f5f5f5' }}>
                        <td style={{ padding: '10px 16px', fontSize: '12px', color: '#bbb' }}>{i + 1}</td>
                        <td style={{ padding: '10px 16px', fontSize: '12px', color: '#185FA5', fontWeight: '600' }}>{sale.receiptId || '—'}</td>
                        <td style={{ padding: '10px 16px', fontSize: '13px', color: '#444' }}>{saleItems}</td>
                        <td style={{ padding: '10px 16px', fontSize: '13px', color: '#333', fontWeight: '500' }}>KSh {sale.total?.toLocaleString()}</td>
                        <td style={{ padding: '10px 16px', fontSize: '13px', color: '#3B6D11' }}>KSh {saleProfit.toLocaleString()}</td>
                        <td style={{ padding: '10px 16px', fontSize: '12px', color: '#888' }}>{sale.time || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot style={{ position: 'sticky', bottom: 0, background: '#fff' }}>
                  <tr style={{ background: '#F8FAFC', borderTop: '2px solid #E2E8F0' }}>
                    <td colSpan={2} style={{ padding: '12px 16px', fontSize: '13px', fontWeight: '700' }}>Totals</td>
                    <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: '700' }}>{totalItems}</td>
                    <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: '700', color: '#185FA5' }}>KSh {totalRevenue.toLocaleString()}</td>
                    <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: '700', color: '#3B6D11' }}>KSh {totalProfit.toLocaleString()}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
          
          {/* Footer Print Button */}
          <div className="no-print" style={{ padding: '1rem', borderTop: '0.5px solid #eee', textAlign: 'right' }}>
            <button 
              onClick={() => window.print()}
              style={{
                padding: '8px 16px', background: '#185FA5', color: 'white', 
                border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px'
              }}
            >
              Print Report
            </button>
          </div>
        </div>
      </div>
    </>
  );
}