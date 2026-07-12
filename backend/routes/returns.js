const express     = require("express");
const router      = express.Router();
const bcrypt      = require("bcryptjs");
const Return      = require("../models/Return");
const Sale        = require("../models/Sale");
const Product     = require("../models/Product");
const User        = require("../models/User");
const Archive     = require("../models/Archive");
const ApprovalLog = require("../models/ApprovalLog");
const { authMiddleware, ownerOnly, managerOrOwner } = require("../middleware/authMiddleware");

router.use(authMiddleware);

// Shared archive recalculation — called after any return approval
async function recalcArchive(sale, refundAmount, tenantId) {
  const saleDate    = sale?.date;
  const cashierName = sale?.cashier;
  if (!saleDate || !cashierName) return;

  const daySales = await Sale.find({ tenantId, date: saleDate, cashier: cashierName, returned: false });

  const revenue      = daySales.reduce((sum, s) => sum + (s.paymentInfo?.finalTotal ?? s.total ?? 0), 0);
  const transactions = daySales.length;
  const itemsSold    = daySales.reduce((sum, s) =>
    sum + s.items.reduce((inner, i) => {
      if (i.voidStatus === "voided") return inner;
      return inner + Math.max(0, (i.qty || 0) - (i.voidedQty || 0) - (i.returnedQty || 0));
    }, 0), 0);

  const pureCash   = daySales.filter(s => s.paymentInfo?.paymentMethod === "cash").reduce((sum, s) => sum + (s.paymentInfo?.finalTotal ?? s.total ?? 0), 0);
  const pureMpesa  = daySales.filter(s => s.paymentInfo?.paymentMethod === "mpesa").reduce((sum, s) => sum + (s.paymentInfo?.finalTotal ?? s.total ?? 0), 0);
  const splitCash  = daySales.filter(s => s.paymentInfo?.paymentMethod === "split").reduce((sum, s) => sum + (s.paymentInfo?.cashPart || 0), 0);
  const splitMpesa = daySales.filter(s => s.paymentInfo?.paymentMethod === "split").reduce((sum, s) => sum + (s.paymentInfo?.mpesaPart || 0), 0);
  const credit     = daySales.filter(s => s.paymentInfo?.paymentMethod === "credit").reduce((sum, s) => sum + (s.paymentInfo?.finalTotal ?? s.total ?? 0), 0);

  const originalMethod = sale?.paymentInfo?.paymentMethod || "cash";
  let adjustedCash  = pureCash  + splitCash;
  let adjustedMpesa = pureMpesa + splitMpesa;

  if (originalMethod === "cash") {
    adjustedCash = Math.max(0, adjustedCash - refundAmount);
  } else if (originalMethod === "mpesa") {
    adjustedMpesa = Math.max(0, adjustedMpesa - refundAmount);
  } else if (originalMethod === "split") {
    const cashRatio  = sale.paymentInfo.cashPart  / (sale.paymentInfo.finalTotal || 1);
    const mpesaRatio = sale.paymentInfo.mpesaPart / (sale.paymentInfo.finalTotal || 1);
    adjustedCash  = Math.max(0, adjustedCash  - refundAmount * cashRatio);
    adjustedMpesa = Math.max(0, adjustedMpesa - refundAmount * mpesaRatio);
  }

  await Archive.findOneAndUpdate(
    { tenantId, employeeName: cashierName, date: saleDate },
    { revenue, transactions, itemsSold,
      paymentBreakdown: { cash: adjustedCash, mpesa: adjustedMpesa, splitCash, splitMpesa, credit } },
    { upsert: true, new: true }
  );
}

// ── 1. GET RETURNS ───────────────────────────────────────────────────
router.get("/", async (req, res) => {
  try {
    let query = { tenantId: req.tenantId };

    if (req.query.status) query.status = req.query.status;

    if (req.user.role === "cashier" || req.user.role === "employee") {
      query.requestedBy = req.user.id;
    } else if (req.user.role === "manager") {
      const storeSales = await Sale.find({ tenantId: req.tenantId, store: req.user.store }).select("_id");
      const saleIds = storeSales.map(s => s._id);
      query.saleId = { $in: saleIds };
    }
    // Owner sees everything — no additional filter

    // populate sites 1/4 and 2/4 — match:{tenantId} deferred to 2a-4
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

    const sale = await Sale.findOne({ _id: saleId, tenantId: req.tenantId });
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

    const existingPending = await Return.findOne({ tenantId: req.tenantId, saleId, status: { $in: ["pending_manager", "pending_owner"] } });
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

    // A3: Owner-submitted returns are auto-approved immediately — no pending state needed
    if (req.user.role === "owner") {
      const returnRecord = new Return({
        saleId,
        items: resolvedItems,
        reason,
        customerName,
        requestedBy:  req.user.id,
        refundAmount,
        status:       "approved",
        approvedBy:   req.user.id,
        approvedAt:   now.toISOString(),
        date:         now.toISOString().split("T")[0],
        time:         now.toISOString().slice(11, 19) + " EAT",
        tenantId:     req.tenantId,
      });
      await returnRecord.save();

      // tenantId here prevents a crafted saleItem.productId (data corruption
      // elsewhere or a malicious client) from restocking another tenant's
      // product — same reasoning as sales.js's stock-decrement scoping.
      for (const returnItem of resolvedItems) {
        await Product.findOneAndUpdate({ _id: returnItem.productId, tenantId: req.tenantId }, { $inc: { stock: returnItem.qty } });
      }

      for (const returnItem of resolvedItems) {
        const saleItem = sale.items.id(returnItem.saleItemId);
        if (saleItem) {
          saleItem.returnedQty  = (saleItem.returnedQty || 0) + returnItem.qty;
          saleItem.returnStatus = "approved";
          const remaining = (saleItem.qty || 0) - (saleItem.voidedQty || 0) - saleItem.returnedQty;
          if (remaining <= 0) saleItem.isFullyReturned = true;
        }
      }
      sale.total = Math.max(0, sale.total - refundAmount);
      if (sale.paymentInfo) {
        sale.paymentInfo.finalTotal = Math.max(0, (sale.paymentInfo.finalTotal ?? sale.total) - refundAmount);
      }
      const allReturned = sale.items.every(si => si.isFullyReturned === true);
      if (allReturned) sale.returned = true;
      sale.returnStatus = "approved";
      sale.returnId     = returnRecord._id;
      await sale.save();

      await recalcArchive(sale, refundAmount, req.tenantId).catch(err => console.error("recalcArchive error:", err));

      const io = req.app.get("io");
      if (io) io.emit("sync_system_data");

      return res.status(201).json({ success: true, return: returnRecord });
    }

    // Cashier/employee → stage 1 (manager approval) required first.
    // Manager → skip stage 1, go straight to owner.
    const initialStatus = (req.user.role === "cashier" || req.user.role === "employee")
      ? "pending_manager"
      : "pending_owner";

    const returnRecord = new Return({
      saleId,
      items: resolvedItems,
      reason,
      customerName,
      requestedBy:  req.user.id,
      refundAmount,
      status: initialStatus,
      date:   now.toISOString().split("T")[0],
      time:   now.toISOString().slice(11, 19) + " EAT",
      tenantId: req.tenantId,
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

    const requester = await User.findOne({ _id: req.user.id, tenantId: req.tenantId }).select("fullname username");
    const io = req.app.get("io");
    if (io) {
      if (initialStatus === "pending_manager") {
        // Needs manager stage-1 approval first — notify managers (and owner so panel stays in sync)
        io.to(`manager-${sale.store || ""}`).to("owner").emit("newReturnRequest", {
          returnId:      returnRecord._id,
          saleId,
          stage:         "pending_manager",
          requesterName: requester?.fullname || requester?.username || "Employee",
          message:       `${requester?.fullname || "An employee"} submitted a return request`,
          reason,
          refundAmount,
          items:         returnRecord.items,
        });
      } else {
        // Manager-submitted — skip stage 1, notify owner directly
        io.to("owner").emit("returnNeedsOwnerApproval", {
          returnId:      returnRecord._id,
          saleId,
          stage:         "pending_owner",
          requesterName: requester?.fullname || requester?.username || "Manager",
          message:       `${requester?.fullname || "A manager"} submitted a return for your approval`,
          reason,
          refundAmount,
          items:         returnRecord.items,
        });
      }
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

// ── 3. STAGE-1 APPROVE (cashier-submitted return → manager or owner PIN) ─────
// Any authenticated user may call this; the PIN itself enforces who the approver is.
// Manager PIN is the normal path; owner PIN is an additive override for when
// no manager is on duty (checked only if no manager PIN matched).
router.patch("/:id/approve-stage1", async (req, res) => {
  try {
    const { approverPin } = req.body;
    if (!approverPin) {
      return res.status(400).json({ success: false, message: "Manager PIN is required for stage-1 approval." });
    }

    const returnRecord = await Return.findOne({ _id: req.params.id, tenantId: req.tenantId });
    if (!returnRecord) return res.status(404).json({ success: false, message: "Return record not found." });

    if (returnRecord.status !== "pending_manager") {
      return res.status(400).json({ success: false, message: "This return is not awaiting manager approval." });
    }

    // Find the sale to determine store
    const sale = await Sale.findOne({ _id: returnRecord.saleId, tenantId: req.tenantId }).select("store").lean();
    if (!sale) return res.status(404).json({ success: false, message: "Sale not found." });

    // Scan managers in that store for a PIN match. tenantId required — store
    // names aren't unique across tenants (same reasoning as sales.js).
    const managers = await User.find({ tenantId: req.tenantId, role: "manager", store: sale.store });
    let approver = null;
    let actionType = "return_stage1";
    for (const mgr of managers) {
      if (mgr.approvalPin && await bcrypt.compare(approverPin, mgr.approvalPin)) {
        approver = mgr; break;
      }
    }
    if (!approver) {
      // Additive owner override — the manager check above is unchanged; this
      // only runs when no manager PIN matched, so an owner can approve
      // directly at stage 1 when no manager is on duty.
      const owners = await User.find({ tenantId: req.tenantId, role: "owner" });
      for (const own of owners) {
        if (own.approvalPin && await bcrypt.compare(approverPin, own.approvalPin)) {
          approver = own; break;
        }
      }
      if (approver) actionType = "return_stage1_owner_override";
    }
    if (!approver) {
      // 403, not 401 — see voidRequests.js approve-pin for why (avoids authFetch's
      // blanket 401-means-expired-session logout firing on a mere wrong PIN).
      return res.status(403).json({ success: false, message: "PIN did not match any manager or the owner." });
    }

    returnRecord.status          = "pending_owner";
    returnRecord.stage1ApprovedBy = approver._id;
    returnRecord.stage1ApprovedAt = new Date().toISOString();
    await returnRecord.save();

    await ApprovalLog.create({
      pinOwnerId: approver._id,
      actionType,
      targetId:   returnRecord._id,
      targetType: "return",
      store:      sale.store,
      tenantId:   req.tenantId,
    });

    const io = req.app.get("io");
    if (io) {
      io.to(String(approver._id)).emit("pinUsed", {
        actionType,
        usedBy:     req.user.name || "Staff",
        target:     `Return #${returnRecord._id}`,
        store:      sale.store,
        time:       new Date().toISOString(),
      });
      io.to("owner").emit("returnNeedsOwnerApproval", {
        returnId:          returnRecord._id,
        saleId:            returnRecord.saleId,
        refundAmount:      returnRecord.refundAmount,
        reason:            returnRecord.reason,
        stage1ApprovedBy:  approver.fullname || approver.username,
        message:           actionType === "return_stage1_owner_override"
          ? `Stage-1 approved by ${approver.fullname || approver.username} (owner override) — awaiting final approval`
          : "Return approved by manager — awaiting owner final approval",
      });
      io.emit("sync_system_data");
    }

    res.json({ success: true, return: returnRecord });

  } catch (err) {
    console.error("Error approving return stage 1:", err);
    res.status(500).json({ success: false, message: "Failed to approve return stage 1.", error: err.message });
  }
});

// ── 4. FINAL APPROVE (owner PIN on-site, or owner JWT remote) ────────────────
// Two paths:
//   a) body.approverPin present → any authenticated user; PIN must match the owner
//   b) no approverPin           → req.user must be owner (remote panel approval)
router.patch("/:id/approve", async (req, res) => {
  try {
    const { approverPin } = req.body || {};
    // populate site 3/4 — match:{tenantId} deferred to 2a-4
    const returnRecord = await Return.findOne({ _id: req.params.id, tenantId: req.tenantId }).populate("items.productId");
    if (!returnRecord) {
      return res.status(404).json({ success: false, message: "Return record not found." });
    }

    if (returnRecord.status === "approved") {
      return res.status(400).json({ success: false, message: "This return has already been approved." });
    }
    if (returnRecord.status === "rejected") {
      return res.status(400).json({ success: false, message: "This return has already been rejected." });
    }
    if (returnRecord.status !== "pending_owner") {
      return res.status(400).json({ success: false, message: "This return has not yet received manager approval." });
    }

    // ── Resolve approver ───────────────────────────────────────────────
    let approver = null;
    let usedPin  = false;

    if (approverPin) {
      usedPin = true;
      const owners = await User.find({ tenantId: req.tenantId, role: "owner" });
      for (const own of owners) {
        if (own.approvalPin && await bcrypt.compare(approverPin, own.approvalPin)) {
          approver = own; break;
        }
      }
      if (!approver) {
        // 403, not 401 — see voidRequests.js approve-pin for why.
        return res.status(403).json({ success: false, message: "PIN did not match the owner." });
      }
    } else {
      if (req.user.role !== "owner") {
        return res.status(403).json({ success: false, message: "Only the owner can approve without a PIN." });
      }
      approver = await User.findOne({ _id: req.user.id, tenantId: req.tenantId });
    }

    // ── 1. Restore stock ───────────────────────────────────────────────
    // tenantId here prevents a stale/crafted item.productId from restocking
    // another tenant's product — same reasoning as sales.js.
    for (const item of returnRecord.items) {
      await Product.findOneAndUpdate(
        { _id: item.productId._id || item.productId, tenantId: req.tenantId },
        { $inc: { stock: item.qty } }
      );
    }

    // ── 2. Update sale items and totals ───────────────────────────────
    // populate site 4/4 — match:{tenantId} deferred to 2a-4
    const sale = await Sale.findOne({ _id: returnRecord.saleId, tenantId: req.tenantId }).populate("items.productId");
    if (sale) {
      for (const returnItem of returnRecord.items) {
        const saleItem = sale.items.id(returnItem.saleItemId);
        if (saleItem) {
          saleItem.returnedQty  = (saleItem.returnedQty || 0) + returnItem.qty;
          saleItem.returnStatus = "approved";
          const remaining = (saleItem.qty || 0) - (saleItem.voidedQty || 0) - saleItem.returnedQty;
          if (remaining <= 0) saleItem.isFullyReturned = true;
        }
      }

      sale.total = Math.max(0, sale.total - returnRecord.refundAmount);
      if (sale.paymentInfo) {
        sale.paymentInfo.finalTotal = Math.max(
          0,
          (sale.paymentInfo.finalTotal ?? sale.total) - returnRecord.refundAmount
        );
      }

      const allReturned = sale.items.every(si => si.isFullyReturned === true);
      if (allReturned) sale.returned = true;
      sale.returnStatus = "approved";
      await sale.save();
    }

    // ── 3. Mark return as approved ────────────────────────────────────
    returnRecord.status      = "approved";
    returnRecord.approvedBy  = approver._id;
    returnRecord.approvedAt  = new Date().toISOString();
    await returnRecord.save();

    // ── 4. Audit log (PIN path only) ──────────────────────────────────
    if (usedPin) {
      await ApprovalLog.create({
        pinOwnerId: approver._id,
        actionType: "return_stage2",
        targetId:   returnRecord._id,
        targetType: "return",
        store:      sale?.store,
        tenantId:   req.tenantId,
      });
    }

    // ── 5. Recalculate archive ────────────────────────────────────────
    await recalcArchive(sale, returnRecord.refundAmount, req.tenantId).catch(err => console.error("recalcArchive error:", err));

    // ── 6. Notify ─────────────────────────────────────────────────────
    const io = req.app.get("io");
    if (io) {
      if (usedPin) {
        io.to(String(approver._id)).emit("pinUsed", {
          actionType: "return_stage2",
          usedBy:     req.user.name || "Staff",
          target:     `Return #${returnRecord._id}`,
          store:      sale?.store,
          time:       new Date().toISOString(),
        });
      }
      io.to(returnRecord.requestedBy.toString()).emit("returnUpdated", {
        status:  "approved",
        message: `✅ Return approved — refund KSh ${returnRecord.refundAmount?.toLocaleString()} to customer`,
      });
      io.emit("sync_system_data");
    }

    res.json({ success: true, return: returnRecord });

  } catch (err) {
    console.error("Error approving return:", err);
    res.status(500).json({ success: false, message: "Failed to approve return.", error: err.message });
  }
});

// ── 5. REJECT RETURN ─────────────────────────────────────────────────────────
// Stage pending_manager → manager or owner may reject.
// Stage pending_owner   → owner only.
router.patch("/:id/reject", managerOrOwner, async (req, res) => {
  try {
    const returnRecord = await Return.findOne({ _id: req.params.id, tenantId: req.tenantId });
    if (!returnRecord) {
      return res.status(404).json({ success: false, message: "Return record not found." });
    }

    if (returnRecord.status === "approved") {
      return res.status(400).json({ success: false, message: "This return has already been approved and cannot be rejected." });
    }
    if (returnRecord.status === "rejected") {
      return res.status(400).json({ success: false, message: "This return has already been rejected." });
    }

    // Stage-based access control
    if (returnRecord.status === "pending_owner" && req.user.role === "manager") {
      return res.status(403).json({ success: false, message: "Only the owner can reject at this stage." });
    }

    // Store scoping for managers
    if (req.user.role === "manager") {
      const saleCheck = await Sale.findOne({ _id: returnRecord.saleId, tenantId: req.tenantId }).select("store").lean();
      if (!saleCheck || saleCheck.store !== req.user.store) {
        return res.status(403).json({ success: false, message: "Access denied: This return belongs to a different store." });
      }
    }

    returnRecord.status        = "rejected";
    returnRecord.rejectedBy    = req.user.id;
    returnRecord.rejectedByRole = req.user.role;
    returnRecord.rejectedAt    = new Date().toISOString();
    await returnRecord.save();

    // Reset sale items returnStatus
    const sale = await Sale.findOne({ _id: returnRecord.saleId, tenantId: req.tenantId });
    if (sale) {
      for (const returnItem of returnRecord.items) {
        const saleItem = sale.items.id(returnItem.saleItemId);
        if (saleItem) saleItem.returnStatus = "rejected";
      }
      sale.returnStatus = "rejected";
      await sale.save();
    }

    const io = req.app.get("io");
    if (io) {
      io.to(returnRecord.requestedBy.toString()).emit("returnUpdated", {
        saleId:   returnRecord.saleId,
        returnId: returnRecord._id,
        status:   "rejected",
        message:  `❌ Your return request was rejected by the ${req.user.role}.`,
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
