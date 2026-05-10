import DateGroup from './DateGroup';
import EmptyState from './EmptyState';

export default function EmployeeView({
    sortedDates,
    groupedByDate,
    isOwner,
    setReturnModal,
}) {
    if (sortedDates.length === 0) {
        return <EmptyState message="No sales this week." />;
    }

    return (
        <>
            {sortedDates.map(date => {
                const daySales = groupedByDate[date];
                return (
                    <DateGroup
                        key={date}
                        date={date}
                        sales={daySales}
                        isOwner={isOwner}
                        setReturnModal={setReturnModal}
                    />
                );
            })}
        </>
    );
}
