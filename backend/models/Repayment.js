const mongoose = require("mongoose")

function nowEAT() {
  return new Date(Date.now() + 3 * 60 * 60 * 1000)
}
function dateEAT() {
  return nowEAT().toISOString().split("T")[0]
}

const repaymentSchema = new mongoose.Schema(
  {
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
      index: true,
    },
    customerName: { type: String, required: true },
    store:        { type: String, required: true, index: true },

    amount:       { type: Number, required: true, min: 1 },

    // ── Who recorded it ──────────────────────────────────────────────
    recordedBy:   { type: String, required: true },  // cashier/manager name
    recordedById: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

    date: { type: String, default: dateEAT },  // "YYYY-MM-DD" EAT

    notes: { type: String, default: "" },
  },
  { timestamps: true }
)

module.exports = mongoose.models.Repayment || mongoose.model("Repayment", repaymentSchema)
