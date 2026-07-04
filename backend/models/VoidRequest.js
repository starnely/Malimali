const mongoose = require("mongoose")

const voidRequestSchema = new mongoose.Schema(
  {
    saleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Sale",
      required: true
    },
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    store:    { type: String, required: true },
    reason:   { type: String, required: true },
    voidType: { type: String, enum: ["whole", "items"], default: "whole" },

    // Populated only for item-level voids
    items: [
      {
        itemId:   { type: mongoose.Schema.Types.ObjectId, required: true },
        voidQty:  { type: Number, required: true }
      }
    ],

    status: {
      type: String,
      enum: ["pending_owner", "approved", "rejected"],
      default: "pending_owner"
    },

    approvedBy:  { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    approvedAt:  { type: String, default: null },
    rejectedAt:  { type: String, default: null }
  },
  { timestamps: true }
)

module.exports = mongoose.models.VoidRequest || mongoose.model("VoidRequest", voidRequestSchema)
