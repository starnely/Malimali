
const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    fullname: { type: String, required: true }, 
    username: { type: String, required: true },
    email: { type: String, required: true },
    password: { type: String, required: true },
    
    // ✅ Aligned with frontend dashboard filters and register endpoints
    role: { 
      type: String, 
      enum: ["owner", "manager", "cashier", "employee"], 
      default: "cashier" 
    },

    // Link the user to a specific Store/Warehouse
    store: { 
      type: String, 
      required: true,
      default: "Store One" 
      
    },

    // ✅ Dual-flag configuration prevents suspension bypass across old/new endpoints
    active: { type: Boolean, default: true },
    isActive: { type: Boolean, default: true },

    shiftStatus: {
      type: String,
      enum: ["open", "closed"],
      default: "closed"
    },

    // Bcrypt-hashed 4-6 digit numeric PIN used for approval workflows.
    // null = PIN not configured; user cannot be used as approver until set.
    approvalPin: { type: String, default: null }
  },
  { timestamps: true }
);

// Phase 2a-2 — tenant-scoped uniqueness (was global unique:true on each field)
userSchema.index({ tenantId: 1, username: 1 }, { unique: true });
userSchema.index({ tenantId: 1, email: 1 }, { unique: true });

// ── AUTO-SYNC MITIGATION MIDDLEWARE ──────────────────────────────────
// Ensures that changing either flag updates the other automatically on save
userSchema.pre("save", function () {
  if (this.isModified("active")) {
    this.isActive = this.active;
  } else if (this.isModified("isActive")) {
    this.active = this.isActive;
  }
});

module.exports = mongoose.models.User || mongoose.model("User", userSchema);