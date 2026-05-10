const express = require("express")
const router = express.Router()
const Product = require("../models/product")
const { authMiddleware } = require("../middleware/authMiddleware") // ✅ protect routes

// ── GET all products ───────────────────────────────────────────────
router.get("/", authMiddleware, async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 })
    res.json(products)
  } catch (err) {
    console.error("Error fetching products:", err)
    res.status(500).json({ success: false, message: "Server error" })
  }
})

// ── Scan product by barcode ─────────────────────────────────────────
router.get("/scan/:barcode", authMiddleware, async (req, res) => {
  try {
    const product = await Product.findOne({ barcode: req.params.barcode })
    if (!product) {
      return res.json({ success: false, message: "Product not found" })
    }
    res.json({ success: true, product })
  } catch (err) {
    console.error("Scan error:", err.message)
    res.status(500).json({ success: false, message: "Server error" })
  }
})

// ── Create product ─────────────────────────────────────────────────
router.post("/", authMiddleware, async (req, res) => {
  try {
    const { name, category, stock, buyPrice, sellPrice, barcode } = req.body

    // 🔒 Prevent duplicate barcode
    let finalBarcode = barcode
    if (barcode) {
      const exists = await Product.findOne({ barcode })
      if (exists) {
        return res.status(400).json({ success: false, message: "Barcode already exists" })
      }
    } else {
      // Auto-generate barcode if not provided
      finalBarcode = Date.now().toString()
    }

    const product = new Product({
      name,
      category,
      stock,
      buyPrice,
      sellPrice,
      barcode: finalBarcode
    })

    const saved = await product.save()
    res.json({ success: true, product: saved })
  } catch (err) {
    console.error("Error creating product:", err)

    // ✅ Handle validation errors clearly
    if (err.name === "ValidationError") {
      const messages = Object.values(err.errors).map(e => e.message)
      return res.status(400).json({ success: false, message: messages.join(", ") })
    }

    res.status(500).json({ success: false, message: "Server error" })
  }
})

// ── Update product ─────────────────────────────────────────────────
router.put("/:id", authMiddleware, async (req, res) => {
  try {
    const { barcode } = req.body
    if (barcode) {
      const exists = await Product.findOne({ barcode, _id: { $ne: req.params.id } })
      if (exists) {
        return res.status(400).json({ success: false, message: "Barcode already exists" })
      }
    }

    const updated = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true })
    res.json({ success: true, product: updated })
  } catch (err) {
    console.error("Error updating product:", err)

    // ✅ Handle validation errors clearly
    if (err.name === "ValidationError") {
      const messages = Object.values(err.errors).map(e => e.message)
      return res.status(400).json({ success: false, message: messages.join(", ") })
    }

    res.status(500).json({ success: false, message: "Server error" })
  }
})

// ── Delete product ─────────────────────────────────────────────────
router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    await Product.findByIdAndDelete(req.params.id)
    res.json({ success: true })
  } catch (err) {
    console.error("Error deleting product:", err)
    res.status(500).json({ success: false, message: "Server error" })
  }
})

module.exports = router
