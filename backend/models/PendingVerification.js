const mongoose = require("mongoose");

// Persists the in-flight "split-payment M-Pesa portion" verification that
// used to live only in an in-process Map (routes/mpesa.js) — that Map was
// wiped on every restart/deploy, silently orphaning any verification whose
// callback arrived after the process came back up (cashier's socket would
// simply never get "mpesa_verify_result"). Mongo-backed instead: survives
// restarts, and the TTL index below auto-expires stale entries, so nothing
// needs a matching setTimeout cleanup anymore either.
const pendingVerificationSchema = new mongoose.Schema({
  checkoutRequestId: {
    type: String,
    required: true,
    unique: true,
  },
  merchantRequestId: {
    type: String,
    default: "",
  },
  cashierId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  amount: {
    type: Number,
    required: true,
    min: [0, "Amount cannot be negative"],
  },
  // TTL: document is auto-deleted 5 minutes after creation — well past
  // Safaricom's ~60s callback window, matching the safety margin the old
  // in-memory Map used (3 min) with extra headroom for Mongo's TTL sweep,
  // which runs on its own ~60s background cycle rather than firing exactly
  // on expiry.
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 300,
  },
});

module.exports = mongoose.models.PendingVerification || mongoose.model("PendingVerification", pendingVerificationSchema);
