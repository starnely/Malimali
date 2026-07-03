const mongoose = require("mongoose");

const SettingSchema = new mongoose.Schema({
  settingKey: {
    type:    String,
    default: "global",
    unique:  true
  },
  companyName: {
    type:     String,
    required: true
  },
  phone:    { type: String, default: "" },
  email:    { type: String, default: "" },
  location: { type: String, default: "" },
  logo:     { type: String, default: "" },

  paymentMethods: {
    type:    [String],
    default: ["cash", "mpesa", "split", "credit"]
  },
  receiptPrefix: {
    type:    String,
    default: "RCP"
  },
  receiptFooter: {
    type:    String,
    default: "Thank you for your business!"
  },
  currency: {
    type:    String,
    default: "KSh"
  },
  taxRate: {
    type:    Number,
    default: 0
  },
  lowStockThreshold: {
    type:    Number,
    default: 5
  },
  // ── KRA Compliance ──────────────────────────────────────────────────
  kraPin: {
    type:    String,
    default: ""
  },

  // ── Printer Configuration ───────────────────────────────────────────
  printerType: {
    type:    String,
    enum:    ["usb", "network", "browser"],
    default: "browser"
  },
  printerIp: {
    type:    String,
    default: ""
  },

  // ── Business Document Info (PDF letterhead) ─────────────────────────
  businessAddress: { type: String, default: "" },
  businessWebsite: { type: String, default: "" },

  // ── SMTP Email Configuration ────────────────────────────────────────
  smtp: {
    host:     { type: String, default: "" },
    port:     { type: Number, default: 587 },
    secure:   { type: Boolean, default: false }, // true = port 465 SSL
    user:     { type: String, default: "" },
    password: { type: String, default: "" },     // AES-256 encrypted at rest
    fromName: { type: String, default: "" },
  },

  // ── Brand Colors (client-customizable, applied via CSS variables) ───
  brandColors: {
    primary:   { type: String, default: '' },  // maps to --primary
    secondary: { type: String, default: '' },  // maps to --sidebar-bg
    accent:    { type: String, default: '' },  // maps to --accent
  },

  // ── Schema version for future migrations ────────────────────────────
  schemaVersion: { type: Number, default: 1 },

  isActivated:    { type: Boolean, default: false },
  activationCode: { type: String },
  installedAt:    { type: Date, default: Date.now }
});

module.exports = mongoose.model("Setting", SettingSchema);
