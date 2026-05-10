import { useState, useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import {
    MdDashboard, MdInventory, MdQrCodeScanner,
    MdPointOfSale, MdHistory, MdBarChart,
    MdLogout, MdMenu, MdClose,
    MdPerson, MdDocumentScanner, MdNotifications,
    MdLockClock, MdArchive, MdCheckCircle
} from 'react-icons/md'
import { useWindowSize } from '@/hooks/useWindowSize'
import { useApp } from '@/context/AppContext'
import styles from '@/styles/Sidebar.module.css'

const ownerLinks = [
    { to: '/', label: 'Dashboard', icon: <MdDashboard /> },
    { to: '/products', label: 'Products', icon: <MdInventory /> },
    { to: '/stock-in', label: 'Stock In', icon: <MdQrCodeScanner /> },
    { to: '/stock-out', label: 'Stock Out', icon: <MdPointOfSale /> },
    { to: '/barcodes', label: 'Barcodes', icon: <MdDocumentScanner /> },
    { to: '/sales-history', label: 'Sales History', icon: <MdHistory /> },
    { to: '/reports', label: 'Reports', icon: <MdBarChart /> },
    { to: '/employees', label: 'Employees', icon: <MdPerson /> },
    { to: '/daily-archives', label: 'Daily Archives', icon: <MdArchive /> },
]

const employeeLinks = [
    { to: '/barcodes', label: 'Scan to Sell', icon: <MdDocumentScanner /> },
    { to: '/stock-out', label: 'Record Sale', icon: <MdPointOfSale /> },
    { to: '/sales-history', label: 'Sales History', icon: <MdHistory /> },
]

// ── Notification Panel ─────────────────────────────────────────────────
function NotificationPanel({ onClose }) {
    const {
        myNotifications, markNotificationRead,
        markAllNotificationsRead, clearNotifications,
        isOwner, currentUser
    } = useApp()

    const target = isOwner ? 'owner' : currentUser?.name

    return (
        <div className="fixed top-0 right-0 h-screen w-[340px] bg-white shadow-[-4px_0_24px_rgba(0,0,0,0.15)] z-[2000] flex flex-col animate-slideInRight">
            <div className="bg-blue-800 px-5 py-4 flex justify-between items-center">
                <div className="text-white text-sm font-bold">🔔 Notifications</div>
                <button onClick={onClose} className="text-white text-xl cursor-pointer"><MdClose /></button>
            </div>

            {myNotifications.length > 0 && (
                <div className="flex gap-2 px-4 py-2 border-b border-gray-200">
                    <button onClick={() => markAllNotificationsRead(target)}
                        className="flex-1 px-2 py-1 border border-gray-300 rounded text-xs bg-gray-100 text-gray-600 hover:bg-gray-200 transition">
                        Mark all read
                    </button>
                    <button onClick={() => clearNotifications(target)}
                        className="flex-1 px-2 py-1 border border-red-500 rounded text-xs bg-red-50 text-red-700 hover:bg-red-100 transition">
                        Clear all
                    </button>
                </div>
            )}

            <div className="flex-1 overflow-y-auto p-3">
                {myNotifications.length === 0 ? (
                    <div className="text-center py-12 text-gray-400 text-sm">
                        <div className="text-3xl mb-2">🔔</div>No notifications yet
                    </div>
                ) : (
                    myNotifications.map(notif => (
                        <div key={notif.id} onClick={() => markNotificationRead(notif.id)}
                            className={`rounded-lg p-3 mb-2 cursor-pointer transition ${notif.read ? 'bg-gray-50 border border-gray-200 opacity-70' : styles[notif.type] || 'bg-blue-50'
                                }`}
                        >
                            <div className={`text-sm ${notif.read ? 'text-gray-600 font-normal' : 'font-medium'}`}>
                                {notif.message}
                            </div>
                            <div className="text-xs text-gray-400 mt-1">
                                {notif.date} · {notif.time}
                                {!notif.read && <span className="ml-2 bg-blue-600 text-white px-2 rounded-full text-[10px]">NEW</span>}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    )
}

// ── Shift Close Confirm ────────────────────────────────────────────────
function ShiftCloseConfirm({ onConfirm, onCancel, stats }) {
    return (
        <div className="fixed inset-0 bg-black/55 z-[3000] flex items-center justify-center p-4 animate-fadeIn">
            <div className="bg-white rounded-xl w-full max-w-sm shadow-2xl overflow-hidden">
                <div className="bg-blue-800 p-5 text-center">
                    <MdLockClock className="text-white text-3xl mx-auto" />
                    <div className="text-white text-base font-bold mt-2">Close My Sales for Today</div>
                    <div className="text-white/70 text-xs mt-1">This will notify the owner that you are done for the day</div>
                </div>
                <div className="p-5">
                    <div className="bg-gray-100 rounded-lg p-3 mb-5">
                        <div className="text-sm font-semibold text-gray-800 mb-2">Your sales summary for today</div>
                        {[
                            { label: 'Transactions', value: stats.transactions },
                            { label: 'Items sold', value: stats.itemsSold },
                            { label: 'Net Revenue', value: `KSh ${stats.revenue.toLocaleString()}` },
                        ].map(row => (
                            <div key={row.label} className="flex justify-between text-sm mb-1">
                                <span className="text-gray-500">{row.label}</span>
                                <span className="text-gray-800 font-semibold">{row.value}</span>
                            </div>
                        ))}
                    </div>
                    <div className="text-xs text-gray-400 mb-5 leading-relaxed text-center">
                        Confirming will mark your shift as closed.
                    </div>
                    <div className="flex gap-2">
                        <button onClick={onCancel} className="flex-1 py-2 border border-gray-300 rounded text-sm text-gray-600 bg-white hover:bg-gray-50 transition">Cancel</button>
                        <button onClick={onConfirm} className="flex-1 py-2 rounded text-sm font-bold text-white bg-blue-800 flex items-center justify-center gap-2 hover:bg-blue-700 transition">
                            <MdLockClock className="text-lg" /> Confirm
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

// ── Sidebar Main Component ──────────────────────────────────────────────
export default function Sidebar({ onLogout }) {
    const { isMobile } = useWindowSize()
    const {
        currentUser, isOwner, unreadCount, sales,
        today, closeShift, hasClosedShiftToday, socket,
        addNotification, fetchArchives, fetchSales
    } = useApp()

    const [isOpen, setIsOpen] = useState(false)
    const [showNotifications, setShowNotifications] = useState(false)
    const [showShiftClose, setShowShiftClose] = useState(false)
    const [shiftCloseSuccess, setShiftCloseSuccess] = useState(false)

    // ✅ FIXED: Listen for the backend confirmation via socket for real-time notification
    useEffect(() => {
        if (socket) {
            // 1. Employee perspective: Confirm their shift was locked
            socket.on("shiftClosedConfirmation", () => {
                setShiftCloseSuccess(true);
                setTimeout(() => setShiftCloseSuccess(false), 5000);
            });

            return () => {
                socket.off("shiftClosedConfirmation");
            };
        }
    }, [socket, isOwner, addNotification, fetchArchives, fetchSales]);

    const links = isOwner ? ownerLinks : employeeLinks
    const empName = currentUser?.name || ''

    // ✅ FIXED: Exclude returned sales to ensure revenue matches Dashboard
    const empTodaySales = sales.filter(s => {
        const saleDate = s.date; 
        return saleDate === today && s.cashier === empName && !s.returned;
    })

    const empStats = {
        transactions: empTodaySales.length,
        itemsSold: empTodaySales.reduce((sum, s) =>
            sum + (s.items?.reduce((q, i) => {
                // Do not count items that were individually returned
                return i.returnStatus === 'approved' ? q : q + i.qty;
            }, 0) || 0), 0),
        // Use netTotal (which accounts for partial returns)
        revenue: empTodaySales.reduce((sum, s) => sum + (s.netTotal || s.total || 0), 0),
    }

    const alreadyClosed = hasClosedShiftToday()

    const handleShiftClose = async () => {
        const result = await closeShift()
        if (result.success) {
            setShowShiftClose(false)
        }
    }

    const sidebarContent = (
        <div className="w-56 h-screen bg-blue-800 p-5 flex flex-col gap-2">
            {/* Header */}
            <div className="text-white text-lg font-semibold mb-2 pb-4 border-b border-white/20 flex justify-between items-center">
                Malimali POS
                {isMobile && <MdClose onClick={() => setIsOpen(false)} className="cursor-pointer text-xl" />}
            </div>

            {/* User card */}
            <div className="flex items-center gap-2 p-2 mb-3 bg-white/10 rounded-lg">
                <div className="w-8 h-8 rounded-full bg-white/30 flex items-center justify-center">
                    <MdPerson className="text-white" />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="text-white text-sm font-semibold truncate">{currentUser?.name}</div>
                    <div className="text-white/60 text-[10px] uppercase tracking-wider font-bold">{currentUser?.role}</div>
                </div>
                <button onClick={() => setShowNotifications(true)} className="relative p-1 bg-transparent border-none cursor-pointer">
                    <MdNotifications className="text-white text-xl" />
                    {unreadCount > 0 && (
                        <div className="absolute top-0 right-0 bg-red-600 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                            {unreadCount > 9 ? '9+' : unreadCount}
                        </div>
                    )}
                </button>
            </div>

            {/* ✅ FIXED: Visual confirmation of shift closure */}
            {shiftCloseSuccess && (
                <div className="bg-green-500 border border-green-400 rounded-lg p-3 text-xs text-white mb-3 shadow-lg animate-bounce">
                    <div className="font-bold flex items-center gap-1">
                        <MdCheckCircle /> Shift Closed!
                    </div>
                    <p className="mt-1 opacity-90">Owner has been notified of your summary.</p>
                </div>
            )}

            {/* Nav links */}
            <div className="flex flex-col gap-1">
                {links.map(link => (
                    <NavLink
                        key={link.to} to={link.to} end
                        onClick={() => isMobile && setIsOpen(false)}
                        className={({ isActive }) =>
                            `px-3 py-2 rounded-lg flex items-center gap-2 text-sm transition
                             ${isActive ? 'bg-white text-blue-800 font-semibold shadow-inner' : 'text-gray-200 hover:bg-blue-700'}`
                        }
                    >
                        <span className="text-lg">{link.icon}</span>
                        {link.label}
                    </NavLink>
                ))}
            </div>

            {/* ✅ FIXED: High-visibility Close Shift button for employees */}
            {!isOwner && (
                <button
                    onClick={() => !alreadyClosed && setShowShiftClose(true)}
                    disabled={alreadyClosed}
                    className={`mt-4 px-3 py-2.5 flex items-center justify-center gap-2 rounded-lg text-sm font-bold transition-all ${alreadyClosed
                        ? 'bg-gray-500/50 text-gray-300 cursor-not-allowed border border-white/10'
                        : 'bg-orange-500 hover:bg-orange-600 text-white shadow-md active:scale-95'
                        }`}
                >
                    <MdLockClock className="text-lg" />
                    {alreadyClosed ? 'Shift Closed ✓' : 'Close My Shift'}
                </button>
            )}

            {/* Logout */}
            <button onClick={onLogout} className="mt-auto px-3 py-2 bg-white/10 text-white text-sm flex items-center gap-2 rounded-lg hover:bg-white/20 transition">
                <MdLogout /> Logout
            </button>
        </div>
    )

    return (
        <>
            {/* Notification Overlay */}
            {showNotifications && (
                <>
                    <div onClick={() => setShowNotifications(false)} className="fixed inset-0 bg-black/30 z-[1999]" />
                    <NotificationPanel onClose={() => setShowNotifications(false)} />
                </>
            )}

            {/* Shift Closure Modal */}
            {showShiftClose && (
                <ShiftCloseConfirm stats={empStats} onConfirm={handleShiftClose} onCancel={() => setShowShiftClose(false)} />
            )}

            {/* Layout Handling */}
            {isMobile ? (
                <>
                    <div className="fixed top-0 left-0 right-0 h-14 bg-blue-800 flex items-center justify-between px-4 z-[999]">
                        <span className="text-white font-semibold">Malimali POS</span>
                        <div className="flex items-center gap-3">
                            <button onClick={() => setShowNotifications(true)} className="relative p-1">
                                <MdNotifications className="text-white text-2xl" />
                                {unreadCount > 0 && <div className="absolute top-0 right-0 bg-red-600 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center">{unreadCount}</div>}
                            </button>
                            <MdMenu onClick={() => setIsOpen(true)} className="text-white text-2xl cursor-pointer" />
                        </div>
                    </div>
                    {isOpen && <div onClick={() => setIsOpen(false)} className="fixed inset-0 bg-black/40 z-[1000]" />}
                    <div className={`fixed top-0 left-0 h-screen z-[1001] transition-transform duration-200 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                        {sidebarContent}
                    </div>
                </>
            ) : (
                <div className="fixed top-0 left-0 h-screen z-[100] shadow-xl">{sidebarContent}</div>
            )}
        </>
    )
}