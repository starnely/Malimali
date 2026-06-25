const express = require("express")
const router = express.Router()
const Product = require("../models/Product")
const { authMiddleware, ownerOnly, managerOrOwner } = require("../middleware/authMiddleware")

router.use(authMiddleware)

// ══════════════════════════════════════════════════════════════════════
//  EAN-13 BARCODE GENERATOR
//  Produces a 13-digit numeric barcode:
//  600 (Kenya GS1 prefix) + 9 random digits + 1 check digit
//  Example: 6001847392015
//  Pure numbers — prints cleanly, scanners read it perfectly.
// ══════════════════════════════════════════════════════════════════════
function generateEAN13() {
  const prefix = "600"
  const body = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10)).join("")
  const digits = (prefix + body).split("").map(Number)
  const sum = digits.reduce((acc, d, i) => acc + d * (i % 2 === 0 ? 1 : 3), 0)
  const checkDigit = (10 - (sum % 10)) % 10
  return prefix + body + checkDigit
}

async function uniqueEAN13() {
  for (let i = 0; i < 5; i++) {
    const code = generateEAN13()
    const exists = await Product.findOne({ barcode: code }).lean()
    if (!exists) return code
  }
  return "600" + Date.now().toString().slice(-9) + "0"
}

// ── GET ALL PRODUCTS ──────────────────────────────────────────────────
router.get("/", async (req, res) => {
  try {
    const filter = {}
    if (req.query.store) {
      filter.store = req.query.store
    } else if (req.user.role !== "owner") {
      filter.store = req.user.store
    }
    const products = await Product.find(filter)
      .populate("supplierId", "name company phone")
      .sort({ name: 1 })
    res.json({ success: true, products })
  } catch (err) {
    console.error("Products GET error:", err.message)
    res.status(500).json({ success: false, message: "Failed to fetch products." })
  }
})

// ── GET LOW-STOCK PRODUCTS ────────────────────────────────────────────
router.get("/low-stock", async (req, res) => {
  try {
    const filter = { isExpired: { $ne: true } }
    if (req.query.store) filter.store = req.query.store
    const products = await Product.find({
      ...filter,
      $expr: { $lte: ["$stock", { $ifNull: ["$reorderLevel", 5] }] },
    })
      .populate("supplierId", "name company phone")
      .sort({ stock: 1 })
    res.json({ success: true, products, count: products.length })
  } catch (err) {
    console.error("Low-stock GET error:", err.message)
    res.status(500).json({ success: false, message: "Failed to fetch low-stock products." })
  }
})

// ── GET SINGLE PRODUCT ────────────────────────────────────────────────
router.get("/:id", async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate("supplierId", "name company phone")
    if (!product) return res.status(404).json({ success: false, message: "Product not found." })
    res.json({ success: true, product })
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to fetch product." })
  }
})

// ── CREATE PRODUCT ────────────────────────────────────────────────────
router.post("/", managerOrOwner, async (req, res) => {
  try {
    const {
      name, description, category, supplier, supplierId,
      store, stock, buyPrice, sellPrice, unit,
      barcode, batch, mftDate, expiryDate, reorderLevel,
      isWeighed, pricePerKg, pluNumber,
    } = req.body

    const finalBarcode = barcode && barcode.trim()
      ? barcode.trim()
      : await uniqueEAN13()

    const product = new Product({
      name, description, category,
      supplier: supplier || "",
      supplierId: supplierId || null,
      store: store || "Main Store",
      stock: Number(stock),
      buyPrice: Number(buyPrice),
      sellPrice: Number(sellPrice),
      unit: unit || "pcs",
      barcode: finalBarcode,
      batch: batch || "",
      mftDate: mftDate || null,
      expiryDate: expiryDate || null,
      reorderLevel: reorderLevel != null ? Number(reorderLevel) : 5,
      isWeighed: !!isWeighed,
      pricePerKg: Number(pricePerKg) || 0,
      // undefined keeps the field absent so the sparse unique index skips it
      pluNumber: pluNumber ? Number(pluNumber) : undefined,
    })

    const saved = await product.save()
    res.status(201).json({ success: true, product: saved })
  } catch (err) {
    if (err.code === 11000) {
      const field = err.keyPattern?.pluNumber ? "PLU number" : "barcode"
      return res.status(409).json({
        success: false,
        message: `A product with this ${field} already exists.`
      })
    }
    console.error("Product POST error:", err.message)
    res.status(500).json({ success: false, message: err.message || "Failed to create product." })
  }
})

// ── UPDATE PRODUCT ────────────────────────────────────────────────────
router.put("/:id", managerOrOwner, async (req, res) => {
  try {
    const {
      name, description, category, supplier, supplierId,
      store, stock, buyPrice, sellPrice, unit,
      barcode, batch, mftDate, expiryDate, reorderLevel,
      isWeighed, pricePerKg, pluNumber,
    } = req.body

    const existing = await Product.findById(req.params.id).lean()
    if (!existing) return res.status(404).json({ success: false, message: "Product not found." })

    const finalBarcode = barcode && barcode.trim()
      ? barcode.trim()
      : existing.barcode

    const setData = {
      name, description, category,
      supplier: supplier ?? "",
      supplierId: supplierId ?? null,
      store: store ?? "Main Store",
      stock: Number(stock),
      buyPrice: Number(buyPrice),
      sellPrice: Number(sellPrice),
      unit: unit ?? "pcs",
      barcode: finalBarcode,
      batch: batch || "",
      mftDate: mftDate || null,
      expiryDate: expiryDate || null,
      reorderLevel: reorderLevel != null ? Number(reorderLevel) : 5,
      isWeighed: !!isWeighed,
      pricePerKg: Number(pricePerKg) || 0,
    }
    if (Number(stock) > 0) {
      setData.isExpired = false
      // Clear a stale expiry date to prevent the scheduler re-catching this product.
      // If the user explicitly provides a future date in this same edit, keep it.
      const incomingExpiry = expiryDate ? new Date(expiryDate) : null
      const today = new Date(); today.setHours(0, 0, 0, 0)
      if (!incomingExpiry || incomingExpiry < today) setData.expiryDate = null
    }

    // pluNumber must be absent (not null) for the sparse unique index to skip it.
    // When provided: include in $set. When cleared: $unset removes it from the doc.
    const updateOp = pluNumber
      ? { $set: { ...setData, pluNumber: Number(pluNumber) } }
      : { $set: setData, $unset: { pluNumber: "" } }

    const updated = await Product.findByIdAndUpdate(
      req.params.id,
      updateOp,
      { new: true, runValidators: true }
    ).populate("supplierId", "name company phone")

    if (!updated) return res.status(404).json({ success: false, message: "Product not found." })

    const io = req.app.get("io")
    if (io && updated.stock <= (updated.reorderLevel ?? 5)) {
      io.to("owner").emit("lowStockAlert", {
        productId: updated._id,
        productName: updated.name,
        stock: updated.stock,
        reorderLevel: updated.reorderLevel,
        store: updated.store,
      })
    }

    res.json({ success: true, product: updated })
  } catch (err) {
    if (err.code === 11000) {
      const field = err.keyPattern?.pluNumber ? "PLU number" : "barcode"
      return res.status(409).json({
        success: false,
        message: `A product with this ${field} already exists.`
      })
    }
    console.error("Product PUT error:", err.message)
    res.status(500).json({ success: false, message: "Failed to update product.", error: err.message })
  }
})

// ── DELETE PRODUCT ────────────────────────────────────────────────────
router.delete("/:id", ownerOnly, async (req, res) => {
  try {
    const deleted = await Product.findByIdAndDelete(req.params.id)
    if (!deleted) return res.status(404).json({ success: false, message: "Product not found." })
    res.json({ success: true, message: "Product deleted." })
  } catch (err) {
    console.error("Product DELETE error:", err.message)
    res.status(500).json({ success: false, message: "Failed to delete product." })
  }
})

module.exports = router
