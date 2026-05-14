import { useState, useEffect } from 'react';
import { MdCheckCircle } from 'react-icons/md';
import ReturnModal from '@/components/modals/ReturnModal';
import PendingReturnsPanel from '@/components/panels/PendingReturnsPanel';
import { useSocket } from '@/context/SocketContext';
import { useApp } from '@/context/AppContext';

// Split components
import SalesFilters from './SalesFilters';
import SalesStats from './SalesStats';
import OwnerView from './OwnerView';
import EmployeeView from './EmployeeView';

const categories = ['All', 'Furniture', 'Bedding', 'Utensils', 'Cleaning', 'Accessories'];

// ── Sunday reset cutoff ────────────────────────────────────────────────
function getLastSundayMidnight() {
    const now = new Date();
    const day = now.getDay();
    const lastSunday = new Date(now);
    lastSunday.setDate(now.getDate() - (day === 0 ? 7 : day));
    lastSunday.setHours(0, 0, 0, 0);
    return lastSunday;
}

export default function SalesHistory() {
    const [search, setSearch] = useState('');
    const [category, setCategory] = useState('All');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [returnModal, setReturnModal] = useState(null);
    const [returnSuccess, setReturnSuccess] = useState('');
    const [expandedEmployee, setExpandedEmployee] = useState(null);
    const [employeeDateFilter, setEmployeeDateFilter] = useState({});

    const socket = useSocket();
    const { isOwner, currentUser, sales, fetchSales, fetchReturns, pendingReturns } = useApp();

    // const fetchSales = async () => {
    // try {
    // const user = JSON.parse(localStorage.getItem("malimali_current_user"));
    // const res = await fetch("http://localhost:5000/sales", {
    // headers: { Authorization: `Bearer ${user?.token}` }
    // });
    // const data = await res.json();
    // setSales(Array.isArray(data) ? data : []);
    // } catch (err) {
    // console.error("Error fetching sales:", err);
    // setSales([]);
    // }
    // };

    // const fetchReturns = async () => {
    // try {
    // const user = JSON.parse(localStorage.getItem("malimali_current_user"));
    // const res = await fetch("http://localhost:5000/returns?status=pending", {
    // headers: { Authorization: `Bearer ${user?.token}` }
    // });
    // const data = await res.json();
    // setPendingReturns(Array.isArray(data) ? data : []);
    // } catch (err) {
    // console.error("Error fetching returns:", err);
    // setPendingReturns([]);
    // }
    // };

    useEffect(() => {
        fetchSales();
        fetchReturns();

        if (!socket) return;

        // Listener for returns
        socket.on("returnUpdated", () => {
            fetchReturns();
            fetchSales();
        });

        // ✅ ADD THIS: Listener for shift closures to refresh the history list
        socket.on("adminShiftNotification", () => {
            if (isOwner) {
                console.log("Refreshing sales history due to shift closure...");
                fetchSales();
                fetchReturns();
            }
        });

        return () => {
            socket.off("returnUpdated");
            socket.off("adminShiftNotification"); // Clean up
        };
    }, [socket, isOwner, fetchSales, fetchReturns]); // Added dependencies

    // ── Role-based filtering ───────────────────────────────────────────────
    const mySales = isOwner ? sales : sales.filter(s => s.cashier === currentUser?.name);

    // Employee: only show current week (since last Sunday)
    const lastSunday = getLastSundayMidnight();
    const visibleSales = isOwner ? mySales : mySales.filter(s => new Date(s.date) >= lastSunday);

    // Apply global filters
    const filtered = visibleSales.filter(s => {
        const matchSearch = !search || s.items?.some(i =>
            i.productId?.name?.toLowerCase().includes(search.toLowerCase())
        );
        const matchCat = category === 'All' || s.items?.some(i => i.productId?.category === category);
        const matchFrom = !dateFrom || new Date(s.date) >= new Date(dateFrom);
        const matchTo = !dateTo || new Date(s.date) <= new Date(dateTo + 'T23:59:59');
        return matchSearch && matchCat && matchFrom && matchTo;
    });

    // ✅ Uses qty=0 as fallback when isFullyReturned is not set on old data
const totalRevenue = filtered
    .filter(s => !s.returned)
    .reduce((sum, s) =>
        sum + (s.items?.reduce((iSum, i) =>
            iSum + ((i.isFullyReturned || i.qty === 0) ? 0 : (i.qty * i.price)), 0) || 0)
    , 0);

const totalItemsSold = filtered
    .filter(s => !s.returned)
    .reduce((sum, s) =>
        sum + (s.items?.reduce((q, i) =>
            q + ((i.isFullyReturned || i.qty === 0) ? 0 : (i.qty || 0)), 0) || 0)
    , 0);

    // ── Owner: group by cashier ────────────────────────────────────────────
    const groupedByCashier = filtered.reduce((groups, sale) => {
        const cashier = sale.cashier || 'Unknown';
        if (!groups[cashier]) groups[cashier] = [];
        groups[cashier].push(sale);
        return groups;
    }, {});

    // ── Employee: group by date ────────────────────────────────────────────
    const groupedByDate = filtered.reduce((groups, sale) => {
        const d = new Date(sale.date);
        if (isNaN(d)) return groups;
        const day = d.toLocaleDateString('en-CA');
        if (!groups[day]) groups[day] = [];
        groups[day].push(sale);
        return groups;
    }, {});
    const sortedDates = Object.keys(groupedByDate).sort((a, b) => b.localeCompare(a));

    return (
        <div className="flex flex-col h-screen overflow-hidden bg-gray-100">
            {/* Header */}
            <div className="flex-shrink-0 px-6 pt-6 pb-3">
                <div className="mb-4">
                    <h1 className="text-lg font-semibold text-gray-800">Sales History</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        {isOwner
                            ? 'All employee sales — click an employee to expand'
                            : `Your sales this week — ${currentUser?.name}`}
                    </p>
                </div>

                {/* Return success */}
                {returnSuccess && (
                    <div className="bg-green-100 text-green-800 p-3 rounded-md text-sm mb-3 flex items-center gap-2">
                        <MdCheckCircle className="text-lg flex-shrink-0" /> {returnSuccess}
                    </div>
                )}

                {/* Pending returns panel — owner only */}
                {isOwner && pendingReturns.length > 0 && (
                    <PendingReturnsPanel pendingReturns={pendingReturns} refreshReturns={fetchReturns} />
                )}

                {/* Stats */}
                <SalesStats
                    isOwner={isOwner}
                    totalRevenue={totalRevenue}
                    filtered={filtered}
                    totalItemsSold={totalItemsSold}
                />

                {/* Filters */}
                <SalesFilters
                    search={search}
                    setSearch={setSearch}
                    dateFrom={dateFrom}
                    setDateFrom={setDateFrom}
                    dateTo={dateTo}
                    setDateTo={setDateTo}
                    category={category}
                    setCategory={setCategory}
                    categories={categories}
                />
            </div>

            {/* Scrollable list */}
            <div className="flex-1 overflow-y-auto px-6 pb-6">
                {isOwner ? (
                    <OwnerView
                        groupedByCashier={groupedByCashier}
                        expandedEmployee={expandedEmployee}
                        setExpandedEmployee={setExpandedEmployee}
                        employeeDateFilter={employeeDateFilter}
                        setEmployeeDateFilter={setEmployeeDateFilter}
                        isOwner={isOwner}
                        setReturnModal={setReturnModal}
                    />
                ) : (
                    <EmployeeView
                        sortedDates={sortedDates}
                        groupedByDate={groupedByDate}
                        isOwner={isOwner}
                        setReturnModal={setReturnModal}
                    />
                )}
            </div>

            {/* Return modal */}
            {returnModal && (
                <ReturnModal
                    sale={returnModal}
                    onClose={() => setReturnModal(null)}
                    onSuccess={(msg) => {
                        setReturnSuccess(msg);
                        fetchSales();
                        fetchReturns();
                        setTimeout(() => setReturnSuccess(''), 6000);
                    }}
                />
            )}
        </div>
    );
}
