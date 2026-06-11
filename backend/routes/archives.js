const express = require("express");
const router = express.Router();
const Archive = require("../models/Archive");
const Sale = require("../models/Sale");
const { authMiddleware } = require("../middleware/authMiddleware");

router.use(authMiddleware);

// ── 1. GET ARCHIVES ──────────────────────────────────────────────────
router.get("/", async (req, res) => {
  try {
    let query = {};

    if (req.user.role === "owner") {
      if (req.query.store && req.query.store !== "All") {
        query.store = req.query.store;
      }
    } else if (req.user.role === "manager") {
      query.store = req.user.store;
    } else {
      const employeeName = req.user.name || req.user.fullname;
      if (!employeeName) {
        return res.status(400).json({
          success: false,
          message: "Unable to identify employee from token."
        });
      }
      query.employeeName = employeeName;
    }

    const archives = await Archive.find(query).sort({ date: -1 });
    res.json({ success: true, archives });

  } catch (err) {
    console.error("Archives GET error:", err.message);
    res.status(500).json({ success: false, message: "Failed to fetch archives.", error: err.message });
  }
});

// ── 2. CLOSE SHIFT — CREATE ARCHIVE SNAPSHOT ────────────────────────
router.post("/", async (req, res) => {
  try {
    const employeeName = req.user.name || req.user.fullname;
    const store = req.user.store || "Main Store";

    if (!employeeName) {
      return res.status(400).json({
        success: false,
        message: "Unable to identify employee from token."
      });
    }

    // ── EAT date ──
    const todayEAT = new Date(Date.now() + 3 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];

    const date = req.body.date || todayEAT;

    // ── Prevent double close on same day ──
    const alreadyClosed = await Archive.findOne({ employeeName, date });
    if (alreadyClosed) {
      return res.status(400).json({
        success: false,
        message: "You have already closed your shift for today."
      });
    }

    // ── Fetch today's sales for this employee ──
    const daySales = await Sale.find({
      date,
      cashier: employeeName,
      returned: false
    });

    // ── Calculate revenue from finalTotal ──
    const revenue = daySales.reduce((sum, s) => {
      if (s.voided) return sum
      // Calculate from active items to handle partial voids
      const saleRevenue = s.items.reduce((itemSum, item) => {
        if (item.voidStatus === 'voided') return itemSum
        const activeQty = Math.max(0, item.qty - (item.voidedQty || 0) - (item.returnedQty || 0))
        return itemSum + (item.price * activeQty)
      }, 0)
      return sum + saleRevenue
    }, 0)

    const profit = daySales.reduce((sum, s) => {
      if (s.voided) return sum
      return sum + s.items.reduce((itemSum, item) => {
        if (item.voidStatus === 'voided') return itemSum
        const activeQty = Math.max(0, item.qty - (item.voidedQty || 0) - (item.returnedQty || 0))
        const sellPrice = item.price || 0
        const costPrice = item.buyPrice || 0
        return itemSum + (sellPrice - costPrice) * activeQty
      }, 0)
    }, 0)
    const transactions = daySales.filter(s => {
      if (s.voided) return false
      return s.items.some(i => i.voidStatus !== 'voided' && Math.max(0, i.qty - (i.voidedQty || 0) - (i.returnedQty || 0)) > 0)
    }).length

    const itemsSold = daySales.reduce((sum, s) => {
      if (s.voided) return sum
      return sum + s.items.reduce((inner, i) => {
        if (i.voidStatus === 'voided') return inner
        return inner + Math.max(0, i.qty - (i.voidedQty || 0) - (i.returnedQty || 0))
      }, 0)
    }, 0)

    // ── Payment breakdown ──
    const pureCash = daySales
      .filter(s => s.paymentInfo?.paymentMethod === "cash" && !s.voided)
      .reduce((sum, s) => sum + (s.paymentInfo?.finalTotal ?? s.total ?? 0), 0);

    const pureMpesa = daySales
      .filter(s => s.paymentInfo?.paymentMethod === "mpesa" && !s.voided)
      .reduce((sum, s) => sum + (s.paymentInfo?.finalTotal ?? s.total ?? 0), 0);

    const splitCashPart = daySales
      .filter(s => s.paymentInfo?.paymentMethod === "split" && !s.voided)
      .reduce((sum, s) => sum + (s.paymentInfo?.cashPart || 0), 0);

    const splitMpesaPart = daySales
      .filter(s => s.paymentInfo?.paymentMethod === "split" && !s.voided)
      .reduce((sum, s) => sum + (s.paymentInfo?.mpesaPart || 0), 0);

    const credit = daySales
      .filter(s => s.paymentInfo?.paymentMethod === "credit" && !s.voided)
      .reduce((sum, s) => sum + (s.paymentInfo?.finalTotal ?? s.total ?? 0), 0);

    const card = daySales
      .filter(s => s.paymentInfo?.paymentMethod === "card" && !s.voided)
      .reduce((sum, s) => sum + (s.paymentInfo?.finalTotal ?? s.total ?? 0), 0);

    const bank = daySales
      .filter(s => s.paymentInfo?.paymentMethod === "bank" && !s.voided)
      .reduce((sum, s) => sum + (s.paymentInfo?.finalTotal ?? s.total ?? 0), 0);

    // ── Cash reconciliation ──────────────────────────────────────────
    const openingFloat = Number(req.body.openingFloat) || 0;
    const actualCash = Number(req.body.actualCash) || 0;

    // Expected cash = opening float + all cash that came in today
    const totalCashIn = pureCash + splitCashPart;
    const expectedCash = openingFloat + totalCashIn;

    // Variance: positive = cashier has extra (over), negative = short
    const variance = actualCash - expectedCash;

    // ── Save archive ──
    const archiveData = {
      employeeName,
      date,
      store,
      revenue,
      profit,
      transactions,
      itemsSold,
      closedAt: new Date(),
      paymentBreakdown: {
        cash: pureCash + splitCashPart,
        mpesa: pureMpesa + splitMpesaPart,
        splitCash: splitCashPart,
        splitMpesa: splitMpesaPart,
        credit,
        card,
        bank
      },
      openingFloat,
      actualCash,
      variance,
    };

    const archive = await Archive.findOneAndUpdate(
      { employeeName, date },
      archiveData,
      { upsert: true, new: true }
    );

    const io = req.app.get("io");
    if (io) {
      io.to("owner").emit("adminShiftNotification", {
        employeeName,
        revenue,
        store,
        variance,
        time: new Date().toLocaleTimeString()
      });
      io.emit("sync_system_data");
    }

    res.json({ success: true, archive });

  } catch (err) {
    console.error("Archive POST error:", err.message);
    res.status(500).json({
      success: false,
      message: "Failed to close shift.",
      error: err.message
    });
  }
});

module.exports = router;
