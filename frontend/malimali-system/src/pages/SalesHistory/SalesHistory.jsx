import { useState, useEffect, useMemo } from 'react'
import { MdCheckCircle } from 'react-icons/md'
import ReturnModal from '@/components/modals/ReturnModal'
import VoidModal from '@/components/modals/VoidModal'
import PendingReturnsPanel from '@/components/panels/PendingReturnsPanel'
import { useSocket } from '@/context/SocketContext'
import { useApp } from '@/context/AppContext'

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
  const [returnModal, setReturnModal] = useState(null)
  const [voidModal, setVoidModal] = useState(null)
  const [returnSuccess, setReturnSuccess] = useState('')
  const [voidSuccess, setVoidSuccess] = useState('')
  const [expandedEmployee, setExpandedEmployee] = useState(null)
  const [employeeDateFilter, setEmployeeDateFilter] = useState({})

  const socket = useSocket()
  const {
    isOwner, currentUser, sales, stores,
    fetchSales, fetchReturns, fetchArchives, fetchStores,
    pendingReturns, products, voidSale
  } = useApp()

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

  const mySales = isOwner
    ? sales
    : sales.filter(s => s.cashier === (currentUser?.fullname || currentUser?.name || currentUser?.username))

  const cutoff = getLast30DaysCutoff()
  const visibleSales = isOwner ? mySales : mySales.filter(s => new Date(s.date) >= cutoff)

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
  const handleVoidSubmit = async ({ saleId, managerUsername, managerPassword, reason, voidType, items }) => {
    if (voidType === 'items') {
      // Per-item void — new endpoint
      try {
        const res = await fetch(`${API_BASE_URL}/api/sales/${saleId}/void-items`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${currentUser?.token}`,
          },
          body: JSON.stringify({ managerUsername, managerPassword, reason, items }),
        })
        const data = await res.json()
        if (data.success) {
          setVoidModal(null)
          setVoidSuccess(
            data.isPartialVoid
              ? `${data.message} Receipt #${voidModal?.receiptId || ''}`
              : `Sale #${voidModal?.receiptId || ''} fully voided.`
          )
          fetchSales()
          setTimeout(() => setVoidSuccess(''), 6000)
          return { success: true }
        }
        return { success: false, message: data.message }
      } catch {
        return { success: false, message: 'Network error' }
      }
    } else {
      // Whole-sale void — existing voidSale from AppContext
      const result = await voidSale(saleId, managerUsername, managerPassword, reason)
      if (result.success) {
        setVoidModal(null)
        setVoidSuccess(`Sale #${voidModal?.receiptId || ''} voided successfully.`)
        fetchSales()
        setTimeout(() => setVoidSuccess(''), 6000)
      }
      return result
    }
  }


  return (
    <div className="flex flex-col min-h-full md:h-full md:overflow-hidden" style={{ background: 'var(--bg-page)' }}>

      {/* ── Fixed header ───────────────────────────────── */}
      <div className="flex-shrink-0 px-6 pt-6 pb-3">
        <div className="mb-4">
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
            Sales History
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {isOwner
              ? 'All employee sales — click an employee to expand'
              : `Your sales (last 30 days) — ${currentUser?.fullname || currentUser?.name || currentUser?.username}`
            }
          </p>
        </div>

        {/* Success toasts */}
        {returnSuccess && (
          <div className="p-3 rounded-lg text-sm mb-3 flex items-center gap-2"
            style={{ background: 'var(--success-light)', border: '1px solid var(--success)', color: 'var(--success-dark)' }}>
            <MdCheckCircle className="text-lg flex-shrink-0" /> {returnSuccess}
          </div>
        )}
        {voidSuccess && (
          <div className="p-3 rounded-lg text-sm mb-3 flex items-center gap-2"
            style={{ background: 'var(--danger-light)', border: '1px solid var(--danger)', color: 'var(--danger-dark)' }}>
            <MdCheckCircle className="text-lg flex-shrink-0" /> {voidSuccess}
          </div>
        )}

        {isOwner && pendingReturns.length > 0 && (
          <PendingReturnsPanel pendingReturns={pendingReturns} refreshReturns={fetchReturns} />
        )}

        <SalesStats isOwner={isOwner} filtered={filtered} category={category} />

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

      {/* ── Scrollable content ──────────────────────────── */}
      <div className="md:flex-1 md:overflow-y-auto px-6 pb-6">
        {isOwner ? (
          <OwnerView
            groupedByCashier={groupedByCashier}
            expandedEmployee={expandedEmployee}
            setExpandedEmployee={setExpandedEmployee}
            employeeDateFilter={employeeDateFilter}
            setEmployeeDateFilter={setEmployeeDateFilter}
            isOwner={isOwner}
            setReturnModal={setReturnModal}
            setVoidModal={setVoidModal}
            category={category}
          />
        ) : (
          <EmployeeView
            sortedDates={sortedDates}
            groupedByDate={groupedByDate}
            isOwner={isOwner}
            setReturnModal={setReturnModal}
            setVoidModal={setVoidModal}
            category={category}
          />
        )}
      </div>

      {/* ── Return modal ────────────────────────────────── */}
      {returnModal && (
        <ReturnModal
          sale={returnModal}
          onClose={() => setReturnModal(null)}
          onSuccess={(msg) => {
            setReturnSuccess(msg)
            fetchSales()
            fetchReturns()
            setTimeout(() => setReturnSuccess(''), 6000)
          }}
        />
      )}

      {/* ── Void modal ──────────────────────────────────── */}
      {voidModal && (
        <VoidModal
          sale={voidModal}
          onClose={() => setVoidModal(null)}
          onVoid={handleVoidSubmit}
        />
      )}
    </div>
  )
}
