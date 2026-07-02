import {
  MdArchive, MdExpandMore, MdExpandLess,
  MdAttachMoney, MdTrendingUp, MdPointOfSale,
  MdInventory, MdRefresh, MdStore
} from 'react-icons/md'
import { fmtQty } from '@/utils/utils'

const isTouchDevice = () => window.matchMedia('(pointer: coarse)').matches

export default function ArchiveCard({ archive, isExpanded, onToggle, onViewDebtors }) {
  const pb = archive.paymentBreakdown || {}

  // ── All payment method tiles — only show card/bank if they have value
  // (older archives before the update won't have these fields)
  const paymentTiles = [
    {
      label:   '💵 Cash in Drawer',
      value:   pb.cash   || 0,
      color:   'var(--success-dark)',
      bg:      'var(--success-light)',
      border:  'var(--success)',
      always:  true,
    },
    {
      label:   '📱 M-Pesa Total',
      value:   pb.mpesa  || 0,
      color:   'var(--info-dark)',
      bg:      'var(--info-light)',
      border:  'var(--info)',
      always:  true,
    },
    {
      label:   '💳 Card (EDC)',
      value:   pb.card   || 0,
      color:   pb.card > 0 ? 'var(--primary-dark)' : 'var(--text-muted)',
      bg:      pb.card > 0 ? 'var(--primary-light)' : 'var(--bg-muted)',
      border:  pb.card > 0 ? 'var(--primary)'       : 'var(--border-soft)',
      always:  false,
    },
    {
      label:   '🏦 Bank Transfer',
      value:   pb.bank   || 0,
      color:   pb.bank > 0 ? 'var(--primary-dark)' : 'var(--text-muted)',
      bg:      pb.bank > 0 ? 'var(--primary-light)' : 'var(--bg-muted)',
      border:  pb.bank > 0 ? 'var(--primary)'       : 'var(--border-soft)',
      always:  false,
    },
  ].filter(t => t.always || t.value > 0)

  return (
    <div
      className="mb-4 rounded-xl overflow-hidden"
      style={{
        background: 'var(--bg-card)',
        border:     '1px solid var(--border-soft)',
        boxShadow:  'var(--shadow-card)',
      }}
    >
      {/* ── Header ─────────────────────────────────────── */}
      <div
        onClick={onToggle}
        className="flex justify-between items-center p-4 cursor-pointer transition-colors duration-200"
        style={{ background: isExpanded ? 'var(--primary-light)' : 'var(--bg-card)' }}
        onMouseEnter={e => { if (!isExpanded && !isTouchDevice()) e.currentTarget.style.background = 'var(--bg-muted)' }}
        onMouseLeave={e => { if (!isExpanded && !isTouchDevice()) e.currentTarget.style.background = 'var(--bg-card)' }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: archive.isLive ? 'var(--success-light)' : 'var(--primary-light)' }}
          >
            {archive.isLive
              ? <MdRefresh style={{ color: 'var(--success-dark)', fontSize: '20px' }} />
              : <MdArchive style={{ color: 'var(--primary)',      fontSize: '20px' }} />
            }
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>
                {new Date(archive.date + 'T00:00:00').toLocaleDateString('en-KE', {
                  weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
                })}
              </span>
              {archive.isLive && (
                <span
                  className="text-[10px] px-2 py-0.5 rounded font-black uppercase tracking-wider"
                  style={{ background: 'var(--success-light)', color: 'var(--success-dark)' }}
                >
                  LIVE
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {archive.totalTransactions} transactions · {fmtQty(archive.totalItems || 0)} items sold
              </span>
              {archive.store && (
                <span
                  className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded"
                  style={{ background: 'var(--bg-muted)', color: 'var(--text-secondary)' }}
                >
                  <MdStore size={11} /> {archive.store}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="text-right hidden sm:block">
            <div className="text-[10px] uppercase font-bold" style={{ color: 'var(--text-muted)' }}>Revenue</div>
            <div className="text-lg font-black" style={{ color: 'var(--primary)' }}>
              KSh {(archive.totalRevenue || 0).toLocaleString()}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase font-bold" style={{ color: 'var(--text-muted)' }}>Profit</div>
            <div className="text-lg font-black" style={{ color: 'var(--success-dark)' }}>
              KSh {(archive.totalProfit || 0).toLocaleString()}
            </div>
          </div>
          {isExpanded
            ? <MdExpandLess style={{ color: 'var(--text-muted)', fontSize: '20px' }} />
            : <MdExpandMore style={{ color: 'var(--text-muted)', fontSize: '20px' }} />
          }
        </div>
      </div>

      {/* ── Expanded content ───────────────────────────── */}
      {isExpanded && (
        <div style={{ borderTop: '1px solid var(--border-soft)', padding: '1rem', background: 'var(--bg-card)' }}>

          {/* Summary grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            {[
              { label: 'Total Revenue', value: `KSh ${(archive.totalRevenue || 0).toLocaleString()}`, color: 'var(--primary)',      bg: 'var(--primary-light)',  icon: <MdAttachMoney /> },
              { label: 'Total Profit',  value: `KSh ${(archive.totalProfit  || 0).toLocaleString()}`, color: 'var(--success-dark)', bg: 'var(--success-light)', icon: <MdTrendingUp />  },
              { label: 'Transactions',  value: archive.totalTransactions || 0,                        color: 'var(--warning-dark)', bg: 'var(--warning-light)', icon: <MdPointOfSale /> },
              { label: 'Items Sold',    value: fmtQty(archive.totalItems || 0),                      color: 'var(--info-dark)',    bg: 'var(--info-light)',    icon: <MdInventory />   },
            ].map((card, i) => (
              <div
                key={i}
                className="rounded-xl p-3"
                style={{ background: card.bg, borderLeft: `4px solid ${card.color}` }}
              >
                <div className="text-[10px] uppercase font-bold flex items-center gap-1 mb-1" style={{ color: card.color }}>
                  {card.icon} {card.label}
                </div>
                <div className="text-base font-black" style={{ color: 'var(--text-primary)' }}>
                  {card.value}
                </div>
              </div>
            ))}
          </div>

          {/* Payment breakdown — dynamic tiles */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
            {paymentTiles.map((tile, i) => (
              <div
                key={i}
                className="rounded-xl p-4"
                style={{ background: tile.bg, border: `1px solid ${tile.border}` }}
              >
                <div className="text-[10px] uppercase font-bold mb-1" style={{ color: tile.color }}>
                  {tile.label}
                </div>
                <div className="text-xl font-black" style={{ color: tile.color }}>
                  KSh {tile.value.toLocaleString()}
                </div>
              </div>
            ))}

            {/* Credit tile is always last and is a button to view debtors */}
            <button
              onClick={e => { e.stopPropagation(); onViewDebtors() }}
              className="rounded-xl p-4 text-left transition-all hover:scale-[1.02] active:scale-95"
              style={pb.credit > 0
                ? { background: 'var(--danger-light)', border: '1px solid var(--danger)' }
                : { background: 'var(--bg-muted)', border: '1px solid var(--border-soft)', opacity: 0.6 }
              }
            >
              <div
                className="text-[10px] uppercase font-bold mb-1"
                style={{ color: pb.credit > 0 ? 'var(--danger-dark)' : 'var(--text-muted)' }}
              >
                📋 Unpaid Credit {pb.credit > 0 ? '→ View' : ''}
              </div>
              <div
                className="text-xl font-black"
                style={{ color: pb.credit > 0 ? 'var(--danger)' : 'var(--text-muted)' }}
              >
                KSh {(pb.credit || 0).toLocaleString()}
              </div>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
