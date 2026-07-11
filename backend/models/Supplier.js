const mongoose = require("mongoose");

const supplierSchema = new mongoose.Schema({
  name: {
    type:     String,
    required: true,
    trim:     true,
  },
  company: {
    type:   String,
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

// Phase 2a-2 — tenant-scoped uniqueness (was global unique+sparse). Partial
// filter, not sparse — see Product.js barcode/pluNumber comment for why.
supplierSchema.index({ tenantId: 1, company: 1 }, { unique: true, partialFilterExpression: { company: { $exists: true } } });

module.exports = mongoose.model("Supplier", supplierSchema);
