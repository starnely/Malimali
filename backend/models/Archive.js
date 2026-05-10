const mongoose = require("mongoose");

const ArchiveSchema = new mongoose.Schema({
  employeeName: { 
    type: String, 
    required: true,
    trim: true 
  },
  date: { 
    type: String, 
    required: true 
  }, // Format: YYYY-MM-DD
  
  revenue: { type: Number, default: 0 },
  profit: { type: Number, default: 0 },
  transactions: { type: Number, default: 0 },
  itemsSold: { type: Number, default: 0 },

  // 🔹 Payment breakdown stores the totals shown in image_84105b.png
  paymentBreakdown: {
    // Total Cash (Pure Cash + Split Cash)
    cash: { type: Number, default: 0 },
    // Total M-Pesa (Pure M-Pesa + Split M-Pesa)
    mpesa: { type: Number, default: 0 },
    // Specific parts kept for auditing
    splitCash: { type: Number, default: 0 },
    splitMpesa: { type: Number, default: 0 },
    credit: { type: Number, default: 0 }
  },

  createdAt: { 
    type: Date, 
    default: Date.now 
  }
});

// 🔹 Enforce unique archive per employee per day.
// This allows our findOneAndUpdate logic to identify the correct record to update.
ArchiveSchema.index({ employeeName: 1, date: 1 }, { unique: true });

module.exports = mongoose.model("Archive", ArchiveSchema);