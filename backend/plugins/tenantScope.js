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
//
// ── 2a-5 — exemption model (two tiers, do not conflate them) ──────────
// 1. Model-level, permanent: a model not in SCOPED_MODEL_NAMES (today, only
//    Tenant) structurally never has a tenantId — every hook below skips
//    silently for such models. Not a per-call judgment call.
// 2. Query/document-level, per-call, explicit: a specific call site on a
//    SCOPED model that is intentionally global (login establishing tenant,
//    the mpesa webhook deriving tenant post-hoc, setup bootstrap before any
//    tenant exists). Opt out via .setOptions({ skipTenantScope: "reason" })
//    on a query, or doc.$locals.skipTenantScope = "reason" before .save()/
//    .deleteOne(). The reason MUST be a non-empty string — this is required,
//    not optional, so every exemption is self-documenting and greppable
//    (`grep -rn skipTenantScope`). A malformed opt-out (e.g. `true` instead
//    of a reason) is treated as NOT exempt and still warns/throws.

// The 20 business-data models scoped by this plugin (deliberately excludes
// Tenant itself — a tenant doesn't belong to a tenant). Exported so scripts
// like the Phase 1 migration reuse this exact list instead of duplicating it.
const SCOPED_MODEL_NAMES = [
  "User", "Store", "Product", "Category", "Sale", "Customer", "Supplier",
  "PurchaseOrder", "Repayment", "ApprovalLog", "Expense", "ExpiredStock",
  "PettyCash", "SupplierPayment", "Archive", "VoidRequest", "Return",
  "Message", "WeighBarcodeLog", "Setting",
];

// Query-context methods: pre-hook receives the Query as `this`.
const SCOPED_QUERY_METHODS = [
  "find",
  "findOne",
  "findOneAndUpdate",
  "findOneAndDelete",
  "findOneAndReplace",
  "countDocuments",
  "updateMany",
  "updateOne",
  "deleteMany",
  "deleteOne",
  "distinct",
];

function hasTenantFilter(query) {
  const conditions = query.getQuery ? query.getQuery() : {};
  return Object.prototype.hasOwnProperty.call(conditions, "tenantId");
}

// Returns the reason string if this query carries a valid explicit opt-out,
// otherwise null (including the malformed case — no reason, no exemption).
function explicitQueryReason(query) {
  const opts = query.getOptions ? query.getOptions() : {};
  const reason = opts.skipTenantScope;
  return typeof reason === "string" && reason.trim() ? reason : null;
}

function explicitDocReason(doc) {
  const reason = doc.$locals && doc.$locals.skipTenantScope;
  return typeof reason === "string" && reason.trim() ? reason : null;
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

  // Mongoose 9 dropped the callback-style `next` argument for query/aggregate/
  // insertMany middleware — hooks are plain functions now (sync, or async
  // returning a promise Mongoose awaits). Matches this codebase's existing
  // convention, e.g. `pre("save", function () {...})` in User.js/PettyCash.js.
  SCOPED_QUERY_METHODS.forEach((method) => {
    schema.pre(method, function () {
      const runtimeModelName = this.model?.modelName || modelName;
      if (!SCOPED_MODEL_NAMES.includes(runtimeModelName)) return; // tier 1 — model exempt
      if (hasTenantFilter(this)) return;
      if (explicitQueryReason(this)) return; // tier 2 — explicit opt-out
      warnMissingTenant(runtimeModelName, method);
    });
  });

  // deleteOne also has a document-context form (doc.deleteOne()), which is a
  // SEPARATE hook registration from the query-context form above — Mongoose
  // does not fire one for the other. Existing call sites (pettyCash.js,
  // purchaseOrders.js) operate on documents already fetched via a
  // tenant-scoped findOne, so this should be a no-op in practice; kept for
  // defense-in-depth against future call sites that don't hold that invariant.
  schema.pre("deleteOne", { document: true, query: false }, function () {
    const runtimeModelName = this.constructor?.modelName || modelName;
    if (!SCOPED_MODEL_NAMES.includes(runtimeModelName)) return;
    if (this.tenantId) return;
    if (explicitDocReason(this)) return;
    warnMissingTenant(runtimeModelName, "deleteOne (document)");
  });

  // save() has no query filter to inspect — check tenantId directly on the
  // document instance. Gated on SCOPED_MODEL_NAMES so Tenant's own .save()
  // (tenant onboarding) is never flagged — it structurally has no tenantId.
  schema.pre("save", function () {
    const runtimeModelName = this.constructor?.modelName || modelName;
    if (!SCOPED_MODEL_NAMES.includes(runtimeModelName)) return;
    if (this.tenantId) return;
    if (explicitDocReason(this)) return;
    warnMissingTenant(runtimeModelName, "save");
  });

  // insertMany's pre-hook receives the docs array directly as the first
  // argument (verified empirically against this Mongoose version — no `next`
  // callback, unlike older Mongoose). Opt out per-call via
  // Model.insertMany(docs, { skipTenantScope: "reason" }) — the second
  // argument Mongoose passes through as `opts` here.
  schema.pre("insertMany", function (docs, opts) {
    const runtimeModelName = modelName; // insertMany hook has no query/doc `this` to read the live model off of
    if (!SCOPED_MODEL_NAMES.includes(runtimeModelName)) return;
    const validReason = opts && typeof opts.skipTenantScope === "string" && opts.skipTenantScope.trim();
    if (validReason) return;
    const list = Array.isArray(docs) ? docs : [];
    const allScoped = list.length > 0 && list.every((d) => d && d.tenantId);
    if (!allScoped) warnMissingTenant(runtimeModelName, "insertMany");
  });

  schema.pre("aggregate", function () {
    const runtimeModelName = (this.model && this.model())?.modelName || modelName;
    if (!SCOPED_MODEL_NAMES.includes(runtimeModelName)) return;
    const pipeline = this.pipeline();
    const firstMatch = pipeline.find((stage) => stage && stage.$match);
    const scoped = firstMatch && Object.prototype.hasOwnProperty.call(firstMatch.$match, "tenantId");
    if (scoped) return;
    const opts = this.options || {};
    if (typeof opts.skipTenantScope === "string" && opts.skipTenantScope.trim()) return;
    warnMissingTenant(runtimeModelName, "aggregate");
  });
}

// Register globally so every schema compiled after this module is first
// required gets the field + hooks automatically — this file must be
// require()'d before any model file, in both server.js and the test harness.
mongoose.plugin(tenantScopePlugin);

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
