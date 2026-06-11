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

const EXPENSE_CATEGORIES = [
  "rent",
  "utilities",
  "wages",
  "supplies",
  "transport",
  "maintenance",
  "marketing",
  "taxes",
  "other",
  // NOTE: "petty_cash" removed — petty cash spend is auto-logged
  // via the Cash Out action in the Petty Cash module
]

const expenseSchema = new mongoose.Schema(
  {
    amount: {
      type:     Number,
      required: [true, "Expense amount is required"],
      min:      [0.01, "Amount must be greater than 0"],
    },
    category: {
      type:    String,
      enum:    [...EXPENSE_CATEGORIES, "petty_cash"], // keep petty_cash in enum for old records
      default: "other",
      required: true,
    },
    description: {
      type:    String,
      trim:    true,
      default: "",
    },
    store: {
      type:    String,
      trim:    true,
      default: "Main Store",
    },
    recordedBy:   { type: String,  default: "" },
    recordedById: {
      type:    mongoose.Schema.Types.ObjectId,
      ref:     "User",
      default: null,
    },
    date: {
      type:    String,
      default: dateEAT,
      index:   true,
    },
    time: {
      type:    String,
      default: timeEAT,
    },
    // ── Petty cash link ───────────────────────────────────────────────
    // true = this expense was auto-created from a Petty Cash Cash Out
    // false/undefined = manually logged expense
    fromPettyCash: {
      type:    Boolean,
      default: false,
      index:   true,
    },
    // Soft delete
    isDeleted:  { type: Boolean, default: false },
    deletedBy:  { type: String,  default: "" },
    deletedAt:  { type: Date,    default: null },
    deleteNote: { type: String,  default: "" },
  },
  { timestamps: true }
)

expenseSchema.index({ store: 1, date: 1, isDeleted: 1 })
expenseSchema.index({ date: 1, category: 1 })

module.exports =
  mongoose.models.Expense || mongoose.model("Expense", expenseSchema)

module.exports.EXPENSE_CATEGORIES = EXPENSE_CATEGORIES
