const mongoose = require("mongoose")

const approvalLogSchema = new mongoose.Schema(
  {
    // Whose PIN was used
    pinOwnerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    actionType: {
      type: String,
      enum: [
        "void_cashier", "void_cashier_owner_override",
        "void_manager_onsite", "void_owner_pin",
        "return_stage1", "return_stage1_owner_override", "return_stage2",
      ],
      required: true
    },
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true
    },
    targetType: {
      type: String,
      enum: ["sale", "return"],
      required: true
    },
    store:     { type: String },
    timestamp: { type: Date, default: Date.now }
  },
  { timestamps: true }
)

module.exports = mongoose.models.ApprovalLog || mongoose.model("ApprovalLog", approvalLogSchema)
