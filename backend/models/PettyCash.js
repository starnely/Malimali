const mongoose = require("mongoose")

// ── EAT helpers ───────────────────────────────────────────────────────
function nowEAT() {
  return new Date(Date.now() + 3 * 60 * 60 * 1000)
}
function dateEAT() {
  return nowEAT().toISOString().split("T")[0]
}
function timeEAT() {
  return nowEAT().toISOString().slice(11, 19) + " EAT"
}

// ── Transaction sub-schema ────────────────────────────────────────────
const pettyCashTxSchema = new mongoose.Schema(
  {
    type:        { type: String, enum: ["in", "out"], required: true },
    amount:      { type: Number, required: true, min: [0.01, "Amount must be > 0"] },
    description: { type: String, trim: true, default: "" },
    recordedBy:  { type: String, default: "" },
    time:        { type: String, default: timeEAT },
  },
  { _id: true, timestamps: false }
)

// ── Main PettyCash schema ─────────────────────────────────────────────
// One document per store per day.
const pettyCashSchema = new mongoose.Schema(
  {
    date: {
      type:     String,
      required: true,
      default:  dateEAT,
      index:    true,
    },
    store: {
      type:     String,
      required: true,
      default:  "Main Store",
    },
    openingFloat: {
      type:    Number,
      default: 0,
      min:     0,
    },
    closingFloat: {
      type:    Number,
      default: null,   // null = not yet closed
    },
    transactions: [pettyCashTxSchema],
    // Derived values — kept on document for fast reporting
    totalIn:  { type: Number, default: 0 },
    totalOut: { type: Number, default: 0 },
    netBalance: { type: Number, default: 0 },  // openingFloat + totalIn - totalOut
    // ── Status ───────────────────────────────────────────────────────
    isClosed:  { type: Boolean, default: false },
    openedBy:  { type: String, default: "" },
    closedBy:  { type: String, default: "" },
    closedAt:  { type: Date,   default: null },
    notes:     { type: String, default: "" },
  },
  { timestamps: true }
)

// ── One record per store per day ──────────────────────────────────────
pettyCashSchema.index({ store: 1, date: 1 }, { unique: true })

// ── Auto-recalculate derived fields before save ───────────────────────
pettyCashSchema.pre("save", function () {
  const totalIn  = this.transactions
    .filter(t => t.type === "in")
    .reduce((s, t) => s + t.amount, 0)
  const totalOut = this.transactions
    .filter(t => t.type === "out")
    .reduce((s, t) => s + t.amount, 0)

  this.totalIn    = totalIn
  this.totalOut   = totalOut
  this.netBalance = this.openingFloat + totalIn - totalOut
})

module.exports =
  mongoose.models.PettyCash || mongoose.model("PettyCash", pettyCashSchema)
