const express  = require("express");
const router   = express.Router();
const mongoose = require("mongoose");
const Sale     = require("../models/Sale");
const Product  = require("../models/Product");
const User     = require("../models/User");
const { authMiddleware } = require("../middleware/authMiddleware");
const { initiateSTKPush, getResultMessage } = require("../utils/mpesaClient");
const { sendSmsReceipt } = require("../utils/smsReceipt");

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

    const user = await User.findById(req.user.id).session(session);
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
        { _id: item.productId, stock: { $gte: parsedQty }, isExpired: { $ne: true } },
        { $inc: { stock: -parsedQty } },
        { new: true, session }
      );

      // Floating-point guard (kg items can leave stock at -1e-15)
      if (updated && updated.stock < 0) {
        await Product.findByIdAndUpdate(updated._id, { $set: { stock: 0 } }, { session });
        updated.stock = 0;
      }

      if (!updated) {
        const product = await Product.findById(item.productId).session(session);
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


// ── 2. SAFARICOM CALLBACK — no JWT auth ──────────────────────────────
//
// Safaricom calls this after the customer enters their PIN (or cancels).
// We respond 200 immediately, then process async — Safaricom retries on
// non-200 responses and we must not keep their connection open.
router.post("/callback", async (req, res) => {
  console.log("[MPesa Callback] Raw body received:", JSON.stringify(req.body));
  res.json({ ResultCode: 0, ResultDesc: "Accepted" });

  try {
    const callback = req.body?.Body?.stkCallback;
    if (!callback) {
      console.warn("[MPesa Callback] No stkCallback in body — ignoring");
      return;
    }

    const { CheckoutRequestID, ResultCode, ResultDesc, CallbackMetadata } = callback;
    console.log("[MPesa Callback] CheckoutRequestID:", CheckoutRequestID, "| ResultCode:", ResultCode, "| ResultDesc:", ResultDesc);
    if (!CheckoutRequestID) return;

    const sale = await Sale.findOne({ mpesaCheckoutRequestId: CheckoutRequestID });
    if (!sale) {
      console.warn("[MPesa Callback] No sale found for CheckoutRequestID:", CheckoutRequestID);
      return;
    }
    if (sale.status !== "pending") {
      console.warn("[MPesa Callback] Sale already processed (status:", sale.status, ") — skipping. CheckoutRequestID:", CheckoutRequestID);
      return;
    }
    console.log("[MPesa Callback] Matched sale:", String(sale._id), "| receiptId:", sale.receiptId);

    const io = req.app.get("io");

    if (ResultCode === 0) {
      // ── Payment succeeded ─────────────────────────────────────────
      const metaItems         = CallbackMetadata?.Item || [];
      const mpesaReceiptNumber = String(metaItems.find(i => i.Name === "MpesaReceiptNumber")?.Value || "");
      const paidAmount         = metaItems.find(i => i.Name === "Amount")?.Value || 0;

      console.log("[MPesa Callback] Payment SUCCESS — MpesaReceiptNumber:", mpesaReceiptNumber, "| Amount:", paidAmount);

      sale.status = "confirmed";
      sale.paymentInfo.mpesaReceiptNumber = mpesaReceiptNumber;
      await sale.save();
      console.log("[MPesa Callback] Sale saved as confirmed:", String(sale._id));

      // Fire-and-forget SMS receipt — never blocks callback response
      sendSmsReceipt(sale.paymentInfo.mpesaPhone, {
        store:              sale.store,
        receiptId:          sale.receiptId,
        itemCount:          sale.items.length,
        finalTotal:         sale.paymentInfo.finalTotal ?? sale.total,
        mpesaReceiptNumber,
        date:               sale.date,
      }).catch(err => console.error('[SMS] Uncaught error:', err.message))

      if (io) {
        // Notify the specific cashier who initiated this sale
        io.to(String(sale.cashierId)).emit("mpesa_result", {
          checkoutRequestId: CheckoutRequestID,
          status:            "success",
          mpesaReceiptNumber,
          amount:            paidAmount,
          sale:              sale.toObject(),
        });
        io.emit("productsUpdated");
        io.emit("sync_system_data");
      }

    } else {
      // ── Payment failed — restock all items ────────────────────────
      console.log("[MPesa Callback] Payment FAILED — ResultCode:", ResultCode, "| ResultDesc:", ResultDesc, "| Restocking", sale.items.length, "item(s)");
      for (const item of sale.items) {
        await Product.findByIdAndUpdate(
          item.productId,
          { $inc: { stock: item.qty } }
        );
      }

      sale.status = "failed";
      await sale.save();
      console.log("[MPesa Callback] Sale saved as failed:", String(sale._id));

      if (io) {
        io.to(String(sale.cashierId)).emit("mpesa_result", {
          checkoutRequestId: CheckoutRequestID,
          status:            "failed",
          resultCode:        ResultCode,
          message:           getResultMessage(ResultCode, ResultDesc),
        });
        io.emit("productsUpdated");
      }
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

module.exports = router;
