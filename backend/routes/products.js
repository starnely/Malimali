// ═══════════════════════════════════════════════════════════════════════
//  PRODUCTS ROUTE — PHASE 6 ADDITIONS
//  Add these three blocks to your existing routes/products.js file.
//  Do NOT replace the whole file — slot these in at the positions noted.
// ═══════════════════════════════════════════════════════════════════════

// ── ADD BLOCK A ─────────────────────────────────────────────────────
//  Place this NEW ROUTE before your existing router.get("/:id") route.
//  It must come before /:id so Express doesn't treat "low-stock" as an id.
// ────────────────────────────────────────────────────────────────────
/*
// GET /api/products/low-stock — products at or below their reorder level
router.get("/low-stock", authMiddleware, async (req, res) => {
  try {
    const filter = { isExpired: { $ne: true } }
    if (req.query.store) filter.store = req.query.store

    // A product is low-stock when: stock <= reorderLevel
    // reorderLevel defaults to 5 if not set, so existing products work immediately
    const products = await Product.find({
      ...filter,
      $expr: { $lte: ["$stock", { $ifNull: ["$reorderLevel", 5] }] }
    })
    .populate("supplierId", "name company phone")
    .sort({ stock: 1 })

    res.json({ success: true, products, count: products.length })
  } catch (err) {
    console.error("Low-stock GET error:", err.message)
    res.status(500).json({ success: false, message: "Failed to fetch low-stock products." })
  }
})
*/

// ── ADD BLOCK B ─────────────────────────────────────────────────────
//  In your existing POST "/" (create product) handler,
//  add these two fields to the new Product({...}) constructor object:
// ────────────────────────────────────────────────────────────────────
/*
    reorderLevel: req.body.reorderLevel != null ? Number(req.body.reorderLevel) : 5,
    supplierId:   req.body.supplierId   || null,
*/

// ── ADD BLOCK C ─────────────────────────────────────────────────────
//  In your existing PUT "/:id" (update product) handler,
//  add these two fields to the $set object:
// ────────────────────────────────────────────────────────────────────
/*
    reorderLevel: req.body.reorderLevel != null ? Number(req.body.reorderLevel) : 5,
    supplierId:   req.body.supplierId   || null,
*/

// ═══════════════════════════════════════════════════════════════════════
//  FULL STANDALONE ROUTE FILE
//  If you prefer, replace your routes/products.js entirely with this.
//  It is your original file structure + the three blocks above merged in.
// ═══════════════════════════════════════════════════════════════════════

const express = require("express")
const router = express.Router()
const Product = require("../models/Product")
const { authMiddleware, ownerOnly, managerOrOwner } = require("../middleware/authMiddleware")

router.use(authMiddleware)

// ── GET ALL PRODUCTS ──────────────────────────────────────────────────
router.get("/", async (req, res) => {
  try {
    const filter = { isExpired: { $ne: true } }

    // Owner can see all or filter by store param
    // Cashier/manager always sees only their assigned store
    if (req.query.store) {
      filter.store = req.query.store
    } else if (req.user.role !== 'owner') {
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

// ── ★ NEW: GET LOW-STOCK PRODUCTS ────────────────────────────────────
// Must be defined BEFORE /:id route
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

// ── CREATE PRODUCT (manager+) ─────────────────────────────────────────
router.post("/", managerOrOwner, async (req, res) => {
  try {
    const {
      name, description, category, supplier, supplierId,
      store, stock, buyPrice, sellPrice,
      barcode, batch, mftDate, expiryDate,
      reorderLevel,  // ★ new
    } = req.body

    const product = new Product({
      name, description, category,
      supplier: supplier || "",
      supplierId: supplierId || null,
      store: store || "Main Store",
      stock: Number(stock),
      buyPrice: Number(buyPrice),
      sellPrice: Number(sellPrice),
      barcode: barcode || undefined,
      batch: batch || "",
      mftDate: mftDate || null,
      expiryDate: expiryDate || null,
      reorderLevel: reorderLevel != null ? Number(reorderLevel) : 5, // ★ new
    })

    const saved = await product.save()
    res.status(201).json({ success: true, product: saved })
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ success: false, message: "A product with this barcode already exists." })
    }
    console.error("Product POST error:", err.message)
    res.status(500).json({ success: false, message: err.message || "Failed to create product." })
  }
})

// ── UPDATE PRODUCT (manager+) ─────────────────────────────────────────
router.put("/:id", managerOrOwner, async (req, res) => {
  try {
    const {
      name, description, category, supplier, supplierId,
      store, stock, buyPrice, sellPrice,
      barcode, batch, mftDate, expiryDate,
      reorderLevel,  // ★ new
    } = req.body

    const updateData = {
      name, description, category,
      supplier: supplier ?? "",
      supplierId: supplierId ?? null,
      store: store ?? "Main Store",
      stock: Number(stock),
      buyPrice: Number(buyPrice),
      sellPrice: Number(sellPrice),
      barcode: barcode || undefined,
      batch: batch || "",
      mftDate: mftDate || null,
      expiryDate: expiryDate || null,
      reorderLevel: reorderLevel != null ? Number(reorderLevel) : 5, // ★ new
    }

    // Remove undefined barcode so sparse index isn't cleared accidentally
    if (!updateData.barcode) delete updateData.barcode

    const updated = await Product.findByIdAndUpdate(
      req.params.id,
      { $set: updateData },
      { new: true, runValidators: true }
    ).populate("supplierId", "name company phone")

    if (!updated) return res.status(404).json({ success: false, message: "Product not found." })

    // ★ Emit low-stock alert if stock is now at or below reorder level
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
      return res.status(409).json({ success: false, message: "A product with this barcode already exists." })
    }
    console.error("Product PUT error:", err.message)
    res.status(500).json({ success: false, message: "Failed to update product.", error: err.message })
  }
})

// ── DELETE PRODUCT (owner only) ───────────────────────────────────────
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
