const mongoose = require("mongoose")

function nowEAT() {
  return new Date(Date.now() + 3 * 60 * 60 * 1000)
}
function dateEAT() {
  return nowEAT().toISOString().split("T")[0]
}

async function generatePoNumber() {
  const now    = nowEAT()
  const yy     = String(now.getFullYear()).slice(2)
  const mm     = String(now.getMonth() + 1).padStart(2, "0")
  const dd     = String(now.getDate()).padStart(2, "0")
  const prefix = `PO-${yy}${mm}${dd}-`
  const last   = await mongoose.models.PurchaseOrder
    .findOne({ poNumber: { $regex: `^${prefix}` } })
    .sort({ poNumber: -1 }).lean()
  let seq = 1
  if (last?.poNumber) {
    const parts = last.poNumber.split("-")
    seq = (parseInt(parts[parts.length - 1], 10) || 0) + 1
  }
  return `${prefix}${String(seq).padStart(4, "0")}`
}

const poItemSchema = new mongoose.Schema(
  {
    productId:    { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    productName:  { type: String, default: "" },
    unit:         { type: String, default: "pcs" },
    qtyOrdered:   { type: Number, required: true, min: [1, "Quantity must be at least 1"] },
    qtyReceived:  { type: Number, default: 0, min: [0, "Received quantity cannot be negative"] },
    unitCost:       { type: Number, required: true, min: [0, "Unit cost cannot be negative"] },
    actualUnitCost: { type: Number, default: null }, // actual price paid at delivery (null = same as unitCost)
    receivedCost:   { type: Number, default: 0 },
  },
  { _id: true }
)

const purchaseOrderSchema = new mongoose.Schema(
  {
    poNumber:      { type: String, unique: true, index: true },
    supplierId:    { type: mongoose.Schema.Types.ObjectId, ref: "Supplier", default: null },
    supplierName:  { type: String, default: "Manual / Walk-in" },
    supplierPhone: { type: String, default: "" },
    store:         { type: String, required: true, default: "Main Store" },
    items:         [poItemSchema],

    status: {
      type:    String,
      enum:    ["draft", "sent", "received", "partial", "cancelled"],
      default: "draft",
    },

    totalOrderedCost:  { type: Number, default: 0 },
    totalReceivedCost: { type: Number, default: 0 },
    notes:             { type: String, default: "" },

    // ── Audit trail ──────────────────────────────────────────────────
    createdBy:   { type: String, default: "" },
    createdById: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    sentAt:      { type: Date,   default: null },
    sentBy:      { type: String, default: "" },
    receivedAt:  { type: Date,   default: null },
    receivedBy:  { type: String, default: "" },
    expectedDate: { type: String, default: "" },

    // ── Cancel ───────────────────────────────────────────────────────
    cancelledAt:  { type: Date,   default: null },
    cancelledBy:  { type: String, default: "" },
    cancelReason: { type: String, default: "" },

    date: { type: String, default: dateEAT },

    // ── Invoice (supplier's document when delivering) ─────────────────
    invoiceNumber: { type: String, default: "", trim: true },
    invoiceAmount: { type: Number, default: 0 },   // what supplier charged
    invoiceDate:   { type: String, default: "" },  // "YYYY-MM-DD"
    invoicePhoto:  { type: String, default: "" },  // file path after upload

    // ── Payment tracking ──────────────────────────────────────────────
    // unpaid = no payments yet
    // partial = some payments made, balance > 0
    // paid    = fully settled
    paymentStatus: {
      type:    String,
      enum:    ["unpaid", "partial", "paid"],
      default: "unpaid",
    },
    amountPaid: { type: Number, default: 0 },
    // balance = invoiceAmount - amountPaid (recalculated on each payment)
    balance:    { type: Number, default: 0 },
  },
  { timestamps: true }
)

purchaseOrderSchema.pre("save", async function () {
  if (!this.poNumber) {
    this.poNumber = await generatePoNumber()
  }
  this.totalOrderedCost = this.items.reduce(
    (sum, item) => sum + item.qtyOrdered * item.unitCost, 0
  )
  // Keep balance in sync with invoiceAmount
  if (this.invoiceAmount > 0) {
    this.balance = Math.max(0, this.invoiceAmount - this.amountPaid)
  }
})

purchaseOrderSchema.index({ store: 1, status: 1, date: -1 })
purchaseOrderSchema.index({ supplierId: 1 })
purchaseOrderSchema.index({ paymentStatus: 1, store: 1 })

module.exports =
  mongoose.models.PurchaseOrder ||
  mongoose.model("PurchaseOrder", purchaseOrderSchema)
