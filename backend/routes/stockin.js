const express = require("express")
const router = express.Router()
const mongoose = require("mongoose")
const Product = require("../models/Product")

// ✅ Inline StockIn schema — tracks each stock-in event separately
// This gives a real log instead of just returning current product state
const stockInSchema = new mongoose.Schema({
  name:      { type: String, required: true },
  category:  { type: String, required: true },
  qty:       { type: Number, required: true },
  buyPrice:  { type: Number, required: true },
  total:     { type: Number, required: true },
  productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
  date:      { type: String },
  time:      { type: String },
}, { timestamps: true })

const StockIn = mongoose.models.StockIn || mongoose.model("StockIn", stockInSchema)

// GET — return real stock-in log entries
router.get("/", async (req, res) => {
  try {
    const log = await StockIn.find().sort({ createdAt: -1 })
    res.json(log)
  } catch (err) {
    console.error("StockIn GET error:", err.message)
    res.status(500).json([])
  }
})

// POST — create product AND log the stock-in entry
router.post("/", async (req, res) => {
  try {
    const { name, category, qty, buyPrice } = req.body

    // Create the product
    const product = new Product({
      name,
      category,
      stock: Number(qty),
      buyPrice: Number(buyPrice),
      sellPrice: Number(buyPrice) * 1.3  // default 30% markup
    })
    await product.save()

    // ✅ Log the stock-in entry separately so history is preserved
    const entry = new StockIn({
      name,
      category,
      qty:      Number(qty),
      buyPrice: Number(buyPrice),
      total:    Number(qty) * Number(buyPrice),
      productId: product._id,
      date: new Date().toLocaleDateString("en-KE"),
      time: new Date().toLocaleTimeString("en-KE"),
    })
    await entry.save()

    res.json({ success: true, product, entry })
  } catch (err) {
    console.error("StockIn POST error:", err.message)
    res.status(400).json({ success: false, message: err.message })
  }
})

module.exports = router