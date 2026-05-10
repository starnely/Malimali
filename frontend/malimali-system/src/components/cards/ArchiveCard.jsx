import { MdArchive, MdExpandMore, MdExpandLess, MdAttachMoney, MdTrendingUp, MdPointOfSale, MdInventory, MdRefresh } from 'react-icons/md'

export default function ArchiveCard({ archive, isExpanded, onToggle, onViewDebtors }) {
  // ✅ Guard: paymentBreakdown may be missing on old stored archives
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
              {/* ✅ Fix: append T00:00:00 to prevent timezone date shift */}
              {new Date(archive.date + 'T00:00:00').toLocaleDateString('en-KE', {
                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
              })}
              {archive.isLive && (
                <span className="text-xs px-2 py-0.5 rounded bg-green-100 text-green-700 font-semibold">LIVE</span>
              )}
            </div>
            <div className="text-xs text-gray-500">
              {archive.totalTransactions} transactions · {archive.totalItems} items sold
              {!archive.isLive && archive.archivedAt && ` · Archived at ${archive.archivedAt}`}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right">
            <div className="text-xs text-gray-400">Revenue</div>
            <div className="text-lg font-bold text-blue-700">
              KSh {(archive.totalRevenue || 0).toLocaleString()}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-gray-400">Profit</div>
            <div className="text-lg font-bold text-green-700">
              KSh {(archive.totalProfit || 0).toLocaleString()}
            </div>
          </div>
          {isExpanded ? <MdExpandLess className="text-gray-400 text-xl" /> : <MdExpandMore className="text-gray-400 text-xl" />}
        </div>
      </div>

      {/* Expanded */}
      {isExpanded && (
        <div className="border-t border-gray-200 p-4">
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            {[
              { label: 'Total Revenue',  value: `KSh ${(archive.totalRevenue || 0).toLocaleString()}`,  color: 'text-blue-700',   icon: <MdAttachMoney /> },
              { label: 'Total Profit',   value: `KSh ${(archive.totalProfit || 0).toLocaleString()}`,   color: 'text-green-700',  icon: <MdTrendingUp /> },
              { label: 'Transactions',   value: archive.totalTransactions || 0,                          color: 'text-yellow-700', icon: <MdPointOfSale /> },
              { label: 'Items Sold',     value: archive.totalItems || 0,                                 color: 'text-purple-700', icon: <MdInventory /> },
            ].map((card, i) => (
              <div key={i} className="bg-gray-50 rounded-lg p-3 border-l-4" style={{ borderColor: card.color.replace('text-', '') }}>
                <div className="text-xs text-gray-500 flex items-center gap-1 mb-1">{card.icon} {card.label}</div>
                <div className={`text-base font-bold ${card.color}`}>{card.value}</div>
              </div>
            ))}
          </div>

          {/* Payment breakdown */}
          <div className="flex flex-wrap gap-3 mb-4">
            <div className="bg-green-100 rounded-lg p-3 text-center flex-1">
              <div className="text-xs text-green-700 mb-1">💵 Cash in Drawer</div>
              <div className="text-lg font-bold text-green-800">
                KSh {((pb.cash || 0) + (pb.splitCash || 0)).toLocaleString()}
              </div>
            </div>
            <div className="bg-blue-100 rounded-lg p-3 text-center flex-1">
              <div className="text-xs text-blue-700 mb-1">📱 M-Pesa Total</div>
              <div className="text-lg font-bold text-blue-800">
                KSh {((pb.mpesa || 0) + (pb.splitMpesa || 0)).toLocaleString()}
              </div>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); onViewDebtors() }}
              className={`rounded-lg p-3 text-center flex-1 transition-colors duration-200 ${
                pb.credit > 0
                  ? 'bg-yellow-100 border border-yellow-400 hover:bg-yellow-200'
                  : 'bg-gray-50 border border-gray-200'
              }`}
            >
              <div className={`text-xs mb-1 ${pb.credit > 0 ? 'text-yellow-700' : 'text-gray-400'}`}>
                📋 Credit {pb.credit > 0 ? '(tap to view)' : ''}
              </div>
              <div className={`text-lg font-bold ${pb.credit > 0 ? 'text-red-700' : 'text-gray-400'}`}>
                KSh {(pb.credit || 0).toLocaleString()}
              </div>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}