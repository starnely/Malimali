
const express = require("express")
const router = express.Router()
const Product = require("../models/Product")
const ExpiredStock = require("../models/ExpiredStock")
const { authMiddleware } = require("../middleware/authMiddleware")

router.use(authMiddleware)

// ── GET all expired stock ─────────────────────────────────────────────
router.get("/", async (req, res) => {
  try {
    let query = {}

    // Store filter for owner/manager
    if (req.query.store) query.store = req.query.store

    // Employees see only their store
    if (req.user.role === "cashier" || req.user.role === "employee") {
      if (req.user.store) query.store = req.user.store
    }

    const expired = await ExpiredStock.find(query).sort({ movedAt: -1 })

    const totalLoss = expired.reduce((sum, e) => sum + (e.totalLoss || 0), 0)

    res.json({ success: true, expired, totalLoss })
  } catch (err) {
    console.error("Error fetching expired stock:", err)
    res.status(500).json({ success: false, message: "Server error" })
  }
})

// ── GET expired stock summary (loss totals by store/category) ─────────
router.get("/summary", async (req, res) => {
  try {
    const expired = await ExpiredStock.find({})

    const byStore = {}
    const byCategory = {}

    expired.forEach(e => {
      // By store
      if (!byStore[e.store]) byStore[e.store] = { count: 0, totalLoss: 0 }
      byStore[e.store].count += e.quantity
      byStore[e.store].totalLoss += e.totalLoss

      // By category
      const cat = e.category || "Uncategorized"
      if (!byCategory[cat]) byCategory[cat] = { count: 0, totalLoss: 0 }
      byCategory[cat].count += e.quantity
      byCategory[cat].totalLoss += e.totalLoss
    })

    const totalLoss = expired.reduce((sum, e) => sum + (e.totalLoss || 0), 0)

    res.json({ success: true, byStore, byCategory, totalLoss })
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" })
  }
})

// ── POST manually move a product to expired stock ─────────────────────
router.post("/move/:productId", async (req, res) => {
  try {
    if (req.user.role !== "owner" && req.user.role !== "manager") {
      return res.status(403).json({ success: false, message: "Owner or manager access required" })
    }

    const product = await Product.findById(req.params.productId)
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" })
    }

    const quantity = Number(req.body.quantity) || product.stock
    if (quantity <= 0) {
      return res.status(400).json({ success: false, message: "Quantity must be greater than 0" })
    }
    if (quantity > product.stock) {
      return res.status(400).json({ success: false, message: "Quantity exceeds current stock" })
    }

    const totalLoss = quantity * product.buyPrice

    // Create expired stock record
    const expiredRecord = new ExpiredStock({
      productId: product._id,
      productName: product.name,
      category: product.category,
      supplier: product.supplier || "",
      store: product.store,
      batch: product.batch || "",
      unit: product.unit || "pcs",
      quantity,
      buyPrice: product.buyPrice,
      totalLoss,
      expiryDate: product.expiryDate || new Date(),
      processedBy: req.user.name || req.user.username,
      notes: req.body.notes || ""
    })

    await expiredRecord.save()

    // Reduce stock on the product
    const newStock = product.stock - quantity
    if (newStock === 0) {
      // Mark product as expired if all stock is gone
      await Product.findByIdAndUpdate(product._id, {
        $set: { stock: 0, isExpired: true }
      })
    } else {
      await Product.findByIdAndUpdate(product._id, {
        $set: { stock: newStock }
      })
    }

    // Emit socket event if available
    const io = req.app.get("io")
    if (io) {
      io.emit("productsUpdated")
      io.to("owner").emit("expiredStockMoved", {
        productName: product.name,
        quantity,
        totalLoss,
        store: product.store
      })
    }

    res.json({ success: true, expiredRecord, newStock, totalLoss })
  } catch (err) {
    console.error("Error moving to expired:", err)
    res.status(500).json({ success: false, message: "Server error" })
  }
})

// ── POST auto-check and move all expired products (run on schedule) ───
router.post("/auto-check", async (req, res) => {
  try {
    if (req.user.role !== "owner") {
      return res.status(403).json({ success: false, message: "Owner access required" })
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Find all non-expired products whose expiryDate has passed
    const expiredProducts = await Product.find({
      expiryDate: { $lte: today },
      isExpired: { $ne: true },
      stock: { $gt: 0 }
    })

    const results = []

    for (const product of expiredProducts) {
      const totalLoss = product.stock * product.buyPrice

      const expiredRecord = new ExpiredStock({
        productId: product._id,
        productName: product.name,
        category: product.category,
        supplier: product.supplier || "",
        store: product.store,
        batch: product.batch || "",
        unit: product.unit || "pcs",
        quantity: product.stock,
        buyPrice: product.buyPrice,
        totalLoss,
        expiryDate: product.expiryDate,
        processedBy: "System (Auto)",
        notes: "Automatically moved on expiry date check"
      })

      await expiredRecord.save()

      await Product.findByIdAndUpdate(product._id, {
        $set: { stock: 0, isExpired: true }
      })

      results.push({ productName: product.name, quantity: product.stock, totalLoss })
    }

    const io = req.app.get("io")
    if (io && results.length > 0) {
      io.emit("productsUpdated")
      io.to("owner").emit("autoExpiredCheck", { moved: results.length, results })
    }

    res.json({ success: true, moved: results.length, results })
  } catch (err) {
    console.error("Auto-expiry check error:", err)
    res.status(500).json({ success: false, message: "Server error" })
  }
})

// ── DELETE an expired stock record (owner only) ───────────────────────
router.delete("/:id", async (req, res) => {
  try {
    if (req.user.role !== "owner") {
      return res.status(403).json({ success: false, message: "Owner access required" })
    }
    const deleted = await ExpiredStock.findByIdAndDelete(req.params.id)
    if (!deleted) return res.status(404).json({ success: false, message: "Record not found" })
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" })
  }
})

module.exports = router