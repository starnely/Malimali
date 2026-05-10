import { MdSearch } from 'react-icons/md';

export default function ProductFilters({ search, setSearch, categoryFilter, setCategoryFilter, categories }) {
  return (
    <div className="bg-white p-4 rounded-lg shadow mb-4">
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1">
          <MdSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search product..."
            className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 hover:border-blue-500 transition-colors duration-200"
          />
        </div>
        {['All', ...categories].map(cat => (
          <button
            key={cat}
            onClick={() => setCategoryFilter(cat)}
            className={`px-3 py-1 rounded-md border transition-colors duration-200 ${
              categoryFilter === cat
                ? 'bg-blue-800 text-white hover:bg-blue-900'
                : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-100'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>
    </div>
  );
}
