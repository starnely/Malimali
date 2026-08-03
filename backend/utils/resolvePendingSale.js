// ── Single source of truth: "is this pending M-Pesa sale actually paid?" ──
//
// Used by routes/mpesa.js's /callback and /query routes, and the
// orphan-cleanup job in server.js. Before this,
// those call sites drifted: the callback route trusted whatever ResultCode /
// CallbackMetadata Safaricom's POST body claimed, while the orphan job
// (correctly) re-queried Safaricom directly. A forged callback POST could
// mark a sale "confirmed" without ever going through an authoritative check.
// Now every path funnels through the same Daraja STK Push Query call and the
// same atomic claim — there is exactly one way a sale becomes
// confirmed/failed, and it is never based on unverified caller-supplied input.
//
// Also fixes two bugs the old duplicated logic had:
//   - the callback route used a separate status check + later sale.save(),
//     a check-then-act race against the orphan job; both now share one
//     atomic findOneAndUpdate(status:"pending") claim, so only one caller's
//     update ever applies even if both fire for the same sale concurrently.
//   - the orphan job's restock loop used Product.findByIdAndUpdate with no
//     tenantId filter; every restock here is scoped to sale.tenantId.

const Sale = require("../models/Sale");
const Product = require("../models/Product");
const { queryStkStatus, getResultMessage } = require("./mpesaClient");
const { sendSmsReceipt } = require("./smsReceipt");

/**
 * Resolves a pending M-Pesa sale by asking Safaricom directly — never by
 * trusting a caller-supplied result. Safe to call repeatedly/concurrently
 * for the same sale: only the first caller to win the atomic claim applies
 * a state change; everyone else gets back { applied: false }.
 *
 * @param {Object} params
 * @param {Object} params.sale - a Sale document or plain object with at
 *   least _id, tenantId, status, mpesaCheckoutRequestId, cashierId, items.
 * @param {Object} params.io - Socket.IO server instance (may be null/undefined).
 * @param {String} [params.mpesaReceiptNumberHint] - a receipt number lifted
 *   from an inbound callback body, if any. Purely cosmetic: only ever stored
 *   if the Query API independently confirms success. Never used to decide
 *   success/failure — that decision comes from resultCode alone.
 * @returns {Promise<{status: "confirmed"|"failed"|"pending", applied: boolean}>}
 */
async function resolvePendingSale({ sale, io, mpesaReceiptNumberHint }) {
  if (!sale || sale.status !== "pending" || !sale.mpesaCheckoutRequestId) {
    return { status: sale?.status || "unknown", applied: false };
  }

  const { resultCode, resultDesc } = await queryStkStatus(sale.mpesaCheckoutRequestId);

  if (resultCode === 0) {
    const updated = await Sale.findOneAndUpdate(
      { _id: sale._id, status: "pending" },
      { $set: {
          status: "confirmed",
          "paymentInfo.mpesaReceiptNumber": mpesaReceiptNumberHint || "",
        } },
      { new: true }
    );
    if (!updated) return { status: "pending", applied: false }; // lost the race — someone else already resolved it

    console.log(`[MPesa Resolve] ✅ Confirmed sale ${updated.receiptId || updated._id}`);

    sendSmsReceipt(updated.paymentInfo.mpesaPhone, {
      store:              updated.store,
      receiptId:          updated.receiptId,
      itemCount:          updated.items.length,
      finalTotal:         updated.paymentInfo?.finalTotal ?? updated.total,
      mpesaReceiptNumber: updated.paymentInfo.mpesaReceiptNumber,
      date:               updated.date,
    }).catch(err => console.error("[SMS] Uncaught error:", err.message));

    if (io) {
      io.to(String(updated.cashierId)).emit("mpesa_result", {
        checkoutRequestId:  updated.mpesaCheckoutRequestId,
        status:             "success",
        mpesaReceiptNumber: updated.paymentInfo.mpesaReceiptNumber,
        sale:               updated.toObject(),
      });
      io.emit("sync_system_data");
    }
    return { status: "confirmed", applied: true };
  }

  if (resultCode !== -1) {
    const updated = await Sale.findOneAndUpdate(
      { _id: sale._id, status: "pending" },
      { $set: { status: "failed" } },
      { new: true }
    );
    if (!updated) return { status: "pending", applied: false };

    for (const item of updated.items) {
      await Product.findOneAndUpdate(
        { _id: item.productId, tenantId: updated.tenantId },
        { $inc: { stock: item.qty } }
      );
    }

    console.log(`[MPesa Resolve] ❌ Failed sale ${updated.receiptId || updated._id} — code ${resultCode}`);

    if (io) {
      io.to(String(updated.cashierId)).emit("mpesa_result", {
        checkoutRequestId: updated.mpesaCheckoutRequestId,
        status:            "failed",
        resultCode,
        message:           getResultMessage(resultCode, resultDesc),
      });
      io.emit("productsUpdated");
    }
    return { status: "failed", applied: true, message: getResultMessage(resultCode, resultDesc) };
  }

  // resultCode === -1: still processing, or the query itself failed — leave pending
  return { status: "pending", applied: false };
}

module.exports = { resolvePendingSale };
