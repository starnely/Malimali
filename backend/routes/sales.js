const express = require("express")
const router = express.Router()
const mongoose = require("mongoose")
const bcrypt = require("bcryptjs")
const Sale = require("../models/Sale")
const Product = require("../models/Product")
const User = require("../models/User")
const Setting = require("../models/Setting")
const ApprovalLog = require("../models/ApprovalLog")
const { authMiddleware } = require("../middleware/authMiddleware")

router.use(authMiddleware)

function getEATDate() {
  return new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString().split("T")[0]
}

// â"€â"€ 1. RECORD SALE â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
router.post("/", async (req, res) => {
  const session = await mongoose.startSession()
  session.startTransaction()

  try {
    const { items, total, paymentInfo } = req.body

    if (!items || !Array.isArray(items) || items.length === 0) {
      await session.abortTransaction(); session.endSession()
      return res.status(400).json({ success: false, message: "Cart items are required." })
    }

    const CODE_RX = /^[A-Za-z0-9]+$/
    const pm = paymentInfo?.paymentMethod || "cash"

    if (pm === "card") {
      const code = (paymentInfo?.cardApprovalCode || "").trim()
      if (!CODE_RX.test(code) || code.length < 6) {
        await session.abortTransaction(); session.endSession()
        return res.status(400).json({ success: false, message: "Card approval code must be at least 6 alphanumeric characters (letters and numbers only)." })
      }
    }

    if (pm === "bank") {
      const ref = (paymentInfo?.bankReference || "").trim()
      if (!CODE_RX.test(ref) || ref.length < 8) {
        await session.abortTransaction(); session.endSession()
        return res.status(400).json({ success: false, message: "Bank reference must be at least 8 alphanumeric characters (letters and numbers only)." })
      }
    }

    const user = await User.findById(req.user.id).session(session)
    if (!user) {
      await session.abortTransaction(); session.endSession()
      return res.status(401).json({ success: false, message: "Authenticated user not found." })
    }

    const resolvedItems = []
    const lowStockProducts = []

    for (const item of items) {
      const parsedQty = Number(item.qty)
      if (!item.productId || parsedQty <= 0) {
        await session.abortTransaction(); session.endSession()
        return res.status(400).json({ success: false, message: "Invalid item in cart." })
      }

      const updated = await Product.findOneAndUpdate(
        { _id: item.productId, stock: { $gte: parsedQty }, isExpired: { $ne: true } },
        { $inc: { stock: -parsedQty } },
        { new: true, session }
      )

      // Epsilon guard: floating-point subtraction on kg values (e.g. 0.432 kg)
      // can leave stock at -1e-15 when it should be exactly 0. Clamp it.
      if (updated && updated.stock < 0) {
        await Product.findByIdAndUpdate(updated._id, { $set: { stock: 0 } }, { session })
        updated.stock = 0
      }

      if (updated && updated.stock <= (updated.reorderLevel ?? 5)) {
        lowStockProducts.push(updated)
      }

      if (!updated) {
        const product = await Product.findById(item.productId).session(session)
        await session.abortTransaction(); session.endSession()

        if (!product) return res.status(404).json({ success: false, message: "A product in your cart was not found." })
        if (product.isExpired) return res.status(400).json({ success: false, message: `${product.name} has expired and cannot be sold.` })
        return res.status(400).json({ success: false, message: `Insufficient stock for: ${product.name}. Available: ${product.stock}` })
      }

      resolvedItems.push({
        productId: updated._id,
        qty: parsedQty,
        price: item.price != null ? Number(item.price) : updated.sellPrice,
        buyPrice: updated.buyPrice || 0,
        returnStatus: "none",
        voidStatus: "none",
        voidedQty: 0,
      })
    }

    const settingsDoc  = await Setting.findOne().select("taxRate").lean()
    const saleTaxRate  = settingsDoc?.taxRate || 0
    const finalAmt     = Number(paymentInfo?.finalTotal) || Number(total) || 0
    const saleTaxAmt   = saleTaxRate > 0 ? finalAmt * (saleTaxRate / (1 + saleTaxRate)) : 0

    const sale = new Sale({
      items: resolvedItems,
      total: Number(total) || 0,
      store: user.store || "Main Store",
      cashierId: user._id,
      cashier: user.fullname || user.username,
      paymentInfo: {
        paymentMethod: paymentInfo?.paymentMethod || "cash",
        mpesaPhone: paymentInfo?.mpesaPhone || "",
        customerName: paymentInfo?.customerName || "",
        customerPhone: paymentInfo?.customerPhone || "",
        promiseDate: paymentInfo?.promiseDate || "",
        cashPart: Number(paymentInfo?.cashPart) || 0,
        mpesaPart: Number(paymentInfo?.mpesaPart) || 0,
        discount: Number(paymentInfo?.discount) || 0,
        finalTotal: Number(paymentInfo?.finalTotal) || Number(total) || 0,
        cashGiven: Number(paymentInfo?.cashGiven) || 0,
        change: Number(paymentInfo?.change) || 0,
        cardApprovalCode: paymentInfo?.cardApprovalCode || "",
        bankReference: paymentInfo?.bankReference || "",
        mpesaReceiptNumber: paymentInfo?.mpesaReceiptNumber || "",
      },
      date: getEATDate(),
      returnStatus: "none",
      taxRate:  saleTaxRate,
      taxAmount: saleTaxAmt,
      netRevenue: finalAmt - saleTaxAmt,
    })

    await sale.save({ session })
    await session.commitTransaction()
    session.endSession()

    const io = req.app.get("io")
    if (io) {
      io.emit("productsUpdated")
      io.emit("sync_system_data")
    }

    if (lowStockProducts.length > 0) {
      const ids = lowStockProducts.map(p => p._id)
      Product.updateMany({ _id: { $in: ids } }, { $set: { needsReorder: true } })
        .catch(err => console.error("needsReorder flag error:", err.message))
      if (io) {
        for (const p of lowStockProducts) {
          io.to("owner").to(`manager-${p.store}`).emit("lowStockAlert", {
            productId: p._id, productName: p.name,
            stock: p.stock, reorderLevel: p.reorderLevel ?? 5, store: p.store,
          })
        }
      }
    }

    res.status(201).json({ success: true, sale })

  } catch (err) {
    await session.abortTransaction()
    session.endSession()
    console.error("Error recording sale:", err)
    res.status(500).json({
      success: false,
      message: "Failed to record sale. All changes have been rolled back.",
      error: err.message,
    })
  }
})

// â"€â"€ 2. GET SALES â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
router.get("/", async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
    if (!user) return res.status(404).json({ success: false, message: "User not found." })

    let query = {}

    if (user.role === "cashier" || user.role === "employee") {
      query.cashierId = user._id
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      query.createdAt = { $gte: thirtyDaysAgo }
    } else if (user.role === "manager") {
      query.store = user.store
    } else if (user.role === "owner") {
      if (req.query.store && req.query.store !== "All") {
        query.store = req.query.store
      }
    }

    const rawSales = await Sale.find({ ...query, status: "confirmed" })
      .populate("cashierId", "username fullname")
      .populate("items.productId", "name sellPrice category")
      .sort({ createdAt: -1 })

    const sales = rawSales.map(sale => {
      const saleObj = sale.toObject()

      // finalTotal is already decremented at return-approval time (returns.js PATCH approve).
      // Do not subtract returnedAmount a second time â€" that would double-count the deduction.
      saleObj.netTotal = sale.paymentInfo?.finalTotal ?? sale.total
      saleObj.isPartiallyReturned = sale.items.some(i => i.returnStatus === "approved")

      return saleObj
    })

    res.json({ success: true, sales })

  } catch (err) {
    console.error("Sales GET error:", err)
    res.status(500).json({ success: false, message: "Failed to fetch sales records.", error: err.message })
  }
})

// Helper: scan a list of users until one whose approvalPin matches the given PIN
async function findPinMatch(candidates, pin) {
  for (const user of candidates) {
    if (user.approvalPin && await bcrypt.compare(pin, user.approvalPin)) return user
  }
  return null
}

// ── 3. VOID ENTIRE SALE ──────────────────────────────────────────────────────
// Escalation rules:
//   owner role       → self-approved, no PIN required
//   cashier/employee → approverPin must match a manager in the same store
//   manager role     → approverPin must match the owner
//                      (for remote owner approval use POST /api/void-requests instead)
router.patch("/:id/void", async (req, res) => {
  const session = await mongoose.startSession()
  session.startTransaction()

  try {
    const { approverPin, reason } = req.body
    const requesterRole = req.user.role

    if (!reason?.trim()) {
      await session.abortTransaction(); session.endSession()
      return res.status(400).json({ success: false, message: "A void reason is required." })
    }

    // ── Resolve approver + action type ──────────────────────────────────
    let approver = null
    let actionType = null   // null = owner self-approve (no audit log entry needed)

    if (requesterRole === "owner") {
      approver = await User.findById(req.user.id).session(session)
    } else {
      if (!approverPin) {
        await session.abortTransaction(); session.endSession()
        return res.status(400).json({ success: false, message: "An approval PIN is required." })
      }

      if (requesterRole === "cashier" || requesterRole === "employee") {
        actionType = "void_cashier"
        const managers = await User.find({ role: "manager", store: req.user.store }).session(session)
        approver = await findPinMatch(managers, approverPin)
        if (!approver) {
          await session.abortTransaction(); session.endSession()
          return res.status(401).json({ success: false, message: "PIN did not match any manager for this store." })
        }
      } else if (requesterRole === "manager") {
        actionType = "void_manager_onsite"
        const owners = await User.find({ role: "owner" }).session(session)
        approver = await findPinMatch(owners, approverPin)
        if (!approver) {
          await session.abortTransaction(); session.endSession()
          return res.status(401).json({ success: false, message: "PIN did not match the owner." })
        }
      } else {
        await session.abortTransaction(); session.endSession()
        return res.status(403).json({ success: false, message: "Your role cannot authorise voids." })
      }
    }

    // ── Load and validate sale ───────────────────────────────────────────
    const sale = await Sale.findById(req.params.id).session(session)
    if (!sale) {
      await session.abortTransaction(); session.endSession()
      return res.status(404).json({ success: false, message: "Sale not found." })
    }
    if (sale.voided) {
      await session.abortTransaction(); session.endSession()
      return res.status(400).json({ success: false, message: "This sale has already been voided." })
    }
    if (sale.returned) {
      await session.abortTransaction(); session.endSession()
      return res.status(400).json({ success: false, message: "Cannot void a sale that has been returned." })
    }

    const approverName = approver.fullname || approver.username

    // ── Restock and mark items ───────────────────────────────────────────
    for (const item of sale.items) {
      const alreadyVoided = item.voidedQty || 0
      const restockQty = item.qty - alreadyVoided
      if (restockQty > 0) {
        await Product.findByIdAndUpdate(item.productId, { $inc: { stock: restockQty } }, { session })
      }
      item.voidStatus = "voided"
      item.voidedQty  = item.qty
      item.voidedAt   = new Date()
      item.voidedBy   = approverName
      item.voidReason = reason.trim()
    }

    sale.voided    = true
    sale.voidedAt  = new Date()
    sale.voidedBy  = approverName
    sale.voidReason = reason.trim()
    await sale.save({ session })

    // ── Audit log (not for owner self-approval) ──────────────────────────
    if (actionType) {
      await ApprovalLog.create([{
        pinOwnerId: approver._id,
        actionType,
        targetId:   sale._id,
        targetType: "sale",
        store:      sale.store,
      }], { session })
    }

    await session.commitTransaction()
    session.endSession()

    // A2: resolve cashier name from stored field or DB lookup (covers older sales with empty cashier field)
    let cashierName = sale.cashier
    if (!cashierName && sale.cashierId) {
      const cashierUser = await User.findById(sale.cashierId).select("fullname username").lean()
      cashierName = cashierUser?.fullname || cashierUser?.username || "Staff"
    }

    const io = req.app.get("io")
    if (io) {
      const voidedPayload = {
        saleId: sale._id, receiptId: sale.receiptId, cashier: cashierName,
        voidedBy: approverName, voidReason: sale.voidReason,
        total: sale.total, isPartialVoid: false,
        time: new Date().toLocaleTimeString(),
      }
      // A3: owner self-void — notify managers only, not the owner themselves
      if (requesterRole === "owner") {
        io.to(`manager-${sale.store || ""}`).emit("saleVoided", voidedPayload)
      } else {
        io.to("owner").to(`manager-${sale.store || ""}`).emit("saleVoided", voidedPayload)
      }
      if (actionType) {
        io.to(String(approver._id)).emit("pinUsed", {
          actionType,
          usedBy: req.user.name || "Staff",
          target: `Sale #${sale.receiptId || sale._id}`,
          store:  sale.store,
          time:   new Date().toISOString(),
        })
      }
      io.emit("productsUpdated")
      io.emit("sync_system_data")
    }

    res.json({ success: true, message: "Sale voided successfully.", sale })

  } catch (err) {
    await session.abortTransaction()
    session.endSession()
    console.error("Void sale error:", err)
    res.status(500).json({ success: false, message: "Failed to void sale.", error: err.message })
  }
})

// ── 4. VOID SPECIFIC ITEMS / PARTIAL QUANTITIES ──────────────────────────────
// Same escalation rules as Route 3.
router.patch("/:id/void-items", async (req, res) => {
  const session = await mongoose.startSession()
  session.startTransaction()

  try {
    const { approverPin, reason, items: voidItems } = req.body
    const requesterRole = req.user.role

    if (!reason?.trim()) {
      await session.abortTransaction(); session.endSession()
      return res.status(400).json({ success: false, message: "A void reason is required." })
    }
    if (!Array.isArray(voidItems) || voidItems.length === 0) {
      await session.abortTransaction(); session.endSession()
      return res.status(400).json({ success: false, message: "Select at least one item to void." })
    }

    // ── Resolve approver ────────────────────────────────────────────────
    let approver = null
    let actionType = null

    if (requesterRole === "owner") {
      approver = await User.findById(req.user.id).session(session)
    } else {
      if (!approverPin) {
        await session.abortTransaction(); session.endSession()
        return res.status(400).json({ success: false, message: "An approval PIN is required." })
      }

      if (requesterRole === "cashier" || requesterRole === "employee") {
        actionType = "void_cashier"
        const managers = await User.find({ role: "manager", store: req.user.store }).session(session)
        approver = await findPinMatch(managers, approverPin)
        if (!approver) {
          await session.abortTransaction(); session.endSession()
          return res.status(401).json({ success: false, message: "PIN did not match any manager for this store." })
        }
      } else if (requesterRole === "manager") {
        actionType = "void_manager_onsite"
        const owners = await User.find({ role: "owner" }).session(session)
        approver = await findPinMatch(owners, approverPin)
        if (!approver) {
          await session.abortTransaction(); session.endSession()
          return res.status(401).json({ success: false, message: "PIN did not match the owner." })
        }
      } else {
        await session.abortTransaction(); session.endSession()
        return res.status(403).json({ success: false, message: "Your role cannot authorise voids." })
      }
    }

    // ── Load and validate sale ───────────────────────────────────────────
    const sale = await Sale.findById(req.params.id).session(session)
    if (!sale) {
      await session.abortTransaction(); session.endSession()
      return res.status(404).json({ success: false, message: "Sale not found." })
    }
    if (sale.voided) {
      await session.abortTransaction(); session.endSession()
      return res.status(400).json({ success: false, message: "This entire sale is already voided." })
    }
    if (sale.returned) {
      await session.abortTransaction(); session.endSession()
      return res.status(400).json({ success: false, message: "Cannot void a returned sale." })
    }

    const now      = new Date()
    const approverName = approver.fullname || approver.username
    let totalVoidedAmount = 0

    for (const voidReq of voidItems) {
      const { itemId, voidQty } = voidReq
      const parsedQty = Number(voidQty)
      if (!itemId || !parsedQty || parsedQty <= 0) continue

      const item = sale.items.id(itemId)
      if (!item || item.voidStatus === "voided") continue

      const alreadyVoided = item.voidedQty || 0
      const remainingQty  = item.qty - alreadyVoided
      const actualVoidQty = Math.min(parsedQty, remainingQty)
      if (actualVoidQty <= 0) continue

      await Product.findByIdAndUpdate(item.productId, { $inc: { stock: actualVoidQty } }, { session })

      item.voidedQty  = alreadyVoided + actualVoidQty
      item.voidedAt   = now
      item.voidedBy   = approverName
      item.voidReason = reason.trim()
      if (item.voidedQty >= item.qty) item.voidStatus = "voided"

      totalVoidedAmount += actualVoidQty * item.price
    }

    const allVoided = sale.items.every(i => i.voidStatus === "voided" || i.voidedQty >= i.qty)
    if (allVoided) {
      sale.voided    = true
      sale.voidedAt  = now
      sale.voidedBy  = approverName
      sale.voidReason = reason.trim()
    }

    await sale.save({ session })

    if (actionType) {
      await ApprovalLog.create([{
        pinOwnerId: approver._id,
        actionType,
        targetId:   sale._id,
        targetType: "sale",
        store:      sale.store,
      }], { session })
    }

    await session.commitTransaction()
    session.endSession()

    // A2: resolve cashier name
    let cashierName = sale.cashier
    if (!cashierName && sale.cashierId) {
      const cashierUser = await User.findById(sale.cashierId).select("fullname username").lean()
      cashierName = cashierUser?.fullname || cashierUser?.username || "Staff"
    }

    const io = req.app.get("io")
    if (io) {
      const voidedPayload = {
        saleId: sale._id, receiptId: sale.receiptId, cashier: cashierName,
        voidedBy: approverName, voidReason: reason.trim(),
        total: totalVoidedAmount, isPartialVoid: !allVoided,
        itemsVoided: voidItems.length, time: now.toLocaleTimeString(),
      }
      // A3: owner self-void — notify managers only, not the owner themselves
      if (requesterRole === "owner") {
        io.to(`manager-${sale.store || ""}`).emit("saleVoided", voidedPayload)
      } else {
        io.to("owner").to(`manager-${sale.store || ""}`).emit("saleVoided", voidedPayload)
      }
      if (actionType) {
        io.to(String(approver._id)).emit("pinUsed", {
          actionType,
          usedBy: req.user.name || "Staff",
          target: `Sale #${sale.receiptId || sale._id}`,
          store:  sale.store,
          time:   now.toISOString(),
        })
      }
      io.emit("productsUpdated")
      io.emit("sync_system_data")
    }

    res.json({
      success: true,
      message: allVoided ? "Sale fully voided." : `${voidItems.length} item(s) voided successfully.`,
      sale, totalVoidedAmount, isPartialVoid: !allVoided,
    })

  } catch (err) {
    await session.abortTransaction()
    session.endSession()
    console.error("Void items error:", err)
    res.status(500).json({ success: false, message: "Failed to void items.", error: err.message })
  }
})

module.exports = router
