import { MdEdit, MdDelete } from 'react-icons/md';

export default function ProductCardRow({ product, stockBadge, openEdit, setRestockProduct, setDeleteConfirm }) {
  const badge = stockBadge(product.stock);

  return (
    <tr
      key={product._id}
      className="border-t border-gray-200 hover:bg-blue-50 transition-colors duration-200"
    >
      <td className="p-3 text-sm">
        <div className="font-semibold">{product.name}</div>
        <div className="text-xs text-gray-400">{product.category}</div>
      </td>
      <td className="p-3 text-sm font-bold">{product.stock}</td>
      <td className="p-3 text-sm">
        <span className={`${badge.class} px-3 py-1 rounded text-xs font-semibold`}>
          {badge.label}
        </span>
      </td>
      <td className="p-3 text-sm">
        <div className="flex gap-2">
          <button
            onClick={() => openEdit(product)}
            className="p-1 border border-gray-300 rounded bg-white hover:bg-gray-100 transition-colors duration-200"
          >
            <MdEdit />
          </button>
          <button
            onClick={() => setRestockProduct(product)}
            className="bg-green-700 text-white px-2 py-1 rounded hover:bg-green-800 transition-colors duration-200"
          >
            Restock
          </button>
          <button
            onClick={() => setDeleteConfirm(product)}
            className="bg-red-700 text-white px-2 py-1 rounded hover:bg-red-800 transition-colors duration-200"
          >
            <MdDelete />
          </button>
        </div>
      </td>
    </tr>
  );
}
