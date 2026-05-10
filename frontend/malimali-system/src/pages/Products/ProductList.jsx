import ProductCardRow from './ProductCardRow';

export default function ProductList({ filtered, stockBadge, openEdit, setRestockProduct, setDeleteConfirm }) {
  return (
    <div className="flex-1 overflow-hidden px-6 pb-6">
      <div className="bg-white rounded-lg shadow h-full flex flex-col">
        {/* Table header */}
        <div className="flex-shrink-0">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-50">
                {['Product', 'Stock', 'Status', 'Actions'].map(h => (
                  <th
                    key={h}
                    className="p-3 text-left text-xs text-gray-500"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
          </table>
        </div>

        {/* Table body */}
        <div className="flex-1 overflow-y-auto">
          <table className="w-full border-collapse">
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan="4"
                    className="p-8 text-center text-sm text-gray-400"
                  >
                    No products found
                  </td>
                </tr>
              ) : (
                filtered.map(p => (
                  <ProductCardRow
                    key={p._id}
                    product={p}
                    stockBadge={stockBadge}
                    openEdit={openEdit}
                    setRestockProduct={setRestockProduct}
                    setDeleteConfirm={setDeleteConfirm}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
