const mongoose = require("mongoose")

const returnSchema = new mongoose.Schema(
  {
    saleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Sale",
      required: true
    },
    items: [
      {
        productId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
          required: true
        },
        qty: { type: Number, required: true },
        sellPrice: { type: Number, required: true }
      }
    ],
    reason: { type: String },
    customerName: { type: String },
    refundAmount: { type: Number },

    // 🔹 NEW FIELD: track which cashier requested the return
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending"
    },
    date: { type: String },   // stored as YYYY-MM-DD
    time: { type: String },   // stored as HH:MM:SS
    approvedAt: { type: String },
    rejectedAt: { type: String }
  },
  { timestamps: true }
)

// ✅ Prevent OverwriteModelError by reusing existing model if already compiled
module.exports = mongoose.models.Return || mongoose.model("Return", returnSchema)
