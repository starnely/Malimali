const express = require("express");
const router = express.Router();
const Archive = require("../models/Archive");
const Sale = require("../models/Sale");
const { authMiddleware } = require("../middleware/authMiddleware");

// GET archives
router.get("/", authMiddleware, async (req, res) => {
  try {
    const query = req.user.role === "owner"
      ? {}
      : { employeeName: req.user.name };

    const archives = await Archive.find(query).sort({ date: -1 });
    res.json(archives);
  } catch (err) {
    console.error("Fetch archives error:", err.message);
    res.status(500).json({ error: "Failed to fetch archives" });
  }
});

// POST new archive snapshot
router.post("/", authMiddleware, async (req, res) => {
  try {
    const date = req.body.date || new Date().toISOString().split("T")[0];

    // Check if Sale model is correctly loaded
    if (!Sale) {
      return res.status(500).json({ success: false, message: "Sale model not loaded" });
    }

    // 1. Fetch sales for the specific date that haven't been returned
    const daySales = await Sale.find({
      date,
      returned: false,
      cashier: req.user.name
    });

    // 2. Calculate Revenue based on what was ACTUALLY paid (finalTotal)
    const revenue = daySales.reduce((sum, s) => {
      const actualPaid = s.paymentInfo?.finalTotal ?? s.total ?? 0;
      return sum + actualPaid;
    }, 0);

    const profit = daySales.reduce((sum, s) => sum + (s.profit || 0), 0);
    const transactions = daySales.length;
    const itemsSold = daySales.reduce(
      (sum, s) => sum + s.items.reduce((inner, i) => inner + i.qty, 0),
      0
    );

    // 3. Calculate Payment Breakdowns
    const pureCash = daySales
      .filter(s => s.paymentInfo?.paymentMethod === "cash")
      .reduce((sum, s) => sum + (s.paymentInfo?.finalTotal ?? s.total), 0);

    const pureMpesa = daySales
      .filter(s => s.paymentInfo?.paymentMethod === "mpesa")
      .reduce((sum, s) => sum + (s.paymentInfo?.finalTotal ?? s.total), 0);

    const splitCashPart = daySales
      .filter(s => s.paymentInfo?.paymentMethod === "split")
      .reduce((sum, s) => sum + (s.paymentInfo?.cashPart || 0), 0);

    const splitMpesaPart = daySales
      .filter(s => s.paymentInfo?.paymentMethod === "split")
      .reduce((sum, s) => sum + (s.paymentInfo?.mpesaPart || 0), 0);

    const credit = daySales
      .filter(s => s.paymentInfo?.paymentMethod === "credit")
      .reduce((sum, s) => sum + (s.paymentInfo?.finalTotal ?? s.total), 0);

    // 4. Save archive snapshot
    const archiveData = {
      employeeName: req.user?.name || "Unknown Employee",
      date,
      revenue,
      profit: daySales.reduce((sum, s) => sum + (s.profit || 0), 0),
      transactions: daySales.length,
      itemsSold: daySales.reduce((sum, s) => sum + (s.items?.reduce((inner, i) => inner + (i.qty || 0), 0) || 0), 0),
      paymentBreakdown: {
        cash: pureCash + splitCashPart,
        mpesa: pureMpesa + splitMpesaPart,
        splitCash: splitCashPart,
        splitMpesa: splitMpesaPart,
        credit: credit
      }
    };

    // Update instead of Duplicate
    const updatedArchive = await Archive.findOneAndUpdate(
      { employeeName: req.user.name, date },
      archiveData,
      { upsert: true, new: true }
    );

    // ── 5. SOCKET BROADCASTING ──────────────────────────────────────────
    const io = req.app.get("io");

    if (io) {
      console.log(`📢 Sending notification for ${req.user.name} to owner room...`);
      // A. Notify the 'owner' room specifically for the Sidebar Notification
      // This matches the listener we added in Sidebar.jsx

      const displayName = req.user?.name || "Unknown Employee";
      
      io.to("owner").emit("adminShiftNotification", {
        employeeName: displayName,
        revenue: revenue,
        time: new Date().toLocaleTimeString()
      });
      // B. Notify the specific Employee (Add this)
      // This triggers the 'Shift Closed!' green badge in their Sidebar.jsx
      io.emit("shiftClosedConfirmation", { userId: req.user.id });
    } else {
      console.error("❌ Socket.io instance NOT FOUND in req.app");
    }
    // ────────────────────────────────────────────────────────────────────
    // ALWAYS include success: true
    res.json({ success: true, archive: updatedArchive });

  } catch (err) {
    console.error("Save archive error:", err.message);
    // FIX: Send success: false so the frontend doesn't crash trying to read 'undefined'
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;