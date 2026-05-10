const mongoose = require("mongoose")

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Product name is required"],
      trim: true,
      minlength: [2, "Name must be at least 2 characters long"]
    },
    category: {
      type: String,
      required: [true, "Category is required"],
      // ✅ Fixed: Added "Accessories" to match frontend categories
      enum: {
        values: ["Furniture", "Bedding", "Utensils", "Cleaning", "Accessories", "Other"],
        message: "'{VALUE}' is not a valid category"
      },
      trim: true
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
      // ✅ Fixed: validator fires on updates too — use Number() to avoid string comparison
      // Also skip validation if buyPrice not set yet (e.g. partial updates)
      validate: {
        validator: function (value) {
          if (this.buyPrice === undefined || this.buyPrice === null) return true
          return Number(value) >= Number(this.buyPrice)
        },
        message: "Sell price must be greater than or equal to buy price"
      }
    },
    barcode: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
      minlength: [6, "Barcode must be at least 6 characters long"]
    }
  },
  { timestamps: true }
)

module.exports = mongoose.models.Product || mongoose.model("Product", productSchema)