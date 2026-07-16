const mongoose = require("mongoose");

// Fixed, deterministic tenant ID shared by the whole test suite. Most tests
// don't exercise cross-tenant isolation itself — they just need a real,
// non-null tenantId flowing through so required:true validation and
// tenant-scoped queries behave the way they will in production, instead of
// every seeded document/JWT silently carrying tenantId: null.
//
// Tests that specifically exercise cross-tenant isolation (§10's two-tenant
// isolation test) should create and use their own second tenantId
// explicitly — this constant is the default single tenant, not a stand-in
// for real multi-tenant test coverage.
const TEST_TENANT_ID = new mongoose.Types.ObjectId("000000000000000000000001");

module.exports = { TEST_TENANT_ID };
