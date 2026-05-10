const mongoose = require("mongoose")

// ── EAT timezone helper ────────────────────────────────────────────────
// East Africa Time is UTC+3 — used for all date/time display
function nowEAT() {
  return new Date(Date.now() + 3 * 60 * 60 * 1000)
}
function dateEAT() {
  return nowEAT().toISOString().split("T")[0]
}
function timeEAT() {
  return nowEAT().toISOString().slice(11, 19) + " EAT"
}

const saleSchema = new mongoose.Schema(
  {
    items: [
      {
        productId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
          required: true
        },
        qty:   { type: Number, required: true },
        price: { type: Number, required: true },
        // ✅ Per-item return status — only returned items change
        returnStatus: {
          type: String,
          enum: ["none", "pending", "approved", "rejected"],
          default: "none"
        }
      }
    ],
    total:    { type: Number, required: true },
    cashierId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    cashier:   { type: String, default: "Cashier" },
    paymentInfo: {
      paymentMethod: { type: String, enum: ["cash", "mpesa", "split", "credit"], default: "cash" },
      mpesaPhone:    { type: String },
      customerName:  { type: String },
      cashPart:      { type: Number, default: 0 },
      mpesaPart:     { type: Number, default: 0 },
      discount:      { type: Number, default: 0 },
      finalTotal:    { type: Number },
      cashGiven:     { type: Number, default: 0 },
      change:        { type: Number, default: 0 }
    },
    // ✅ EAT date and time
    date: {
      type: String,
      required: true,
      default: dateEAT
    },
    time: {
      type: String,
      required: true,
      default: timeEAT
    },
    receiptId:    { type: String, unique: true, sparse: true },
    returned:     { type: Boolean, default: false },
    returnStatus: {
      type: String,
      enum: ["none", "pending", "approved", "rejected"],
      default: "none"
    },
    returnId: { type: mongoose.Schema.Types.ObjectId, ref: "Return" }
  },
  { timestamps: true }
)

saleSchema.pre("save", async function () {
  if (!this.receiptId) {
    const timestamp = Date.now().toString().slice(-6)
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, "0")
    this.receiptId = `RCP-${timestamp}-${random}`
  }
})

module.exports = mongoose.models.Sale || mongoose.model("Sale", saleSchema)