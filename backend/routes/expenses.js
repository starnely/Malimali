const express   = require("express")
const router    = express.Router()
const Expense   = require("../models/Expense")
const PettyCash = require("../models/PettyCash")
const { authMiddleware, ownerOnly, managerOrOwner } = require("../middleware/authMiddleware")

router.use(authMiddleware)

// ── 1. LIST EXPENSES ──────────────────────────────────────────────────
router.get("/", async (req, res) => {
  try {
    const filter = { isDeleted: false }
    if (req.query.store)    filter.store    = req.query.store
    if (req.query.category) filter.category = req.query.category
    if (req.query.date)     filter.date     = req.query.date

    if (req.query.from || req.query.to) {
      filter.date = {}
      if (req.query.from) filter.date.$gte = req.query.from
      if (req.query.to)   filter.date.$lte = req.query.to
    }

    // Cashiers can only see their own expenses
    if (req.user?.role === "cashier" || req.user?.role === "employee") {
      filter.recordedBy = req.user.name || req.user.username
    }

    const expenses = await Expense.find(filter).sort({ createdAt: -1 }).limit(500)
    res.json({ success: true, expenses, count: expenses.length })
  } catch (err) {
    console.error("Expenses GET error:", err.message)
    res.status(500).json({ success: false, message: "Failed to fetch expenses." })
  }
})

// ── 2. GET SUMMARY ────────────────────────────────────────────────────
router.get("/summary", async (req, res) => {
  try {
    const matchFilter = { isDeleted: false }
    if (req.query.store) matchFilter.store = req.query.store
    if (req.query.date)  matchFilter.date  = req.query.date

    if (req.query.from || req.query.to) {
      matchFilter.date = {}
      if (req.query.from) matchFilter.date.$gte = req.query.from
      if (req.query.to)   matchFilter.date.$lte = req.query.to
    }

    const summary = await Expense.aggregate([
      { $match: matchFilter },
      { $group: { _id: "$category", total: { $sum: "$amount" }, count: { $sum: 1 } } },
      { $sort: { total: -1 } },
    ])

    const grandTotal = summary.reduce((s, c) => s + c.total, 0)
    res.json({ success: true, summary, grandTotal, dateFilter: matchFilter.date || req.query.date || null })
  } catch (err) {
    console.error("Expense summary error:", err.message)
    res.status(500).json({ success: false, message: "Failed to fetch expense summary." })
  }
})

// ── 3. GET MONTHLY BREAKDOWN ──────────────────────────────────────────
router.get("/monthly", async (req, res) => {
  try {
    const year    = parseInt(req.query.year  || new Date().getFullYear())
    const month   = parseInt(req.query.month || new Date().getMonth() + 1)
    const mm      = String(month).padStart(2, "0")
    const from    = `${year}-${mm}-01`
    const lastDay = new Date(year, month, 0).getDate()
    const to      = `${year}-${mm}-${lastDay}`

    const filter = { isDeleted: false, date: { $gte: from, $lte: to } }
    if (req.query.store) filter.store = req.query.store

    const expenses = await Expense.find(filter).sort({ date: 1 })
    const byDate   = {}
    expenses.forEach(e => {
      if (!byDate[e.date]) byDate[e.date] = 0
      byDate[e.date] += e.amount
    })

    const grandTotal = expenses.reduce((s, e) => s + e.amount, 0)
    res.json({ success: true, expenses, byDate, grandTotal, year, month })
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to fetch monthly expenses." })
  }
})

// ── 4. LOG NEW EXPENSE (all roles) ────────────────────────────────────
router.post("/", async (req, res) => {
  try {
    const { amount, category, description, store } = req.body

    if (!amount || Number(amount) <= 0) {
      return res.status(400).json({ success: false, message: "A valid amount is required." })
    }

    const expense = await new Expense({
      amount:       Number(amount),
      category:     category    || "other",
      description:  description || "",
      store:        store       || req.user?.store || "Main Store",
      recordedBy:   req.user?.name || req.user?.username || "",
      recordedById: req.user?._id  || null,
    }).save()

    const io = req.app.get("io")
    if (io) {
      io.to("owner").emit("expenseLogged", {
        amount:      expense.amount,
        category:    expense.category,
        description: expense.description,
        store:       expense.store,
        recordedBy:  expense.recordedBy,
        time:        new Date().toLocaleTimeString(),
      })
    }

    res.status(201).json({ success: true, expense })
  } catch (err) {
    console.error("Expense POST error:", err.message)
    res.status(500).json({ success: false, message: "Failed to log expense.", error: err.message })
  }
})

// ── 5. UPDATE EXPENSE (manager+) ─────────────────────────────────────
router.put("/:id", managerOrOwner, async (req, res) => {
  try {
    const expense = await Expense.findById(req.params.id)
    if (!expense)         return res.status(404).json({ success: false, message: "Expense not found." })
    if (expense.isDeleted) return res.status(400).json({ success: false, message: "Expense has been deleted." })

    const { amount, category, description } = req.body
    if (amount !== undefined)      expense.amount      = Number(amount)
    if (category)                  expense.category    = category
    if (description !== undefined) expense.description = description

    await expense.save()
    res.json({ success: true, expense })
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to update expense." })
  }
})

// ── 6. SOFT DELETE EXPENSE (manager+) ────────────────────────────────
router.delete("/:id", managerOrOwner, async (req, res) => {
  try {
    const expense = await Expense.findById(req.params.id)
    if (!expense) return res.status(404).json({ success: false, message: "Expense not found." })

    // ── If this expense came from a petty cash Cash Out,
    //    remove the matching petty cash transaction so the
    //    balance is restored automatically via the pre-save hook
    if (expense.fromPettyCash) {
      try {
        const pettyCashRecord = await PettyCash.findOne({
          store:     expense.store,
          date:      expense.date,
          isClosed:  false,   // can only reverse if the day isn't closed yet
        })

        if (pettyCashRecord) {
          // Find the matching transaction — match on amount, type=out, recordedBy
          // and description containing the expense description
          const txIndex = pettyCashRecord.transactions.findIndex(tx =>
            tx.type   === "out" &&
            tx.amount === expense.amount &&
            (
              tx.description === expense.description ||
              tx.description === expense.description?.replace("[Petty Cash] ", "") ||
              `[Petty Cash] ${tx.description}` === expense.description
            )
          )

          if (txIndex !== -1) {
            pettyCashRecord.transactions.splice(txIndex, 1)
            await pettyCashRecord.save()  // pre-save hook recalculates netBalance
          }
        } else {
          // Day is closed — we still soft-delete the expense but
          // cannot reverse the petty cash (it's already closed)
          // Return a warning alongside success
          expense.isDeleted  = true
          expense.deletedBy  = req.user?.name || req.user?.username || ""
          expense.deletedAt  = new Date()
          expense.deleteNote = req.body.reason || ""
          await expense.save()

          return res.json({
            success: true,
            warning: "Expense removed but petty cash balance was not restored — the petty cash record for this day is already closed.",
            message: "Expense removed.",
          })
        }
      } catch (pcErr) {
        console.error("Petty cash reversal error:", pcErr.message)
        // Don't block the expense deletion — just log the error
      }
    }

    // Soft-delete the expense
    expense.isDeleted  = true
    expense.deletedBy  = req.user?.name || req.user?.username || ""
    expense.deletedAt  = new Date()
    expense.deleteNote = req.body.reason || ""
    await expense.save()

    res.json({ success: true, message: "Expense removed." })
  } catch (err) {
    console.error("Expense delete error:", err.message)
    res.status(500).json({ success: false, message: "Failed to delete expense." })
  }
})

module.exports = router
