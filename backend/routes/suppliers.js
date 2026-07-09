const express  = require("express");
const router   = express.Router();
const Supplier = require("../models/Supplier");
const { authMiddleware, ownerOnly, managerOrOwner } = require("../middleware/authMiddleware");

router.use(authMiddleware);

// Suppliers have a `stores` array (not a single store) — empty array = global,
// visible everywhere. A scoped supplier notifies each linked store's room.
function broadcastSupplierEvent(io, eventName, supplier) {
  if (!io) return
  const payload = { _id: supplier._id, name: supplier.name, company: supplier.company, stores: supplier.stores }
  if (Array.isArray(supplier.stores) && supplier.stores.length > 0) {
    let target = io.to("owner")
    supplier.stores.forEach(s => { target = target.to(`manager-${s}`).to(`store-${s}`) })
    target.emit(eventName, payload)
  } else {
    io.emit(eventName, payload)
  }
}

// ── 1. GET ALL SUPPLIERS ─────────────────────────────────────────────
// ?store=StoreName  → returns suppliers who supply that store OR global (empty stores array)
// ?all=true         → includes archived
router.get("/", async (req, res) => {
  try {
    const { store, all } = req.query
    const filter = all === "true" ? {} : { isActive: true }

    if (req.user.role === "manager") {
      // Managers see global suppliers (no stores restriction) OR ones linked to their store
      filter.$or = [
        { stores: { $size: 0 } },
        { stores: req.user.store },
      ]
    } else if (store && store.trim() && store !== "All") {
      // Owner filtering by a specific store
      filter.$or = [
        { stores: { $size: 0 } },
        { stores: store.trim() },
      ]
    }
    // Owner with no store query sees all suppliers

    const suppliers = await Supplier.find(filter).sort({ name: 1 })
    res.json({ success: true, suppliers })
  } catch (err) {
    console.error("Suppliers GET error:", err.message)
    res.status(500).json({ success: false, message: "Failed to fetch suppliers." })
  }
})

// ── 2. CREATE SUPPLIER ───────────────────────────────────────────────
// body: { name, company, email, phone, address, notes, stores: [] }
router.post("/", ownerOnly, async (req, res) => {
  try {
    const { name, company, email, phone, address, notes, stores } = req.body

    if (!name?.trim()) {
      return res.status(400).json({ success: false, message: "Supplier name is required." })
    }

    if (company?.trim()) {
      const existing = await Supplier.findOne({ company: company.trim() })
      if (existing) {
        return res.status(409).json({ success: false, message: "A supplier with this company name already exists." })
      }
    }

    const saved = await new Supplier({
      name:    name.trim(),
      company: company?.trim() || "",
      email:   email?.trim().toLowerCase() || "",
      phone:   phone?.trim() || "",
      address: address?.trim() || "",
      notes:   notes?.trim() || "",
      stores:  Array.isArray(stores) ? stores.filter(Boolean) : [],
    }).save()

    broadcastSupplierEvent(req.app.get("io"), "supplierCreated", saved)

    res.status(201).json({ success: true, supplier: saved })
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ success: false, message: "A supplier with this company name already exists." })
    }
    console.error("Supplier POST error:", err.message)
    res.status(500).json({ success: false, message: "Failed to create supplier.", error: err.message })
  }
})

// ── 3. UPDATE SUPPLIER ───────────────────────────────────────────────
router.put("/:id", ownerOnly, async (req, res) => {
  try {
    const { name, company, email, phone, address, notes, stores } = req.body

    if (!name?.trim()) {
      return res.status(400).json({ success: false, message: "Supplier name is required." })
    }

    if (company?.trim()) {
      const duplicate = await Supplier.findOne({ company: company.trim(), _id: { $ne: req.params.id } })
      if (duplicate) {
        return res.status(409).json({ success: false, message: "Another supplier is already using this company name." })
      }
    }

    const updated = await Supplier.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          name:    name.trim(),
          company: company?.trim() || "",
          email:   email?.trim().toLowerCase() || "",
          phone:   phone?.trim() || "",
          address: address?.trim() || "",
          notes:   notes?.trim() || "",
          stores:  Array.isArray(stores) ? stores.filter(Boolean) : [],
        }
      },
      { new: true, runValidators: true }
    )

    if (!updated) {
      return res.status(404).json({ success: false, message: "Supplier not found." })
    }

    broadcastSupplierEvent(req.app.get("io"), "supplierUpdated", updated)

    res.json({ success: true, supplier: updated })
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ success: false, message: "A supplier with this company name already exists." })
    }
    console.error("Supplier PUT error:", err.message)
    res.status(500).json({ success: false, message: "Failed to update supplier.", error: err.message })
  }
})

// ── 4. ARCHIVE TOGGLE ────────────────────────────────────────────────
router.patch("/:id/archive", ownerOnly, async (req, res) => {
  try {
    const supplier = await Supplier.findById(req.params.id)
    if (!supplier) return res.status(404).json({ success: false, message: "Supplier not found." })
    supplier.isActive = !supplier.isActive
    await supplier.save()

    broadcastSupplierEvent(req.app.get("io"), "supplierArchived", supplier)

    res.json({ success: true, message: supplier.isActive ? "Supplier restored." : "Supplier archived.", supplier })
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to archive supplier." })
  }
})

// ── 5. DELETE SUPPLIER ───────────────────────────────────────────────
router.delete("/:id", ownerOnly, async (req, res) => {
  try {
    const PurchaseOrder = require("../models/PurchaseOrder")
    const openPO = await PurchaseOrder.findOne({
      supplierId: req.params.id,
      status:     { $in: ["draft", "sent", "partial"] }
    })
    if (openPO) {
      return res.status(409).json({
        success: false,
        message: `Cannot delete — supplier has an open purchase order (${openPO.poNumber}). Archive instead.`
      })
    }
    const deleted = await Supplier.findByIdAndDelete(req.params.id)
    if (!deleted) return res.status(404).json({ success: false, message: "Supplier not found." })

    broadcastSupplierEvent(req.app.get("io"), "supplierDeleted", deleted)

    res.json({ success: true, message: "Supplier deleted successfully." })
  } catch (err) {
    console.error("Supplier DELETE error:", err.message)
    res.status(500).json({ success: false, message: "Failed to delete supplier.", error: err.message })
  }
})

module.exports = router
