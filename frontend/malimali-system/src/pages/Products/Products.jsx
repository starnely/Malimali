import { useState, useEffect } from 'react';
import { MdAdd } from 'react-icons/md';
import { useLocation } from 'react-router-dom';
import { useApp } from '@/context/AppContext';

// Components
import ProductFilters from './ProductFilters';
import ProductList from './ProductList';
import ProductFormPanel from './ProductFormPanel';
import RestockModal from './RestockModal';
import DeleteConfirmModal from './DeleteConfirmModal';

// ✅ Added Accessories to match backend enum
const categories = ['Furniture', 'Bedding', 'Utensils', 'Cleaning', 'Accessories'];

const stockBadge = (stock) => {
    if (stock <= 3) return { class: "bg-red-200 text-red-800", label: 'Critical' };
    if (stock <= 6) return { class: "bg-yellow-200 text-yellow-800", label: 'Low' };
    return { class: "bg-green-200 text-green-800", label: 'In Stock' };
};

const emptyForm = { name: '', category: 'Furniture', buyPrice: '', sellPrice: '', stock: '' };

export default function Products() {
    const { products: contextProducts, fetchProducts, currentUser } = useApp();
    const products = Array.isArray(contextProducts) ? contextProducts : [];

    const location = useLocation();
    const [search, setSearch] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('All');
    const [showModal, setShowModal] = useState(false);
    const [editProduct, setEditProduct] = useState(null);
    const [restockProduct, setRestockProduct] = useState(null);
    const [restockQty, setRestockQty] = useState('');
    const [deleteConfirm, setDeleteConfirm] = useState(null);
    const [form, setForm] = useState(emptyForm);
    const [mode, setMode] = useState("manual");
    const [barcode, setBarcode] = useState("");
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [savedBarcode, setSavedBarcode] = useState("");

    const showLowStockOnly = location.state?.filter === 'lowStock';

    useEffect(() => { fetchProducts(); }, []);

    useEffect(() => {
        if (location.state?.productToEdit) openEdit(location.state.productToEdit);
    }, [location.state]);

    let filtered = products
        .filter(p => {
            const matchSearch = p.name.toLowerCase().includes(search.toLowerCase());
            const matchCat = categoryFilter === 'All' || p.category === categoryFilter;
            const matchLow = showLowStockOnly ? p.stock <= 6 : true;
            return matchSearch && matchCat && matchLow;
        })
        .sort((a, b) => a.stock - b.stock);

    const openAdd = () => {
        setEditProduct(null);
        setForm(emptyForm);
        setMode("manual");
        setBarcode("");
        setSavedBarcode("");
        setError("");
        setSuccess("");
        setShowModal(true);
    };

    const openEdit = (product) => {
        setEditProduct(product);
        setForm({
            name: product.name,
            category: product.category,
            buyPrice: product.buyPrice,
            sellPrice: product.sellPrice,
            stock: product.stock
        });
        setMode("manual");
        setBarcode("");
        setSavedBarcode("");
        setError("");
        setSuccess("");
        setShowModal(true);
    };

    const closeModal = () => {
        setShowModal(false);
        setEditProduct(null);
        setError("");
        setSuccess("");
        setSavedBarcode("");
    };

    const handleScan = (barcodeValue) => {
        const code = barcodeValue || barcode;
        if (!code.trim()) return;
        setBarcode(code.trim());
        setSuccess("Barcode captured — fill in the product details below and save");
        setError("");
    };

    const saveProduct = async () => {
        if (!form.name || !form.buyPrice || !form.sellPrice || !form.stock) {
            setError("Please fill in all fields");
            return;
        }
        if (Number(form.sellPrice) < Number(form.buyPrice)) {
            setError("Sell price must be at least as high as buy price");
            return;
        }

        const data = {
            name: form.name,
            category: form.category,
            buyPrice: Number(form.buyPrice),
            sellPrice: Number(form.sellPrice),
            stock: Number(form.stock),
            barcode: barcode.trim() || undefined
        };

        try {
            const url = editProduct
                ? `http://localhost:5000/products/${editProduct._id}`
                : "http://localhost:5000/products";
            const method = editProduct ? "PUT" : "POST";

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${currentUser?.token}` },
                body: JSON.stringify(data),
            });
            const result = await res.json();

            if (result.success) {
                setSuccess(editProduct ? "Product updated successfully" : "Product saved successfully");
                setError("");
                fetchProducts();

                if (editProduct) {
                    setTimeout(() => closeModal(), 1000);
                } else {
                    if (result.product?.barcode) setSavedBarcode(result.product.barcode);
                    setTimeout(() => {
                        setForm(emptyForm);
                        setBarcode("");
                        setSavedBarcode("");
                        setSuccess("");
                        setError("");
                    }, 3000);
                }
            } else {
                setError(result.message || "Error saving product");
            }
        } catch (err) {
            console.error("Save error:", err);
            setError("Error saving product");
        }
    };

    const confirmRestock = async () => {
        if (!restockQty || isNaN(restockQty)) return;
        try {
            await fetch(`http://localhost:5000/products/${restockProduct._id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${currentUser?.token}` },
                body: JSON.stringify({ stock: restockProduct.stock + Number(restockQty) }),
            });
            fetchProducts();
        } catch (err) { console.error("Error restocking:", err); }
        setRestockProduct(null);
        setRestockQty('');
    };

    const handleDeleteConfirmed = async () => {
        if (!deleteConfirm) return;
        try {
            await fetch(`http://localhost:5000/products/${deleteConfirm._id}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${currentUser?.token}` }
            });
            fetchProducts();
        } catch (err) { console.error("Error deleting product:", err); }
        setDeleteConfirm(null);
    };

    const printBarcode = () => {
        if (savedBarcode) window.open(`http://localhost:5000/products/barcode/${savedBarcode}`, "_blank");
    };

    return (
        <div className="flex h-screen overflow-hidden bg-gray-100">
            {/* MAIN CONTENT */}
            <div className={`flex flex-col flex-1 min-w-0 transition-all duration-300 ${showModal ? 'mr-[420px]' : ''}`}>
                {/* HEADER */}
                <div className="flex-shrink-0 px-6 pt-6 pb-3">
                    <div className="flex justify-between items-center mb-4">
                        <div>
                            <h1 className="text-xl font-bold">Products</h1>
                            <p className="text-sm text-gray-500">{filtered.length} items</p>
                        </div>
                        <button
                            onClick={openAdd}
                            className="bg-blue-800 text-white px-4 py-2 rounded flex items-center gap-2 hover:bg-blue-900 transition-colors duration-200"
                        >
                            <MdAdd /> Add Product
                        </button>
                    </div>
                    {/* Filters */}
                    <ProductFilters
                        search={search}
                        setSearch={setSearch}
                        categoryFilter={categoryFilter}
                        setCategoryFilter={setCategoryFilter}
                        categories={categories}
                    />
                </div>

                {/* Product list */}
                <ProductList
                    filtered={filtered}
                    stockBadge={stockBadge}
                    openEdit={openEdit}
                    setRestockProduct={setRestockProduct}
                    setDeleteConfirm={setDeleteConfirm}
                />
            </div>

            {/* Side panel */}
            <ProductFormPanel
                showModal={showModal}
                editProduct={editProduct}
                mode={mode}
                setMode={setMode}
                barcode={barcode}
                setBarcode={setBarcode}
                savedBarcode={savedBarcode}
                error={error}
                success={success}
                form={form}
                setForm={setForm}
                categories={categories}
                handleScan={handleScan}
                saveProduct={saveProduct}
                closeModal={closeModal}
                printBarcode={printBarcode}
            />

            {/* Modals */}
            <RestockModal
                restockProduct={restockProduct}
                restockQty={restockQty}
                setRestockQty={setRestockQty}
                confirmRestock={confirmRestock}
                setRestockProduct={setRestockProduct}
            />
            <DeleteConfirmModal
                deleteConfirm={deleteConfirm}
                handleDeleteConfirmed={handleDeleteConfirmed}
                setDeleteConfirm={setDeleteConfirm}
            />
        </div>
    );
}
