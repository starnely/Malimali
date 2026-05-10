export default function FormInput({ label, value, onChange }) {
  return (
    <div className="mb-4">
      <label className="block text-sm text-gray-600 mb-1">{label}</label>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 hover:border-blue-500 transition-colors duration-200"
      />
    </div>
  );
}
