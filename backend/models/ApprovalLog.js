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
      enum: ["void_cashier", "void_manager_onsite", "return_stage1", "return_stage2"],
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
