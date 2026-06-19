const express = require("express");

// Minimal Express app for tests — no env guards, no mongoose.connect(), no scheduler.
// Routes are identical to production; only the server bootstrap is omitted.
function createApp() {
  const app = express();
  app.use(express.json());

  // No-op Socket.IO stub so routes can call io.emit() / io.to().emit() safely.
  const mockIo = {
    emit: () => {},
    to: () => ({ emit: () => {} }),
  };
  app.set("io", mockIo);

  app.use("/api/auth", require("../../routes/auth"));
  app.use("/api/sales", require("../../routes/sales"));

  return app;
}

module.exports = createApp;
