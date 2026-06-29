const express = require("express");
const router = express.Router();
const Store           = require("../models/Store");
const Product         = require("../models/Product");
const Category        = require("../models/Category");
const Customer        = require("../models/Customer");
const Sale            = require("../models/Sale");
const Expense         = require("../models/Expense");
const ExpiredStock    = require("../models/ExpiredStock");
const PettyCash       = require("../models/PettyCash");
const PurchaseOrder   = require("../models/PurchaseOrder");
const SupplierPayment = require("../models/SupplierPayment");
const Repayment       = require("../models/Repayment");
const Archive         = require("../models/Archive");
const User            = require("../models/User");
const Supplier        = require("../models/Supplier");
const { authMiddleware, ownerOnly } = require("../middleware/authMiddleware");

router.use(authMiddleware);

// ── 1. GET ALL STORES ────────────────────────────────────────────────
router.get("/", async (req, res) => {
  try {
    const stores = await Store.find().sort({ name: 1 });
    res.json({ success: true, stores });
  } catch (err) {
    console.error("Stores GET error:", err.message);
    res.status(500).json({ success: false, message: "Failed to fetch stores." });
  }
});

// ── 2. CREATE STORE (owner only) ─────────────────────────────────────
router.post("/", ownerOnly, async (req, res) => {
  try {
    const { name, location, phone } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: "Store name is required." });
    }

    const existing = await Store.findOne({ name: name.trim() });
    if (existing) {
      return res.status(409).json({ success: false, message: "A store with this name already exists." });
    }

    const newStore = new Store({
      name:     name.trim(),
      location: location ? location.trim() : "",
      phone:    phone    ? phone.trim()    : ""
    });

    const saved = await newStore.save();
    res.status(201).json({ success: true, store: saved });

  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ success: false, message: "A store with this name already exists." });
    }
    console.error("Store POST error:", err.message);
    res.status(500).json({ success: false, message: "Failed to create store.", error: err.message });
  }
});

// ── 3. UPDATE STORE (owner only) ─────────────────────────────────────
router.put("/:id", ownerOnly, async (req, res) => {
  try {
    const { name, location, phone } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: "Store name is required." });
    }

    // Prevent renaming to an existing store name
    const duplicate = await Store.findOne({
      name: name.trim(),
      _id:  { $ne: req.params.id }
    });
    if (duplicate) {
      return res.status(409).json({ success: false, message: "Another store is already using this name." });
    }

    // Capture old name before update so we can cascade the rename
    const existing = await Store.findById(req.params.id).lean();
    if (!existing) {
      return res.status(404).json({ success: false, message: "Store not found." });
    }
    const oldName = existing.name;
    const newName = name.trim();

    const updated = await Store.findByIdAndUpdate(
      req.params.id,
      { $set: { name: newName, location: location ? location.trim() : "", phone: phone ? phone.trim() : "" } },
      { new: true, runValidators: true }
    );

    if (!updated) {
      return res.status(404).json({ success: false, message: "Store not found." });
    }

    // Cascade rename to all 13 collections that store names as plain strings.
    // Collections: Product, Category, Customer, Sale, Expense, ExpiredStock,
    //   PettyCash, PurchaseOrder, SupplierPayment, Repayment, Archive, User,
    //   Supplier (stores is a [String] array — use arrayFilters positional operator).
    let cascadeWarning = false;
    if (oldName !== newName) {
      try {
        await Promise.all([
          Product.updateMany        ({ store:  oldName }, { $set: { store:  newName } }),
          Category.updateMany       ({ store:  oldName }, { $set: { store:  newName } }),
          Customer.updateMany       ({ store:  oldName }, { $set: { store:  newName } }),
          Sale.updateMany           ({ store:  oldName }, { $set: { store:  newName } }),
          Expense.updateMany        ({ store:  oldName }, { $set: { store:  newName } }),
          ExpiredStock.updateMany   ({ store:  oldName }, { $set: { store:  newName } }),
          PettyCash.updateMany      ({ store:  oldName }, { $set: { store:  newName } }),
          PurchaseOrder.updateMany  ({ store:  oldName }, { $set: { store:  newName } }),
          SupplierPayment.updateMany({ store:  oldName }, { $set: { store:  newName } }),
          Repayment.updateMany      ({ store:  oldName }, { $set: { store:  newName } }),
          Archive.updateMany        ({ store:  oldName }, { $set: { store:  newName } }),
          User.updateMany           ({ store:  oldName }, { $set: { store:  newName } }),
          Supplier.updateMany(
            { stores: oldName },
            { $set: { "stores.$[elem]": newName } },
            { arrayFilters: [{ elem: oldName }] }
          ),
        ]);
      } catch (cascadeErr) {
        // Store document was already renamed — log for manual repair, but don't fail the response.
        cascadeWarning = true;
        console.error(
          `[STORE RENAME CASCADE FAILED] "${oldName}" → "${newName}": ${cascadeErr.message}`
        );
      }
    }

    res.json({ success: true, store: updated, cascadeWarning });

  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ success: false, message: "A store with this name already exists." });
    }
    console.error("Store PUT error:", err.message);
    res.status(500).json({ success: false, message: "Failed to update store.", error: err.message });
  }
});

// ── 4. DELETE STORE (owner only) ─────────────────────────────────────
router.delete("/:id", ownerOnly, async (req, res) => {
  try {
    const deleted = await Store.findByIdAndDelete(req.params.id);

    if (!deleted) {
      return res.status(404).json({ success: false, message: "Store not found." });
    }

    res.json({ success: true, message: "Store deleted successfully." });

  } catch (err) {
    console.error("Store DELETE error:", err.message);
    res.status(500).json({ success: false, message: "Failed to delete store.", error: err.message });
  }
});

module.exports = router;