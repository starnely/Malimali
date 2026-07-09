const express    = require("express")
const router     = express.Router()
const Customer   = require("../models/Customer")
const Repayment  = require("../models/Repayment")
const Sale       = require("../models/Sale")
const { authMiddleware: verifyToken, ownerOnly, managerOrOwner } = require("../middleware/authMiddleware");

// ── Helper: calculate total owed by a customer ────────────────────────
async function calcBalance(customerId) {
  const sales = await Sale.find({
    "paymentInfo.customerId": customerId,
    "paymentInfo.paymentMethod": "credit",
    voided: { $ne: true },
    returned: { $ne: true },
  })
  const totalCredit = sales.reduce((sum, s) => sum + (s.paymentInfo.finalTotal || s.total), 0)
  const repayments  = await Repayment.find({ customerId })
  const totalPaid   = repayments.reduce((sum, r) => sum + r.amount, 0)
  return Math.max(0, totalCredit - totalPaid)
}

// ── Helper: check + update overdue flag ──────────────────────────────
async function refreshOverdue(customer) {
  const today   = new Date().toISOString().split("T")[0]
  const balance = await calcBalance(customer._id)
  const sales   = await Sale.find({
    "paymentInfo.customerId": customer._id,
    "paymentInfo.paymentMethod": "credit",
    voided: { $ne: true },
    returned: { $ne: true },
  }).sort({ "paymentInfo.promiseDate": 1 })
  const earliestPromise = sales.find(s => s.paymentInfo.promiseDate)
  const isOverdue = balance > 0 && earliestPromise &&
    earliestPromise.paymentInfo.promiseDate < today
  if (customer.overdue !== isOverdue) {
    customer.overdue = isOverdue
    await customer.save()
  }
  return isOverdue
}

// ════════════════════════════════════════════════════════════════════════
// POST /api/customers/from-sale
// ════════════════════════════════════════════════════════════════════════
router.post("/from-sale", verifyToken, async (req, res) => {
  try {
    const { customerName, phone, store, saleId } = req.body
    if (!customerName || !store || !saleId) {
      return res.status(400).json({ error: "customerName, store and saleId are required" })
    }
    let customer = null
    if (phone && phone.trim()) {
      customer = await Customer.findOne({ phone: phone.trim(), store })
    }
    if (!customer) {
      customer = await Customer.findOne({
        name:  { $regex: `^${customerName.trim()}$`, $options: "i" },
        store,
      })
    }
    if (!customer) {
      customer = await Customer.create({
        name:  customerName.trim(),
        phone: phone?.trim() || "",
        store,
      })
    } else {
      if (phone?.trim() && !customer.phone) {
        customer.phone = phone.trim()
        await customer.save()
      }
    }
    await Sale.findByIdAndUpdate(saleId, {
      "paymentInfo.customerId": customer._id,
    })
    res.json({ customer })
  } catch (err) {
    console.error("from-sale error:", err)
    res.status(500).json({ error: err.message })
  }
})

// ════════════════════════════════════════════════════════════════════════
// GET /api/customers
// Returns customers with balance + nextPromiseDate + lastSaleDate
// ════════════════════════════════════════════════════════════════════════
router.get("/", verifyToken, async (req, res) => {
  try {
    const { store, search, overdue, blacklisted } = req.query
    const query = {}

    if (store) query.store = store
    else if (req.user.role !== "owner") query.store = req.user.store

    if (search?.trim()) {
      query.$or = [
        { name:  { $regex: search.trim(), $options: "i" } },
        { phone: { $regex: search.trim(), $options: "i" } },
      ]
    }

    if (overdue     === "true") query.overdue     = true
    if (blacklisted === "true") query.blacklisted = true

    const customers = await Customer.find(query).sort({ updatedAt: -1 })

    const withBalances = await Promise.all(
      customers.map(async (c) => {
        const balance = await calcBalance(c._id)

        // Get all credit sales for this customer
        const creditSales = await Sale.find({
          "paymentInfo.customerId": c._id,
          "paymentInfo.paymentMethod": "credit",
          voided:   { $ne: true },
          returned: { $ne: true },
        }).sort({ "paymentInfo.promiseDate": 1 })

        // Earliest upcoming promise date (for countdown)
        const nextPromiseSale = creditSales.find(s => s.paymentInfo?.promiseDate)
        const nextPromiseDate = nextPromiseSale?.paymentInfo?.promiseDate || null

        // Most recent sale date (when they last bought on credit)
        const salesByDate = [...creditSales].sort((a, b) =>
          new Date(b.date) - new Date(a.date)
        )
        const lastSaleDate = salesByDate[0]?.date || null

        // Total amount borrowed across all sales
        const totalBorrowed = creditSales.reduce(
          (s, sale) => s + (sale.paymentInfo?.finalTotal || sale.total || 0), 0
        )

        return {
          ...c.toObject(),
          balance,
          nextPromiseDate,
          lastSaleDate,
          totalBorrowed,
          totalSales: creditSales.length,
        }
      })
    )

    res.json(withBalances)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ════════════════════════════════════════════════════════════════════════
// GET /api/customers/:id — full detail
// ════════════════════════════════════════════════════════════════════════
router.get("/:id", verifyToken, async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id)
    if (!customer) return res.status(404).json({ error: "Customer not found" })

    const sales = await Sale.find({
      "paymentInfo.customerId": customer._id,
      "paymentInfo.paymentMethod": "credit",
      voided: { $ne: true },
    }).sort({ createdAt: -1 })

    const repayments = await Repayment.find({ customerId: customer._id })
      .sort({ createdAt: -1 })

    const balance = await calcBalance(customer._id)
    await refreshOverdue(customer)

    res.json({
      customer: { ...customer.toObject(), balance },
      sales,
      repayments,
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ════════════════════════════════════════════════════════════════════════
// POST /api/customers/:id/repayments
// ════════════════════════════════════════════════════════════════════════
router.post("/:id/repayments", verifyToken, async (req, res) => {
  try {
    const { amount, notes } = req.body
    const customer = await Customer.findById(req.params.id)
    if (!customer) return res.status(404).json({ error: "Customer not found" })
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: "Amount must be greater than 0" })
    }
    const balance = await calcBalance(customer._id)
    if (amount > balance) {
      return res.status(400).json({ error: `Amount exceeds balance. Customer owes KSh ${balance}` })
    }
    const repayment = await Repayment.create({
      customerId:   customer._id,
      customerName: customer.name,
      store:        customer.store,
      amount:       Number(amount),
      recordedBy:   req.user.name || req.user.username,
      recordedById: req.user.id,
      notes:        notes?.trim() || "",
    })
    await refreshOverdue(customer)
    const newBalance = await calcBalance(customer._id)
    if (newBalance === 0 && customer.overdue) {
      customer.overdue = false
      await customer.save()
    }

    const io = req.app.get("io")
    if (io) {
      io.to("owner").to(`manager-${customer.store}`).to(`store-${customer.store}`).emit("repaymentRecorded", {
        customerId: customer._id, customerName: customer.name,
        store: customer.store, amount: Number(amount), newBalance,
      })
    }

    res.json({ repayment, newBalance })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ════════════════════════════════════════════════════════════════════════
// PATCH /api/customers/:id/blacklist
// ════════════════════════════════════════════════════════════════════════
router.patch("/:id/blacklist", verifyToken, ownerOnly, async (req, res) => {
  try {
    const { blacklisted, reason } = req.body
    const customer = await Customer.findById(req.params.id)
    if (!customer) return res.status(404).json({ error: "Customer not found" })
    customer.blacklisted = blacklisted
    if (blacklisted) {
      customer.blacklistReason = reason?.trim() || "Manually blacklisted"
      customer.blacklistedBy   = req.user.name || req.user.username
      customer.blacklistedAt   = new Date()
    } else {
      customer.blacklistReason = ""
      customer.blacklistedBy   = ""
      customer.blacklistedAt   = null
    }
    await customer.save()
    res.json({ customer })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ════════════════════════════════════════════════════════════════════════
// POST /api/customers/check-overdue
// ════════════════════════════════════════════════════════════════════════
router.post("/check-overdue", verifyToken, managerOrOwner, async (req, res) => {
  try {
    const customers = await Customer.find({ blacklisted: false })
    let flagged = 0
    for (const customer of customers) {
      const wasOverdue = customer.overdue
      await refreshOverdue(customer)
      if (!wasOverdue && customer.overdue) flagged++
    }
    res.json({ message: `Checked ${customers.length} customers. ${flagged} newly flagged as overdue.` })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ════════════════════════════════════════════════════════════════════════
// GET /api/customers/cashier/:cashierId
// ════════════════════════════════════════════════════════════════════════
router.get("/cashier/:cashierId", verifyToken, async (req, res) => {
  try {
    if (req.user.role === "cashier" && req.user.id !== req.params.cashierId) {
      return res.status(403).json({ error: "Access denied" })
    }
    const sales = await Sale.find({
      cashierId: req.params.cashierId,
      "paymentInfo.paymentMethod": "credit",
      voided: { $ne: true },
    }).sort({ createdAt: -1 })
    const withCustomer = await Promise.all(
      sales.map(async (sale) => {
        const customer = sale.paymentInfo.customerId
          ? await Customer.findById(sale.paymentInfo.customerId)
          : null
        const balance = customer ? await calcBalance(customer._id) : null
        return { ...sale.toObject(), customer, balance }
      })
    )
    res.json(withCustomer)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ════════════════════════════════════════════════════════════════════════
// GET /api/customers/repayments/month
// ════════════════════════════════════════════════════════════════════════
router.get("/repayments/month", verifyToken, async (req, res) => {
  try {
    const { year, month, store } = req.query
    if (!year || !month) return res.status(400).json({ error: "year and month required" })
    const y = parseInt(year)
    const m = parseInt(month) - 1
    const startDate = `${y}-${String(m + 1).padStart(2, "0")}-01`
    const endDate   = `${y}-${String(m + 1).padStart(2, "0")}-${new Date(y, m + 1, 0).getDate()}`
    const query = { date: { $gte: startDate, $lte: endDate } }
    if (store && store.trim() && store !== "All") {
      query.store = store.trim()
    } else if (req.user.role !== "owner") {
      query.store = req.user.store
    }
    const repayments = await Repayment.find(query).sort({ date: 1 })
    res.json(repayments)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
