const mongoose = require("mongoose")

function nowEAT() {
  return new Date(Date.now() + 3 * 60 * 60 * 1000)
}
function dateEAT() {
  return nowEAT().toISOString().split("T")[0]
}
function timeEAT() {
  return nowEAT().toISOString().slice(11, 19) + " EAT"
}

const supplierPaymentSchema = new mongoose.Schema(
  {
    poId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      "PurchaseOrder",
      required: true,
    },
    poNumber: {
      type:    String,
      default: "",
    },
    supplierId: {
      type:    mongoose.Schema.Types.ObjectId,
      ref:     "Supplier",
      default: null,
    },
    supplierName: {
      type:    String,
      default: "",
    },
    store: {
      type:    String,
      default: "Main Store",
    },
    amount: {
      type:     Number,
      required: true,
      min:      [0.01, "Amount must be greater than 0"],
    },
    // cash | mpesa | bank
    method: {
      type:    String,
      enum:    ["cash", "mpesa", "bank"],
      required: true,
    },
    // M-Pesa transaction code / bank reference / receipt number
    reference: {
      type:    String,
      default: "",
      trim:    true,
    },
    notes: {
      type:    String,
      default: "",
      trim:    true,
    },
    paidBy:   { type: String, default: "" },
    paidById: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    // EAT date string for reporting
    date: { type: String, default: dateEAT },
    time: { type: String, default: timeEAT },
  },
  { timestamps: true }
)

supplierPaymentSchema.index({ supplierId: 1, date: -1 })
supplierPaymentSchema.index({ poId: 1 })
supplierPaymentSchema.index({ store: 1, date: -1 })

module.exports =
  mongoose.models.SupplierPayment ||
  mongoose.model("SupplierPayment", supplierPaymentSchema)
