import { useState, useEffect, useMemo } from 'react'
import { MdCheckCircle, MdFilterList } from 'react-icons/md'
import ReturnModal from '@/components/modals/ReturnModal'
import VoidModal from '@/components/modals/VoidModal'
import PendingReturnsPanel from '@/components/panels/PendingReturnsPanel'
import PendingVoidRequestsPanel from '@/components/panels/PendingVoidRequestsPanel'
import { useSocket } from '@/context/SocketContext'
import { useApp } from '@/context/AppContext'
import { useHistoryModal } from '@/hooks/useHistoryModal'

import SalesFilters from './SalesFilters'
import SalesStats from './SalesStats'
import OwnerView from './OwnerView'
import EmployeeView from './EmployeeView'
import { API_BASE_URL } from '@/config/api'

function getLast30DaysCutoff() {
  const date = new Date()
  date.setDate(date.getDate() - 30)
  date.setHours(0, 0, 0, 0)
  return date
}

export default function SalesHistory() {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')
  const [storeFilter, setStoreFilter] = useState('All')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [showReturn, openReturn, closeReturn] = useHistoryModal('return')
  const [returnSale, setReturnSale] = useState(null)
  const [showVoid, openVoid, closeVoid] = useHistoryModal('void-sale')
  const [voidSaleData, setVoidSaleData] = useState(null)
  const [returnSuccess, setReturnSuccess] = useState('')
  const [voidSuccess, setVoidSuccess] = useState('')

  useEffect(() => { if (!showReturn) setReturnSale(null) }, [showReturn])
  useEffect(() => { if (!showVoid) setVoidSaleData(null) }, [showVoid])
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [expandedEmployee, setExpandedEmployee] = useState(null)
  const [employeeDateFilter, setEmployeeDateFilter] = useState({})

  const socket = useSocket()
  const {
    isOwner, isManager, currentUser, sales, stores, settings,
    fetchSales, fetchReturns, fetchArchives, fetchStores,
    pendingReturns, pendingVoidRequests, products, voidSale, submitRemoteVoid,
  } = useApp()
  const currency = settings?.currency || 'KSh'

  const categories = useMemo(() => {
    const cats = [...new Set(products.map(p => p.category).filter(Boolean))]
    return ['All', ...cats.sort()]
  }, [products])


  const storeList = useMemo(() => ['All', ...stores.map(s => s.name).sort()], [stores])

  useEffect(() => {
    fetchSales()
    fetchReturns()
    if (isOwner) fetchStores()
    if (!socket) return

    socket.on('returnUpdated', () => { fetchReturns(); fetchSales() })
    socket.on('adminShiftNotification', () => {
      if (isOwner) { fetchSales(); fetchReturns(); fetchArchives() }
    })
    socket.on('sync_system_data', () => { fetchSales(); fetchReturns() })

    return () => {
      socket.off('returnUpdated')
      socket.off('adminShiftNotification')
      socket.off('sync_system_data')
    }
  }, [socket, isOwner, fetchSales, fetchReturns, fetchArchives, fetchStores])

  const mySales = (isOwner || isManager)
    ? sales
    : sales.filter(s => s.cashier === (currentUser?.fullname || currentUser?.name || currentUser?.username))

  const cutoff = getLast30DaysCutoff()
  const visibleSales = (isOwner || isManager) ? mySales : mySales.filter(s => new Date(s.date) >= cutoff)

  const filtered = visibleSales.filter(s => {
    const matchSearch = !search || s.items?.some(i =>
      i.productId?.name?.toLowerCase().includes(search.toLowerCase())
    )
    const matchCat = category === 'All' || s.items?.some(i => i.productId?.category === category)
    const matchStore = storeFilter === 'All' || s.store === storeFilter
    const matchFrom = !dateFrom || new Date(s.date) >= new Date(dateFrom)
    const matchTo = !dateTo || new Date(s.date) <= new Date(dateTo + 'T23:59:59')
    return matchSearch && matchCat && matchStore && matchFrom && matchTo
  })

  const groupedByCashier = filtered.reduce((groups, sale) => {
    const cashier = sale.cashier || 'Unknown'
    if (!groups[cashier]) groups[cashier] = []
    groups[cashier].push(sale)
    return groups
  }, {})

  const groupedByDate = filtered.reduce((groups, sale) => {
    const d = new Date(sale.date)
    if (isNaN(d)) return groups
    const day = d.toLocaleDateString('en-CA')
    if (!groups[day]) groups[day] = []
    groups[day].push(sale)
    return groups
  }, {})

  const sortedDates = Object.keys(groupedByDate).sort((a, b) => b.localeCompare(a))

  // ── Handle void ────────────────────────────────────────────────────
  const handleVoidSubmit = async ({ saleId, approverPin, reason, voidType, items }) => {
    const result = await voidSale(saleId, approverPin, reason, voidType, items)
    if (result.success) {
      closeVoid()
      setVoidSuccess(
        result.isPartialVoid
          ? `${result.message} Receipt #${voidSaleData?.receiptId || ''}`
          : `Sale #${voidSaleData?.receiptId || ''} voided successfully.`
      )
      fetchSales()
      setTimeout(() => setVoidSuccess(''), 6000)
    }
    return result
  }

  const handleRemoteVoidSubmit = async ({ saleId, reason, voidType, items }) => {
    const result = await submitRemoteVoid(saleId, reason, voidType, items)
    if (result.success) {
      closeVoid()
      setVoidSuccess(`Void request for Sale #${voidSaleData?.receiptId || ''} sent to owner for approval.`)
      setTimeout(() => setVoidSuccess(''), 8000)
    }
    return result
  }


  return (
    <div className="flex flex-col min-h-full md:h-full md:overflow-hidden" style={{ background: 'var(--bg-page)' }}>

      {/* ── Fixed header ───────────────────────────────── */}
      <div className="flex-shrink-0 px-6 pt-6 pb-3">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
              Sales History
            </h1>
            <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {isOwner
                ? 'All employee sales — click an employee to expand'
                : isManager
                  ? `Store sales — ${currentUser?.store}`
                  : `Your sales (last 30 days) — ${currentUser?.fullname || currentUser?.name || currentUser?.username}`
              }
            </p>
          </div>
          <button
            className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex-shrink-0"
            style={{
              background: filtersOpen ? 'var(--primary)' : 'var(--bg-card)',
              color: filtersOpen ? '#fff' : 'var(--text-secondary)',
              border: '1px solid var(--border-medium)',
            }}
            onClick={() => setFiltersOpen(o => !o)}
          >
            <MdFilterList /> {filtersOpen ? 'Hide Filters' : 'Filters'}
          </button>
        </div>

        {/* Success toasts */}
        {returnSuccess && (
          <div className="p-3 rounded-lg text-sm mb-3 flex items-center gap-2"
            style={{ background: 'var(--success-light)', border: '1px solid var(--success)', color: 'var(--badge-success-text)' }}>
            <MdCheckCircle className="text-lg flex-shrink-0" /> {returnSuccess}
          </div>
        )}
        {voidSuccess && (
          <div className="p-3 rounded-lg text-sm mb-3 flex items-center gap-2"
            style={{ background: 'var(--danger-light)', border: '1px solid var(--danger)', color: 'var(--badge-danger-text)' }}>
            <MdCheckCircle className="text-lg flex-shrink-0" /> {voidSuccess}
          </div>
        )}

        {(isOwner || isManager) && pendingReturns.length > 0 && (
          <PendingReturnsPanel pendingReturns={pendingReturns} refreshReturns={fetchReturns} />
        )}
        {isOwner && pendingVoidRequests.length > 0 && (
          <PendingVoidRequestsPanel />
        )}

        <SalesStats isOwner={isOwner} filtered={filtered} category={category} currency={currency} />

        <div className={filtersOpen ? '' : 'md:hidden'}>
          <SalesFilters
            search={search} setSearch={setSearch}
            dateFrom={dateFrom} setDateFrom={setDateFrom}
            dateTo={dateTo} setDateTo={setDateTo}
            category={category} setCategory={setCategory}
            categories={categories}
            storeFilter={storeFilter} setStoreFilter={setStoreFilter}
            storeList={isOwner ? storeList : null}
          />
        </div>
      </div>

      {/* ── Scrollable content ──────────────────────────── */}
      <div className="md:flex-1 md:overflow-y-auto px-6 pb-6">
        {(isOwner || isManager) ? (
          <OwnerView
            groupedByCashier={groupedByCashier}
            expandedEmployee={expandedEmployee}
            setExpandedEmployee={setExpandedEmployee}
            employeeDateFilter={employeeDateFilter}
            setEmployeeDateFilter={setEmployeeDateFilter}
            isOwner={isOwner || isManager}
            setReturnModal={(sale) => { setReturnSale(sale); openReturn() }}
            setVoidModal={(sale) => { setVoidSaleData(sale); openVoid() }}
            category={category}
          />
        ) : (
          <EmployeeView
            sortedDates={sortedDates}
            groupedByDate={groupedByDate}
            isOwner={isOwner}
            setReturnModal={(sale) => { setReturnSale(sale); openReturn() }}
            setVoidModal={(sale) => { setVoidSaleData(sale); openVoid() }}
            category={category}
          />
        )}
      </div>

      {/* ── Return modal ────────────────────────────────── */}
      {showReturn && (
        <ReturnModal
          sale={returnSale}
          onClose={closeReturn}
          onSuccess={(msg) => {
            setReturnSuccess(msg)
            fetchSales()
            fetchReturns()
            setTimeout(() => setReturnSuccess(''), 6000)
          }}
        />
      )}

      {/* ── Void modal ──────────────────────────────────── */}
      {showVoid && (
        <VoidModal
          sale={voidSaleData}
          onClose={closeVoid}
          onVoid={handleVoidSubmit}
          onRemoteVoid={handleRemoteVoidSubmit}
        />
      )}
    </div>
  )
}
