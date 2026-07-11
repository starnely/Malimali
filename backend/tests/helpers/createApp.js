const express = require("express");

// Phase 0 of multi-tenant conversion — must run before any model file is required
// (route requires below pull in models internally), so the plugin registers before
// any schema compiles.
require("../../plugins/tenantScope");

// Minimal Express app for tests — no env guards, no mongoose.connect(), no scheduler.
// Routes are identical to production; only the server bootstrap is omitted.
function createApp() {
  const app = express();
  app.use(express.json());

  // No-op Socket.IO stub so routes can call io.emit() / io.to(...).to(...).emit()
  // safely. Real Socket.IO's BroadcastOperator.to() returns another
  // BroadcastOperator (see node_modules/socket.io/dist/broadcast-operator.d.ts),
  // so chained .to().to().to() calls are valid production usage — this
  // self-referencing object mirrors that so the mock supports unlimited chaining
  // instead of only one level.
  const chainableEmitter = { to: () => chainableEmitter, emit: () => {} };
  const mockIo = {
    emit: () => {},
    to: () => chainableEmitter,
  };
  app.set("io", mockIo);

  app.use("/api/auth", require("../../routes/auth"));
  app.use("/api/sales", require("../../routes/sales"));
  app.use("/api/products", require("../../routes/products"));
  app.use("/api/weigh-station", require("../../routes/weighStation"));
  app.use("/api/purchase-orders", require("../../routes/purchaseOrders"));
  app.use("/api/returns", require("../../routes/returns"));
  app.use("/api/customers", require("../../routes/customers"));
  app.use("/api/expired", require("../../routes/expiredStock"));
  app.use("/api/expenses", require("../../routes/expenses"));
  app.use("/api/petty-cash", require("../../routes/pettyCash"));
  app.use("/api/categories", require("../../routes/categories"));
  app.use("/api/suppliers", require("../../routes/suppliers"));
  app.use("/api/stores", require("../../routes/stores"));
  app.use("/api/archives", require("../../routes/archives"));
  app.use("/api/messages", require("../../routes/messages"));
  app.use("/api/setup", require("../../routes/setup"));
  app.use("/api/mpesa", require("../../routes/mpesa"));

  return app;
}

module.exports = createApp;
