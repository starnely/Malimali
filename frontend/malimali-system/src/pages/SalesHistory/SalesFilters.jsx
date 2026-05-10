import { MdSearch } from 'react-icons/md';

export default function SalesFilters({ search, setSearch, dateFrom, setDateFrom, dateTo, setDateTo, category, setCategory, categories }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3">
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[160px]">
          <MdSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search product..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <input
          type="date"
          value={dateFrom}
          onChange={e => setDateFrom(e.target.value)}
          className="p-2 border border-gray-300 rounded-md text-sm hover:border-blue-500 focus:ring-2 focus:ring-blue-500"
        />
        <input
          type="date"
          value={dateTo}
          onChange={e => setDateTo(e.target.value)}
          className="p-2 border border-gray-300 rounded-md text-sm hover:border-blue-500 focus:ring-2 focus:ring-blue-500"
        />
        <div className="flex gap-1 flex-wrap">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`px-2 py-1 rounded text-xs border transition-colors duration-150 ${
                category === cat
                  ? 'bg-blue-800 text-white'
                  : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-100'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
