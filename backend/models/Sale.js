const mongoose = require("mongoose")

function nowEAT() { return new Date(Date.now() + 3 * 60 * 60 * 1000) }
function dateEAT() { return nowEAT().toISOString().split("T")[0] }
function timeEAT() { return nowEAT().toISOString().slice(11, 19) + " EAT" }

const saleSchema = new mongoose.Schema(
  {
    items: [
      {
        productId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
          required: true,
        },
        qty: { type: Number, required: true },
        price: { type: Number, required: true },
        buyPrice: { type: Number, default: 0 },
        unit: { type: String, default: "pcs" },
        returnStatus: {
          type: String,
          enum: ["none", "pending", "approved", "rejected"],
          default: "none",
        },
        returnedQty: { type: Number, default: 0 },
        // ── Per-item void fields ──────────────────────────────────────
        voidStatus: {
          type: String,
          enum: ["none", "voided"],
          default: "none",
        },
        voidedQty: { type: Number, default: 0 },   // how many units voided
        voidedAt: { type: Date },
        voidedBy: { type: String, default: "" },
        voidReason: { type: String, default: "" },
      },
    ],
    total: { type: Number, required: true },

    // ── Multi-store tracking ──────────────────────────────────────────
    store: { type: String, required: true, index: true },
    cashierId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    cashier: { type: String, default: "Cashier" },

    paymentInfo: {
      paymentMethod: {
        type: String,
        enum: ["cash", "mpesa", "split", "credit", "card", "bank"],
        default: "cash",
      },
      mpesaPhone: { type: String },
      customerName: { type: String },
      customerPhone: { type: String, default: "" },
      customerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Customer",
        default: null,
      },
      promiseDate: { type: String, default: "" },
      cashPart: { type: Number, default: 0 },
      mpesaPart: { type: Number, default: 0 },
      discount: { type: Number, default: 0 },
      finalTotal: { type: Number },
      cashGiven: { type: Number, default: 0 },
      change: { type: Number, default: 0 },
      cardApprovalCode: { type: String, default: "" },
      bankReference: { type: String, default: "" },
      mpesaReceiptNumber: { type: String, default: "" },
    },

    // ── M-Pesa STK Push integration ───────────────────────────────────
    // "pending"   — stock reserved, STK push sent, awaiting callback
    // "confirmed" — callback received (success), or created by non-M-Pesa method
    // "failed"    — callback received (failure), stock has been restocked
    status: {
      type: String,
      enum: ["pending", "confirmed", "failed"],
      default: "confirmed",
    },
    mpesaCheckoutRequestId: { type: String, default: "" },
    mpesaMerchantRequestId: { type: String, default: "" },

    date: { type: String, required: true, default: dateEAT },
    time: { type: String, required: true, default: timeEAT },
    receiptId: { type: String, unique: true, sparse: true },
    returned: { type: Boolean, default: false },
    returnStatus: {
      type: String,
      enum: ["none", "pending", "approved", "rejected"],
      default: "none",
    },
    returnId: { type: mongoose.Schema.Types.ObjectId, ref: "Return" },

    // ── Whole-sale void fields ────────────────────────────────────────
    voided: { type: Boolean, default: false },
    voidedAt: { type: Date },
    voidedBy: { type: String, default: "" },
    voidReason: { type: String, default: "" },
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
