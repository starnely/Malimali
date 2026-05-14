import { useState, useEffect, useRef } from 'react'
import { MdDelete, MdAddShoppingCart, MdAdd, MdRemove, MdReceipt } from 'react-icons/md'
import { useSocket } from '../context/SocketContext'
import CheckoutModal from './CheckoutModal'
import Receipt from './Receipt';

export default function Sales() {
  const [products, setProducts] = useState([])
  const [cart, setCart] = useState([])
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('All')
  const [receipt, setReceipt] = useState(null)

  // Add state to control the Checkout Modal
  const [showCheckoutModal, setShowCheckoutModal] = useState(false)

  const searchInput = useRef(null)
  const socket = useSocket()

  // Function to fetch products
  const fetchProducts = () => {
    fetch("http://localhost:5000/products")
      .then(res => res.json())
      .then(data => setProducts(data))
      .catch(err => console.error("Error fetching products:", err))
  }

  useEffect(() => {
    searchInput.current?.focus()
    fetchProducts()
  }, [])

  // Socket Listener for Real-time Updates
  useEffect(() => {
    if (!socket) return
    socket.on("productsUpdated", () => {
      console.log("External update detected. Refreshing products...")
      fetchProducts()
    })

    return () => {
      socket.off("productsUpdated")
    }
  }, [socket])


  const categories = ['All', ...new Set(products.map(p => p.category))]

  const filteredProducts = products
    .filter(p => categoryFilter === 'All' || p.category === categoryFilter)
    .filter(p => p.name.toLowerCase().includes(search.toLowerCase()))

  const addToCart = (product) => {
    const existing = cart.find(c => c._id === product._id)
    if (existing) {
      if (existing.qty + 1 > product.stock)
        return alert('Not enough stock!')
      setCart(cart.map(c => c._id === product._id ? { ...c, qty: c.qty + 1 } : c))
    } else {
      if (product.stock < 1)
        return alert('Out of stock!')
      setCart([...cart, { ...product, qty: 1 }])
    }
  }

  const removeFromCart = (id) => setCart(cart.filter(c => c._id !== id))

  const updateQty = (id, qty) => {
    const product = products.find(p => p._id === id)
    if (!product || qty < 1 || qty > product.stock)
      return
    setCart(cart.map(c => c._id === id ? { ...c, qty } : c))
  }

  const incrementQty = (id) => updateQty(id, cart.find(c => c._id === id).qty + 1)
  const decrementQty = (id) => updateQty(id, cart.find(c => c._id === id).qty - 1)

  const handleCheckoutConfirm = async (paymentData) => {
    const userData = localStorage.getItem("pos_system_user");
    const currentUser = userData ? JSON.parse(userData) : null;
    const token = localStorage.getItem("token");

    const salePayload = {
      store: currentUser?.store || "Main Branch",
      items: cart.map(c => ({
        productId: c._id,
        qty: c.qty,
        price: c.sellPrice,
        name: c.name // Useful for the receipt
      })),
      total: paymentData.finalTotal, // The amount after discount
      cashier: currentUser?.name || "Cashier",
      paymentInfo: {
        ...paymentData, // Spreads all the modal data (paymentMethod, discount, customerName, etc.)
      }
    };

    try {
      const res = await fetch("http://localhost:5000/sales", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(salePayload)
      })

      const data = await res.json()
      if (!data.success) throw new Error(data.error)

      // Set Receipt for display
      setReceipt({
        ...salePayload,
        date: new Date().toLocaleString('en-KE'),
        saleId: data.sale._id
      })

      // Clean up cart and reset search
      setCart([])
      setSearch('')
      setShowCheckoutModal(false) // Close the modal
      searchInput.current?.focus()
    } catch (err) {
      console.error("Error recording sale:", err)
      alert(err.message || "Failed to record sale")
    }
  }

  const total = cart.reduce((sum, c) => sum + c.sellPrice * c.qty, 0)

  return (
    <div className="p-6 min-h-screen bg-gray-100">
      <h1 className="text-xl font-bold mb-4">Point of Sale</h1>

      {/* CATEGORY FILTER */}
      <div className="flex flex-wrap gap-2 mb-4">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setCategoryFilter(cat)}
            className={`px-3 py-1 rounded-md transition-colors duration-200 ${categoryFilter === cat
              ? 'bg-blue-800 text-white hover:bg-blue-900'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* SEARCH */}
      <input
        ref={searchInput}
        type="text"
        placeholder="Search products..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="w-full px-3 py-2 border border-gray-300 rounded-md mb-4 
                   focus:ring-2 focus:ring-blue-500 hover:border-blue-500 transition-colors duration-200"
      />

      {/* PRODUCTS GRID */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-h-[350px] overflow-y-auto mb-6">
        {filteredProducts.map(p => (
          <div
            key={p._id}
            onClick={() => addToCart(p)}
            className="bg-white border border-gray-200 rounded-lg p-3 cursor-pointer 
                       hover:bg-blue-50 hover:border-blue-500 transition-colors duration-200"
          >
            <div className="font-medium mb-1">{p.name}</div>
            <div className="text-xs text-gray-500 mb-1">Stock: {p.stock}</div>
            <div className="font-semibold text-blue-700">KSh {p.sellPrice.toLocaleString()}</div>
          </div>
        ))}
      </div>

      {/* CART */}
      <div className="bg-white p-4 rounded-lg shadow">
        <h2 className="text-lg font-semibold mb-3">Cart</h2>
        {cart.length === 0 ? (
          <p className="text-gray-400">Cart is empty. Add products to start.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50">
                {['Product', 'Qty', 'Price', 'Subtotal', ''].map(h => (
                  <th key={h} className="text-left px-3 py-2 text-xs text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cart.map(item => (
                <tr key={item._id} className="border-t hover:bg-blue-50 transition-colors duration-200">
                  <td className="px-3 py-2">{item.name}</td>
                  <td className="px-3 py-2 flex items-center gap-2">
                    <MdRemove className="cursor-pointer hover:text-red-600 transition-colors duration-200" onClick={() => decrementQty(item._id)} />
                    <input
                      type="number"
                      value={item.qty}
                      min="1"
                      max={item.stock}
                      onChange={e => updateQty(item._id, parseInt(e.target.value))}
                      className="w-14 px-2 py-1 border border-gray-300 rounded text-center text-sm 
                                 focus:ring-2 focus:ring-blue-500 hover:border-blue-500 transition-colors duration-200"
                    />
                    <MdAdd className="cursor-pointer hover:text-green-600 transition-colors duration-200" onClick={() => incrementQty(item._id)} />
                  </td>
                  <td className="px-3 py-2">KSh {item.sellPrice.toLocaleString()}</td>
                  <td className="px-3 py-2 font-semibold text-blue-700">KSh {(item.sellPrice * item.qty).toLocaleString()}</td>
                  <td className="px-3 py-2">
                    <MdDelete className="cursor-pointer text-red-600 hover:text-red-800 transition-colors duration-200" onClick={() => removeFromCart(item._id)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div className="flex justify-between items-center mt-4">
          <div className="text-lg font-bold">Total: KSh {total.toLocaleString()}</div>
          <button
            onClick={() => cart.length > 0 ? setShowCheckoutModal(true) : alert("Cart is empty!")}
            className="flex items-center gap-2 px-4 py-2 bg-blue-800 text-white rounded 
                       hover:bg-blue-900 transition-colors duration-200"
          >
            <MdAddShoppingCart /> Checkout
          </button>
        </div>
      </div>

      {/* CHECKOUT MODAL */}
      {showCheckoutModal && (
        <CheckoutModal
          total={total}
          onClose={() => setShowCheckoutModal(false)}
          onConfirm={handleCheckoutConfirm}
        />
      )}

      {/* RECEIPT MODAL */}
      {receipt && (
        <Receipt
          receipt={receipt}
          onClose={() => {
            setReceipt(null);
            searchInput.current?.focus();
          }}
        />
      )}
    </div>
  )
}