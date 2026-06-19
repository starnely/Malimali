const mongoose = require("mongoose")

const expiredStockSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true
    },
    productName: {
      type: String,
      required: true,
      trim: true
    },
    category: {
      type: String,
      trim: true,
      default: ""
    },
    supplier: {
      type: String,
      trim: true,
      default: ""
    },
    store: {
      type: String,
      trim: true,
      default: "Main Store"
    },
    batch: {
      type: String,
      trim: true,
      default: ""
    },
    unit: {
      type: String,
      trim: true,
      default: "pcs"
    },
    // How many units expired
    quantity: {
      type: Number,
      required: true,
      min: [1, "Expired quantity must be at least 1"]
    },
    // Buy price at time of expiry (for loss calculation)
    buyPrice: {
      type: Number,
      required: true,
      min: [0, "Buy price cannot be negative"]
    },
    // Total loss = quantity * buyPrice
    totalLoss: {
      type: Number,
      required: true,
      min: [0, "Total loss cannot be negative"]
    },
    expiryDate: {
      type: Date,
      required: true
    },
    // Date this was moved to expired stock
    movedAt: {
      type: Date,
      default: Date.now
    },
    // Who processed it (manual moves)
    processedBy: {
      type: String,
      default: "System"
    },
    notes: {
      type: String,
      trim: true,
      default: ""
    }
  },
  { timestamps: true }
)

module.exports = mongoose.models.ExpiredStock || mongoose.model("ExpiredStock", expiredStockSchema)