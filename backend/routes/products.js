const express = require("express")
const router = express.Router()
const Product = require("../models/Product")
const { authMiddleware, ownerOnly, managerOrOwner } = require("../middleware/authMiddleware")

// Fields that reveal purchasing/restocking intent — stripped from cashier responses.
const REORDER_EXCL = "-needsReorder -suggestedQty -dailyVelocity -velocityCalcAt -velocityTier -buyPrice"

router.use(authMiddleware)

// Products always belong to a single store — no global-scope case (unlike categories).
function broadcastProductEvent(io, eventName, product) {
  if (!io) return
  const payload = {
    _id: product._id, name: product.name, store: product.store,
    category: product.category, stock: product.stock,
    buyPrice: product.buyPrice, sellPrice: product.sellPrice,
  }
  io.to("owner").to(`manager-${product.store}`).to(`store-${product.store}`).emit(eventName, payload)
}

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

async function uniqueEAN13(tenantId) {
  for (let i = 0; i < 5; i++) {
    const code = generateEAN13()
    const exists = await Product.findOne({ tenantId, barcode: code }).lean()
    if (!exists) return code
  }
  return "600" + Date.now().toString().slice(-9) + "0"
}

// ── GET ALL PRODUCTS ──────────────────────────────────────────────────
router.get("/", async (req, res) => {
  try {
    const filter = { tenantId: req.tenantId }
    if (req.query.store) {
      filter.store = req.query.store
    } else if (req.user.role !== "owner") {
      filter.store = req.user.store
    }
    // populate site 1/5 — match:{tenantId} deferred to 2a-4
    let q = Product.find(filter).populate("supplierId", "name company phone")
    if (req.user.role === "cashier") q = q.select(REORDER_EXCL)
    const products = await q.sort({ name: 1 })
    res.json({ success: true, products })
  } catch (err) {
    console.error("Products GET error:", err.message)
    res.status(500).json({ success: false, message: "Failed to fetch products." })
  }
})

// ── GET LOW-STOCK PRODUCTS ────────────────────────────────────────────
router.get("/low-stock", async (req, res) => {
  try {
    const filter = { tenantId: req.tenantId, isExpired: { $ne: true } }
    if (req.user.role === "manager") filter.store = req.user.store
    else if (req.query.store) filter.store = req.query.store
    const rawThreshold = req.query.threshold !== undefined ? parseInt(req.query.threshold, 10) : null
    const stockExpr = rawThreshold !== null && !isNaN(rawThreshold)
      ? { $lte: ["$stock", rawThreshold] }
      : { $lte: ["$stock", { $ifNull: ["$reorderLevel", 5] }] }
    // populate site 2/5 — match:{tenantId} deferred to 2a-4
    let q = Product.find({ ...filter, $expr: stockExpr })
      .populate("supplierId", "name company phone")
    if (req.user.role === "cashier") q = q.select(REORDER_EXCL)
    const products = await q.sort({ stock: 1 })
    res.json({ success: true, products, count: products.length })
  } catch (err) {
    console.error("Low-stock GET error:", err.message)
    res.status(500).json({ success: false, message: "Failed to fetch low-stock products." })
  }
})

// ── BARCODE LOOKUP — cross-store duplicate check ──────────────────────
// No store filter: looks across the entire products collection.
// Returns 404 when not found so callers can treat that as "free to use".
// isSameStore compares product.store to the requesting user's store so
// the frontend can decide between auto-fill-for-edit vs. blocking error.
router.get("/lookup/:barcode", async (req, res) => {
  try {
    // barcode uniqueness is per-tenant (2a-2's compound index) — without
    // tenantId here this would search across ALL tenants and could report
    // a false "already exists" collision against another tenant's product.
    // populate site 3/5 — match:{tenantId} deferred to 2a-4
    let q = Product.findOne({ tenantId: req.tenantId, barcode: req.params.barcode })
      .populate("supplierId", "name company phone")
    if (req.user.role === "cashier") q = q.select(REORDER_EXCL)
    const product = await q.lean()
    if (!product) return res.status(404).json({ success: false })
    const isSameStore = product.store === req.user.store
    res.json({ success: true, product, isSameStore })
  } catch (err) {
    res.status(500).json({ success: false, message: "Barcode lookup failed." })
  }
})

// ── GET SINGLE PRODUCT ────────────────────────────────────────────────
router.get("/:id", async (req, res) => {
  try {
    // populate site 4/5 — match:{tenantId} deferred to 2a-4
    let q = Product.findOne({ _id: req.params.id, tenantId: req.tenantId }).populate("supplierId", "name company phone")
    if (req.user.role === "cashier") q = q.select(REORDER_EXCL)
    const product = await q
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
      : await uniqueEAN13(req.tenantId)

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
      tenantId: req.tenantId,
    })

    const saved = await product.save()

    broadcastProductEvent(req.app.get("io"), "productCreated", saved)

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

    const existing = await Product.findOne({ _id: req.params.id, tenantId: req.tenantId }).lean()
    if (!existing) return res.status(404).json({ success: false, message: "Product not found." })
    if (req.user.role === "manager" && existing.store !== req.user.store)
      return res.status(403).json({ success: false, message: "Access denied: This product belongs to a different store." })

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

    // populate site 5/5 — match:{tenantId} deferred to 2a-4
    const updated = await Product.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.tenantId },
      updateOp,
      { new: true, runValidators: true }
    ).populate("supplierId", "name company phone")

    if (!updated) return res.status(404).json({ success: false, message: "Product not found." })

    const io = req.app.get("io")
    if (updated.stock > (updated.reorderLevel ?? 5)) {
      Product.findOneAndUpdate({ _id: updated._id, tenantId: req.tenantId }, { $set: { needsReorder: false } }).catch(() => {})
    } else {
      Product.findOneAndUpdate({ _id: updated._id, tenantId: req.tenantId }, { $set: { needsReorder: true } }).catch(() => {})
      if (io) {
        io.to("owner").to(`manager-${updated.store}`).emit("lowStockAlert", {
          productId: updated._id,
          productName: updated.name,
          stock: updated.stock,
          reorderLevel: updated.reorderLevel,
          store: updated.store,
        })
      }
    }

    broadcastProductEvent(io, "productUpdated", updated)

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
    const deleted = await Product.findOneAndDelete({ _id: req.params.id, tenantId: req.tenantId })
    if (!deleted) return res.status(404).json({ success: false, message: "Product not found." })

    broadcastProductEvent(req.app.get("io"), "productDeleted", deleted)

    res.json({ success: true, message: "Product deleted." })
  } catch (err) {
    console.error("Product DELETE error:", err.message)
    res.status(500).json({ success: false, message: "Failed to delete product." })
  }
})

module.exports = router
