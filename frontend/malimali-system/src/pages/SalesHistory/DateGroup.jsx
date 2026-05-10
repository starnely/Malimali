import SaleCard from './SaleCard';

const DAY_COLORS = [
    { bg: 'bg-blue-50', border: 'border-blue-200', header: 'bg-blue-100', text: 'text-blue-800' },
    { bg: 'bg-green-50', border: 'border-green-200', header: 'bg-green-100', text: 'text-green-800' },
    { bg: 'bg-purple-50', border: 'border-purple-200', header: 'bg-purple-100', text: 'text-purple-800' },
    { bg: 'bg-amber-50', border: 'border-amber-200', header: 'bg-amber-100', text: 'text-amber-800' },
    { bg: 'bg-rose-50', border: 'border-rose-200', header: 'bg-rose-100', text: 'text-rose-800' },
    { bg: 'bg-teal-50', border: 'border-teal-200', header: 'bg-teal-100', text: 'text-teal-800' },
];

function getColorForDate(date) {
    const day = new Date(date + 'T00:00:00').getDay();
    return DAY_COLORS[day % DAY_COLORS.length];
}

export default function DateGroup({ date, sales, isOwner, setReturnModal }) {
    const color = getColorForDate(date);
    const dateTotal = sales.filter(s => !s.returned).reduce((sum, s) => sum + (s.total || 0), 0);
    const dayQty = sales.reduce((sum, s) => sum + (s.items?.reduce((q, i) => q + i.qty, 0) || 0), 0);

    return (
        <div className={`mb-4 rounded-lg border ${color.border} overflow-hidden`}>
            {/* Date header */}
            <div className={`px-4 py-2 flex justify-between items-center ${color.header}`}>
                <span className={`text-sm font-semibold ${color.text}`}>
                    {new Date(date + 'T00:00:00').toLocaleDateString('en-KE', {
                        weekday: 'long', year: 'numeric', month: 'short', day: 'numeric'
                    })}
                </span>
                <div className="flex gap-4">
                    <span className={`text-xs ${color.text} opacity-70`}>{dayQty} items</span>
                    <span className={`text-sm font-bold ${color.text}`}>KSh {dateTotal.toLocaleString()}</span>
                </div>
            </div>

            {/* Sales list */}
            <div className={color.bg}>
                {sales
                    .sort((a, b) => new Date(b.date) - new Date(a.date))
                    .map(sale => (
                        <SaleCard
                            key={sale._id}
                            sale={sale}
                            onReturn={() => setReturnModal(sale)}
                            isOwner={isOwner}
                        />
                    ))}
            </div>
        </div>
    );
}
