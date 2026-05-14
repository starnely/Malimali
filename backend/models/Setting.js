// backend/models/Setting.js
const mongoose = require('mongoose');

const SettingSchema = new mongoose.Schema({
  // Ensure only one settings document exists
  settingKey: { type: String, default: 'global', unique: true },

  companyName: { type: String, required: true },
  phone: String,
  email: String,
  location: String,
  logo: String, // Store the file path or Base64 string
  paymentMethods: { 
    type: [String], 
    default: ['cash', 'mpesa', 'split', 'credit'] 
  },
  receiptPrefix: { 
    type: String, 
    default: "RCP" 
  },
  isActivated: { type: Boolean, default: false },
  activationCode: String,
  installedAt: { type: Date, default: Date.now },
  currency: { type: String, default: "$" },
  taxRate: { type: Number, default: 0 }, // e.g., 0.15 for 15%
  receiptFooter: { type: String, default: "Thank you for your business!" },
  lowStockThreshold: { type: Number, default: 3 }, // Alert when stock is below this number

  // Useful for your EAT logic
  timezone: { type: String, default: "Africa/Nairobi" }
});

module.exports = mongoose.model('Setting', SettingSchema);