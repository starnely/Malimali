import { MdClose } from 'react-icons/md';
import FormInput from './FormInput';

export default function RestockModal({ restockProduct, restockQty, setRestockQty, confirmRestock, setRestockProduct }) {
    if (!restockProduct) return null;

    return (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-2xl w-[360px] p-6">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold">Restock – {restockProduct.name}</h3>
                    <button
                        onClick={() => setRestockProduct(null)}
                        className="text-gray-500 hover:text-red-600 transition-colors duration-200"
                    >
                        <MdClose size={20} />
                    </button>
                </div>
                <div className="mb-4 text-sm">
                    <b>{restockProduct.name}</b><br />
                    Current Stock: {restockProduct.stock}
                </div>
                <FormInput label="Quantity to Add" value={restockQty} onChange={setRestockQty} />
                <div className="flex gap-2 mt-6">
                    <button
                        onClick={confirmRestock}
                        className="bg-blue-800 text-white px-4 py-2 rounded hover:bg-blue-900 transition-colors duration-200"
                    >
                        Update Stock
                    </button>
                    <button
                        onClick={() => setRestockProduct(null)}
                        className="bg-gray-200 px-4 py-2 rounded hover:bg-gray-300 transition-colors duration-200"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
}
