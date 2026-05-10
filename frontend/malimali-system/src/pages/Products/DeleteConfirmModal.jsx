import { MdWarning } from 'react-icons/md';

export default function DeleteConfirmModal({ deleteConfirm, handleDeleteConfirmed, setDeleteConfirm }) {
    if (!deleteConfirm) return null;

    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-2xl w-[360px] p-6 animate-slideUp">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                        <MdWarning className="text-red-600 text-xl" />
                    </div>
                    <div>
                        <h3 className="text-base font-semibold text-gray-800">Delete Product</h3>
                        <p className="text-xs text-gray-500">This action cannot be undone</p>
                    </div>
                </div>
                <p className="text-sm text-gray-600 mb-6">
                    Are you sure you want to delete <span className="font-semibold text-gray-800">"{deleteConfirm.name}"</span>?
                    All associated data will be removed.
                </p>
                <div className="flex gap-2">
                    <button
                        onClick={() => setDeleteConfirm(null)}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm text-gray-600 bg-white hover:bg-gray-100 transition-colyesors duration-200"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleDeleteConfirmed}
                        className="flex-1 px-3 py-2 rounded text-sm font-semibold bg-red-600 text-white hover:bg-red-700 transition-colors duration-200"
                    >
                        Yes, Delete
                    </button>
                </div>
            </div>
        </div>
    );
}
