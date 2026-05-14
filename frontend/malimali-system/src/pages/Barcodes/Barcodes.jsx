import { useState, useEffect, useRef } from 'react';
import { MdPointOfSale, MdTableChart, MdBarChart } from 'react-icons/md';
import { useApp } from '@/context/AppContext';
import s from '@/styles/Barcodes.module.css';

// Subcomponents
import Receipt from './Receipt';
import CheckoutModal from './CheckoutModal';
import ProductBarcodesTable from './ProductBarcodesTable';
import ScanPanel from './ScanPanel';
import GenerateBarcodes from './GenerateBarcodes';

export default function Barcodes() {
    const { products, recordMultipleSales, currentUser, fetchProducts } = useApp();

    // State
    const [tab, setTab] = useState('scan');
    const [scanInput, setScanInput] = useState('');
    const [cart, setCart] = useState([]);
    const [scanError, setScanError] = useState('');
    const [lastScanned, setLastScanned] = useState(null);
    const [receipt, setReceipt] = useState(null);
    const [showCheckout, setShowCheckout] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const scanInputRef = useRef(null);

    // 2. Add this Effect to sync data whenever the POS is opened
    useEffect(() => {
        if (fetchProducts) {
            fetchProducts();
        }
    }, [fetchProducts]);

    // Focus scanner input when active
    useEffect(() => {
        if (tab === 'scan' && !showCheckout && !receipt) {
            scanInputRef.current?.focus();
        }
    }, [tab, showCheckout, receipt, cart]);

    // Helpers
    const findProduct = (code) => {
        const trimmed = String(code).trim();
        return products.find(p =>
            String(p.barcode) === trimmed || String(p._id) === trimmed
        );
    };

    const addToCart = (code) => {
        const trimmed = String(code).trim();
        if (!trimmed) return;
        const product = findProduct(trimmed);
        if (!product) {
            setScanError(`No product found for: "${trimmed}"`);
            setLastScanned(null);
            return;
        }
        setScanError('');
        setLastScanned(product);
        setCart(prev => {
            const existing = prev.find(item => item._id === product._id);
            if (existing) {
                if (existing.qty >= product.stock) {
                    setScanError(`Max stock reached for ${product.name} (${product.stock} items)`);
                    return prev;
                }
                return prev.map(item =>
                    item._id === product._id
                        ? { ...item, qty: item.qty + 1, total: (item.qty + 1) * item.sellPrice }
                        : item
                );
            }
            if (product.stock < 1) {
                setScanError(`${product.name} is out of stock!`);
                return prev;
            }
            return [...prev, {
                _id: product._id,
                id: product._id,
                name: product.name,
                category: product.category,
                sellPrice: product.sellPrice,
                buyPrice: product.buyPrice,
                stock: product.stock,
                qty: 1,
                total: product.sellPrice,
            }];
        });
    };

    const handleScanKeyDown = (e) => {
        if (e.key === 'Enter') {
            addToCart(scanInput);
            setScanInput('');
        }
    };

    const updateQty = (id, newQty) => {
        const product = products.find(p => p._id === id);
        if (!product) return;
        if (newQty < 1) { removeFromCart(id); return; }
        if (newQty > product.stock) return;
        setCart(prev => prev.map(item =>
            item._id === id ? { ...item, qty: newQty, total: newQty * item.sellPrice } : item
        ));
    };

    const removeFromCart = (id) => setCart(prev => prev.filter(item => item._id !== id));
    const clearCart = () => { setCart([]); setScanError(''); setLastScanned(null); };

    const cartTotal = cart.reduce((sum, item) => sum + item.total, 0);
    const cartCount = cart.reduce((sum, item) => sum + item.qty, 0);

    const handleCheckoutConfirm = async (paymentDetails) => {
        const paymentInfo = {
            paymentMethod: paymentDetails.paymentMethod,
            mpesaPhone: paymentDetails.mpesaPhone,
            customerName: paymentDetails.customerName,
            cashPart: paymentDetails.cashPart,
            mpesaPart: paymentDetails.mpesaPart,
            store: currentUser?.store || "Main Store",
            cashier: currentUser?.name || "Unknown Cashier"
        };

        const result = await recordMultipleSales(cart, paymentInfo);

        if (result.success) {
            setReceipt({
                receiptId: result.sale.receiptId,
                date: result.sale.date,
                time: result.sale.time,
                items: cart,
                total: cartTotal,
                finalTotal: paymentDetails.finalTotal,
                discount: paymentDetails.discount,
                paymentMethod: paymentDetails.paymentMethod,
                cashGiven: paymentDetails.cashGiven,
                change: paymentDetails.change,
                customerName: paymentDetails.customerName,
                mpesaPhone: paymentDetails.mpesaPhone,
                cashPart: paymentDetails.cashPart,
                mpesaPart: paymentDetails.mpesaPart,
                soldBy: result.sale.cashier || currentUser?.name || "Cashier",
                store: result.sale.store || currentUser?.store || "Main Store"
            });
            setCart([]);
            setLastScanned(null);
            setScanError("");
            setShowCheckout(false);
        } else {
            setScanError(result.error || 'Failed to record sale');
            setShowCheckout(false);
        }
    };

    const handleDownload = (product) => {
        const canvas = document.createElement('canvas');
        canvas.width = 320; canvas.height = 160;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 320, 160);
        const svg = document.getElementById(`barcode-dl-${product._id}`);
        if (!svg) return;
        const svgData = new XMLSerializer().serializeToString(svg);
        const img = new Image();
        img.onload = () => {
            ctx.drawImage(img, 10, 8, 300, 80);
            ctx.fillStyle = '#333333'; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center';
            ctx.fillText(product.name, 160, 112);
            ctx.font = '12px sans-serif'; ctx.fillStyle = '#185FA5';
            ctx.fillText(`KSh ${Number(product.sellPrice).toLocaleString()}`, 160, 130);
            ctx.fillStyle = '#aaaaaa'; ctx.font = '11px sans-serif';
            ctx.fillText(`Barcode: ${product.barcode}`, 160, 148);
            const link = document.createElement('a');
            link.download = `${product.name}-barcode.png`;
            link.href = canvas.toDataURL(); link.click();
        };
        img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
    };

    const tabBtn = (id, label, icon) => (
        <button
            key={id}
            onClick={() => setTab(id)}
            className={`${s.tabBtn} ${tab === id ? s.tabBtnActive : ''}`}
        >
            {icon} {label}
        </button>
    );

    return (
        <div className={s.page}>
            {receipt && (
                <Receipt receipt={receipt} onClose={() => {
                    setReceipt(null);
                    setTimeout(() => scanInputRef.current?.focus(), 100);
                }} />
            )}
            {showCheckout && (
                <CheckoutModal
                    cartTotal={cartTotal}
                    onConfirm={handleCheckoutConfirm}
                    onCancel={() => {
                        setShowCheckout(false);
                        setTimeout(() => scanInputRef.current?.focus(), 100);
                    }}
                />
            )}

            <div className={s.pageHeader}>
                <h1 className={s.pageTitle}>POS Terminal</h1>
                <p className={s.pageSubtitle}>Scan products · Build cart · Confirm · Print receipt</p>
            </div>

            <div className={s.tabs}>
                {tabBtn('scan', 'Scan to Sell', <MdPointOfSale style={{ fontSize: '18px' }} />)}
                {tabBtn('barcodes', 'Product Barcodes', <MdTableChart style={{ fontSize: '18px' }} />)}
                {tabBtn('generate', 'Generate Barcodes', <MdBarChart style={{ fontSize: '18px' }} />)}
            </div>

            {tab === 'scan' && (
                <ScanPanel
                    cart={cart}
                    cartTotal={cartTotal}
                    cartCount={cartCount}
                    scanError={scanError}
                    lastScanned={lastScanned}
                    scanInput={scanInput}
                    setScanInput={setScanInput}
                    handleScanKeyDown={handleScanKeyDown}
                    updateQty={updateQty}
                    removeFromCart={removeFromCart}
                    clearCart={clearCart}
                    setShowCheckout={setShowCheckout}
                    scanInputRef={scanInputRef}
                />
            )}

            {tab === 'barcodes' && (
                <ProductBarcodesTable
                    products={products}
                    onGoToScan={() => setTab('scan')}
                />
            )}

            {tab === 'generate' && (
                <GenerateBarcodes
                    products={products}
                    searchQuery={searchQuery}
                    setSearchQuery={setSearchQuery}
                    handleDownload={handleDownload}
                />
            )}
        </div>
    );
}
