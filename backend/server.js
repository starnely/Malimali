const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const path = require("path");
const fs = require("fs");
const { Server } = require("socket.io");
require("dotenv").config();

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
const ALLOWED_ORIGIN = process.env.FRONTEND_URL || "*";

app.use(cors({ origin: ALLOWED_ORIGIN, credentials: true }));
app.use(require("helmet")({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ── 4. DATABASE ──────────────────────────────────────────────────────
mongoose.connect(MONGO_URI)
  .then(() => console.log("✅ MongoDB connected successfully"))
  .catch(err => { console.error("❌ MongoDB connection failed:", err.message); process.exit(1); });

// ── 5. HTTP SERVER + SOCKET.IO ───────────────────────────────────────
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => { console.log(`🚀 Server running on port ${PORT}`); });

const io = new Server(server, {
  cors: { origin: ALLOWED_ORIGIN, methods: ["GET", "POST", "PUT", "PATCH", "DELETE"] }
});

app.set("io", io);

// ── 6. SOCKET EVENTS ─────────────────────────────────────────────────
io.on("connection", (socket) => {
  console.log(`🔌 Socket connected: ${socket.id}`);

  socket.on("join-room", (room) => { if (room) { socket.join(room); console.log(`📦 Socket ${socket.id} joined room: ${room}`); } });
  socket.on("join-owner-room", () => { socket.join("owner"); console.log(`👑 Socket ${socket.id} joined owner room`); });
  socket.on("join", (room) => { if (room) { socket.join(room); console.log(`📦 Socket ${socket.id} joined: ${room}`); } });
  socket.on("shift-closed", (data) => {
    console.log(`📢 Shift closed: ${data.employeeName || "Unknown"}`);

    // Debug — see who is in the owner room
    const ownerRoom = io.sockets.adapter.rooms.get("owner");
    console.log(`👑 Owner room has ${ownerRoom ? ownerRoom.size : 0} socket(s):`, ownerRoom);

    io.to("owner").emit("adminShiftNotification", {
      employeeName: data.employeeName || "Unknown",
      time: data.time || new Date().toLocaleTimeString(),
      revenue: data.revenue || 0,
      store: data.store || "",
    });
  });
  socket.on("disconnect", () => { console.log(`🔌 Socket disconnected: ${socket.id}`); });
});

// ── 7. ROUTES ────────────────────────────────────────────────────────
app.use("/api/setup", require("./routes/setup"));
app.use("/api/auth", require("./routes/auth"));
app.use("/api/products", require("./routes/products"));
app.use("/api/sales", require("./routes/sales"));
app.use("/api/returns", require("./routes/returns"));
app.use("/api/archives", require("./routes/archives"));
app.use("/api/stockin", require("./routes/stockin"));
app.use("/api/categories", require("./routes/categories"));
app.use("/api/suppliers", require("./routes/suppliers"));
app.use("/api/stores", require("./routes/stores"));
app.use("/api/expired", require("./routes/expiredStock"));
app.use("/api/messages", require("./routes/messages"));
app.use("/api/print", require("./routes/print"));
app.use("/api/customers", require("./routes/customers"));
app.use("/api/weigh-station", require("./routes/weighStation"));

// ── Phase 6 ──────────────────────────────────────────────────────────
require("./models/SupplierPayment");
app.use("/api/purchase-orders", require("./routes/purchaseOrders"));
app.use("/api/expenses", require("./routes/expenses"));
app.use("/api/petty-cash", require("./routes/pettyCash"));

// ── 8. STARTUP: AUTO OVERDUE CHECK ───────────────────────────────────
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

  scheduleAutoExpiryCheck();
});

// ── 9. MIDNIGHT SCHEDULER ────────────────────────────────────────────
// Runs at 23:59 EAT every day:
//   a) Auto-expire products
//   b) Auto-close any unclosed petty cash records
//   c) Flag overdue customers
function scheduleAutoExpiryCheck() {
  const now = new Date();

  // Target: 23:59:00 today (server local time)
  // Your server runs in EAT (+3) based on your existing code pattern
  const target = new Date();
  target.setHours(23, 59, 0, 0);

  // If 23:59 already passed today, schedule for tomorrow
  let msUntilTarget = target - now;
  if (msUntilTarget <= 0) msUntilTarget += 24 * 60 * 60 * 1000;

  setTimeout(async () => {

    // ── a) AUTO-EXPIRE PRODUCTS ───────────────────────────────────────
    try {
      console.log("⏰ Midnight: running auto-expiry check...");

      const Product = require("./models/Product");
      const ExpiredStock = require("./models/ExpiredStock");
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const expiredProducts = await Product.find({
        expiryDate: { $lte: today },
        isExpired: { $ne: true },
        stock: { $gt: 0 }
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
          quantity: product.stock,
          buyPrice: product.buyPrice,
          totalLoss,
          expiryDate: product.expiryDate,
          processedBy: "System (Midnight Auto-Check)",
          notes: "Automatically moved at midnight expiry check",
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

    // Schedule again for tomorrow
    scheduleAutoExpiryCheck();

  }, msUntilTarget);

  const minutesUntil = Math.round(msUntilTarget / 1000 / 60);
  console.log(`⏰ Midnight scheduler set — runs in ${minutesUntil} minute(s)`);
}

// ── 10. GLOBAL ERROR HANDLER ─────────────────────────────────────────
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

// ── 11. GRACEFUL SHUTDOWN ────────────────────────────────────────────
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
