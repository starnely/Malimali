const express  = require("express");
const router   = express.Router();
const mongoose = require("mongoose");
const Sale     = require("../models/Sale");
const Product  = require("../models/Product");
const User     = require("../models/User");
const PendingVerification = require("../models/PendingVerification");
const { authMiddleware } = require("../middleware/authMiddleware");
const { mpesaIpAllowlist } = require("../middleware/mpesaIpAllowlist");
const { initiateSTKPush, queryStkStatus, getResultMessage } = require("../utils/mpesaClient");
const { resolvePendingSale } = require("../utils/resolvePendingSale");

function getEATDate() {
  return new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString().split("T")[0];
}

// ── 1. INITIATE STK PUSH — requires cashier auth ──────────────────────
//
// Creates a pending Sale (stock reserved) then contacts Safaricom.
// If Safaricom rejects the request, the MongoDB transaction is aborted
// and stock is automatically restored.  The frontend polls or listens
// on socket "mpesa_result" for the final outcome.
router.post("/stk-push", authMiddleware, async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { phone, amount, cartItems, discount, finalTotal, customerName } = req.body;

    if (!phone) {
      await session.abortTransaction(); session.endSession();
      return res.status(400).json({ success: false, message: "Phone number is required." });
    }
    if (!cartItems || !Array.isArray(cartItems) || cartItems.length === 0) {
      await session.abortTransaction(); session.endSession();
      return res.status(400).json({ success: false, message: "Cart items are required." });
    }

    const user = await User.findOne({ _id: req.user.id, tenantId: req.tenantId }).session(session);
    if (!user) {
      await session.abortTransaction(); session.endSession();
      return res.status(401).json({ success: false, message: "Authenticated user not found." });
    }

    // ── Validate items and reserve stock (mirrors sales.js logic) ─────
    const resolvedItems = [];

    for (const item of cartItems) {
      const parsedQty = Number(item.qty);
      if (!item.productId || parsedQty <= 0) {
        await session.abortTransaction(); session.endSession();
        return res.status(400).json({ success: false, message: "Invalid item in cart." });
      }

      const updated = await Product.findOneAndUpdate(
        { _id: item.productId, tenantId: req.tenantId, stock: { $gte: parsedQty }, isExpired: { $ne: true } },
        { $inc: { stock: -parsedQty } },
        { new: true, session }
      );

      // Floating-point guard (kg items can leave stock at -1e-15)
      if (updated && updated.stock < 0) {
        await Product.findOneAndUpdate({ _id: updated._id, tenantId: req.tenantId }, { $set: { stock: 0 } }, { session });
        updated.stock = 0;
      }

      if (!updated) {
        const product = await Product.findOne({ _id: item.productId, tenantId: req.tenantId }).session(session);
        await session.abortTransaction(); session.endSession();
        if (!product)          return res.status(404).json({ success: false, message: "A product in your cart was not found." });
        if (product.isExpired) return res.status(400).json({ success: false, message: `${product.name} has expired and cannot be sold.` });
        return res.status(400).json({ success: false, message: `Insufficient stock for: ${product.name}. Available: ${product.stock}` });
      }

      resolvedItems.push({
        productId:    updated._id,
        qty:          parsedQty,
        price:        item.price != null ? Number(item.price) : updated.sellPrice,
        buyPrice:     updated.buyPrice || 0,
        returnStatus: "none",
        voidStatus:   "none",
        voidedQty:    0,
      });
    }

    const cartTotal = resolvedItems.reduce((sum, i) => sum + i.price * i.qty, 0);

    // ── Save pending sale — pre-save hook assigns receiptId ───────────
    const sale = new Sale({
      items: resolvedItems,
      total: cartTotal,
      store: user.store || "Main Store",
      cashierId: user._id,
      cashier:   user.fullname || user.username,
      status:    "pending",
      paymentInfo: {
        paymentMethod:      "mpesa",
        mpesaPhone:         String(phone),
        finalTotal:         Number(finalTotal) || cartTotal,
        discount:           Number(discount)   || 0,
        mpesaPart:          Number(finalTotal) || cartTotal,
        cashPart:           0,
        cashGiven:          0,
        change:             0,
        customerName:       (customerName || "Walk-in Customer").trim(),
        cardApprovalCode:   "",
        bankReference:      "",
        mpesaReceiptNumber: "",
      },
      date:         getEATDate(),
      returnStatus: "none",
      tenantId:     req.tenantId,
    });

    await sale.save({ session });

    // ── Send STK Push to Safaricom ────────────────────────────────────
    // AccountReference must be ≤ 12 chars; strip dashes from receiptId.
    let stkResult;
    try {
      console.log("[MPesa STK Push] Initiating for phone:", phone, "| amount:", Number(finalTotal) || cartTotal, "| saleId:", String(sale._id));
      stkResult = await initiateSTKPush({
        phone,
        amount:           Number(finalTotal) || cartTotal,
        accountReference: (sale.receiptId || String(sale._id)).replace(/-/g, "").slice(0, 12),
        description:      "POS Payment",
      });
      console.log("[MPesa STK Push] initiateSTKPush returned:", JSON.stringify(stkResult));
    } catch (stkErr) {
      // STK push failed — roll back the transaction so stock is restored
      await session.abortTransaction();
      session.endSession();
      console.error("[MPesa STK Push] Error caught in route:", stkErr.message);
      return res.status(502).json({
        success: false,
        message: stkErr.message || "Failed to reach M-Pesa. Please try again.",
      });
    }

    // ── Persist CheckoutRequestID before committing ───────────────────
    sale.mpesaCheckoutRequestId = stkResult.checkoutRequestId;
    sale.mpesaMerchantRequestId = stkResult.merchantRequestId || "";
    await sale.save({ session });

    await session.commitTransaction();
    session.endSession();

    return res.status(202).json({
      success:           true,
      checkoutRequestId: stkResult.checkoutRequestId,
      saleId:            sale._id,
    });

  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error("[MPesa STK Push] Unhandled route error:", err);
    return res.status(500).json({ success: false, message: "Failed to initiate payment.", error: err.message });
  }
});


// ── 2. SAFARICOM CALLBACK — no JWT auth, IP-allowlisted ──────────────
//
// Safaricom calls this after the customer enters their PIN (or cancels).
// We respond 200 immediately, then process async — Safaricom retries on
// non-200 responses and we must not keep their connection open.
//
// SECURITY: nothing in the request BODY decides whether money changed
// hands. ResultCode/ResultDesc from the body are never read at all below —
// only CheckoutRequestID (an anchor to look up our own record) and
// CallbackMetadata (used purely as a cosmetic receipt-number hint, never to
// decide success/failure). The actual decision always comes from a fresh
// call to Safaricom's own Query API, via resolvePendingSale for the main
// sale case and directly below for the split-payment case.
//
// Middleware order: mpesaIpAllowlist runs first, but in its default "log"
// mode it always calls next() regardless of match (see
// middleware/mpesaIpAllowlist.js) — this handler still runs and still does
// its own authoritative check even before the allowlist is confirmed/enforced.
router.post("/callback", mpesaIpAllowlist, async (req, res) => {
  console.log("[MPesa Callback] Raw body received:", JSON.stringify(req.body));
  res.json({ ResultCode: 0, ResultDesc: "Accepted" });

  try {
    const callback = req.body?.Body?.stkCallback;
    if (!callback) {
      console.warn("[MPesa Callback] No stkCallback in body — ignoring");
      return;
    }

    const { CheckoutRequestID, CallbackMetadata } = callback;
    console.log("[MPesa Callback] CheckoutRequestID:", CheckoutRequestID);
    if (!CheckoutRequestID) return;

    const io = req.app.get("io");

    // ── SPECIAL CASE — unauthenticated external webhook ─────────────────
    // No JWT, no req.user, no req.tenantId exists on this request at all —
    // Safaricom calls this directly. This lookup is DELIBERATELY unscoped:
    // mpesaCheckoutRequestId is a globally-unique external reference (issued
    // by Safaricom, not by us), so it's the one correct anchor to find the
    // Sale without any tenant context. Do NOT add req.tenantId here — it
    // would be undefined and would just make this query fail to match.
    const sale = await Sale.findOne({ mpesaCheckoutRequestId: CheckoutRequestID })
      .setOptions({ skipTenantScope: "unauthenticated Safaricom webhook — mpesaCheckoutRequestId is a globally-unique external reference; tenant is derived from this Sale for every subsequent operation" });

    if (sale) {
      console.log("[MPesa Callback] Matched sale:", String(sale._id), "| receiptId:", sale.receiptId);
      // Cosmetic only — never used to decide confirmed/failed. That
      // decision comes entirely from resolvePendingSale's own Query API call.
      const metaItems   = CallbackMetadata?.Item || [];
      const receiptHint = String(metaItems.find(i => i.Name === "MpesaReceiptNumber")?.Value || "");
      const result = await resolvePendingSale({ sale, io, mpesaReceiptNumberHint: receiptHint });
      console.log(`[MPesa Callback] Resolved sale ${String(sale._id)} → status=${result.status} applied=${result.applied}`);
      return;
    }

    // ── No full sale — check the split-payment verification record ──────
    // findOneAndDelete is the atomic claim (mirrors the status:"pending"
    // claim resolvePendingSale uses for full sales): only the first
    // delivery of this callback can win it, so a Safaricom retry can't
    // double-notify the cashier's socket.
    const verif = await PendingVerification.findOneAndDelete({ checkoutRequestId: CheckoutRequestID })
      .setOptions({ skipTenantScope: "unauthenticated Safaricom webhook — same reasoning as the Sale lookup above; the atomic findOneAndDelete already scopes to a single record via its unique checkoutRequestId" });

    // Still ask Safaricom what actually happened even with no local record —
    // a callback landing after the 5-minute TTL already deleted the record
    // (or one that was never registered) must never be silently dropped
    // without at least logging Safaricom's authoritative answer. There's
    // nothing to notify in that case (no cashier to route to), but "a real
    // payment happened and we have zero trace of it" must never be true.
    const { resultCode, resultDesc } = await queryStkStatus(CheckoutRequestID);

    if (!verif) {
      if (resultCode === 0) {
        console.error(`[MPesa Callback] ⚠️  CONFIRMED payment for CheckoutRequestID ${CheckoutRequestID} has no matching Sale or PendingVerification record — investigate (TTL expiry or unregistered request).`);
      } else {
        console.warn(`[MPesa Callback] No sale or verification found for CheckoutRequestID: ${CheckoutRequestID} — Daraja reports resultCode ${resultCode} (${resultDesc || "n/a"})`);
      }
      return;
    }

    let status, mpesaReceiptNumber = "", message = "";
    if (resultCode === 0) {
      status = "success";
      const metaItems = CallbackMetadata?.Item || [];
      mpesaReceiptNumber = String(metaItems.find(i => i.Name === "MpesaReceiptNumber")?.Value || "");
    } else if (resultCode === -1) {
      // Query itself was inconclusive right after a callback fired — rare,
      // but the record is already consumed (findOneAndDelete above), so
      // there's no later retry path for this one specifically. Tell the
      // cashier so they can check manually instead of the UI hanging.
      status  = "pending";
      message = "Payment status could not be confirmed automatically — please check manually before retrying.";
    } else {
      status  = "failed";
      message = getResultMessage(resultCode, resultDesc);
    }

    console.log(`[MPesa Callback] Split verify ${status.toUpperCase()}: ${CheckoutRequestID} | cashierId: ${verif.cashierId}`);
    if (io) {
      io.to(String(verif.cashierId)).emit("mpesa_verify_result", {
        checkoutRequestId: CheckoutRequestID,
        status,
        mpesaReceiptNumber,
        message,
      });
    }

  } catch (err) {
    console.error("[MPesa Callback] Processing error:", err);
  }
});


// ── 3. POLL PAYMENT STATUS — requires auth (polling fallback) ─────────
//
// Frontend uses this if the socket event is missed (e.g. reconnect).
router.get("/status/:checkoutRequestId", authMiddleware, async (req, res) => {
  try {
    const sale = await Sale.findOne({
      tenantId: req.tenantId,
      mpesaCheckoutRequestId: req.params.checkoutRequestId,
    }).lean();

    if (!sale) {
      return res.status(404).json({ success: false, message: "Payment not found." });
    }

    return res.json({
      success:            true,
      status:             sale.status,
      mpesaReceiptNumber: sale.paymentInfo?.mpesaReceiptNumber || "",
      saleId:             String(sale._id),
      receiptId:          sale.receiptId  || "",
      date:               sale.date       || "",
      time:               sale.time       || "",
      cashier:            sale.cashier    || "",
      store:              sale.store      || "",
    });
  } catch (err) {
    console.error("M-Pesa status error:", err);
    return res.status(500).json({ success: false, message: "Failed to fetch payment status.", error: err.message });
  }
});

// ── 4. STK VERIFY — split payment M-Pesa portion (no sale created) ────
//
// Sends a real STK push for the M-Pesa portion of a split payment without
// creating a Sale document or touching stock. On callback the cashier's
// socket room receives "mpesa_verify_result". The full split sale is
// recorded separately via POST /api/sales once the cashier confirms.
router.post("/stk-verify", authMiddleware, async (req, res) => {
  try {
    const { phone, amount } = req.body;
    if (!phone || !amount || Number(amount) <= 0) {
      return res.status(400).json({ success: false, message: "Phone and amount are required." });
    }

    const user = await User.findOne({ _id: req.user.id, tenantId: req.tenantId });
    if (!user) return res.status(401).json({ success: false, message: "User not found." });

    let stkResult;
    try {
      stkResult = await initiateSTKPush({
        phone,
        amount:           Math.ceil(Number(amount)),
        accountReference: "SPLIT-PAY",
        description:      "Split M-Pesa",
      });
    } catch (stkErr) {
      console.error("[MPesa STK Verify] STK push error:", stkErr.message);
      return res.status(502).json({ success: false, message: stkErr.message || "Failed to reach M-Pesa." });
    }

    // Persisted (not an in-process Map) so a server restart between the STK
    // push and the callback doesn't silently orphan the verification. The
    // model's TTL index (5 min, models/PendingVerification.js) handles
    // cleanup instead of a setTimeout.
    await PendingVerification.create({
      checkoutRequestId: stkResult.checkoutRequestId,
      merchantRequestId: stkResult.merchantRequestId || "",
      cashierId:         user._id,
      amount:            Number(amount),
      tenantId:          req.tenantId,
    });

    console.log("[MPesa STK Verify] Initiated | phone:", phone, "| amount:", amount, "| cashier:", user._id);

    return res.status(202).json({
      success:           true,
      checkoutRequestId: stkResult.checkoutRequestId,
    });
  } catch (err) {
    console.error("[MPesa STK Verify] Unhandled error:", err);
    return res.status(500).json({ success: false, message: "Failed to initiate M-Pesa verification." });
  }
});


// ── 5. ON-DEMAND STK QUERY — used by frontend before retry ────────────
//
// Lets the frontend ask "what is the REAL status of this checkout
// request?" before allowing a retry.  Calls Safaricom directly so we
// have an authoritative answer even if the callback was missed.
router.get("/query/:checkoutRequestId", authMiddleware, async (req, res) => {
  try {
    const { checkoutRequestId } = req.params;
    const sale = await Sale.findOne({ tenantId: req.tenantId, mpesaCheckoutRequestId: checkoutRequestId });
    if (!sale) {
      return res.status(404).json({ success: false, message: "Payment not found." });
    }

    // Already resolved — no need to hit Safaricom
    if (sale.status !== "pending") {
      return res.json({ success: true, status: sale.status });
    }

    // Same atomic, authoritative resolution used by the callback route and
    // the orphan-cleanup job — one code path, not a third reimplementation.
    const io = req.app.get("io");
    const result = await resolvePendingSale({ sale, io });
    return res.json({ success: true, status: result.status, message: result.message });

  } catch (err) {
    console.error("[MPesa On-Demand Query] Error:", err);
    return res.status(500).json({ success: false, message: "Failed to query payment status.", error: err.message });
  }
});


module.exports = router;
