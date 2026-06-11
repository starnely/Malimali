const express = require("express");
const router = express.Router();
const Product = require("../models/Product");
const StockIn = require("../models/StockIn");
const { authMiddleware, ownerOnly } = require("../middleware/authMiddleware");

router.use(authMiddleware);

// ── 1. GET STOCK IN LOG ──────────────────────────────────────────────
router.get("/", async (req, res) => {
  try {
    let query = {};

    if (req.user.role === "cashier" || req.user.role === "employee") {
      return res.status(403).json({
        success: false,
        message: "Access denied: Stock records are restricted to management."
      });
    }

    if (req.user.role === "manager") {
      query.store = req.user.store;
    }

    if (req.user.role === "owner" && req.query.store) {
      query.store = req.query.store;
    }

    const stockIn = await StockIn.find(query).sort({ createdAt: -1 });
    res.json({ success: true, stockIn });
  } catch (err) {
    console.error("StockIn GET error:", err.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch stock intake history.",
      error: err.message
    });
  }
});

// ── 2. POST — RESTOCK EXISTING PRODUCT ──────────────────────────────
router.post("/", async (req, res) => {
  try {
    if (req.user.role === "cashier" || req.user.role === "employee") {
      return res.status(403).json({
        success: false,
        message: "Access denied: Only managers and owners can restock products."
      });
    }

    const { productId, name, category, qty, buyPrice, total } = req.body;

    // ── Validate required fields ──
    if (!productId) {
      return res.status(400).json({ success: false, message: "Product selection is required." });
    }
    if (!qty || Number(qty) <= 0) {
      return res.status(400).json({ success: false, message: "Quantity must be greater than zero." });
    }
    if (!buyPrice || Number(buyPrice) <= 0) {
      return res.status(400).json({ success: false, message: "Buy price must be greater than zero." });
    }

    // ── Confirm product exists ──
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found in inventory." });
    }

    // ── Manager can only restock products in their store ──
    if (req.user.role === "manager" && product.store !== req.user.store) {
      return res.status(403).json({
        success: false,
        message: "Access denied: You can only restock products in your assigned store."
      });
    }

    const parsedQty      = Number(qty);
    const parsedBuyPrice = Number(buyPrice);
    const parsedTotal    = Number(total) || parsedQty * parsedBuyPrice;

    // ── Update product stock ──
    const updatedProduct = await Product.findByIdAndUpdate(
      productId,
      { $inc: { stock: parsedQty }, $set: { buyPrice: parsedBuyPrice } },
      { new: true }
    );

    // ── Log the stock-in entry ──
    const entry = new StockIn({
      productId,
      name:       name       || product.name,
      category:   category   || product.category,
      store:      product.store,
      qty:        parsedQty,
      buyPrice:   parsedBuyPrice,
      total:      parsedTotal,
      recordedBy: req.user.name || req.user.username || "Unknown"
    });

    await entry.save();

    // ── Emit socket so all clients refresh products ──
    const io = req.app.get("io");
    if (io) io.emit("productsUpdated");

    res.status(201).json({
      success: true,
      product: updatedProduct,
      entry
    });

  } catch (err) {
    console.error("StockIn POST error:", err.message);
    if (err.name === "ValidationError") {
      const messages = Object.values(err.errors).map(e => e.message);
      return res.status(400).json({ success: false, message: messages.join(", ") });
    }
    res.status(500).json({
      success: false,
      message: "Failed to process stock restock operation.",
      error: err.message
    });
  }
});

module.exports = router;