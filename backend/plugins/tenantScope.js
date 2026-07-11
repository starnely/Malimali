const mongoose = require("mongoose");

// ── Phase 0 — SHADOW MODE ─────────────────────────────────────────────
// This plugin only WARNS about queries missing a tenantId filter; it never
// throws and never alters a query. It exists to (1) add the tenantId field
// to every schema centrally, and (2) build an audit trail of every call
// site that will need a real tenant filter once Phase 2a flips this from
// warn -> throw. Zero behavior change to any existing route.
//
// Known, documented limits of this hook-based approach (do not "fix" these
// by trying to make the hooks smarter — they need explicit per-call-site
// handling in Phase 2a instead):
//   - .populate() issues a secondary query that does not pass through these
//     hooks; each populate() call site will need its own tenant match.
//   - bulkWrite() does not run Mongoose document/query middleware at all.
//   - Raw driver access (Model.collection.<op>) bypasses Mongoose entirely.

const SCOPED_METHODS = [
  "find",
  "findOne",
  "findOneAndUpdate",
  "findOneAndDelete",
  "countDocuments",
  "updateMany",
  "deleteMany",
];

function hasTenantFilter(query) {
  const conditions = query.getQuery ? query.getQuery() : {};
  return Object.prototype.hasOwnProperty.call(conditions, "tenantId");
}

function warnMissingTenant(modelName, method) {
  console.warn(`[tenantScope:SHADOW] ${modelName}.${method} called with no tenantId filter`);
}

function tenantScopePlugin(schema, options = {}) {
  const modelName = options.modelName || "UnknownModel";

  // Additive, optional field — no `required`, no `unique`, no `default`.
  // Every existing document will have tenantId: undefined until Phase 1's backfill.
  schema.add({
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      index: true,
    },
  });

  // Mongoose 9 dropped the callback-style `next` argument for query/aggregate
  // middleware — hooks are plain functions now (sync, or async returning a
  // promise Mongoose awaits). Matches this codebase's existing convention,
  // e.g. `pre("save", function () {...})` in User.js/PettyCash.js.
  SCOPED_METHODS.forEach((method) => {
    schema.pre(method, function () {
      if (!hasTenantFilter(this)) {
        warnMissingTenant(this.model?.modelName || modelName, method);
      }
    });
  });

  schema.pre("aggregate", function () {
    const pipeline = this.pipeline();
    const firstMatch = pipeline.find((stage) => stage && stage.$match);
    const scoped = firstMatch && Object.prototype.hasOwnProperty.call(firstMatch.$match, "tenantId");
    if (!scoped) {
      warnMissingTenant(modelName, "aggregate");
    }
  });
}

// Register globally so every schema compiled after this module is first
// required gets the field + hooks automatically — this file must be
// require()'d before any model file, in both server.js and the test harness.
mongoose.plugin(tenantScopePlugin);

// ── req.models building block (not wired into the request pipeline yet) ──
// Phase 2a will attach `req.models = getScopedModels(req.tenantId)` via
// Express middleware, once authMiddleware actually populates req.tenantId
// from a real JWT claim. Exported now so it exists, is unit-testable in
// isolation, and needs no further design work when that phase starts.
// The 20 business-data models scoped by this plugin (deliberately excludes
// Tenant itself — a tenant doesn't belong to a tenant). Exported so scripts
// like the Phase 1 migration reuse this exact list instead of duplicating it.
const SCOPED_MODEL_NAMES = [
  "User", "Store", "Product", "Category", "Sale", "Customer", "Supplier",
  "PurchaseOrder", "Repayment", "ApprovalLog", "Expense", "ExpiredStock",
  "PettyCash", "SupplierPayment", "Archive", "VoidRequest", "Return",
  "Message", "WeighBarcodeLog", "Setting",
];

function getScopedModels(tenantId) {
  const wrapped = {};
  for (const name of SCOPED_MODEL_NAMES) {
    const Model = mongoose.models[name];
    if (!Model) continue; // model not yet required/compiled in this process

    wrapped[name] = {
      find: (filter = {}) => Model.find({ ...filter, tenantId }),
      findOne: (filter = {}) => Model.findOne({ ...filter, tenantId }),
      countDocuments: (filter = {}) => Model.countDocuments({ ...filter, tenantId }),
      create: (doc) => Model.create({ ...doc, tenantId }),
      updateMany: (filter = {}, update) => Model.updateMany({ ...filter, tenantId }, update),
      deleteMany: (filter = {}) => Model.deleteMany({ ...filter, tenantId }),
    };
  }
  return wrapped;
}

module.exports = { tenantScopePlugin, getScopedModels, SCOPED_MODEL_NAMES };
