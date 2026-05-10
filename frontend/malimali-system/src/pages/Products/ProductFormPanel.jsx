import {
    MdClose, MdQrCodeScanner, MdKeyboard, MdPrint
} from 'react-icons/md';
import FormInput from './FormInput';
import FormInputDropdown from './FormInputDropdown';

export default function ProductFormPanel({
    showModal, editProduct, mode, setMode,
    barcode, setBarcode, savedBarcode,
    error, success, form, setForm,
    categories, handleScan, saveProduct,
    closeModal, printBarcode
}) {
    return (
        <div
            className={`fixed top-0 right-0 h-full w-[420px] bg-white shadow-2xl z-40 flex flex-col transform transition-transform duration-300 ease-in-out ${showModal ? 'translate-x-0' : 'translate-x-full'
                }`}
        >
            {/* Header */}
            <div className="flex-shrink-0 flex justify-between items-center px-5 py-4 border-b border-gray-200 bg-white">
                <h3 className="text-lg font-semibold truncate pr-2">
                    {editProduct ? `Edit – ${editProduct.name}` : 'Add Product'}
                </h3>
                <button
                    onClick={closeModal}
                    className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors duration-200"
                >
                    <MdClose size={20} />
                </button>
            </div>

            {/* Mode toggle (scan/manual) */}
            {!editProduct && (
                <div className="flex-shrink-0 flex gap-2 px-5 pt-3 pb-2">
                    <button
                        onClick={() => setMode("scan")}
                        className={`flex-1 py-2 rounded flex items-center justify-center gap-2 text-sm font-medium transition-colors ${mode === "scan"
                                ? "bg-blue-800 text-white"
                                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                            }`}
                    >
                        <MdQrCodeScanner /> Scan Product
                    </button>
                    <button
                        onClick={() => setMode("manual")}
                        className={`flex-1 py-2 rounded flex items-center justify-center gap-2 text-sm font-medium transition-colors ${mode === "manual"
                                ? "bg-blue-800 text-white"
                                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                            }`}
                    >
                        <MdKeyboard /> Manual Entry
                    </button>
                </div>
            )}

            {/* Scan mode */}
            {mode === "scan" && !editProduct && (
                <div className="flex-shrink-0 px-5 pb-3">
                    <div className="flex items-center gap-2 mb-2">
                        <span className="relative flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                        </span>
                        <span className="text-green-700 text-xs font-semibold tracking-wide">
                            Scanner Ready
                        </span>
                    </div>
                    <div
                        className={`rounded-lg border-2 transition-colors duration-200 ${success
                                ? "border-green-400 bg-green-50"
                                : error
                                    ? "border-red-400 bg-red-50"
                                    : "border-blue-300 bg-blue-50"
                            }`}
                    >
                        <div className="flex items-center gap-2 px-3 pt-2 pb-1">
                            <MdQrCodeScanner
                                className={`text-lg flex-shrink-0 ${success
                                        ? "text-green-600"
                                        : error
                                            ? "text-red-500"
                                            : "text-blue-600"
                                    }`}
                            />
                            <span className="text-xs font-medium text-gray-600">
                                Point scanner at the product barcode
                            </span>
                        </div>
                        <div className="px-3 pb-2">
                            <input
                                autoFocus
                                type="text"
                                value={barcode}
                                onChange={e => setBarcode(e.target.value)}
                                onKeyDown={e => {
                                    if (e.key === "Enter" && barcode.trim()) handleScan(barcode);
                                }}
                                className={`w-full px-3 py-1.5 border rounded-md text-sm tracking-widest outline-none bg-white focus:ring-2 transition-colors duration-200 ${success
                                        ? "border-green-400 focus:ring-green-200"
                                        : error
                                            ? "border-red-400 focus:ring-red-200"
                                            : "border-blue-200 focus:ring-blue-200"
                                    }`}
                                placeholder="Waiting for scan..."
                            />
                        </div>
                        <div className="px-3 pb-2 flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-gray-400 inline-block"></span>
                            <span className="text-xs text-gray-400">
                                Scanner auto-captures · fill details below then save
                            </span>
                        </div>
                    </div>
                    {error && (
                        <p className="text-red-600 text-xs mt-1.5 px-1 flex items-center gap-1">
                            <MdClose size={12} /> {error}
                        </p>
                    )}
                    {success && (
                        <p className="text-green-600 text-xs mt-1.5 px-1 flex items-center gap-1">
                            ✓ {success}
                        </p>
                    )}
                </div>
            )}

            {/* Form fields */}
            <div className="flex-1 overflow-y-auto px-5 pb-6 pt-2">
                <FormInput
                    label="Product Name"
                    value={form.name}
                    onChange={v => setForm({ ...form, name: v })}
                />
                <FormInputDropdown
                    label="Category"
                    value={form.category}
                    onChange={v => setForm({ ...form, category: v })}
                    options={categories}
                />
                <FormInput
                    label="Buy Price"
                    value={form.buyPrice}
                    onChange={v => setForm({ ...form, buyPrice: v })}
                />
                <FormInput
                    label="Sell Price"
                    value={form.sellPrice}
                    onChange={v => setForm({ ...form, sellPrice: v })}
                />
                <FormInput
                    label="Stock Quantity"
                    value={form.stock}
                    onChange={v => setForm({ ...form, stock: v })}
                />

                {error && <p className="text-red-600 text-sm mt-1">{error}</p>}
                {success && <p className="text-green-600 text-sm mt-1">{success}</p>}

                {/* Barcode display */}
                {savedBarcode && (
                    <div className="mt-4 text-center">
                        <p className="text-sm text-gray-600 mb-2">Generated Barcode:</p>
                        <img
                            src={`http://localhost:5000/products/barcode/${savedBarcode}`}
                            alt="Barcode"
                            className="mx-auto border p-2 rounded shadow max-w-full"
                        />
                        <p className="text-xs text-gray-500 mt-1">{savedBarcode}</p>
                        <div className="flex gap-2 justify-center mt-3">
                            <button
                                onClick={printBarcode}
                                className="bg-purple-700 text-white px-3 py-1.5 rounded hover:bg-purple-800 transition-colors duration-200 flex items-center gap-2 text-sm"
                            >
                                <MdPrint /> Print Barcode
                            </button>
                        </div>
                        <p className="text-xs text-gray-400 mt-2">
                            Form clears in a moment — ready for next product
                        </p>
                    </div>
                )}

                {!savedBarcode && (
                    <div className="flex gap-2 mt-6">
                        <button
                            onClick={saveProduct}
                            className="bg-blue-800 text-white px-4 py-2 rounded hover:bg-blue-900 transition-colors duration-200"
                        >
                            {editProduct ? 'Save Changes' : 'Save Product'}
                        </button>
                        <button
                            onClick={closeModal}
                            className="bg-gray-200 px-4 py-2 rounded hover:bg-gray-300 transition-colors duration-200"
                        >
                            Cancel
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
