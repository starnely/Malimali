const mongoose = require("mongoose");

function nowEAT() {
  return new Date(Date.now() + 3 * 60 * 60 * 1000);
}
function dateEAT() {
  return nowEAT().toISOString().split("T")[0];
}
function timeEAT() {
  return nowEAT().toISOString().slice(11, 19) + " EAT";
}

const stockInSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: [true, "Product reference is required"]
    },
    name: {
      type: String,
      required: [true, "Product name is required"],
      trim: true
    },
    category: {
      type: String,
      required: [true, "Category is required"],
      trim: true
    },
    store: {
      type: String,
      trim: true,
      default: "Main Store"
    },
    qty: {
      type: Number,
      required: [true, "Quantity is required"],
      min: [1, "Quantity must be at least 1"]
    },
    buyPrice: {
      type: Number,
      required: [true, "Buy price is required"],
      min: [0, "Buy price cannot be negative"]
    },
    total: {
      type: Number,
      required: [true, "Total cost is required"],
      min: [0, "Total cannot be negative"]
    },
    recordedBy: {
      type: String,
      default: "Unknown"
    },
    date: {
      type: String,
      default: dateEAT
    },
    time: {
      type: String,
      default: timeEAT
    }
  },
  { timestamps: true }
);

module.exports = mongoose.models.StockIn || mongoose.model("StockIn", stockInSchema);