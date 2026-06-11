import { useApp } from '@/context/AppContext'
import EmployeeCard from './EmployeeCard'
import EmptyState from './EmptyState'

export default function OwnerView({
  groupedByCashier, expandedEmployee, setExpandedEmployee,
  employeeDateFilter, setEmployeeDateFilter,
  isOwner, setReturnModal, setVoidModal, category,
}) {
  const { dailyArchives } = useApp()
  const today = new Date().toLocaleDateString('en-CA')

  const closedTodayNames = new Set(
    (dailyArchives ?? [])
      .filter(a => { if (!a?.date) return false; return new Date(a.date).toLocaleDateString('en-CA') === today })
      .map(a => (a.employeeName || '').toLowerCase().trim())
  )

  if (Object.keys(groupedByCashier).length === 0) return <EmptyState message="No sales recorded yet." />

  return (
    <>
      {Object.entries(groupedByCashier)
        .sort(([, a], [, b]) => {
          const activeRev = (arr) => arr.reduce((sum, s) => {
            if (s.voided) return sum
            return sum + (s.items?.reduce((rv, item) => {
              if (item.voidStatus === 'voided') return rv
              const qty = Math.max(0, (item.qty || 0) - (item.voidedQty || 0) - (item.returnedQty || 0))
              return rv + (item.price || 0) * qty
            }, 0) || 0)
          }, 0)
          return activeRev(b) - activeRev(a)
        })
        .map(([cashier, cashierSales]) => {
          const filteredCashierSales = cashierSales.filter(sale =>
            category === 'All' || sale.items?.some(item => item.productId?.category === category)
          )
          if (filteredCashierSales.length === 0) return null
          const isClosed = closedTodayNames.has(cashier.toLowerCase().trim())
          return (
            <EmployeeCard
              key={cashier}
              cashier={cashier}
              cashierSales={filteredCashierSales}
              expandedEmployee={expandedEmployee}
              setExpandedEmployee={setExpandedEmployee}
              employeeDateFilter={employeeDateFilter}
              setEmployeeDateFilter={setEmployeeDateFilter}
              isOwner={isOwner}
              setReturnModal={setReturnModal}
              setVoidModal={setVoidModal}
              category={category}
              employeeData={{ shiftStatus: isClosed ? 'closed' : 'working' }}
            />
          )
        })}
    </>
  )
}
