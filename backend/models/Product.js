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
    // ── Legacy plain-text supplier (kept for backward compat) ────────
    supplier: {
      type: String,
      trim: true,
      default: ""
    },
    // ── Phase 6: linked Supplier document (optional) ─────────────────
    supplierId: {
      type:    mongoose.Schema.Types.ObjectId,
      ref:     "Supplier",
      default: null,
    },
    // ── Phase 6: reorder threshold ───────────────────────────────────
    reorderLevel: {
      type:    Number,
      default: 5,
      min:     [0, "Reorder level cannot be negative"],
    },
    // Store/Warehouse this product belongs to
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
    // Batch tracking
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
    // Flag for expired products (moved to expired stock)
    isExpired: {
      type: Boolean,
      default: false
    }
  },
  { timestamps: true }
)

module.exports = mongoose.models.Product || mongoose.model("Product", productSchema)
