import { MdExpandMore, MdExpandLess, MdFilterList, MdCheckCircle, MdTimer } from 'react-icons/md';
import DateGroup from './DateGroup';

export default function EmployeeCard({
    cashier,
    cashierSales,
    expandedEmployee,
    setExpandedEmployee,
    employeeDateFilter,
    setEmployeeDateFilter,
    isOwner,
    setReturnModal,
    // Assuming you pass down user objects to check shiftStatus
    employeeData 
}) {
    const isExpanded = expandedEmployee === cashier;

    // ✅ FIXED (Issue 2): Calculate revenue using netTotal (calculated in sales.js)
    // This ensures returned items are deducted, but the whole sale isn't wiped out.
    const cashierRevenue = cashierSales.reduce((sum, s) => sum + (s.netTotal || 0), 0);
    
    const cashierItems = cashierSales.reduce((sum, s) => sum + (s.items?.reduce((q, i) => q + i.qty, 0) || 0), 0);
    const cashierTx = cashierSales.length;

    const empFilter = employeeDateFilter[cashier] || {};
    const filteredSales = cashierSales.filter(s => {
        const matchFrom = !empFilter.from || new Date(s.date) >= new Date(empFilter.from);
        const matchTo = !empFilter.to || new Date(s.date) <= new Date(empFilter.to + 'T23:59:59');
        return matchFrom && matchTo;
    });

    const byDate = filteredSales.reduce((groups, sale) => {
        const d = new Date(sale.date);
        if (isNaN(d)) return groups;
        const day = d.toISOString().split('T')[0];
        if (!groups[day]) groups[day] = [];
        groups[day].push(sale);
        return groups; 

    }, {});
    const dates = Object.keys(byDate).sort((a, b) => b.localeCompare(a));

    // ✅ FIXED (Issue 3): Determine shift badge
    const isClosed = employeeData?.shiftStatus === 'closed';

    return (
        <div className="mb-4 bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-200">
            <div
                onClick={() => setExpandedEmployee(prev => prev === cashier ? null : cashier)}
                className="flex justify-between items-center px-5 py-4 cursor-pointer hover:bg-gray-50 transition-colors duration-150"
            >
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center text-sm font-bold">
                            {cashier.charAt(0).toUpperCase()}
                        </div>
                        {/* Status indicator dot */}
                        <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white ${isClosed ? 'bg-gray-400' : 'bg-green-500'}`}></div>
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-gray-800">{cashier}</span>
                            {/* ✅ FIXED (Issue 3): Shift Status Badge */}
                            {isClosed ? (
                                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 text-[10px] font-bold text-gray-500 uppercase">
                                    <MdCheckCircle /> Shift Closed
                                </span>
                            ) : (
                                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 text-[10px] font-bold text-green-700 uppercase animate-pulse">
                                    <MdTimer /> Still Working
                                </span>
                            )}
                        </div>
                        <div className="text-xs text-gray-400">{cashierTx} transactions · {cashierItems} items</div>
                    </div>
                </div>
                <div className="flex items-center gap-6">
                    <div className="text-right">
                        <div className="text-xs text-gray-400">Net Revenue</div>
                        <div className="text-base font-bold text-blue-800">KSh {cashierRevenue.toLocaleString()}</div>
                    </div>
                    {isExpanded
                        ? <MdExpandLess className="text-gray-400 text-xl" />
                        : <MdExpandMore className="text-gray-400 text-xl" />}
                </div>
            </div>

            {isExpanded && (
                <div className="border-t border-gray-100 px-5 py-4 bg-gray-50">
                    {/* ... Date filter inputs remain the same ... */}
                    <div className="flex items-center gap-2 mb-4 flex-wrap">
                        <MdFilterList className="text-gray-400" />
                        <span className="text-xs text-gray-500">Filter {cashier}'s sales:</span>
                        <input
                            type="date"
                            value={empFilter.from || ''}
                            onChange={e => setEmployeeDateFilter(prev => ({ ...prev, [cashier]: { ...prev[cashier], from: e.target.value } }))}
                            className="p-1.5 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-blue-500"
                        />
                        <span className="text-xs text-gray-400">to</span>
                        <input
                            type="date"
                            value={empFilter.to || ''}
                            onChange={e => setEmployeeDateFilter(prev => ({ ...prev, [cashier]: { ...prev[cashier], to: e.target.value } }))}
                            className="p-1.5 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-blue-500"
                        />
                    </div>

                    {dates.length === 0 ? (
                        <div className="text-center py-6 text-sm text-gray-400">No sales in this date range</div>
                    ) : (
                        dates.map(date => (
                            <DateGroup
                                key={date}
                                date={date}
                                sales={byDate[date]}
                                isOwner={isOwner}
                                setReturnModal={setReturnModal}
                            />
                        ))
                    )}
                </div>
            )}
        </div>
    );
}