const express = require("express");
const router = express.Router();
const Store = require("../models/Store");
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

    // Explicit field update — never pass raw req.body to MongoDB
    const updateData = {
      name:     name.trim(),
      location: location ? location.trim() : "",
      phone:    phone    ? phone.trim()    : ""
    };

    const updated = await Store.findByIdAndUpdate(
      req.params.id,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!updated) {
      return res.status(404).json({ success: false, message: "Store not found." });
    }

    res.json({ success: true, store: updated });

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