const mongoose = require("mongoose");

const supplierSchema = new mongoose.Schema({
  name: {
    type:     String,
    required: true,
    trim:     true,
  },
  company: {
    type:   String,
    unique: true,
    sparse: true,
    trim:   true,
  },
  email: {
    type:      String,
    lowercase: true,
    trim:      true,
    default:   "",
  },
  phone: {
    type:    String,
    trim:    true,
    default: "",
  },
  address: {
    type:    String,
    default: "",
  },
  notes: {
    type:    String,
    trim:    true,
    default: "",
  },
  // ── Multi-store: supplier can supply to multiple stores ───────────
  // Empty array = supplies to all stores (global supplier)
  stores: {
    type:    [String],
    default: [],
  },
  isActive: {
    type:    Boolean,
    default: true,
  },
}, { timestamps: true });

module.exports = mongoose.model("Supplier", supplierSchema);
