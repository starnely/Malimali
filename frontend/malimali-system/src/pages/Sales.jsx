import { useState, useEffect, useRef } from 'react'
import { MdDelete, MdAddShoppingCart, MdAdd, MdRemove, MdReceipt } from 'react-icons/md'
import { useSocket } from '../context/SocketContext' // Added socket hook import

export default function Sales() {
  const [products, setProducts] = useState([])
  const [cart, setCart] = useState([])
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('All')
  const [receipt, setReceipt] = useState(null)
  const searchInput = useRef(null)
  
  const socket = useSocket() // Initialize socket

  // Function to fetch products (reusable for initial load and socket updates)
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

    // When the backend says products have changed, refresh our list
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
      if (existing.qty + 1 > product.stock) return alert('Not enough stock!')
      setCart(cart.map(c => c._id === product._id ? { ...c, qty: c.qty + 1 } : c))
    } else {
      if (product.stock < 1) return alert('Out of stock!')
      setCart([...cart, { ...product, qty: 1 }])
    }
  }

  const removeFromCart = (id) => setCart(cart.filter(c => c._id !== id))
  
  const updateQty = (id, qty) => {
    const product = products.find(p => p._id === id)
    if (!product || qty < 1 || qty > product.stock) return
    setCart(cart.map(c => c._id === id ? { ...c, qty } : c))
  }

  const incrementQty = (id) => updateQty(id, cart.find(c => c._id === id).qty + 1)
  const decrementQty = (id) => updateQty(id, cart.find(c => c._id === id).qty - 1)

  const checkout = async () => {
    if (cart.length === 0) return alert('Cart is empty!')
    
    // Get current user info from localStorage for the cashier name
    const currentUser = JSON.parse(localStorage.getItem("malimali_current_user"))
    const token = localStorage.getItem("token") // Assuming you store your JWT here

    try {
      const res = await fetch("http://localhost:5000/sales", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}` // Added Auth header
        },
        body: JSON.stringify({
          items: cart.map(c => ({ productId: c._id, qty: c.qty, price: c.sellPrice })),
          total: cart.reduce((s, i) => s + i.sellPrice * i.qty, 0),
          paymentInfo: {
            paymentMethod: "cash", // default, can be expanded
            finalTotal: cart.reduce((s, i) => s + i.sellPrice * i.qty, 0)
          }
        })
      })
      
      const data = await res.json()
      if (!data.success) throw new Error(data.error)

      setReceipt({
        items: [...cart],
        total: cart.reduce((s, i) => s + i.sellPrice * i.qty, 0),
        cashier: currentUser?.name || "Cashier",
        date: new Date().toLocaleString('en-KE'),
        saleId: data.sale._id 
      })

      // We don't necessarily need to fetchProducts() manually here 
      // because the backend emit will trigger our socket listener!
      
      setCart([])
      setSearch('')
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
            onClick={checkout}
            className="flex items-center gap-2 px-4 py-2 bg-blue-800 text-white rounded 
                       hover:bg-blue-900 transition-colors duration-200"
          >
            <MdAddShoppingCart /> Checkout
          </button>
        </div>
      </div>

      {/* RECEIPT MODAL */}
      {receipt && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-[400px] max-h-[80vh] overflow-y-auto shadow-2xl animate-fadeIn">
            <h2 className="text-center font-semibold mb-3">Malimali POS Receipt</h2>
            <p className="text-xs text-gray-600">Cashier: {receipt.cashier}</p>
            <p className="text-xs text-gray-600">Date: {receipt.date}</p>
            <p className="text-xs text-gray-600">Sale ID: {receipt.saleId}</p>
            <hr className="my-2" />
            <table className="w-full text-sm mb-2">
              <thead>
                <tr>
                  {['Item', 'Qty', 'Subtotal'].map(h => (
                    <th key={h} className="text-left text-xs text-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {receipt.items.map(i => (
                  <tr key={i._id}>
                    <td className="text-sm">{i.name}</td>
                    <td className="text-sm">{i.qty}</td>
                    <td className="text-sm text-blue-700">
                      KSh {(i.sellPrice * i.qty).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <hr className="my-2" />
            <div className="flex justify-between font-semibold text-sm">
              <span>Total:</span>
              <span>KSh {receipt.total.toLocaleString()}</span>
            </div>

            <div className="flex justify-between mt-4">
              <button
                onClick={() => setReceipt(null)}
                className="px-3 py-1 rounded bg-gray-200 text-gray-700 
                           hover:bg-gray-300 transition-colors duration-200"
              >
                Close
              </button>
              <button
                onClick={() => window.print()}
                className="px-3 py-1 rounded bg-blue-800 text-white flex items-center gap-1 
                           hover:bg-blue-900 transition-colors duration-200"
              >
                <MdReceipt /> Print
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}