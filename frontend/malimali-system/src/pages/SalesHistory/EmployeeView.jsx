import DateGroup from './DateGroup'
import EmptyState from './EmptyState'

export default function EmployeeView({
  sortedDates, groupedByDate,
  isOwner, setReturnModal, setVoidModal, category,
}) {
  const filteredSortedDates = sortedDates.filter(date => {
    const daySales = groupedByDate[date]
    return category === 'All' || daySales.some(sale =>
      sale.items?.some(item => item.productId?.category === category)
    )
  })

  if (filteredSortedDates.length === 0) {
    return <EmptyState message="No sales found for the selected filter." />
  }

  return (
    <>
      {filteredSortedDates.map(date => {
        const daySales = groupedByDate[date].filter(sale =>
          category === 'All' ||
          sale.items?.some(item => item.productId?.category === category)
        )
        return (
          <DateGroup
            key={date}
            date={date}
            sales={daySales}
            isOwner={isOwner}
            setReturnModal={setReturnModal}
            setVoidModal={setVoidModal}
            category={category}
          />
        )
      })}
    </>
  )
}
