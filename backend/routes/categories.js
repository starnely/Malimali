const express  = require("express")
const router   = express.Router()
const Category = require("../models/Category")
const Product  = require("../models/Product")
const { authMiddleware, ownerOnly } = require("../middleware/authMiddleware")

router.use(authMiddleware)

// ── 1. GET CATEGORIES ────────────────────────────────────────────────
// ?store=StoreName  → returns global + that store's categories
// no store param   → returns all (owner sees everything)
router.get("/", async (req, res) => {
  try {
    const { store } = req.query
    let query = {}

    if (store && store.trim() && store !== 'All') {
      // Return global (null store) + this store's categories
      query = { $or: [{ store: null }, { store: store.trim() }] }
    } else if (req.user.role !== 'owner') {
      // Non-owner with no store filter: show global + their store
      const userStore = req.user.store
      query = { $or: [{ store: null }, { store: userStore }] }
    }
    // Owner with no filter: show everything (empty query)

    const categories = await Category.find(query).sort({ store: 1, name: 1 })

    // Attach product count per category
    const withCounts = await Promise.all(
      categories.map(async (cat) => {
        const count = await Product.countDocuments({
          category: cat.name,
          ...(cat.store ? { store: cat.store } : {}),
        })
        return { ...cat.toObject(), productCount: count }
      })
    )

    res.json({ success: true, categories: withCounts })
  } catch (err) {
    console.error("Categories GET error:", err.message)
    res.status(500).json({ success: false, message: "Failed to fetch categories." })
  }
})

// ── 2. CREATE CATEGORY ───────────────────────────────────────────────
// body: { name, store? (null = global) }
router.post("/", ownerOnly, async (req, res) => {
  try {
    const { name, store, description } = req.body
    if (!name?.trim()) {
      return res.status(400).json({ success: false, message: "Category name is required." })
    }

    const normalized   = name.trim().toLowerCase()
    const storeVal     = store?.trim() || null

    const existing = await Category.findOne({ name: normalized, store: storeVal })
    if (existing) {
      return res.status(409).json({
        success: false,
        message: storeVal
          ? `"${normalized}" already exists for ${storeVal}.`
          : `"${normalized}" already exists as a global category.`
      })
    }

    const saved = await Category.create({
      name:        normalized,
      store:       storeVal,
      description: description?.trim() || '',
    })

    res.status(201).json({ success: true, category: saved })
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ success: false, message: "This category already exists." })
    }
    console.error("Category POST error:", err.message)
    res.status(500).json({ success: false, message: "Failed to create category.", error: err.message })
  }
})

// ── 3. UPDATE CATEGORY ───────────────────────────────────────────────
router.put("/:id", ownerOnly, async (req, res) => {
  try {
    const { name, store, description } = req.body
    if (!name?.trim()) {
      return res.status(400).json({ success: false, message: "Category name is required." })
    }

    const normalized = name.trim().toLowerCase()
    const storeVal   = store?.trim() || null

    const duplicate = await Category.findOne({
      name:  normalized,
      store: storeVal,
      _id:   { $ne: req.params.id }
    })
    if (duplicate) {
      return res.status(409).json({ success: false, message: "Another category is already using this name." })
    }

    const updated = await Category.findByIdAndUpdate(
      req.params.id,
      { name: normalized, store: storeVal, description: description?.trim() || '' },
      { new: true, runValidators: true }
    )
    if (!updated) {
      return res.status(404).json({ success: false, message: "Category not found." })
    }

    res.json({ success: true, category: updated })
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ success: false, message: "This category already exists." })
    }
    console.error("Category PUT error:", err.message)
    res.status(500).json({ success: false, message: "Failed to update category.", error: err.message })
  }
})

// ── 4. DELETE CATEGORY ───────────────────────────────────────────────
router.delete("/:id", ownerOnly, async (req, res) => {
  try {
    const cat = await Category.findById(req.params.id)
    if (!cat) {
      return res.status(404).json({ success: false, message: "Category not found." })
    }

    // Check if any products use this category
    const productCount = await Product.countDocuments({ category: cat.name })
    if (productCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete — ${productCount} product${productCount !== 1 ? 's' : ''} use this category. Reassign them first.`
      })
    }

    await Category.findByIdAndDelete(req.params.id)
    res.json({ success: true, message: "Category deleted successfully." })
  } catch (err) {
    console.error("Category DELETE error:", err.message)
    res.status(500).json({ success: false, message: "Failed to delete category.", error: err.message })
  }
})

module.exports = router
