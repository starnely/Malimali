export default function EmptyState({ message = 'No sales found.' }) {
    return (
        <div className="bg-white border border-gray-200 rounded-lg p-12 text-center text-gray-400 text-sm mt-2">
            {message}
        </div>
    );
}
