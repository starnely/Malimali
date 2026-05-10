  const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ["owner", "employee"], default: "employee" },
    name: { type: String },
    active: { type: Boolean, default: true },

    // ✅ New field for shift tracking
    shiftStatus: {
      type: String,
      enum: ["open", "closed"],
      default: "open"
    }
  },
  { timestamps: true }
);

// ✅ Prevent OverwriteModelError by reusing existing model if already compiled
module.exports = mongoose.models.User || mongoose.model("User", userSchema);
