const mongoose = require("mongoose")

const customerSchema = new mongoose.Schema(
  {
    name:  { type: String, required: true, trim: true },
    phone: { type: String, default: "", trim: true },
    store: { type: String, required: true, index: true },

    // ── Blacklist ────────────────────────────────────────────────────
    blacklisted:     { type: Boolean, default: false },
    blacklistReason: { type: String, default: "" },
    blacklistedBy:   { type: String, default: "" },   // owner/manager name
    blacklistedAt:   { type: Date },

    // ── Auto-flag (promise date passed, balance > 0) ─────────────────
    overdue: { type: Boolean, default: false },
  },
  { timestamps: true }
)

// ── Unique index: phone+store (only when phone is provided) ───────────
// We use a partial index so that empty phone strings don't conflict
// Phase 2a-2 — tenantId leads the existing compound unique index
customerSchema.index(
  { tenantId: 1, phone: 1, store: 1 },
  { unique: true, partialFilterExpression: { phone: { $gt: "" } } }
)

module.exports = mongoose.models.Customer || mongoose.model("Customer", customerSchema)
