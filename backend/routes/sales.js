const express = require("express");
const router = express.Router();
const Sale = require("../models/Sale");
const Product = require("../models/Product");
const User = require("../models/User");
const { authMiddleware } = require("../middleware/authMiddleware");

// Helper to match your Sale model's EAT logic
function getEATDate() {
  return new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString().split("T")[0];
}

// ── RECORD SALE ────────────────────────────────────────────────────────
router.post("/", authMiddleware, async (req, res) => {
  try {
    const { items, total, paymentInfo } = req.body;

    const user = await User.findById(req.user.id);
    if (!user) return res.status(401).json({ success: false, error: "User not found" });

    // 1. Validate stock
    for (const item of items) {
      const product = await Product.findById(item.productId);
      if (!product) return res.status(404).json({ success: false, error: "Product not found" });
      if (product.stock < item.qty) {
        return res.status(400).json({ success: false, error: `Not enough stock for: ${product.name}` });
      }
    }

    // 2. Deduct stock
    for (const item of items) {
      await Product.findByIdAndUpdate(item.productId, { $inc: { stock: -item.qty } });
    }

    const sale = new Sale({
      items: items.map(i => ({
        productId: i.productId,
        qty: i.qty,
        price: i.price || 0,
        returnStatus: "none"
      })),
      total,
      store: user.store || "Main Store", //which store made the sale
      cashierId: user._id,
      cashier: user.fullname || user.username,
      paymentInfo: {
        paymentMethod: paymentInfo?.paymentMethod || "cash",
        mpesaPhone: paymentInfo?.mpesaPhone || "",
        customerName: paymentInfo?.customerName || "",
        cashPart: paymentInfo?.cashPart || 0,
        mpesaPart: paymentInfo?.mpesaPart || 0,
        discount: paymentInfo?.discount || 0,
        finalTotal: paymentInfo?.finalTotal || total,
        cashGiven: paymentInfo?.cashGiven || 0,
        change: paymentInfo?.change || 0,
      },
      date: getEATDate(),
      returnStatus: "none"
    });

    await sale.save();

    // ── SOCKET BROADCASTING ──
    const io = req.app.get("io");
    if (io) {
      // Notify owner of the sale and which store it came from
      io.to("owner").emit("newSale", {
        cashier: user.fullname,
        store: user.store,
        total: sale.paymentInfo.finalTotal
      });
      io.emit("productsUpdated");
    }

    res.json({ success: true, sale });
  } catch (err) {
    console.error("Error recording sale:", err);
    res.status(500).json({ success: false, error: err.message || "Failed to record sale" });
  }
});

// ── GET SALES ──────────────────────
router.get("/", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    let query = {};

    // 👈 NEW: Filter logic
    if (user.role !== "owner") {
      // Managers and Cashiers only see their store's sales
      query.store = user.store;
    } else if (req.query.store && req.query.store !== "All") {
      // Owner can filter by a specific store via query param
      query.store = req.query.store;
    }

    const rawSales = await Sale.find(query)
      .populate("cashierId", "username fullname")
      .populate("items.productId", "name category")
      .sort({ createdAt: -1 });

    const sales = rawSales.map(sale => {
      const saleObj = sale.toObject();
      const returnedAmount = sale.items.reduce((sum, item) => {
        return item.returnStatus === "approved" ? sum + (item.qty * item.price) : sum;
      }, 0);

      saleObj.netTotal = (sale.paymentInfo?.finalTotal || sale.total) - returnedAmount;
      saleObj.isPartiallyReturned = sale.items.some(i => i.returnStatus === "approved");

      return saleObj;
    });

    res.json(sales);
  } catch (err) {
    console.error("Error fetching sales:", err);
    res.status(500).json({ error: "Failed to fetch sales" });
  }
});

module.exports = router;