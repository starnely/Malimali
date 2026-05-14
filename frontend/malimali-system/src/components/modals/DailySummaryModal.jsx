import { useState, useMemo } from 'react'
import { MdClose, MdAttachMoney, MdInventory, MdTrendingUp, MdPerson } from 'react-icons/md'
import { useApp } from '@/context/AppContext'
import { buildLiveSummary } from '@/utils/utils'

export default function DailySummaryModal({ onClose }) {
  const { sales, products } = useApp()
  const [selectedDate, setSelectedDate] = useState(new Date().toLocaleDateString('en-CA'));

  // ✅ Use buildLiveSummary which now has all correct field names
  const summary = useMemo(() => {
    return buildLiveSummary(selectedDate, sales, products) || null
  }, [selectedDate, sales, products])

  const displayDate = new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-KE', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  })

  return (
    <>
      {/* 1. Add the Print CSS Rules */}
      <style>
        {`
        @media print {
          /* Hide background overlay, close button, date input, and icons */
          .modal-overlay, .close-icon, input[type="date"], svg {
            display: none !important;
          }
          
          /* Force colors and backgrounds to appear in print */
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          /* Remove modal positioning so it prints as a flat document */
          .modal-container {
            position: static !important;
            box-shadow: none !important;
            width: 100% !important;
            max-height: none !important;
            overflow: visible !important;
            border: none !important;
          }

          /* Ensure the scrollable area expands for the printer */
          .scroll-content {
            overflow-y: visible !important;
            height: auto !important;
          }

          body {
            background: white !important;
          }
        }
      `}
      </style>

      {/* 2. Added className="modal-overlay" */}
      <div className="modal-overlay" style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'center',
        justifyContent: 'center', zIndex: 1000, padding: '1rem'
      }}>

        {/* 3. Added className="modal-container" */}
        <div className="modal-container" style={{
          background: '#fff', borderRadius: '12px',
          width: '100%', maxWidth: '640px',
          maxHeight: '90vh', overflow: 'hidden',
          display: 'flex', flexDirection: 'column'
        }}>

          {/* Header */}
          <div style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '0.5px solid #eee',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center'
          }}>
            <div>
              <div style={{ fontSize: '16px', fontWeight: '600', color: '#333' }}>Daily Summary</div>
              <div style={{ fontSize: '12px', color: '#888', marginTop: '2px' }}>{displayDate}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <input
                type="date"
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
                style={{
                  padding: '7px 10px', border: '0.5px solid #ddd',
                  borderRadius: '8px', fontSize: '13px', outline: 'none'
                }}
              />
              {/* Added className="close-icon" */}
              <MdClose
                className="close-icon"
                onClick={onClose}
                style={{ fontSize: '22px', color: '#aaa', cursor: 'pointer' }}
              />
            </div>
          </div>

          {/* 4. Added className="scroll-content" */}
          <div className="scroll-content" style={{ overflowY: 'auto', flex: 1, padding: '1.5rem' }}>

            {!summary && (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#aaa', fontSize: '14px' }}>
                No sales recorded for this date.
              </div>
            )}

            {summary && (
              <>
                {/* Summary cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', marginBottom: '1.5rem' }}>
                  {[
                    { label: 'Total revenue', value: `KSh ${summary.totalRevenue.toLocaleString()}`, icon: <MdAttachMoney />, color: '#185FA5', bg: '#E6F1FB' },
                    { label: 'Profit today', value: `KSh ${summary.totalProfit.toLocaleString()}`, icon: <MdTrendingUp />, color: summary.totalProfit >= 0 ? '#3B6D11' : '#A32D2D', bg: summary.totalProfit >= 0 ? '#EAF3DE' : '#FCEBEB' },
                    { label: 'Items sold', value: summary.totalItems, icon: <MdInventory />, color: '#BA7517', bg: '#FAEEDA' },
                    { label: 'Transactions', value: summary.totalTransactions, icon: <MdPerson />, color: '#533AB7', bg: '#EEEDFE' },
                  ].map((card, i) => (
                    <div key={i} style={{
                      background: card.bg, borderRadius: '10px',
                      padding: '1rem', display: 'flex', alignItems: 'center', gap: '12px'
                    }}>
                      <div style={{ fontSize: '24px', color: card.color }}>{card.icon}</div>
                      <div>
                        <div style={{ fontSize: '11px', color: card.color, marginBottom: '2px' }}>{card.label}</div>
                        <div style={{ fontSize: '18px', fontWeight: '600', color: card.color }}>{card.value}</div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Profit breakdown */}
                <div style={{ background: '#f9f9f9', borderRadius: '10px', padding: '1rem 1.25rem', marginBottom: '1.25rem' }}>
                  <div style={{ fontSize: '13px', fontWeight: '600', color: '#333', marginBottom: '10px' }}>Profit breakdown</div>
                  {[
                    { label: 'Revenue', value: `KSh ${summary.totalRevenue.toLocaleString()}`, color: '#185FA5' },
                    { label: 'Cost of goods sold', value: `− KSh ${summary.totalCOGS.toLocaleString()}`, color: '#A32D2D' },
                    { label: 'Profit', value: `KSh ${summary.totalProfit.toLocaleString()}`, color: summary.totalProfit >= 0 ? '#3B6D11' : '#A32D2D', bold: true },
                  ].map((row, i) => (
                    <div key={i} style={{
                      display: 'flex', justifyContent: 'space-between', padding: '6px 0',
                      borderTop: i === 2 ? '0.5px solid #ddd' : 'none',
                      marginTop: i === 2 ? '6px' : '0'
                    }}>
                      <span style={{ fontSize: '13px', color: '#555' }}>{row.label}</span>
                      <span style={{ fontSize: '13px', fontWeight: row.bold ? '600' : '400', color: row.color }}>{row.value}</span>
                    </div>
                  ))}
                </div>

                {/* Payment breakdown */}
                <div style={{ background: '#f9f9f9', borderRadius: '10px', padding: '1rem 1.25rem', marginBottom: '1.25rem' }}>
                  <div style={{ fontSize: '13px', fontWeight: '600', color: '#333', marginBottom: '12px' }}>Payment breakdown</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                    <div style={{ background: '#EAF3DE', borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
                      <div style={{ fontSize: '11px', color: '#3B6D11', marginBottom: '4px' }}>💵 Cash in Drawer</div>
                      <div style={{ fontSize: '16px', fontWeight: '700', color: '#27500A' }}>KSh {summary.paymentBreakdown.cash.toLocaleString()}</div>
                      <div style={{ fontSize: '11px', color: '#888', marginTop: '4px' }}>{summary.cashSalesCount} cash · {summary.splitSalesCount} split</div>
                    </div>
                    <div style={{ background: '#E6F1FB', borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
                      <div style={{ fontSize: '11px', color: '#185FA5', marginBottom: '4px' }}>📱 M-Pesa Total</div>
                      <div style={{ fontSize: '16px', fontWeight: '700', color: '#0C447C' }}>KSh {summary.paymentBreakdown.mpesa.toLocaleString()}</div>
                      <div style={{ fontSize: '11px', color: '#888', marginTop: '4px' }}>{summary.mpesaSalesCount} mpesa · {summary.splitSalesCount} split</div>
                    </div>
                    <div style={{ background: summary.paymentBreakdown.credit > 0 ? '#FFF4E5' : '#f9f9f9', borderRadius: '10px', padding: '12px', textAlign: 'center', border: summary.paymentBreakdown.credit > 0 ? '0.5px solid #F5A623' : '0.5px solid #eee' }}>
                      <div style={{ fontSize: '11px', color: summary.paymentBreakdown.credit > 0 ? '#7A4D00' : '#aaa', marginBottom: '4px' }}>📋 Credit (Owed)</div>
                      <div style={{ fontSize: '16px', fontWeight: '700', color: summary.paymentBreakdown.credit > 0 ? '#7A4D00' : '#aaa' }}>KSh {summary.paymentBreakdown.credit.toLocaleString()}</div>
                      <div style={{ fontSize: '11px', color: '#888', marginTop: '4px' }}>{summary.creditSalesCount} credit sale{summary.creditSalesCount !== 1 ? 's' : ''}</div>
                    </div>
                  </div>

                  <div style={{ marginTop: '12px', padding: '8px 12px', background: '#fff', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#888', border: '0.5px solid #eee' }}>
                    <span>Balanced Total (Cash + Mobile + Credit)</span>
                    <span style={{ fontWeight: '700', color: summary.paymentBreakdown.cash + summary.paymentBreakdown.mpesa + summary.paymentBreakdown.credit === summary.totalRevenue ? '#333' : '#D97706' }}>
                      KSh {(summary.paymentBreakdown.cash + summary.paymentBreakdown.mpesa + summary.paymentBreakdown.credit).toLocaleString()}
                      {summary.paymentBreakdown.cash + summary.paymentBreakdown.mpesa + summary.paymentBreakdown.credit === summary.totalRevenue ? ' ✅ Match' : ' ⚠️ Discrepancy Found'}
                    </span>
                  </div>
                </div>

                {/* Stock summary */}
                <div style={{ background: '#f9f9f9', borderRadius: '10px', padding: '1rem 1.25rem', marginBottom: '1.25rem' }}>
                  <div style={{ fontSize: '13px', fontWeight: '600', color: '#333', marginBottom: '10px' }}>Current stock snapshot</div>
                  {[{ label: 'Items sold today', value: summary.totalItems }, { label: 'Transactions today', value: summary.totalTransactions }].map((row, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderTop: i > 0 ? '0.5px solid #eee' : 'none' }}>
                      <span style={{ fontSize: '13px', color: '#555' }}>{row.label}</span>
                      <span style={{ fontSize: '13px', fontWeight: '500', color: '#333' }}>{row.value}</span>
                    </div>
                  ))}
                </div>

                {/* Employee breakdown */}
                <div style={{ background: '#f9f9f9', borderRadius: '10px', padding: '1rem 1.25rem' }}>
                  <div style={{ fontSize: '13px', fontWeight: '600', color: '#333', marginBottom: '10px' }}>Sales by person</div>
                  {summary.perEmployee.length === 0 ? (
                    <div style={{ fontSize: '13px', color: '#aaa', textAlign: 'center', padding: '1rem 0' }}>No employee data.</div>
                  ) : (
                    summary.perEmployee.map((emp, i) => (
                      <div key={emp.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderTop: i > 0 ? '0.5px solid #eee' : 'none' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#E6F1FB', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: '700', color: '#185FA5' }}>{emp.name.charAt(0).toUpperCase()}</div>
                          <div>
                            <div style={{ fontSize: '13px', fontWeight: '500', color: '#333' }}>{emp.name}</div>
                            <div style={{ fontSize: '11px', color: '#888' }}>{emp.transactions} transactions · {emp.itemsSold} items</div>
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '14px', fontWeight: '600', color: '#185FA5' }}>KSh {emp.revenue.toLocaleString()}</div>
                          <div style={{ fontSize: '12px', color: '#3B6D11', marginTop: '2px' }}>Profit: KSh {emp.profit.toLocaleString()}</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
