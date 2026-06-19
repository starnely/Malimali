const express = require("express");
const router = express.Router();
const Return = require("../models/Return");
const Sale = require("../models/Sale");
const Product = require("../models/Product");
const User = require("../models/User");
const Archive = require("../models/Archive");
const { authMiddleware, ownerOnly } = require("../middleware/authMiddleware");

router.use(authMiddleware);

// ── 1. GET RETURNS ───────────────────────────────────────────────────
router.get("/", async (req, res) => {
  try {
    let query = {};

    if (req.query.status) query.status = req.query.status;

    if (req.user.role === "cashier" || req.user.role === "employee") {
      query.requestedBy = req.user.id;
    } else if (req.user.role === "manager") {
      const storeSales = await Sale.find({ store: req.user.store }).select("_id");
      const saleIds = storeSales.map(s => s._id);
      query.saleId = { $in: saleIds };
    }
    // Owner sees everything — no additional filter

    const returns = await Return.find(query)
      .populate("items.productId", "name category")
      .populate("requestedBy", "fullname username")
      .sort({ createdAt: -1 });

    res.json({ success: true, returns });

  } catch (err) {
    console.error("Error fetching returns:", err);
    res.status(500).json({ success: false, message: "Failed to fetch returns." });
  }
});

// ── 2. SUBMIT RETURN REQUEST ─────────────────────────────────────────
router.post("/", async (req, res) => {
  try {
    const { saleId, items, reason, customerName } = req.body;

    if (!saleId || !items || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Sale ID and return items are required."
      });
    }

    const sale = await Sale.findById(saleId);
    if (!sale) {
      return res.status(404).json({ success: false, message: "Sale record not found." });
    }

    if (
      (req.user.role === "cashier" || req.user.role === "employee") &&
      String(sale.cashierId) !== String(req.user.id)
    ) {
      return res.status(403).json({
        success: false,
        message: "You can only submit returns for your own sales."
      });
    }

    const existingPending = await Return.findOne({ saleId, status: "pending" });
    if (existingPending) {
      return res.status(400).json({
        success: false,
        message: "This sale already has a pending return request."
      });
    }

    // Resolve price and qty from the stored sale — never trust client-supplied prices.
    let refundAmount = 0;
    const resolvedItems = [];

    for (const i of items) {
      // Prefer saleItemId (sub-doc _id) when provided — essential for sales
      // where the same product appears as more than one line item.
      const saleItem = i.saleItemId
        ? sale.items.id(i.saleItemId)
        : sale.items.find(si => String(si.productId) === String(i.productId));
      if (!saleItem) {
        return res.status(400).json({
          success: false,
          message: "One or more items were not found in this sale."
        });
      }
      const qty = Number(i.qty);
      const maxReturnable = (saleItem.qty || 0)
        - (saleItem.returnedQty || 0)
        - (saleItem.voidedQty   || 0);
      if (qty <= 0 || qty > maxReturnable) {
        return res.status(400).json({
          success: false,
          message: `Return quantity for item exceeds what is eligible for return (max ${maxReturnable}).`
        });
      }
      refundAmount += qty * saleItem.price;
      resolvedItems.push({
        saleItemId: saleItem._id,   // sub-doc _id — avoids find-first-by-productId ambiguity
        productId:  saleItem.productId,
        qty,
        sellPrice:  saleItem.price,
      });
    }

    const now = new Date(Date.now() + 3 * 60 * 60 * 1000);

    const returnRecord = new Return({
      saleId,
      items: resolvedItems,
      reason,
      customerName,
      requestedBy:  req.user.id,
      refundAmount,
      status: "pending",
      date:   now.toISOString().split("T")[0],
      time:   now.toISOString().slice(11, 19) + " EAT"
    });

    await returnRecord.save();

    // Mark the exact sale sub-documents as pending, matched by sub-doc _id.
    for (const returnItem of resolvedItems) {
      const saleItem = sale.items.id(returnItem.saleItemId);
      if (saleItem) saleItem.returnStatus = "pending";
    }
    sale.returnStatus = "pending";
    sale.returnId     = returnRecord._id;
    await sale.save();

    // Notify owner via socket
    const requester = await User.findById(req.user.id).select("fullname username");
    const io = req.app.get("io");
    if (io) {
      io.to("owner").emit("newReturnRequest", {
        returnId:      returnRecord._id,
        saleId,
        requesterName: requester?.fullname || requester?.username || "Employee",
        message:       `${requester?.fullname || "An employee"} submitted a return request`,
        reason,
        refundAmount,
        items:         returnRecord.items
      });
    }

    res.status(201).json({ success: true, return: returnRecord });

  } catch (err) {
    console.error("Error submitting return:", err);
    res.status(500).json({
      success: false,
      message: "Failed to submit return request.",
      error: err.message
    });
  }
});

// ── 3. APPROVE RETURN ────────────────────────────────────────────────
router.patch("/:id/approve", ownerOnly, async (req, res) => {
  try {
    const returnRecord = await Return.findById(req.params.id).populate("items.productId");
    if (!returnRecord) {
      return res.status(404).json({ success: false, message: "Return record not found." });
    }

    if (returnRecord.status === "approved") {
      return res.status(400).json({ success: false, message: "This return has already been approved." });
    }
    if (returnRecord.status === "rejected") {
      return res.status(400).json({ success: false, message: "This return has already been rejected and cannot be approved." });
    }

    // ── 1. Restore stock for each returned item ──
    for (const item of returnRecord.items) {
      await Product.findByIdAndUpdate(
        item.productId._id || item.productId,
        { $inc: { stock: item.qty } }
      );
    }

    // ── 2. Update sale items and totals ──
    const sale = await Sale.findById(returnRecord.saleId).populate("items.productId");
    if (sale) {
      for (const returnItem of returnRecord.items) {
        const saleItem = sale.items.id(returnItem.saleItemId);
        if (saleItem) {
          // Accumulate returnedQty — do NOT mutate qty so original qty is preserved
          saleItem.returnedQty  = (saleItem.returnedQty || 0) + returnItem.qty
          saleItem.returnStatus = "approved"

          // Mark fully returned if nothing active remains
          const remaining = (saleItem.qty || 0) - (saleItem.voidedQty || 0) - saleItem.returnedQty
          if (remaining <= 0) {
            saleItem.isFullyReturned = true
          }
        }
      }

      sale.total = Math.max(0, sale.total - returnRecord.refundAmount);

      if (sale.paymentInfo) {
        sale.paymentInfo.finalTotal = Math.max(
          0,
          (sale.paymentInfo.finalTotal ?? sale.total) - returnRecord.refundAmount
        );
      }

      // Only mark sale as fully returned if every item is fully returned
      const allReturned = sale.items.every(si => si.isFullyReturned === true);
      if (allReturned) sale.returned = true;

      sale.returnStatus = "approved";
      await sale.save();
    }

    // ── 3. Mark return as approved ──
    returnRecord.status     = "approved";
    returnRecord.approvedAt = new Date().toISOString();
    await returnRecord.save();

    // ── 4. Recalculate archive for affected cashier and date ──
    const saleDate    = sale?.date;
    const cashierName = sale?.cashier;

    if (saleDate && cashierName) {
      const daySales = await Sale.find({
        date:     saleDate,
        cashier:  cashierName,
        returned: false
      });

      const revenue = daySales.reduce((sum, s) =>
        sum + (s.paymentInfo?.finalTotal ?? s.total ?? 0), 0);

      const transactions = daySales.length;

      // itemsSold uses active qty — subtracts voided and returned units
      const itemsSold = daySales.reduce((sum, s) =>
        sum + s.items.reduce((inner, i) => {
          if (i.voidStatus === "voided") return inner
          return inner + Math.max(0, (i.qty || 0) - (i.voidedQty || 0) - (i.returnedQty || 0))
        }, 0), 0);

      const pureCash = daySales
        .filter(s => s.paymentInfo?.paymentMethod === "cash")
        .reduce((sum, s) => sum + (s.paymentInfo?.finalTotal ?? s.total ?? 0), 0);
      const pureMpesa = daySales
        .filter(s => s.paymentInfo?.paymentMethod === "mpesa")
        .reduce((sum, s) => sum + (s.paymentInfo?.finalTotal ?? s.total ?? 0), 0);
      const splitCash = daySales
        .filter(s => s.paymentInfo?.paymentMethod === "split")
        .reduce((sum, s) => sum + (s.paymentInfo?.cashPart || 0), 0);
      const splitMpesa = daySales
        .filter(s => s.paymentInfo?.paymentMethod === "split")
        .reduce((sum, s) => sum + (s.paymentInfo?.mpesaPart || 0), 0);
      const credit = daySales
        .filter(s => s.paymentInfo?.paymentMethod === "credit")
        .reduce((sum, s) => sum + (s.paymentInfo?.finalTotal ?? s.total ?? 0), 0);

      // Deduct refund from the correct payment method bucket
      const originalMethod = sale?.paymentInfo?.paymentMethod || "cash";
      let adjustedCash  = pureCash  + splitCash;
      let adjustedMpesa = pureMpesa + splitMpesa;

      if (originalMethod === "cash") {
        adjustedCash = Math.max(0, adjustedCash - returnRecord.refundAmount);
      } else if (originalMethod === "mpesa") {
        adjustedMpesa = Math.max(0, adjustedMpesa - returnRecord.refundAmount);
      } else if (originalMethod === "split") {
        const cashRatio  = sale.paymentInfo.cashPart  / (sale.paymentInfo.finalTotal || 1);
        const mpesaRatio = sale.paymentInfo.mpesaPart / (sale.paymentInfo.finalTotal || 1);
        adjustedCash  = Math.max(0, adjustedCash  - returnRecord.refundAmount * cashRatio);
        adjustedMpesa = Math.max(0, adjustedMpesa - returnRecord.refundAmount * mpesaRatio);
      }

      await Archive.findOneAndUpdate(
        { employeeName: cashierName, date: saleDate },
        {
          revenue,
          transactions,
          itemsSold,
          paymentBreakdown: {
            cash:       adjustedCash,
            mpesa:      adjustedMpesa,
            splitCash,
            splitMpesa,
            credit
          }
        },
        { upsert: true, new: true }
      );
    }

    // ── 5. Notify requester and broadcast sync ──
    const io = req.app.get("io");
    if (io) {
      io.to(returnRecord.requestedBy.toString()).emit("returnUpdated", {
        status:  "approved",
        message: `✅ Return approved — refund KSh ${returnRecord.refundAmount?.toLocaleString()} to customer`
      });
      io.emit("sync_system_data");
    }

    res.json({ success: true, return: returnRecord });

  } catch (err) {
    console.error("Error approving return:", err);
    res.status(500).json({ success: false, message: "Failed to approve return.", error: err.message });
  }
});

// ── 4. REJECT RETURN ─────────────────────────────────────────────────
router.patch("/:id/reject", ownerOnly, async (req, res) => {
  try {
    const returnRecord = await Return.findById(req.params.id);
    if (!returnRecord) {
      return res.status(404).json({ success: false, message: "Return record not found." });
    }

    if (returnRecord.status === "approved") {
      return res.status(400).json({ success: false, message: "This return has already been approved and cannot be rejected." });
    }
    if (returnRecord.status === "rejected") {
      return res.status(400).json({ success: false, message: "This return has already been rejected." });
    }

    returnRecord.status     = "rejected";
    returnRecord.rejectedAt = new Date().toISOString();
    await returnRecord.save();

    // Reset sale items returnStatus
    const sale = await Sale.findById(returnRecord.saleId);
    if (sale) {
      for (const returnItem of returnRecord.items) {
        const saleItem = sale.items.id(returnItem.saleItemId);
        if (saleItem) saleItem.returnStatus = "rejected";
      }
      sale.returnStatus = "rejected";
      await sale.save();
    }

    // Notify requester
    const io = req.app.get("io");
    if (io) {
      io.to(returnRecord.requestedBy.toString()).emit("returnUpdated", {
        saleId:   returnRecord.saleId,
        returnId: returnRecord._id,
        status:   "rejected",
        message:  "❌ Your return request was rejected by the owner."
      });
      io.emit("sync_system_data");
    }

    res.json({ success: true, return: returnRecord });

  } catch (err) {
    console.error("Error rejecting return:", err);
    res.status(500).json({ success: false, message: "Failed to reject return.", error: err.message });
  }
});

module.exports = router;
