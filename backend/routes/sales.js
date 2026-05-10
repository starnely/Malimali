const express = require("express");
const router = express.Router();
const Sale = require("../models/Sale");
const Product = require("../models/Product");
const User = require("../models/User");
const { authMiddleware } = require("../middleware/authMiddleware");

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
      cashierId: user._id,
      cashier: user.name || user.username || "Cashier",
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
      date: new Date().toISOString().split('T')[0], 
      time: new Date().toLocaleTimeString("en-KE"),
      returnStatus: "none"
    });

    await sale.save();

    // ── SOCKET BROADCASTING ──
    const io = req.app.get("io");
    if (io) {
      // Broadcast to specific "owner" room for dashboard updates/notifications
      io.to("owner").emit("newSale", { 
        cashier: user.name, 
        total: paymentInfo?.finalTotal || total 
      });

      // Broadcast to EVERYONE (including the cashier who just sold) 
      // so all tabs sync their product stock levels
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
    const user = req.user;
    let query = user.role === "owner" ? {} : { cashierId: user.id };

    const rawSales = await Sale.find(query)
      .populate("cashierId", "username name")
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