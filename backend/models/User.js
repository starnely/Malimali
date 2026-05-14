const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    fullname: { type: String, required: true }, // Added to match "Fullname" in image_3b9fb0.png
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true }, // Added email field
    password: { type: String, required: true },
    
    // Updated roles to match your requirement: owner, manager, cashier
    role: { 
      type: String, 
      enum: ["owner", "manager", "cashier"], 
      default: "cashier" 
    },

    // New field to link the user to a specific Store/Warehouse
    store: { 
      type: String, 
      required: true,
      default: "Store One" // Defaulting to match your UI example
    },

    active: { type: Boolean, default: true },

    // ✅ Keeps your existing shift tracking logic
    shiftStatus: {
      type: String,
      enum: ["open", "closed"],
      default: "closed" // Generally safer to start 'closed' until they clock in
    }
  },
  { timestamps: true }
);

// ✅ Prevent OverwriteModelError by reusing existing model if already compiled
module.exports = mongoose.models.User || mongoose.model("User", userSchema);