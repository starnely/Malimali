const mongoose = require("mongoose")

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Product name is required"],
      trim: true,
      minlength: [2, "Name must be at least 2 characters"]
    },
    description: {
      type: String,
      trim: true,
      default: ""
    },
    category: {
      type: String,
      required: [true, "Category is required"],
      trim: true
    },
    unit: {
      type: String,
      trim: true,
      enum: ["kg", "g", "l", "ml", "pcs", "box", "carton", "pack", "dozen", "crate", "bag", "bale", "tray", "roll", "bottle", "set"],
      default: "pcs",
    },
    supplier: {
      type: String,
      trim: true,
      default: ""
    },
    supplierId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Supplier",
      default: null,
    },
    reorderLevel: {
      type: Number,
      default: 5,
      min: [0, "Reorder level cannot be negative"],
    },
    store: {
      type: String,
      trim: true,
      default: "Main Store"
    },
    stock: {
      type: Number,
      required: [true, "Stock quantity is required"],
      min: [0, "Stock cannot be negative"]
    },
    buyPrice: {
      type: Number,
      required: [true, "Buy price is required"],
      min: [0, "Buy price cannot be negative"]
    },
    sellPrice: {
      type: Number,
      required: [true, "Sell price is required"],
      min: [0, "Sell price cannot be negative"],
      validate: {
        validator: function (value) {
          // Skip validation for weighed items — sellPrice is per kg
          if (this.isWeighed) return true
          if (this.buyPrice === undefined || this.buyPrice === null) return true
          return Number(value) >= Number(this.buyPrice)
        },
        message: "Selling price must be equal to or higher than buy price"
      }
    },
    barcode: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
      minlength: [6, "Barcode must be at least 6 characters"]
    },
    batch: {
      type: String,
      trim: true,
      default: ""
    },
    mftDate: {
      type: Date,
      default: null
    },
    expiryDate: {
      type: Date,
      default: null
    },
    isExpired: {
      type: Boolean,
      default: false
    },

    // ── NEW: Weighed Item Fields ────────────────────────────────────────
    // Set isWeighed: true for products sold by weight (sugar, rice, meat, etc.)
    // sellPrice becomes the price per KG
    // pluNumber is the number programmed on the DIGI SM-500 scale
    isWeighed: {
      type: Boolean,
      default: false,
    },
    pricePerKg: {
      type: Number,
      default: 0,
      min: [0, "Price per kg cannot be negative"],
    },
    pluNumber: {
      type: Number,
      min: 1,
      max: 99999,
      unique: true,
      sparse: true,
      // No default — field must be absent (not null) for sparse unique index
      // to skip non-weighed products. Use $unset when clearing.
    },

    // ── Auto-PO suggestion fields ──────────────────────────────────────
    needsReorder:   { type: Boolean, default: false },
    suggestedQty:   { type: Number,  default: 0 },
    dailyVelocity:  { type: Number,  default: 0 },
    velocityCalcAt: { type: Date,    default: null },
    velocityTier:   { type: String,  enum: ["velocity", "fallback"], default: null },
  },
  { timestamps: true }
)

module.exports = mongoose.models.Product || mongoose.model("Product", productSchema)