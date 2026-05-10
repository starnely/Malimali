import { MdExpandMore, MdExpandLess, MdFilterList } from 'react-icons/md';
import EmployeeCard from './EmployeeCard';
import EmptyState from './EmptyState';

export default function OwnerView({
    groupedByCashier,
    expandedEmployee,
    setExpandedEmployee,
    employeeDateFilter,
    setEmployeeDateFilter,
    isOwner,
    setReturnModal,
}) {
    if (Object.keys(groupedByCashier).length === 0) {
        return <EmptyState />;
    }

    return (
        <>
            {Object.entries(groupedByCashier)
                .sort(([, a], [, b]) =>
                    b.reduce((s, x) => s + (x.total || 0), 0) -
                    a.reduce((s, x) => s + (x.total || 0), 0)
                )
                .map(([cashier, cashierSales]) => (
                    <EmployeeCard
                        key={cashier}
                        cashier={cashier}
                        cashierSales={cashierSales}
                        expandedEmployee={expandedEmployee}
                        setExpandedEmployee={setExpandedEmployee}
                        employeeDateFilter={employeeDateFilter}
                        setEmployeeDateFilter={setEmployeeDateFilter}
                        isOwner={isOwner}
                        setReturnModal={setReturnModal}
                    />
                ))}
        </>
    );
}
