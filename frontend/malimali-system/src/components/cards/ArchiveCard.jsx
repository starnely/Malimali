import { MdArchive, MdExpandMore, MdExpandLess, MdAttachMoney, MdTrendingUp, MdPointOfSale, MdInventory, MdRefresh, MdStore } from 'react-icons/md'

export default function ArchiveCard({ archive, isExpanded, onToggle, onViewDebtors }) {
  // ✅ Access the breakdown safely
  const pb = archive.paymentBreakdown || {}

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow mb-4 overflow-hidden">
      {/* Header */}
      <div
        onClick={onToggle}
        className={`flex justify-between items-center p-4 cursor-pointer transition-colors duration-200 ${isExpanded ? 'bg-blue-50' : 'bg-white'}`}
      >
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${archive.isLive ? 'bg-green-100' : 'bg-blue-100'}`}>
            {archive.isLive
              ? <MdRefresh className="text-green-700 text-xl" />
              : <MdArchive className="text-blue-700 text-xl" />}
          </div>
          <div>
            <div className="font-semibold text-gray-800 flex items-center gap-2">
              {new Date(archive.date + 'T00:00:00').toLocaleDateString('en-KE', {
                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
              })}
              {archive.isLive && (
                <span className="text-[10px] px-2 py-0.5 rounded bg-green-100 text-green-700 font-bold uppercase tracking-wider">LIVE</span>
              )}
            </div>
            <div className="text-xs text-gray-500 flex items-center gap-2">
              <span>{archive.totalTransactions} transactions · {archive.totalItems} items sold</span>
              {/* Optional: Show store name if available */}
              {archive.store && (
                <span className="flex items-center gap-1 bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">
                  <MdStore size={12} /> {archive.store}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="text-right hidden sm:block">
            <div className="text-[10px] uppercase text-gray-400 font-bold">Revenue</div>
            <div className="text-lg font-bold text-blue-700">
              KSh {(archive.totalRevenue || 0).toLocaleString()}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase text-gray-400 font-bold">Profit</div>
            <div className="text-lg font-bold text-green-700">
              KSh {(archive.totalProfit || 0).toLocaleString()}
            </div>
          </div>
          {isExpanded ? <MdExpandLess className="text-gray-400 text-xl" /> : <MdExpandMore className="text-gray-400 text-xl" />}
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t border-gray-100 p-4 bg-white">
          {/* Summary Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            {[
              { label: 'Total Revenue',  value: `KSh ${(archive.totalRevenue || 0).toLocaleString()}`,  color: '#1d4ed8', icon: <MdAttachMoney /> },
              { label: 'Total Profit',   value: `KSh ${(archive.totalProfit || 0).toLocaleString()}`,   color: '#15803d', icon: <MdTrendingUp /> },
              { label: 'Transactions',   value: archive.totalTransactions || 0,                         color: '#a16207', icon: <MdPointOfSale /> },
              { label: 'Items Sold',     value: archive.totalItems || 0,                                color: '#7e22ce', icon: <MdInventory /> },
            ].map((card, i) => (
              <div key={i} className="bg-gray-50 rounded-xl p-3 border-l-4" style={{ borderLeftColor: card.color }}>
                <div className="text-[10px] uppercase font-bold text-gray-400 flex items-center gap-1 mb-1">
                  {card.icon} {card.label}
                </div>
                <div className="text-base font-black text-gray-800">{card.value}</div>
              </div>
            ))}
          </div>

          {/* Payment Breakdown - Cleaned Up */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-green-50 border border-green-100 rounded-xl p-4">
              <div className="text-[10px] uppercase font-bold text-green-600 mb-1">💵 Cash in Drawer</div>
              <div className="text-xl font-black text-green-800">
                KSh {(pb.cash || 0).toLocaleString()}
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
              <div className="text-[10px] uppercase font-bold text-blue-600 mb-1">📱 M-Pesa Total</div>
              <div className="text-xl font-black text-blue-800">
                KSh {(pb.mpesa || 0).toLocaleString()}
              </div>
            </div>

            <button
              onClick={(e) => { e.stopPropagation(); onViewDebtors() }}
              className={`rounded-xl p-4 text-left transition-all hover:scale-[1.02] active:scale-95 ${
                pb.credit > 0
                  ? 'bg-red-50 border border-red-200 shadow-sm'
                  : 'bg-gray-50 border border-gray-100 opacity-60'
              }`}
            >
              <div className={`text-[10px] uppercase font-bold mb-1 ${pb.credit > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                📋 Unpaid Credit {pb.credit > 0 ? '→ View' : ''}
              </div>
              <div className={`text-xl font-black ${pb.credit > 0 ? 'text-red-700' : 'text-gray-400'}`}>
                KSh {(pb.credit || 0).toLocaleString()}
              </div>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}