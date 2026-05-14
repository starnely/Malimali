const express = require("express");
const Return = require("../models/Return");
const Sale = require("../models/Sale");
const Product = require("../models/Product");
const User = require("../models/User");
const Archive = require("../models/Archive");
const { authMiddleware } = require("../middleware/authMiddleware");

const router = express.Router();

// ── GET RETURNS ────────────────────────────────────────────────────────
router.get("/", authMiddleware, async (req, res) => {
  try {
    let query = {};
    if (req.query.status) query.status = req.query.status;
    if (req.user.role !== "owner") query.requestedBy = req.user.id;

    const returns = await Return.find(query)
      .populate("items.productId", "name category")
      .populate("requestedBy", "name username")
      .sort({ createdAt: -1 });

    res.json(returns);
  } catch (err) {
    console.error("Error fetching returns:", err);
    res.status(500).json({ error: "Failed to fetch returns" });
  }
});

// ── SUBMIT RETURN ──────────────────────────────────────────────────────
router.post("/", authMiddleware, async (req, res) => {
  try {
    const { saleId, items, reason, customerName } = req.body;
    const requestedById = req.user.id;

    const refundAmount = items.reduce((sum, i) =>
      sum + (i.qty * (i.price || i.sellPrice || 0)), 0);

    const returnRecord = new Return({
      saleId,
      items: items.map(i => ({
        productId: i.productId,
        qty: i.qty,
        sellPrice: i.price || i.sellPrice || 0
      })),
      reason,
      customerName,
      requestedBy: requestedById,
      refundAmount,
      status: "pending",
      date: new Date().toISOString().split("T")[0],
      time: new Date().toLocaleTimeString("en-KE")
    });

    await returnRecord.save();

    await Sale.findByIdAndUpdate(saleId, {
      returnStatus: "pending",
      returnId: returnRecord._id
    });

    const sale = await Sale.findById(saleId);
    if (sale) {
      for (const returnItem of items) {
        const saleItem = sale.items.find(si =>
          String(si.productId) === String(returnItem.productId) ||
          String(si._id) === String(returnItem.saleItemId)
        );
        if (saleItem) saleItem.returnStatus = "pending";
      }
      await sale.save();
    }

    const requester = await User.findById(requestedById);
    const io = req.app.get("io");
    if (io) {
      io.to("owner").emit("newReturnRequest", {
        returnId: returnRecord._id,
        saleId,
        requesterName: requester?.name || "Employee",
        message: `${requester?.name || "An employee"} wants to return an item`,
        reason,
        refundAmount,
        items: returnRecord.items
      });
    }

    res.json(returnRecord);
  } catch (err) {
    console.error("Error submitting return:", err);
    res.status(500).json({ error: "Failed to submit return", details: err.message });
  }
});

// ── APPROVE RETURN ──────────────────────────────────────────────────────
router.patch("/:id/approve", authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'owner') {
      return res.status(403).json({ error: "Unauthorized. Only owners can approve returns." });
    }

    const returnRecord = await Return.findById(req.params.id).populate("items.productId");
    if (!returnRecord) return res.status(404).json({ error: "Return not found" });
    if (returnRecord.status === "approved") return res.status(400).json({ error: "Already approved" });

    // 1. Restore stock for each returned item
    for (const item of returnRecord.items) {
      await Product.findByIdAndUpdate(
        item.productId._id || item.productId,
        { $inc: { stock: item.qty } }
      );
    }

    // 2. Update the original sale
    const sale = await Sale.findById(returnRecord.saleId).populate("items.productId");
    if (sale) {
      for (const returnItem of returnRecord.items) {
        const saleItem = sale.items.find(si =>
          String(si.productId?._id || si.productId) === String(returnItem.productId._id || returnItem.productId)
        );

        if (saleItem) {
          saleItem.qty -= returnItem.qty;
          saleItem.returnStatus = "approved";
          if (saleItem.qty <= 0) {
            saleItem.qty = 0;
            saleItem.isFullyReturned = true;
          }
        }
      }

      // Deduct refund from sale total
      sale.total = Math.max(0, sale.total - returnRecord.refundAmount);

      // ── Also reduce paymentInfo.finalTotal so archive recalc picks up correct amount ──
      if (sale.paymentInfo) {
        sale.paymentInfo.finalTotal = Math.max(
          0,
          (sale.paymentInfo.finalTotal ?? sale.total) - returnRecord.refundAmount
        );
      }

      // Mark fully returned if all items are back
      const allReturned = sale.items.every(si => si.isFullyReturned === true);
      if (allReturned) sale.returned = true;

      sale.returnStatus = "approved";
      await sale.save();
    }

    // 3. Mark return as approved
    returnRecord.status = "approved";
    returnRecord.approvedAt = new Date().toISOString();
    await returnRecord.save();

    // 4. ── RECALCULATE ARCHIVE ──────────────────────────────────────────
    const saleDate = sale?.date;
    const cashierName = sale?.cashier;

    if (saleDate && cashierName) {
      // Re-fetch all non-fully-returned sales for that cashier on that date
      const daySales = await Sale.find({
        date: saleDate,
        cashier: cashierName,
        returned: false
      });

      // Revenue uses updated finalTotal (already reduced above on the sale)
      const revenue = daySales.reduce((sum, s) =>
        sum + (s.paymentInfo?.finalTotal ?? s.total ?? 0), 0);

      const transactions = daySales.length;

      // itemsSold uses current qty (already reduced above on each saleItem)
      const itemsSold = daySales.reduce((sum, s) =>
        sum + s.items.reduce((inner, i) => inner + (i.qty || 0), 0), 0);

      // ── Payment breakdown — refund deducted from cash only ──
      const pureCash = daySales
        .filter(s => s.paymentInfo?.paymentMethod === "cash")
        .reduce((sum, s) => sum + (s.paymentInfo?.finalTotal ?? s.total ?? 0), 0);

      const pureMpesa = daySales
        .filter(s => s.paymentInfo?.paymentMethod === "mpesa")
        .reduce((sum, s) => sum + (s.paymentInfo?.finalTotal ?? s.total ?? 0), 0);

      const splitCashPart = daySales
        .filter(s => s.paymentInfo?.paymentMethod === "split")
        .reduce((sum, s) => sum + (s.paymentInfo?.cashPart || 0), 0);

      const splitMpesaPart = daySales
        .filter(s => s.paymentInfo?.paymentMethod === "split")
        .reduce((sum, s) => sum + (s.paymentInfo?.mpesaPart || 0), 0);

      const credit = daySales
        .filter(s => s.paymentInfo?.paymentMethod === "credit")
        .reduce((sum, s) => sum + (s.paymentInfo?.finalTotal ?? s.total ?? 0), 0);

      // Deduct refund from cash only — this is what the cashier pays out physically
      const cashAfterRefund = Math.max(0, (pureCash + splitCashPart) - returnRecord.refundAmount);

      await Archive.findOneAndUpdate(
        { employeeName: cashierName, date: saleDate },
        {
          employeeName: cashierName,
          date: saleDate,
          revenue,
          transactions,
          itemsSold,
          paymentBreakdown: {
            cash: cashAfterRefund,              // ← refund deducted here only
            mpesa: pureMpesa + splitMpesaPart,  // ← mpesa untouched
            splitCash: splitCashPart,
            splitMpesa: splitMpesaPart,
            credit
          }
        },
        { upsert: true, new: true }
      );
    }

    // 5. Real-time sync
    const io = req.app.get("io");
    if (io) {
      io.to(returnRecord.requestedBy.toString()).emit("returnUpdated", {
        status: "approved",
        message: `✅ Return approved — refund KSh ${returnRecord.refundAmount?.toLocaleString()} to customer`
      });
      io.emit("sync_system_data");
    }

    res.json({ success: true, return: returnRecord });
  } catch (err) {
    console.error("Error approving return:", err);
    res.status(500).json({ error: "Failed to approve return" });
  }
});

// ── REJECT RETURN ──────────────────────────────────────────────────────
router.patch("/:id/reject", authMiddleware, async (req, res) => {
  try {
    const returnRecord = await Return.findById(req.params.id).populate("items.productId");
    if (!returnRecord) return res.status(404).json({ error: "Return not found" });

    returnRecord.status = "rejected";
    returnRecord.rejectedAt = new Date().toISOString();
    await returnRecord.save();

    await Sale.findByIdAndUpdate(returnRecord.saleId, { returnStatus: "rejected" });

    const sale = await Sale.findById(returnRecord.saleId);
    if (sale) {
      for (const returnItem of returnRecord.items) {
        const saleItem = sale.items.find(si =>
          String(si.productId?._id || si.productId) === String(returnItem.productId?._id || returnItem.productId)
        );
        if (saleItem) saleItem.returnStatus = "rejected";
      }
      await sale.save();
    }

    const io = req.app.get("io");
    if (io) {
      io.to(returnRecord.requestedBy.toString()).emit("returnUpdated", {
        saleId: returnRecord.saleId,
        returnId: returnRecord._id,
        status: "rejected",
        message: "❌ Return request was rejected by owner"
      });
    }

    res.json({ success: true, return: returnRecord });
  } catch (err) {
    console.error("Error rejecting return:", err);
    res.status(500).json({ error: "Failed to reject return" });
  }
});

module.exports = router;