const express = require("express")
const router = express.Router()
const mongoose = require("mongoose")
const bcrypt = require("bcryptjs")
const Sale = require("../models/Sale")
const Product = require("../models/Product")
const User = require("../models/User")
const { authMiddleware } = require("../middleware/authMiddleware")

router.use(authMiddleware)

function getEATDate() {
  return new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString().split("T")[0]
}

// ── 1. RECORD SALE ───────────────────────────────────────────────────
router.post("/", async (req, res) => {
  const session = await mongoose.startSession()
  session.startTransaction()

  try {
    const { items, total, paymentInfo } = req.body

    if (!items || !Array.isArray(items) || items.length === 0) {
      await session.abortTransaction(); session.endSession()
      return res.status(400).json({ success: false, message: "Cart items are required." })
    }

    const user = await User.findById(req.user.id).session(session)
    if (!user) {
      await session.abortTransaction(); session.endSession()
      return res.status(401).json({ success: false, message: "Authenticated user not found." })
    }

    const resolvedItems = []

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
      },
      date: getEATDate(),
      returnStatus: "none",
    })

    await sale.save({ session })
    await session.commitTransaction()
    session.endSession()

    const io = req.app.get("io")
    if (io) {
      io.emit("productsUpdated")
      io.emit("sync_system_data")
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

// ── 2. GET SALES ─────────────────────────────────────────────────────
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

    const rawSales = await Sale.find({ ...query, status: { $ne: "failed" } })
      .populate("cashierId", "username fullname")
      .populate("items.productId", "name sellPrice category")
      .sort({ createdAt: -1 })

    const sales = rawSales.map(sale => {
      const saleObj = sale.toObject()

      // finalTotal is already decremented at return-approval time (returns.js PATCH approve).
      // Do not subtract returnedAmount a second time — that would double-count the deduction.
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

// ── 3. VOID ENTIRE SALE ──────────────────────────────────────────────
router.patch("/:id/void", async (req, res) => {
  const session = await mongoose.startSession()
  session.startTransaction()

  try {
    const { managerUsername, managerPassword, reason } = req.body

    if (!managerUsername || !managerPassword) {
      await session.abortTransaction(); session.endSession()
      return res.status(400).json({ success: false, message: "Manager credentials are required to void a sale." })
    }
    if (!reason || !reason.trim()) {
      await session.abortTransaction(); session.endSession()
      return res.status(400).json({ success: false, message: "A void reason is required." })
    }

    // Verify manager/owner credentials
    const sanitized = managerUsername.trim()
    const manager = await User.findOne({
      username: { $regex: new RegExp(`^${sanitized}$`, "i") }
    }).session(session)

    if (!manager) {
      await session.abortTransaction(); session.endSession()
      return res.status(401).json({ success: false, message: "Invalid manager credentials." })
    }
    if (manager.role !== "owner" && manager.role !== "manager") {
      await session.abortTransaction(); session.endSession()
      return res.status(403).json({ success: false, message: "Only a manager or owner can authorize a void." })
    }

    const passwordMatch = await bcrypt.compare(managerPassword, manager.password)
    if (!passwordMatch) {
      await session.abortTransaction(); session.endSession()
      return res.status(401).json({ success: false, message: "Invalid manager credentials." })
    }

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

    // Restock all items
    for (const item of sale.items) {
      const alreadyVoided = item.voidedQty || 0
      const restockQty = item.qty - alreadyVoided
      if (restockQty > 0) {
        await Product.findByIdAndUpdate(
          item.productId,
          { $inc: { stock: restockQty } },
          { session }
        )
      }
      item.voidStatus = "voided"
      item.voidedQty = item.qty
      item.voidedAt = new Date()
      item.voidedBy = manager.fullname || manager.username
      item.voidReason = reason.trim()
    }

    sale.voided = true
    sale.voidedAt = new Date()
    sale.voidedBy = manager.fullname || manager.username
    sale.voidReason = reason.trim()
    await sale.save({ session })

    await session.commitTransaction()
    session.endSession()

    const io = req.app.get("io")
    if (io) {
      io.to("owner").emit("saleVoided", {
        saleId: sale._id,
        receiptId: sale.receiptId,
        cashier: sale.cashier,
        voidedBy: sale.voidedBy,
        voidReason: sale.voidReason,
        total: sale.total,
        isPartialVoid: false,
        time: new Date().toLocaleTimeString(),
      })
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

// ── 4. VOID SPECIFIC ITEMS / PARTIAL QUANTITIES ──────────────────────
router.patch("/:id/void-items", async (req, res) => {
  const session = await mongoose.startSession()
  session.startTransaction()

  try {
    const { managerUsername, managerPassword, reason, items: voidItems } = req.body

    if (!managerUsername || !managerPassword) {
      await session.abortTransaction(); session.endSession()
      return res.status(400).json({ success: false, message: "Manager credentials are required." })
    }
    if (!reason?.trim()) {
      await session.abortTransaction(); session.endSession()
      return res.status(400).json({ success: false, message: "A void reason is required." })
    }
    if (!Array.isArray(voidItems) || voidItems.length === 0) {
      await session.abortTransaction(); session.endSession()
      return res.status(400).json({ success: false, message: "Select at least one item to void." })
    }

    // Verify manager/owner credentials
    const manager = await User.findOne({
      username: { $regex: new RegExp(`^${managerUsername.trim()}$`, "i") }
    }).session(session)

    if (!manager || (manager.role !== "owner" && manager.role !== "manager")) {
      await session.abortTransaction(); session.endSession()
      return res.status(401).json({ success: false, message: "Invalid manager credentials." })
    }

    const passwordMatch = await bcrypt.compare(managerPassword, manager.password)
    if (!passwordMatch) {
      await session.abortTransaction(); session.endSession()
      return res.status(401).json({ success: false, message: "Invalid manager credentials." })
    }

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

    let totalVoidedAmount = 0
    const now = new Date()
    const voidedBy = manager.fullname || manager.username

    for (const voidReq of voidItems) {
      const { itemId, voidQty } = voidReq
      const parsedQty = Number(voidQty)
      if (!itemId || !parsedQty || parsedQty <= 0) continue

      const item = sale.items.id(itemId)
      if (!item) continue
      if (item.voidStatus === "voided") continue

      const alreadyVoided = item.voidedQty || 0
      const remainingQty = item.qty - alreadyVoided
      const actualVoidQty = Math.min(parsedQty, remainingQty)
      if (actualVoidQty <= 0) continue

      // Restock the voided quantity
      await Product.findByIdAndUpdate(
        item.productId,
        { $inc: { stock: actualVoidQty } },
        { session }
      )

      item.voidedQty = alreadyVoided + actualVoidQty
      item.voidedAt = now
      item.voidedBy = voidedBy
      item.voidReason = reason.trim()

      if (item.voidedQty >= item.qty) {
        item.voidStatus = "voided"
      }

      totalVoidedAmount += actualVoidQty * item.price
    }

    // If all items are now voided, mark whole sale as voided
    const allVoided = sale.items.every(i => i.voidStatus === "voided" || i.voidedQty >= i.qty)
    if (allVoided) {
      sale.voided = true
      sale.voidedAt = now
      sale.voidedBy = voidedBy
      sale.voidReason = reason.trim()
    }

    await sale.save({ session })
    await session.commitTransaction()
    session.endSession()

    const io = req.app.get("io")
    if (io) {
      io.to("owner").emit("saleVoided", {
        saleId: sale._id,
        receiptId: sale.receiptId,
        cashier: sale.cashier,
        voidedBy,
        voidReason: reason.trim(),
        total: totalVoidedAmount,
        isPartialVoid: !allVoided,
        itemsVoided: voidItems.length,
        time: now.toLocaleTimeString(),
      })
      io.emit("productsUpdated")
      io.emit("sync_system_data")
    }

    res.json({
      success: true,
      message: allVoided ? "Sale fully voided." : `${voidItems.length} item(s) voided successfully.`,
      sale,
      totalVoidedAmount,
      isPartialVoid: !allVoided,
    })

  } catch (err) {
    await session.abortTransaction()
    session.endSession()
    console.error("Void items error:", err)
    res.status(500).json({ success: false, message: "Failed to void items.", error: err.message })
  }
})

module.exports = router
