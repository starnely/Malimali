const mongoose = require("mongoose");

const tenantSchema = new mongoose.Schema(
  {
    name:         { type: String, required: true, trim: true },
    slug:         { type: String, required: true, unique: true, trim: true, lowercase: true },
    status:       { type: String, enum: ["trial", "active", "suspended", "cancelled"], default: "trial" },
    plan:         { type: String, default: "starter" },
    billingEmail: { type: String, trim: true },
    trialEndsAt:  { type: Date },
  },
  { timestamps: true }
);

module.exports = mongoose.models.Tenant || mongoose.model("Tenant", tenantSchema);
