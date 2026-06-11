const express   = require("express")
const router    = express.Router()
const PettyCash = require("../models/PettyCash")
const Expense   = require("../models/Expense")
const { authMiddleware, managerOrOwner } = require("../middleware/authMiddleware")

router.use(authMiddleware)

// ── HELPER: today's EAT date string ──────────────────────────────────
function todayEAT() {
  return new Date(Date.now() + 3 * 60 * 60 * 1000)
    .toISOString().split("T")[0]
}
function timeEAT() {
  return new Date(Date.now() + 3 * 60 * 60 * 1000)
    .toISOString().slice(11, 19) + " EAT"
}

// ── Expense categories that petty cash cash-outs can map to ──────────
const PETTY_CASH_CATEGORIES = [
  "supplies",
  "transport",
  "maintenance",
  "utilities",
  "marketing",
  "wages",
  "taxes",
  "other",
]

// ── 1. GET TODAY'S PETTY CASH (all roles) ────────────────────────────
router.get("/today", async (req, res) => {
  try {
    const store = req.query.store || req.user?.store || "Main Store"
    const today = todayEAT()
    const record = await PettyCash.findOne({ store, date: today })
    res.json({ success: true, record: record || null, date: today, store })
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to fetch today's petty cash." })
  }
})

// ── 2. GET HISTORY (manager+) ─────────────────────────────────────────
router.get("/history", managerOrOwner, async (req, res) => {
  try {
    const filter = {}
    if (req.query.store) filter.store = req.query.store
    if (req.query.from || req.query.to) {
      filter.date = {}
      if (req.query.from) filter.date.$gte = req.query.from
      if (req.query.to)   filter.date.$lte = req.query.to
    }
    const records = await PettyCash.find(filter).sort({ date: -1 }).limit(90)
    res.json({ success: true, records, count: records.length })
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to fetch petty cash history." })
  }
})

// ── 3. GET BY DATE ────────────────────────────────────────────────────
router.get("/:date", managerOrOwner, async (req, res) => {
  try {
    const store = req.query.store || req.user?.store || "Main Store"
    const record = await PettyCash.findOne({ date: req.params.date, store })
    if (!record) return res.status(404).json({ success: false, message: "No petty cash record for this date." })
    res.json({ success: true, record })
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to fetch petty cash record." })
  }
})

// ── 4. OPEN PETTY CASH FOR TODAY (manager+) ──────────────────────────
router.post("/open", managerOrOwner, async (req, res) => {
  try {
    const store = req.body.store || req.user?.store || "Main Store"
    const today = todayEAT()

    const existing = await PettyCash.findOne({ store, date: today })
    if (existing) {
      return res.status(409).json({
        success: false,
        message: "Petty cash is already open for today.",
        record: existing,
      })
    }

    const record = await new PettyCash({
      date:         today,
      store,
      openingFloat: Number(req.body.openingFloat) || 0,
      openedBy:     req.user?.name || req.user?.username || "",
      notes:        req.body.notes || "",
    }).save()

    res.status(201).json({ success: true, record })
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ success: false, message: "Petty cash already opened for today." })
    }
    console.error("Petty cash open error:", err.message)
    res.status(500).json({ success: false, message: "Failed to open petty cash.", error: err.message })
  }
})

// ── 5. ADD TRANSACTION (manager+) ────────────────────────────────────
// For Cash Out: also auto-creates an Expense record
router.post("/transaction", managerOrOwner, async (req, res) => {
  try {
    const store = req.body.store || req.user?.store || "Main Store"
    const today = todayEAT()

    let record = await PettyCash.findOne({ store, date: today })
    if (!record) {
      return res.status(404).json({
        success: false,
        message: "Petty cash not opened for today. Open it first.",
      })
    }
    if (record.isClosed) {
      return res.status(400).json({
        success: false,
        message: "Petty cash is already closed for today.",
      })
    }

    const { type, amount, description, expenseCategory } = req.body

    if (!["in", "out"].includes(type)) {
      return res.status(400).json({ success: false, message: "Transaction type must be 'in' or 'out'." })
    }
    if (!amount || Number(amount) <= 0) {
      return res.status(400).json({ success: false, message: "A valid amount is required." })
    }

    // Guard: prevent overdrawing
    if (type === "out") {
      const projected = record.netBalance - Number(amount)
      if (projected < 0) {
        return res.status(400).json({
          success: false,
          message: `Insufficient petty cash balance. Available: KSh ${record.netBalance.toLocaleString()}`,
        })
      }
    }

    // Save the petty cash transaction
    record.transactions.push({
      type,
      amount:      Number(amount),
      description: description || "",
      recordedBy:  req.user?.name || req.user?.username || "",
      expenseCategory: type === "out" ? (expenseCategory || "other") : undefined,
    })

    await record.save()  // pre-save hook recalculates totals

    // ── AUTO-CREATE EXPENSE for Cash Out ─────────────────────────────
    if (type === "out") {
      try {
        const category = PETTY_CASH_CATEGORIES.includes(expenseCategory)
          ? expenseCategory
          : "other"

        await new Expense({
          amount:       Number(amount),
          category,
          description:  description
            ? `[Petty Cash] ${description}`
            : "[Petty Cash] Cash Out",
          store,
          recordedBy:   req.user?.name || req.user?.username || "",
          recordedById: req.user?._id || null,
          date:         today,
          time:         timeEAT(),
          fromPettyCash: true,  // flag so UI can show the source
        }).save()

        // Notify owner via socket
        const io = req.app.get("io")
        if (io) {
          io.to("owner").emit("expenseLogged", {
            amount:      Number(amount),
            category,
            description: description ? `[Petty Cash] ${description}` : "[Petty Cash] Cash Out",
            store,
            recordedBy:  req.user?.name || req.user?.username || "",
            time:        timeEAT(),
          })
        }
      } catch (expErr) {
        // Don't fail the whole request if expense creation fails
        // The petty cash transaction is already saved
        console.error("Auto-expense creation failed:", expErr.message)
      }
    }

    res.json({ success: true, record })
  } catch (err) {
    console.error("Petty cash transaction error:", err.message)
    res.status(500).json({ success: false, message: "Failed to add transaction.", error: err.message })
  }
})

// ── 6. CLOSE PETTY CASH (manager+) ───────────────────────────────────
router.post("/close", managerOrOwner, async (req, res) => {
  try {
    const store = req.body.store || req.user?.store || "Main Store"
    const today = todayEAT()

    const record = await PettyCash.findOne({ store, date: today })
    if (!record) return res.status(404).json({ success: false, message: "No open petty cash for today." })
    if (record.isClosed) return res.status(400).json({ success: false, message: "Already closed." })

    record.isClosed     = true
    record.closingFloat = Number(req.body.closingFloat) ?? record.netBalance
    record.closedBy     = req.user?.name || req.user?.username || ""
    record.closedAt     = new Date()
    if (req.body.notes) record.notes = req.body.notes

    await record.save()
    res.json({ success: true, record })
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to close petty cash." })
  }
})

// ── 7. DELETE TRANSACTION (manager+) ─────────────────────────────────
router.delete("/:recordId/transaction/:txId", managerOrOwner, async (req, res) => {
  try {
    const record = await PettyCash.findById(req.params.recordId)
    if (!record) return res.status(404).json({ success: false, message: "Record not found." })
    if (record.isClosed) return res.status(400).json({ success: false, message: "Cannot edit a closed petty cash record." })

    const tx = record.transactions.id(req.params.txId)
    if (!tx) return res.status(404).json({ success: false, message: "Transaction not found." })

    // Also soft-delete the matching auto-generated expense
    if (tx.type === "out") {
      try {
        await Expense.findOneAndUpdate(
          {
            store:         record.store,
            date:          record.date,
            amount:        tx.amount,
            fromPettyCash: true,
            recordedBy:    tx.recordedBy,
            isDeleted:     false,
          },
          {
            isDeleted:  true,
            deletedBy:  req.user?.name || req.user?.username || "",
            deletedAt:  new Date(),
            deleteNote: "Auto-deleted: petty cash transaction removed",
          }
        )
      } catch (expErr) {
        console.error("Auto-expense delete failed:", expErr.message)
      }
    }

    tx.deleteOne()
    await record.save()

    res.json({ success: true, record })
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to delete transaction." })
  }
})

module.exports = router
