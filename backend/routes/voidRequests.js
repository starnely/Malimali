const express     = require("express")
const router      = express.Router()
const mongoose    = require("mongoose")
const bcrypt      = require("bcryptjs")
const VoidRequest = require("../models/VoidRequest")
const Sale        = require("../models/Sale")
const Product     = require("../models/Product")
const User        = require("../models/User")
const ApprovalLog = require("../models/ApprovalLog")
const { authMiddleware, ownerOnly } = require("../middleware/authMiddleware")

router.use(authMiddleware)

// ── 1. GET VOID REQUESTS ─────────────────────────────────────────────────────
// Owner sees all pending; manager sees their own submissions.
router.get("/", async (req, res) => {
  try {
    let query = { tenantId: req.tenantId }
    if (req.user.role === "owner") {
      query.status = "pending_owner"
    } else if (req.user.role === "manager") {
      query.requestedBy = req.user.id
    } else {
      return res.status(403).json({ success: false, message: "Access denied." })
    }

    // populate sites 1/2 and 2/2
    const requests = await VoidRequest.find(query)
      .populate({ path: "requestedBy", select: "fullname username", match: { tenantId: req.tenantId } })
      .populate({ path: "saleId", select: "receiptId cashier total store", match: { tenantId: req.tenantId } })
      .sort({ createdAt: -1 })

    res.json({ success: true, requests })

  } catch (err) {
    console.error("VoidRequest GET error:", err)
    res.status(500).json({ success: false, message: "Failed to fetch void requests.", error: err.message })
  }
})

// ── 2. SUBMIT VOID REQUEST (manager → remote owner approval) ─────────────────
router.post("/", async (req, res) => {
  if (req.user.role !== "manager") {
    return res.status(403).json({ success: false, message: "Only managers use remote void requests. Owners can void directly." })
  }

  try {
    const { saleId, reason, voidType, items } = req.body

    if (!saleId || !reason?.trim()) {
      return res.status(400).json({ success: false, message: "Sale ID and reason are required." })
    }

    const sale = await Sale.findOne({ _id: saleId, tenantId: req.tenantId })
    if (!sale) return res.status(404).json({ success: false, message: "Sale not found." })
    if (sale.voided)   return res.status(400).json({ success: false, message: "This sale is already voided." })
    if (sale.returned) return res.status(400).json({ success: false, message: "Cannot void a returned sale." })

    if (sale.store !== req.user.store) {
      return res.status(403).json({ success: false, message: "This sale belongs to a different store." })
    }

    const existing = await VoidRequest.findOne({ tenantId: req.tenantId, saleId, status: "pending_owner" })
    if (existing) {
      return res.status(400).json({ success: false, message: "A void request for this sale is already pending owner approval." })
    }

    const voidReq = await VoidRequest.create({
      saleId,
      requestedBy: req.user.id,
      store:       sale.store,
      reason:      reason.trim(),
      voidType:    voidType || "whole",
      items:       voidType === "items" ? (items || []) : [],
      tenantId:    req.tenantId,
    })

    const requester = await User.findOne({ _id: req.user.id, tenantId: req.tenantId }).select("fullname username")
    const io = req.app.get("io")
    if (io) {
      io.to("owner").emit("newVoidRequest", {
        voidRequestId: voidReq._id,
        saleId,
        requestedBy: requester?.fullname || requester?.username,
        reason:      reason.trim(),
        store:       sale.store,
        total:       sale.total,
        receiptId:   sale.receiptId,
        time:        new Date().toISOString(),
      })
    }

    res.status(201).json({ success: true, voidRequest: voidReq })

  } catch (err) {
    console.error("VoidRequest POST error:", err)
    res.status(500).json({ success: false, message: "Failed to submit void request.", error: err.message })
  }
})

// ── 3. APPROVE VOID REQUEST (owner only — executes the actual void) ───────────
router.patch("/:id/approve", ownerOnly, async (req, res) => {
  const session = await mongoose.startSession()
  session.startTransaction()

  try {
    const voidReq = await VoidRequest.findOne({ _id: req.params.id, tenantId: req.tenantId }).session(session)
    if (!voidReq) {
      await session.abortTransaction(); session.endSession()
      return res.status(404).json({ success: false, message: "Void request not found." })
    }
    if (voidReq.status !== "pending_owner") {
      await session.abortTransaction(); session.endSession()
      return res.status(400).json({ success: false, message: "This void request is no longer pending." })
    }

    const sale = await Sale.findOne({ _id: voidReq.saleId, tenantId: req.tenantId }).session(session)
    if (!sale) {
      await session.abortTransaction(); session.endSession()
      return res.status(404).json({ success: false, message: "Sale not found." })
    }
    if (sale.voided) {
      await session.abortTransaction(); session.endSession()
      return res.status(400).json({ success: false, message: "This sale has already been voided." })
    }

    const approver = await User.findOne({ _id: req.user.id, tenantId: req.tenantId }).session(session)
    const approverName = approver?.fullname || approver?.username || "Owner"

    // tenantId on both restock updates below prevents a stale/crafted
    // productId from restocking another tenant's product — same reasoning
    // as sales.js/returns.js.
    if (voidReq.voidType === "whole") {
      for (const item of sale.items) {
        const alreadyVoided = item.voidedQty || 0
        const restockQty = item.qty - alreadyVoided
        if (restockQty > 0) {
          await Product.findOneAndUpdate({ _id: item.productId, tenantId: req.tenantId }, { $inc: { stock: restockQty } }, { session })
        }
        item.voidStatus = "voided"
        item.voidedQty  = item.qty
        item.voidedAt   = new Date()
        item.voidedBy   = approverName
        item.voidReason = voidReq.reason
      }
      sale.voided    = true
      sale.voidedAt  = new Date()
      sale.voidedBy  = approverName
      sale.voidReason = voidReq.reason
    } else {
      // Item-level void
      for (const voidItem of voidReq.items) {
        const saleItem = sale.items.id(voidItem.itemId)
        if (!saleItem || saleItem.voidStatus === "voided") continue

        const alreadyVoided = saleItem.voidedQty || 0
        const remainingQty  = saleItem.qty - alreadyVoided
        const actualQty     = Math.min(Number(voidItem.voidQty), remainingQty)
        if (actualQty <= 0) continue

        await Product.findOneAndUpdate({ _id: saleItem.productId, tenantId: req.tenantId }, { $inc: { stock: actualQty } }, { session })

        saleItem.voidedQty  = alreadyVoided + actualQty
        saleItem.voidedAt   = new Date()
        saleItem.voidedBy   = approverName
        saleItem.voidReason = voidReq.reason
        if (saleItem.voidedQty >= saleItem.qty) saleItem.voidStatus = "voided"
      }

      const allVoided = sale.items.every(i => i.voidStatus === "voided" || i.voidedQty >= i.qty)
      if (allVoided) {
        sale.voided    = true
        sale.voidedAt  = new Date()
        sale.voidedBy  = approverName
        sale.voidReason = voidReq.reason
      }
    }

    await sale.save({ session })

    voidReq.status     = "approved"
    voidReq.approvedBy  = req.user.id
    voidReq.approvedAt  = new Date().toISOString()
    await voidReq.save({ session })

    await session.commitTransaction()
    session.endSession()

    const io = req.app.get("io")
    if (io) {
      io.to("owner").to(`manager-${voidReq.store || ""}`).emit("saleVoided", {
        saleId:    voidReq.saleId,
        voidedBy:  approverName,
        voidReason: voidReq.reason,
        total:     sale.total,
        isPartialVoid: voidReq.voidType !== "whole",
        time:      new Date().toLocaleTimeString(),
      })
      io.to(String(voidReq.requestedBy)).emit("voidApproved", {
        voidRequestId: voidReq._id,
        saleId:        voidReq.saleId,
        message:       "Your void request was approved by the owner.",
        time:          new Date().toISOString(),
      })
      io.emit("productsUpdated")
      io.emit("sync_system_data")
    }

    res.json({ success: true, message: "Void approved and executed.", voidRequest: voidReq })

  } catch (err) {
    await session.abortTransaction()
    session.endSession()
    console.error("VoidRequest approve error:", err)
    res.status(500).json({ success: false, message: "Failed to approve void request.", error: err.message })
  }
})

// ── 4. REJECT VOID REQUEST (owner only) ──────────────────────────────────────
router.patch("/:id/reject", ownerOnly, async (req, res) => {
  try {
    const voidReq = await VoidRequest.findOne({ _id: req.params.id, tenantId: req.tenantId })
    if (!voidReq) return res.status(404).json({ success: false, message: "Void request not found." })
    if (voidReq.status !== "pending_owner") {
      return res.status(400).json({ success: false, message: "This void request is no longer pending." })
    }

    voidReq.status     = "rejected"
    voidReq.rejectedAt = new Date().toISOString()
    await voidReq.save()

    const io = req.app.get("io")
    if (io) {
      io.to(String(voidReq.requestedBy)).emit("voidRejected", {
        voidRequestId: voidReq._id,
        saleId:        voidReq.saleId,
        message:       "Your void request was rejected by the owner.",
        time:          new Date().toISOString(),
      })
      io.emit("sync_system_data")
    }

    res.json({ success: true, message: "Void request rejected.", voidRequest: voidReq })

  } catch (err) {
    console.error("VoidRequest reject error:", err)
    res.status(500).json({ success: false, message: "Failed to reject void request.", error: err.message })
  }
})

// ── 5. APPROVE VOID REQUEST VIA OWNER PIN ────────────────────────────────────
// Phase B: any authenticated user can present the owner's PIN on-site to execute a pending void.
// The PIN itself proves authorization; atomically claims the request to prevent double-execution.
router.patch("/:id/approve-pin", async (req, res) => {
  const { approverPin } = req.body || {}
  if (!approverPin) {
    return res.status(400).json({ success: false, message: "Owner PIN is required." })
  }

  const session = await mongoose.startSession()
  session.startTransaction()

  try {
    // Atomically claim the request — abortTransaction on PIN failure rolls this back
    const voidReq = await VoidRequest.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.tenantId, status: "pending_owner" },
      { $set: { status: "processing" } },
      { new: true, session }
    )
    if (!voidReq) {
      await session.abortTransaction(); session.endSession()
      return res.status(400).json({ success: false, message: "This void request is no longer pending." })
    }

    // Verify owner PIN
    const owners = await User.find({ tenantId: req.tenantId, role: "owner" })
    let approver = null
    for (const own of owners) {
      if (own.approvalPin && await bcrypt.compare(approverPin, own.approvalPin)) {
        approver = own; break
      }
    }
    if (!approver) {
      await session.abortTransaction(); session.endSession()
      // 403, not 401 — the requester's own session is valid; this is a PIN mismatch,
      // not an auth failure. authFetch() on the frontend treats any 401 as an expired
      // session and force-logs-out the caller, which must not happen on a wrong PIN.
      return res.status(403).json({ success: false, message: "PIN did not match the owner." })
    }

    const sale = await Sale.findOne({ _id: voidReq.saleId, tenantId: req.tenantId }).session(session)
    if (!sale || sale.voided) {
      await session.abortTransaction(); session.endSession()
      return res.status(400).json({ success: false, message: sale ? "This sale has already been voided." : "Sale not found." })
    }

    const approverName = approver.fullname || approver.username || "Owner"

    // tenantId on both restock updates below — same reasoning as the
    // approve route above.
    if (voidReq.voidType === "whole") {
      for (const item of sale.items) {
        const alreadyVoided = item.voidedQty || 0
        const restockQty    = item.qty - alreadyVoided
        if (restockQty > 0) {
          await Product.findOneAndUpdate({ _id: item.productId, tenantId: req.tenantId }, { $inc: { stock: restockQty } }, { session })
        }
        item.voidStatus = "voided"
        item.voidedQty  = item.qty
        item.voidedAt   = new Date()
        item.voidedBy   = approverName
        item.voidReason = voidReq.reason
      }
      sale.voided     = true
      sale.voidedAt   = new Date()
      sale.voidedBy   = approverName
      sale.voidReason = voidReq.reason
    } else {
      for (const voidItem of voidReq.items) {
        const saleItem = sale.items.id(voidItem.itemId)
        if (!saleItem || saleItem.voidStatus === "voided") continue
        const alreadyVoided = saleItem.voidedQty || 0
        const remainingQty  = saleItem.qty - alreadyVoided
        const actualQty     = Math.min(Number(voidItem.voidQty), remainingQty)
        if (actualQty <= 0) continue
        await Product.findOneAndUpdate({ _id: saleItem.productId, tenantId: req.tenantId }, { $inc: { stock: actualQty } }, { session })
        saleItem.voidedQty  = alreadyVoided + actualQty
        saleItem.voidedAt   = new Date()
        saleItem.voidedBy   = approverName
        saleItem.voidReason = voidReq.reason
        if (saleItem.voidedQty >= saleItem.qty) saleItem.voidStatus = "voided"
      }
      const allVoided = sale.items.every(i => i.voidStatus === "voided" || i.voidedQty >= i.qty)
      if (allVoided) {
        sale.voided     = true
        sale.voidedAt   = new Date()
        sale.voidedBy   = approverName
        sale.voidReason = voidReq.reason
      }
    }

    await sale.save({ session })

    voidReq.status     = "approved"
    voidReq.approvedBy  = approver._id
    voidReq.approvedAt  = new Date().toISOString()
    await voidReq.save({ session })

    await ApprovalLog.create([{
      pinOwnerId: approver._id,
      actionType: "void_owner_pin",
      targetId:   sale._id,
      targetType: "sale",
      store:      voidReq.store,
      tenantId:   req.tenantId,
    }], { session })

    await session.commitTransaction()
    session.endSession()

    const io = req.app.get("io")
    if (io) {
      io.to(String(approver._id)).emit("pinUsed", {
        actionType: "void_owner_pin",
        usedBy:     req.user.name || "Staff",
        target:     `Sale #${sale.receiptId || sale._id}`,
        store:      voidReq.store,
        time:       new Date().toISOString(),
      })
      io.to(`manager-${voidReq.store || ""}`).emit("saleVoided", {
        saleId:        sale._id,
        receiptId:     sale.receiptId,
        voidedBy:      approverName,
        voidReason:    voidReq.reason,
        total:         sale.total,
        isPartialVoid: voidReq.voidType !== "whole",
        time:          new Date().toLocaleTimeString(),
      })
      io.to(String(voidReq.requestedBy)).emit("voidApproved", {
        voidRequestId: voidReq._id,
        saleId:        voidReq.saleId,
        message:       "Your void request was approved by the owner (PIN).",
        time:          new Date().toISOString(),
      })
      io.emit("productsUpdated")
      io.emit("sync_system_data")
    }

    res.json({ success: true, message: "Void approved via PIN and executed.", voidRequest: voidReq })

  } catch (err) {
    await session.abortTransaction()
    session.endSession()
    console.error("VoidRequest approve-pin error:", err)
    res.status(500).json({ success: false, message: "Failed to approve void via PIN.", error: err.message })
  }
})

module.exports = router
