const jwt = require("jsonwebtoken");
const { TEST_TENANT_ID } = require("./tenant");

// Mint a token directly — avoids a round-trip through /api/auth/login in
// every test that just needs an authenticated request. Defaults tenantId to
// the shared test tenant (see ./tenant.js) so req.tenantId is never null in
// tests; pass an explicit tenantId in payload to override for isolation tests.
function makeToken(payload) {
  return jwt.sign({ tenantId: TEST_TENANT_ID, ...payload }, process.env.JWT_SECRET, { expiresIn: "1h" });
}

module.exports = { makeToken };
