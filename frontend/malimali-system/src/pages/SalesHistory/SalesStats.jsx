import { MdAttachMoney, MdInventory } from 'react-icons/md';

export default function SalesStats({ isOwner, filtered }) {
  // ✅ Correct per-item revenue calculation
  const totalRevenue = filtered.reduce((sum, sale) => {
    const itemRevenue = sale.items
      .filter(item => item.returnStatus !== 'approved') // exclude only returned items
      .reduce((itemSum, item) => itemSum + (item.price * item.qty), 0);
    return sum + itemRevenue;
  }, 0);

  // ✅ Total items sold (excluding returned items)
  const totalItemsSold = filtered.reduce((sum, sale) => {
    const itemCount = sale.items
      .filter(item => item.returnStatus !== 'approved')
      .reduce((itemSum, item) => itemSum + item.qty, 0);
    return sum + itemCount;
  }, 0);

  const cards = [
    {
      label: isOwner ? 'Total revenue' : 'Your revenue this week',
      value: `KSh ${totalRevenue.toLocaleString()}`,
      icon: <MdAttachMoney />,
      color: 'text-blue-800',
      bg: 'bg-blue-50',
    },
    {
      label: 'Transactions',
      value: filtered.length,
      icon: <MdAttachMoney />,
      color: 'text-green-700',
      bg: 'bg-green-50',
    },
    {
      label: 'Items sold',
      value: totalItemsSold,
      icon: <MdInventory />,
      color: 'text-yellow-700',
      bg: 'bg-yellow-50',
    },
  ];

{/* Stats */}
<SalesStats
  isOwner={isOwner}
  filtered={filtered}
/>
  return (
    <div className="grid grid-cols-3 gap-3 mb-3">
      {cards.map((card, i) => (
        <div
          key={i}
          className="bg-white border border-gray-200 rounded-lg p-3 flex items-center gap-3"
        >
          <div
            className={`w-9 h-9 rounded-lg flex items-center justify-center text-xl ${card.bg} ${card.color}`}
          >
            {card.icon}
          </div>
          <div>
            <div className="text-xs text-gray-500">{card.label}</div>
            <div className="text-base font-semibold text-gray-800">{card.value}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
