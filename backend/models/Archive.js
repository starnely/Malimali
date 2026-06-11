const mongoose = require("mongoose");

const ArchiveSchema = new mongoose.Schema({
  employeeName: {
    type:     String,
    required: true,
    trim:     true
  },
  date: {
    type:     String,
    required: true
  },
  store: {
    type:    String,
    trim:    true,
    default: "Main Store"
  },
  revenue:      { type: Number, default: 0 },
  profit:       { type: Number, default: 0 },
  transactions: { type: Number, default: 0 },
  itemsSold:    { type: Number, default: 0 },

  paymentBreakdown: {
    cash:       { type: Number, default: 0 },
    mpesa:      { type: Number, default: 0 },
    splitCash:  { type: Number, default: 0 },
    splitMpesa: { type: Number, default: 0 },
    credit:     { type: Number, default: 0 },
    card:       { type: Number, default: 0 },
    bank:       { type: Number, default: 0 }
  },

  // ── Cash reconciliation fields ───────────────────────────────────
  openingFloat: { type: Number, default: 0 },   // cash in till at shift start (future use)
  actualCash:   { type: Number, default: 0 },   // cash cashier physically counted at close
  variance:     { type: Number, default: 0 },   // actualCash - expectedCash (+ over, - short)

  closedAt: {
    type:    Date,
    default: Date.now
  }
},
{ timestamps: true });

// One archive per employee per day
ArchiveSchema.index({ employeeName: 1, date: 1 }, { unique: true });

// Owner store filter index
ArchiveSchema.index({ store: 1, date: -1 });

module.exports = mongoose.model("Archive", ArchiveSchema);
