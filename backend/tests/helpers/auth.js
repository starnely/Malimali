const jwt = require("jsonwebtoken");

// Mint a token directly — avoids a round-trip through /api/auth/login in
// every test that just needs an authenticated request.
function makeToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "1h" });
}

module.exports = { makeToken };
