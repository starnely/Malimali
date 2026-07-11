const express = require("express");
const https   = require("https");
const http    = require("http");
const cors = require("cors");
const mongoose = require("mongoose");
const path = require("path");
const fs = require("fs");
const jwt = require("jsonwebtoken");
const { Server } = require("socket.io");
require("dotenv").config();

// Phase 0 of multi-tenant conversion — registers the tenantId field + shadow-mode
// scoping hooks on every schema. Must run before any model file is required.
require("./plugins/tenantScope");

const app = express();

// ── 1. ENVIRONMENT GUARD ─────────────────────────────────────────────
const MONGO_URI = process.env.MONGO_URI;
const JWT_SECRET = process.env.JWT_SECRET;
const ACTIVATION_CODE = process.env.ACTIVATION_CODE;

if (!MONGO_URI) { console.error("❌ CRITICAL: MONGO_URI is not defined in .env"); process.exit(1); }
if (!JWT_SECRET) { console.error("❌ CRITICAL: JWT_SECRET is not defined in .env"); process.exit(1); }
if (!ACTIVATION_CODE) { console.error("❌ CRITICAL: ACTIVATION_CODE is not defined in .env"); process.exit(1); }

// ── 2. DIRECTORY GUARD ───────────────────────────────────────────────
const requiredDirectories = [
  path.join(__dirname, "public"),
  path.join(__dirname, "public", "uploads"),
  path.join(__dirname, "public", "uploads", "logo"),
  path.join(__dirname, "public", "uploads", "invoices"),
];

requiredDirectories.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`📁 Created directory: ${dir}`);
  }
});

// ── 3. MIDDLEWARE ────────────────────────────────────────────────────
if (!process.env.FRONTEND_URL) {
  console.error("❌ CRITICAL: FRONTEND_URL is not defined in .env");
  process.exit(1);
}
const ALLOWED_ORIGINS = process.env.FRONTEND_URL
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // allow requests with no Origin header (curl, Postman, server-to-server)
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
}));
app.use(require("helmet")({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ── 3b. HEALTH CHECK — no DB access, for platform uptime pings ────────
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

// ── 4. DATABASE ──────────────────────────────────────────────────────
mongoose.connect(MONGO_URI, {
  serverSelectionTimeoutMS: 5000,
  bufferCommands: false,
})
  .then(() => console.log("✅ MongoDB connected successfully"))
  .catch(err => { console.error("❌ MongoDB connection failed:", err.message); process.exit(1); });

// ── 5. HTTP(S) SERVER + SOCKET.IO ─────────────────────────────────────
// Render (and most PaaS hosts) terminate TLS at the platform level and hand
// this process plain HTTP — there's no local cert to bind to. Only use the
// local self-signed cert for local development.
const PORT = process.env.PORT || 5000;
const IS_PRODUCTION = process.env.NODE_ENV === "production" || !!process.env.RENDER;

let server;
if (IS_PRODUCTION) {
  server = http.createServer(app);
  server.listen(PORT, () => { console.log(`🚀 Server running on port ${PORT} (HTTP — TLS terminated by platform)`); });
} else {
  const httpsOptions = {
    key:  fs.readFileSync(path.resolve(__dirname, '../frontend/malimali-system/certs/key.pem')),
    cert: fs.readFileSync(path.resolve(__dirname, '../frontend/malimali-system/certs/cert.pem')),
  };
  server = https.createServer(httpsOptions, app);
  server.listen(PORT, () => { console.log(`🚀 Server running on port ${PORT} (HTTPS)`); });
}

const io = new Server(server, {
  cors: { origin: ALLOWED_ORIGINS, methods: ["GET", "POST", "PUT", "PATCH", "DELETE"] }
});

app.set("io", io);

// ── 6. SOCKET AUTH MIDDLEWARE ─────────────────────────────────────────
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error("Authentication required."));
  try {
    socket.user = jwt.verify(token, process.env.JWT_SECRET);
    // Phase 2a-1 — additive only, not read anywhere yet (Socket.IO tenant
    // room scoping is Phase 2b).
    socket.tenantId = socket.user.tenantId || null;
    next();
  } catch {
    next(new Error("Invalid or expired token."));
  }
});

// ── 6. SOCKET EVENTS ─────────────────────────────────────────────────
io.on("connection", (socket) => {
  console.log(`🔌 Socket connected: ${socket.id}`);

  socket.on("join-room", (room) => { if (room) { socket.join(room); console.log(`📦 Socket ${socket.id} joined room: ${room}`); } });
  socket.on("join-owner-room", () => {
    if (socket.user?.role !== "owner") return;
    socket.join("owner");
    console.log(`👑 Socket ${socket.id} joined owner room`);
  });
  socket.on("join-manager-room", () => {
    if (socket.user?.role !== "manager") return;
    socket.join("manager");
    if (socket.user.store) socket.join(`manager-${socket.user.store}`);
    console.log(`👔 Socket ${socket.id} joined manager room (store: ${socket.user.store || "none"})`);
  });
  socket.on("join-store-room", () => {
    if (!socket.user?.store) return;
    socket.join(`store-${socket.user.store}`);
    console.log(`🏪 Socket ${socket.id} joined store room: store-${socket.user.store}`);
  });
  socket.on("join", (room) => { if (room) { socket.join(room); console.log(`📦 Socket ${socket.id} joined: ${room}`); } });
  socket.on("shift-closed", (data) => {
    // Use the server-verified identity; never trust the client-supplied name.
    const employeeName = socket.user.name || socket.user.username || "Unknown";
    console.log(`📢 Shift closed: ${employeeName}`);
    const shiftStore = typeof data.store === "string" ? data.store : "";
    io.to("owner").to(`manager-${shiftStore}`).emit("adminShiftNotification", {
      employeeName,
      time: data.time || new Date().toLocaleTimeString(),
      revenue: typeof data.revenue === "number" ? data.revenue : 0,
      store: shiftStore,
    });
    // Confirm back to the closer themselves — adminShiftNotification only reaches others.
    socket.emit("shiftClosedConfirmation");
  });
  socket.on("disconnect", () => { console.log(`🔌 Socket disconnected: ${socket.id}`); });
});

// ── 7. ROUTES ────────────────────────────────────────────────────────
app.use("/api/setup", require("./routes/setup"));
app.use("/api/auth", require("./routes/auth"));
app.use("/api/products", require("./routes/products"));
app.use("/api/sales", require("./routes/sales"));
app.use("/api/returns", require("./routes/returns"));
app.use("/api/void-requests", require("./routes/voidRequests"));
app.use("/api/archives", require("./routes/archives"));
app.use("/api/categories", require("./routes/categories"));
app.use("/api/suppliers", require("./routes/suppliers"));
app.use("/api/stores", require("./routes/stores"));
app.use("/api/expired", require("./routes/expiredStock"));
app.use("/api/messages", require("./routes/messages"));
app.use("/api/print", require("./routes/print"));
app.use("/api/customers", require("./routes/customers"));
app.use("/api/weigh-station", require("./routes/weighStation"));

app.use("/api/mpesa", require("./routes/mpesa"));

// ── Phase 6 ──────────────────────────────────────────────────────────
require("./models/SupplierPayment");
app.use("/api/purchase-orders", require("./routes/purchaseOrders"));
app.use("/api/expenses", require("./routes/expenses"));
app.use("/api/petty-cash", require("./routes/pettyCash"));

// ── 8. STARTUP: OVERDUE CHECK + EXPIRY CATCH-UP ──────────────────────
mongoose.connection.once("open", async () => {
  try {
    const Customer = require("./models/Customer");
    const Sale = require("./models/Sale");
    const today = new Date().toISOString().split("T")[0];
    let flagged = 0;

    const customers = await Customer.find({ blacklisted: false });
    for (const customer of customers) {
      const sales = await Sale.find({
        "paymentInfo.customerId": customer._id,
        "paymentInfo.paymentMethod": "credit",
        voided: { $ne: true },
        returned: { $ne: true },
        "paymentInfo.promiseDate": { $lt: today, $gt: "" },
      });

      if (sales.length > 0) {
        const Repayment = require("./models/Repayment");
        const repayments = await Repayment.find({ customerId: customer._id });
        const totalCredit = sales.reduce((s, sale) => s + (sale.paymentInfo.finalTotal || sale.total), 0);
        const totalPaid = repayments.reduce((s, r) => s + r.amount, 0);
        const balance = Math.max(0, totalCredit - totalPaid);

        if (balance > 0 && !customer.overdue) {
          customer.overdue = true; await customer.save(); flagged++;
        } else if (balance === 0 && customer.overdue) {
          customer.overdue = false; await customer.save();
        }
      }
    }

    if (flagged > 0) console.log(`⚠️  Startup overdue check: ${flagged} customer(s) flagged as overdue.`);
    else console.log("✅ Startup overdue check complete: no new overdue customers.");

  } catch (err) {
    console.error("❌ Startup overdue check failed:", err.message);
  }

  // Catch-up: move any products that expired while the server was down.
  // Runs immediately so no product sits sellable past its expiry just because
  // the server restarted before tonight's midnight scheduler fires.
  try {
    await runExpiryCheck("System (Startup Catch-Up)", "Moved on server startup — expired during downtime");
  } catch (err) {
    console.error("❌ Startup expiry catch-up failed:", err.message);
  }

  scheduleAutoExpiryCheck();

  // ── M-PESA ORPHAN CLEANUP JOB ─────────────────────────────────────────
  // Every 45 s, find pending M-Pesa sales older than 90 s and query Safaricom
  // directly.  Resolves sales where the callback was silently dropped (e.g.
  // ngrok expiry).  Uses findOneAndUpdate with status:"pending" as the filter
  // so the update is a no-op if the real callback arrived in the interim —
  // prevents any double-processing race between the job and the live callback.
  const { queryStkStatus, getResultMessage: mpesaMsg } = require("./utils/mpesaClient");

  setInterval(async () => {
    try {
      const SaleM   = require("./models/Sale");
      const ProductM = require("./models/Product");
      const cutoff  = new Date(Date.now() - 90 * 1000);

      const pendingSales = await SaleM.find({
        status: "pending",
        mpesaCheckoutRequestId: { $nin: ["", null] },
        createdAt: { $lte: cutoff },
      }).lean();

      if (pendingSales.length === 0) return;
      console.log(`[MPesa Job] Querying ${pendingSales.length} orphaned pending sale(s)...`);

      for (const sale of pendingSales) {
        try {
          const { resultCode, resultDesc } = await queryStkStatus(sale.mpesaCheckoutRequestId);

          if (resultCode === 0) {
            // Payment confirmed — atomic claim (no-op if callback beat us here)
            const updated = await SaleM.findOneAndUpdate(
              { _id: sale._id, status: "pending" },
              { $set: { status: "confirmed" } }
            );
            if (updated) {
              console.log(`[MPesa Job] ✅ Confirmed orphaned sale: ${sale.receiptId}`);
              io.to(String(sale.cashierId)).emit("mpesa_result", {
                checkoutRequestId:  sale.mpesaCheckoutRequestId,
                status:             "success",
                mpesaReceiptNumber: "",
                sale:               { ...sale, status: "confirmed" },
              });
              io.emit("sync_system_data");
            }

          } else if (resultCode !== -1) {
            // Definitive failure — atomic claim, then restock
            const updated = await SaleM.findOneAndUpdate(
              { _id: sale._id, status: "pending" },
              { $set: { status: "failed" } }
            );
            if (updated) {
              for (const item of sale.items) {
                await ProductM.findByIdAndUpdate(item.productId, { $inc: { stock: item.qty } });
              }
              console.log(`[MPesa Job] ❌ Failed orphaned sale: ${sale.receiptId} | Code: ${resultCode}`);
              io.to(String(sale.cashierId)).emit("mpesa_result", {
                checkoutRequestId: sale.mpesaCheckoutRequestId,
                status:            "failed",
                resultCode,
                message:           mpesaMsg(resultCode, resultDesc),
              });
              io.emit("productsUpdated");
            }
          }
          // resultCode === -1: still in progress or query itself failed — leave as pending
        } catch (queryErr) {
          console.error(`[MPesa Job] Query error for sale ${sale._id}:`, queryErr.message);
        }
      }
    } catch (err) {
      console.error("[MPesa Job] Job error:", err.message);
    }
  }, 45 * 1000);
});

// ── 9. SHARED EXPIRY LOGIC ───────────────────────────────────────────
// Called from both the startup catch-up and the midnight scheduler so the
// logic (including the EAT-aware date boundary) is never duplicated.
async function runExpiryCheck(processedBy, note) {
  const Product = require("./models/Product");
  const ExpiredStock = require("./models/ExpiredStock");

  // Build "start of today in EAT (UTC+3)" regardless of the server OS timezone.
  // e.g. running at 23:59 EAT on 21 Jun → todayEATStr = "2026-06-21"
  //      → boundary = 2026-06-21T00:00:00+03:00 = 2026-06-20T21:00:00Z
  // A product with expiryDate = 2026-06-21T00:00:00Z (UTC midnight, as stored
  // by the frontend date-picker) satisfies $lte that boundary only on June 22.
  // Using the +03:00 literal fixes this: the boundary shifts to EAT midnight,
  // so a product stored as 2026-06-21T00:00:00+03:00 is caught on June 21.
  const nowEAT = new Date(Date.now() + 3 * 60 * 60 * 1000);
  const todayEATStr = nowEAT.toISOString().split("T")[0];
  const todayBoundary = new Date(todayEATStr + "T00:00:00+03:00");

  const expiredProducts = await Product.find({
    expiryDate: { $lte: todayBoundary },
    isExpired: { $ne: true },
    stock: { $gt: 0 },
  });

  const results = [];
  for (const product of expiredProducts) {
    const totalLoss = product.stock * product.buyPrice;
    await new ExpiredStock({
      productId: product._id,
      productName: product.name,
      category: product.category,
      supplier: product.supplier || "",
      store: product.store,
      batch: product.batch || "",
      unit: product.unit || "pcs",
      quantity: product.stock,
      buyPrice: product.buyPrice,
      totalLoss,
      expiryDate: product.expiryDate,
      processedBy,
      notes: note,
    }).save();
    await Product.findByIdAndUpdate(product._id, { $set: { stock: 0, isExpired: true } });
    results.push({ productName: product.name, quantity: product.stock, totalLoss });
    console.log(`🗑️  Auto-expired: ${product.name} — Loss: KSh ${totalLoss}`);
  }

  if (results.length > 0) {
    io.emit("productsUpdated");
    io.to("owner").emit("autoExpiredCheck", {
      moved: results.length, results, time: new Date().toLocaleTimeString(),
    });
    console.log(`✅ Auto-expiry complete: ${results.length} product(s) moved.`);
  } else {
    console.log("✅ Auto-expiry: no expired products found.");
  }
}

// ── 9b. AUTO-PO SUGGESTION JOB ──────────────────────────────────────
async function runAutoPoSuggestions(io) {
  const Product       = require("./models/Product");
  const Sale          = require("./models/Sale");
  const Supplier      = require("./models/Supplier");
  const PurchaseOrder = require("./models/PurchaseOrder");

  const flagged = await Product.find({ needsReorder: true }).lean();
  if (flagged.length === 0) {
    console.log("✅ Auto-PO: no products flagged for reorder.");
    return;
  }

  const eat30DaysAgo = new Date(Date.now() + 3 * 60 * 60 * 1000);
  eat30DaysAgo.setDate(eat30DaysAgo.getDate() - 30);
  const thirtyDaysAgoStr = eat30DaysAgo.toISOString().split("T")[0];

  // Group flagged products by store
  const byStore = {};
  for (const p of flagged) {
    (byStore[p.store] = byStore[p.store] || []).push(p);
  }

  let newPOCount = 0;

  for (const [store, storeProducts] of Object.entries(byStore)) {
    // Velocity aggregate for this store over the last 30 days
    const velocities = await Sale.aggregate([
      { $match: { store, status: "confirmed", voided: { $ne: true }, date: { $gte: thirtyDaysAgoStr } } },
      { $unwind: "$items" },
      { $match: { "items.voidStatus": { $ne: "voided" } } },
      { $group: {
        _id: "$items.productId",
        totalQty: { $sum: { $subtract: ["$items.qty", { $ifNull: ["$items.voidedQty", 0] }] } },
        saleDays: { $addToSet: "$date" },
      }},
    ]);
    const velMap = {};
    for (const v of velocities) velMap[String(v._id)] = v;

    // Calculate suggested quantities and update Product fields
    const bulkOps = [];
    for (const p of storeProducts) {
      const vel = velMap[String(p._id)];
      const reorderLevel = p.reorderLevel ?? 5;
      let suggestedQty, dailyVelocity, tier;

      if (vel && vel.saleDays.length >= 3) {
        dailyVelocity = vel.totalQty / 30;
        suggestedQty  = Math.ceil(Math.max(dailyVelocity * 14, reorderLevel * 2, 10));
        tier          = "velocity";
      } else {
        dailyVelocity = 0;
        suggestedQty  = Math.max(reorderLevel * 3, 20);
        tier          = "fallback";
      }

      p._suggestedQty = suggestedQty;
      p._tier         = tier;

      bulkOps.push({
        updateOne: {
          filter: { _id: p._id },
          update: { $set: { suggestedQty, dailyVelocity, velocityCalcAt: new Date(), velocityTier: tier } },
        },
      });
    }
    if (bulkOps.length > 0) await Product.bulkWrite(bulkOps);

    // Group products by supplier (supplierId → string name → unlinked bucket)
    const supplierGroups = {};
    for (const p of storeProducts) {
      let key;
      if (p.supplierId) {
        key = String(p.supplierId);
      } else if (p.supplier) {
        const sup = await Supplier.findOne({ name: p.supplier, isActive: { $ne: false } }).lean();
        key = sup ? String(sup._id) : `__name__${p.supplier}`;
      } else {
        key = "__unlinked__";
      }
      (supplierGroups[key] = supplierGroups[key] || []).push(p);
    }

    for (const [key, groupProducts] of Object.entries(supplierGroups)) {
      let supplierId = null, supplierName = "Unlinked Supplier", supplierPhone = "";

      if (!key.startsWith("__")) {
        const sup = await Supplier.findById(key).lean();
        if (sup) { supplierId = sup._id; supplierName = sup.name; supplierPhone = sup.phone || ""; }
      } else if (key.startsWith("__name__")) {
        supplierName = key.slice("__name__".length);
      }

      // Supplier-match clause reused in all PO queries for this group.
      // Matches by ObjectId when available, falls back to name so a key
      // change between runs (supplier archived/reactivated) doesn't cause misses.
      const supplierFilter = supplierId
        ? { $or: [{ supplierId }, { supplierName }] }
        : { supplierName };

      // ── Step 1: per-product coverage check ───────────────────────────
      // Only committed orders (sent / partial) count as "real" coverage.
      // Unsent drafts are not yet firm orders — we manage those below.
      const sentOrPartialPOs = await PurchaseOrder.find({
        store,
        status: { $in: ["sent", "partial"] },
        ...supplierFilter,
      }).select("items").lean();

      const coveredIds = new Set(
        sentOrPartialPOs.flatMap(po => (po.items || []).map(i => String(i.productId)))
      );

      // ── Step 2: filter to products not already on a committed order ───
      const uncovered = groupProducts.filter(p => !coveredIds.has(String(p._id)));

      if (uncovered.length === 0) {
        console.log(`⏭️  Auto-PO: all products for ${store} / ${supplierName} already on committed orders — skipping`);
        continue;
      }

      const items = uncovered.map(p => ({
        productId:   p._id,
        productName: p.name,
        unit:        p.unit || "pcs",
        qtyOrdered:  p._suggestedQty,
        unitCost:    p.buyPrice || 0,
      }));

      const noteLines = uncovered.map(p =>
        `${p.name}: ${p._tier === "velocity" ? "14-day velocity" : "Estimated (no sales history)"} → ${p._suggestedQty} ${p.unit || "pcs"}`
      ).join("\n");
      const notes = `[Auto-suggested ${new Date(Date.now() + 3*60*60*1000).toLocaleDateString("en-KE")}]\n${noteLines}`;

      // ── Step 3: upsert into the existing suggested draft, or create one ─
      // Targets only source:"suggested" drafts — never touches manual drafts.
      const existingDraft = await PurchaseOrder.findOne({
        store,
        status: "draft",
        source: "suggested",
        ...supplierFilter,
      });

      if (existingDraft) {
        existingDraft.items         = items;
        existingDraft.notes         = notes;
        existingDraft.supplierPhone = supplierPhone;
        await existingDraft.save();
        console.log(`🔄 Auto-PO: updated draft ${existingDraft.poNumber} for ${store} / ${supplierName} (${uncovered.length} item(s))`);
      } else {
        const po = new PurchaseOrder({
          supplierId, supplierName, supplierPhone, store, items, notes,
          source: "suggested",
          createdBy: "System (Auto-PO)",
        });
        await po.save();
        newPOCount++;
        console.log(`✨ Auto-PO: created ${po.poNumber} for ${store} / ${supplierName} (${uncovered.length} item(s))`);
      }
    }

    if (io && storeProducts.some(p => p._suggestedQty)) {
      io.to("owner").to(`manager-${store}`).emit("autoPOSuggested", { count: 1, store });
    }
  }

  console.log(`✅ Auto-PO: job complete — ${newPOCount} new PO(s) created.`);
}

// Expose on app so routes can trigger it on-demand (owner-only API + test button).
// Safe to leave in production — the endpoint is owner-gated and doubles as a
// manual "force-refresh suggestions" action that real owners may actually want.
app.set("runAutoPoSuggestions", runAutoPoSuggestions);

// ── 10. MIDNIGHT SCHEDULER ───────────────────────────────────────────
// Runs at 23:59 EAT every day:
//   a) Auto-expire products
//   b) Auto-close any unclosed petty cash records
//   c) Flag overdue customers
function scheduleAutoExpiryCheck() {
  const now = new Date();

  // Target: 23:59:00 EAT today — expressed as a UTC Date so the calculation
  // is correct regardless of what timezone the server OS runs in.
  const nowEAT = new Date(Date.now() + 3 * 60 * 60 * 1000);
  const todayEATStr = nowEAT.toISOString().split("T")[0];
  const target = new Date(todayEATStr + "T23:59:00+03:00");

  // If 23:59 EAT already passed today, schedule for tomorrow
  let msUntilTarget = target - now;
  if (msUntilTarget <= 0) msUntilTarget += 24 * 60 * 60 * 1000;

  setTimeout(async () => {

    // ── a) AUTO-EXPIRE PRODUCTS ───────────────────────────────────────
    try {
      console.log("⏰ Midnight: running auto-expiry check...");
      await runExpiryCheck(
        "System (Midnight Auto-Check)",
        "Automatically moved at midnight expiry check"
      );
    } catch (err) {
      console.error("❌ Auto-expiry check failed:", err.message);
    }

    // ── b) AUTO-CLOSE PETTY CASH ──────────────────────────────────────
    // Any petty cash record for TODAY that is still open gets
    // auto-closed using the expected (net) balance as closing float.
    // Marked as "System (Auto-Close)" so the owner knows no physical
    // count was done — matches industry standard behavior.
    try {
      console.log("⏰ Midnight: running petty cash auto-close...");

      const PettyCash = require("./models/PettyCash");

      // EAT date string for today
      const todayEAT = new Date(Date.now() + 3 * 60 * 60 * 1000)
        .toISOString().split("T")[0];

      const openRecords = await PettyCash.find({
        date: todayEAT,
        isClosed: false,
      });

      if (openRecords.length === 0) {
        console.log("✅ Petty cash auto-close: all records already closed.");
      } else {
        for (const record of openRecords) {
          record.isClosed = true;
          record.closingFloat = record.netBalance;   // use expected balance
          record.closedBy = "System (Auto-Close)";
          record.closedAt = new Date();
          record.notes = record.notes
            ? `${record.notes} | Auto-closed at midnight — no physical count`
            : "Auto-closed at midnight — no physical count performed";

          await record.save();

          console.log(
            `🔒 Auto-closed petty cash: ${record.store} ` +
            `(Balance: KSh ${record.netBalance?.toLocaleString()})`
          );

          // Notify owner so they know to verify tomorrow morning
          io.to("owner").emit("pettyCashAutoClosed", {
            store: record.store,
            date: record.date,
            closingFloat: record.netBalance,
            time: new Date().toLocaleTimeString(),
          });
        }

        console.log(`✅ Petty cash auto-close: ${openRecords.length} record(s) closed.`);
      }
    } catch (err) {
      console.error("❌ Petty cash auto-close failed:", err.message);
    }

    // ── c) MIDNIGHT OVERDUE CHECK ─────────────────────────────────────
    try {
      console.log("⏰ Midnight: running overdue customer check...");

      const Customer = require("./models/Customer");
      const Sale = require("./models/Sale");
      const Repayment = require("./models/Repayment");
      const todayStr = new Date().toISOString().split("T")[0];
      let overdueCount = 0;

      const allCustomers = await Customer.find({ blacklisted: false });
      for (const customer of allCustomers) {
        const cSales = await Sale.find({
          "paymentInfo.customerId": customer._id,
          "paymentInfo.paymentMethod": "credit",
          voided: { $ne: true },
          returned: { $ne: true },
        });
        const totalCredit = cSales.reduce((s, sale) => s + (sale.paymentInfo.finalTotal || sale.total), 0);
        const reps = await Repayment.find({ customerId: customer._id });
        const totalPaid = reps.reduce((s, r) => s + r.amount, 0);
        const balance = Math.max(0, totalCredit - totalPaid);
        const earliest = cSales.find(s => s.paymentInfo.promiseDate);
        const isOverdue = balance > 0 && earliest && earliest.paymentInfo.promiseDate < todayStr;

        if (isOverdue !== customer.overdue) {
          customer.overdue = isOverdue;
          await customer.save();
          if (isOverdue) overdueCount++;
        }
      }

      if (overdueCount > 0) {
        io.to("owner").emit("overdueCustomers", { count: overdueCount });
        console.log(`⚠️  Midnight overdue check: ${overdueCount} newly flagged.`);
      } else {
        console.log("✅ Midnight overdue check: no new overdue customers.");
      }
    } catch (err) {
      console.error("❌ Midnight overdue check failed:", err.message);
    }

    // ── d) AUTO-PO SUGGESTIONS ────────────────────────────────────────
    try {
      console.log("⏰ Midnight: running auto-PO suggestion job...");
      await runAutoPoSuggestions(io);
    } catch (err) {
      console.error("❌ Auto-PO suggestion job failed:", err.message);
    }

    // Schedule again for tomorrow
    scheduleAutoExpiryCheck();

  }, msUntilTarget);

  const minutesUntil = Math.round(msUntilTarget / 1000 / 60);
  console.log(`⏰ Midnight scheduler set — runs in ${minutesUntil} minute(s)`);
}

// ── 11. GLOBAL ERROR HANDLER ─────────────────────────────────────────
app.use((err, req, res, next) => {
  if (err.message && err.message.includes("Only JPEG")) {
    return res.status(400).json({ success: false, message: err.message });
  }
  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({ success: false, message: "File too large. Maximum size is 2MB." });
  }
  console.error("💥 Unhandled error:", err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: "An unexpected server error occurred.",
    error: err.message || "Internal server error",
  });
});

// ── 12. GRACEFUL SHUTDOWN ────────────────────────────────────────────
const gracefulExit = () => {
  console.log("\n🛑 Shutting down gracefully...");
  mongoose.connection.close(false).then(() => {
    console.log("🔒 MongoDB connection closed.");
    server.close(() => { console.log("👋 Server closed. Goodbye."); process.exit(0); });
  });
};

process.on("SIGINT", gracefulExit);
process.on("SIGTERM", gracefulExit);

module.exports = app;
