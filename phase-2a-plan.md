# Phase 2a — Tenant Enforcement (design document)

Status: **DRAFT FOR REVIEW — no implementation started.**
Branch: `multi-tenant`. Builds on Phase 0 (`4fb40b5`, Tenant model + shadow-mode plugin) and Phase 1 (`d539054`, tenant-zero created, all 20 collections backfilled, verified 0 missing `tenantId` on the real database).

This file lives at the repo root (not `.claude/plans/`) specifically so it isn't overwritten by a future plan-mode session the way the original 8-section design doc was.

## 1. Purpose and framing

Phase 0 added the field. Phase 1 backfilled it. Phase 2a is where tenant isolation actually starts being *enforced* — required schema fields, fail-closed query hooks, per-tenant unique indexes, tenant identity flowing through auth and sockets, and every route actually filtering by it. This is the riskiest phase in the whole conversion: done wrong, it either (a) silently leaks data across tenants, or (b) throws 500s across the entire app the moment enforcement flips on. Both failure modes are why this is broken into small, independently-verifiable sub-phases rather than one cutover.

**The one fact that makes incremental rollout safe right now:** only one tenant (tenant-zero) exists. Every document in every collection already has the same `tenantId`. That means adding a `tenantId` filter to any query today is *behaviorally a no-op* — it narrows the result set to "everything," because everything already belongs to tenant-zero. This lets routes be migrated one at a time, verified against the existing 386-test suite plus manual spot checks, with zero risk of breaking real behavior, right up until the moment enforcement (`required: true` + plugin throw mode) is flipped on. That flip is the one genuinely risky moment, and it's sequenced last, deliberately.

## 2. Corrections to the original brief (verified against current code, not memory)

Two things in the original design/your message don't match what's actually in the codebase today — flagging before the plan builds on them:

- **No `bulkWrite` in `messages.js`.** Grepped the file directly — zero matches for "bulk". The only `bulkWrite` in the entire app is `server.js:430`, inside the reorder-suggestion job (`Product.bulkWrite(bulkOps)`, updating `suggestedQty`/`dailyVelocity`/`velocityCalcAt`/`velocityTier` per product). The plan below covers that one, not `messages.js`.
- **No "Business Code"/tenant-slug concept exists anywhere today.** Checked `routes/auth.js` and `authMiddleware.js` directly — login takes only `username`/`password`, the JWT payload is `{ id, role, name, store }` with no tenant field, and there is no business-code/slug input anywhere in the login flow. This isn't a matter of "reconnecting" an existing mechanism — building it is new backend *and* new frontend work (a pre-login screen doesn't exist yet). Flagged as an open scope question in §7.

## 3. Recommended sub-phase order (and why it differs from a flat checklist)

Two of the eight items you listed — flipping `required: true` and flipping the plugin to throw — are **enforcement**, not preparation. Both depend on every route already supplying/filtering `tenantId` correctly:

- `required: true` only validates on `.save()`/`.create()`. Flip it before every create path supplies `tenantId`, and every single document creation in the app starts failing validation immediately.
- Plugin throw-mode makes any query missing a `tenantId` filter throw. Flip it before every route is converted, and essentially every existing route breaks on its next request (all of them currently query without `tenantId`).

So the two "flags" everyone thinks of as the first step are actually the **last** step — a deliberate lockdown, gated behind 100% route completion, not an early safety measure. Recommended order:

| Sub-phase | What | Depends on | Risk | Rollback |
|---|---|---|---|---|
| 2a-1 | Thread `tenantId` through auth (JWT, `authMiddleware`, Socket.IO handshake) | Phase 1 done | Low | Revert JWT payload shape; additive only |
| 2a-2 | Per-tenant unique indexes (build → verify → drop) | none (data already consistent) | Medium | Old index still exists until explicitly dropped |
| 2a-3 | Route-by-route migration to tenant-scoped queries (the bulk of the work) | 2a-1 (needs `req.tenantId` to filter by) | Low per-route, given single-tenant no-op property | Per-route revert; suite + manual check after each |
| 2a-4 | Close the 3 known gaps (`.populate()`, the one `bulkWrite`, raw driver) | 2a-3 | Medium | Per-site revert |
| 2a-5 | **Lockdown**: `required: true` + plugin warn→throw | 2a-1 through 2a-4 all complete | **High** | Flip plugin back to warn; `required` needs a schema redeploy to undo |
| 2a-6 (a.k.a. 2b) | Socket.IO room scoping (real-time layer) | 2a-1 | Medium — see §6 for why this isn't purely cosmetic | Revert room names / emit scoping per event |

2a-6 is large enough (84 call sites) that I'd formally treat it as its own phase (2b) with its own sign-off, gated separately from the HTTP/DB lockdown in 2a-5 — see §6.

## 4. Auth, JWT, and Socket.IO handshake (2a-1)

Current state (verified):
- `routes/auth.js` signs `{ id, role, name, store }`, no tenant field.
- `authMiddleware.js` does `req.user = decoded` verbatim — nothing tenant-related attached.
- Socket.IO handshake (`server.js:104-113`) reads `socket.handshake.auth.token`, verifies it, attaches decoded payload to `socket.user` — same shape, no tenant field.

Change: add `tenantId` to the JWT payload at sign-time (resolved from `User.tenantId` — already populated by Phase 1 for every existing user), have `authMiddleware` attach `req.tenantId = decoded.tenantId`, and have the Socket.IO handshake middleware do the equivalent for `socket.tenantId`. This is purely additive — nothing reads `req.tenantId` yet until 2a-3 migrates routes to use it.

**Risk: Low.** Verification: existing auth/JWT tests in `backend/tests/routes/auth.test.js` plus a new assertion that a fresh login's token decodes with the correct `tenantId`.

## 5. Per-tenant unique indexes (2a-2)

Full inventory (verified by reading all 20 model files directly):

| Model | Current unique constraint | New compound | Sparse/partial today | Notes |
|---|---|---|---|---|
| User | `username`, `email` (separate) | `{tenantId, username}`, `{tenantId, email}` | no | |
| Store | `name` | `{tenantId, name}` | no | |
| Setting | `settingKey` (default `"global"`) | `{tenantId, settingKey}` | no | **Every tenant's Setting doc defaults to the same `settingKey` value — without this fix, tenant #2's first Setting write would collision-fail against tenant-zero's.** |
| Supplier | `company` | `{tenantId, company}` | sparse | keep sparse |
| Product | `barcode`, `pluNumber` (separate) | `{tenantId, barcode}`, `{tenantId, pluNumber}` | sparse | keep sparse |
| Sale | `receiptId` | `{tenantId, receiptId}` | sparse | keep sparse |
| PurchaseOrder | `poNumber` | `{tenantId, poNumber}` | no | |
| Category | `{name, store}` | `{tenantId, name, store}` | no | already compound |
| PettyCash | `{store, date}` | `{tenantId, store, date}` | no | already compound |
| Archive | `{employeeName, date}` | `{tenantId, employeeName, date}` | no | already compound |
| Customer | `{phone, store}` | `{tenantId, phone, store}` | partialFilterExpression `phone > ""` | keep partial filter |

Repayment, ApprovalLog, ExpiredStock, VoidRequest, Return have no unique constraints today — nothing to convert, they just get scoped in 2a-3 like everything else.

**Sequencing per model (safe build → verify → drop):**
1. `db.collection.createIndex({tenantId:1, <field>:1}, {unique:true, background:true, ...same sparse/partial options as today})` — additive, doesn't touch the old index.
2. Verify the new index built successfully and reports the expected document count (`db.collection.getIndexes()`).
3. Confirm no app code depends on the *old* index's specific name (Mongoose default index names are derived from field names — double-check nothing references the index by name directly; unlikely but worth the check).
4. Drop the old single-field/compound unique index.
5. Re-run `npm test` — the in-memory replica set rebuilds indexes from the schema on every test run, so this also serves as a regression check that the new index definition doesn't reject anything the old one allowed.

**Risk: Medium** (index builds on a live cluster are usually safe with `background:true`, but this is exactly the kind of step that's cheap in rehearsal — small dummy dataset — and untested at real scale until go-live with a real tenant's data volume).

**Why this is safe today specifically:** uniqueness of `field` alone (today) mathematically implies uniqueness of `(tenantId, field)` when every document shares the same `tenantId` — so building the new compound index against current data cannot fail on a duplicate-key error. This guarantee disappears the moment a second tenant exists, which is fine — a second tenant's data is new and would naturally satisfy the compound constraint from the start.

## 6. Socket.IO (2a-6 / proposed 2b)

Verified counts: **31 fully-global `io.emit()` calls** (no `.to()` at all — reaches every connected client regardless of future tenant) and **~53 `io.to(...).emit()` calls** scoped only by role/store (`"owner"`, `` `manager-${store}` ``, per-user rooms) — none tenant-aware.

This is not purely cosmetic. Some of these carry real business data directly in the payload — e.g. `saleVoided` (receiptId, cashier, total), `newSale`, `mpesa_result`, `repaymentRecorded`. Once a second tenant exists, every one of those global `io.emit()` calls would push tenant A's sale/payment data straight into tenant B's connected browser tabs, bypassing the HTTP layer entirely — a real leak, not just noise. The "go refetch everything" signals (`sync_system_data`, `productsUpdated`) are lower-severity (no payload data, just a nudge to re-fetch through the properly-scoped HTTP routes) but still cross-tenant noise worth fixing.

Proposed approach: every socket joins a `tenant-{tenantId}` room on connect (alongside its existing role/store rooms), and every emit — global and room-scoped alike — gets `.to(`tenant-${tenantId}`)` added as the outermost scope. **Confirmed with user: split out as its own Phase 2b**, with its own review, separate from 2a's data-layer work — but the go-live gate for onboarding a real second tenant requires **both** 2a and 2b complete, since the data-carrying emits are a genuine isolation gap on their own.

**Risk: Medium.** Verification: a two-socket integration test (two clients, two tenants, assert client B never receives an event fired for tenant A).

## 7. Login / tenant resolution / pre-login endpoints — open question

You referred to this as the "Business Code/slug approach" from the original design — confirmed there is no existing mechanism to adapt; this is new. Once `User.username` becomes tenant-scoped (§5), a username alone is no longer globally unique, so login needs a second signal to know which tenant to check against. Two shapes this could take:

- **(a) Business code on the login form** — user types a short business code/slug alongside username/password; server resolves `Tenant.findOne({slug})` first, then checks `User.findOne({tenantId, username})`. Matches your phrasing; requires a new frontend pre-login field/screen.
- **(b) Subdomain-based** — `acme.yourapp.com` resolves the tenant from the hostname before the login form even loads; no extra field for the user to type, but requires DNS/wildcard-subdomain infrastructure that doesn't exist yet (single Render/Vercel deployment today, per earlier session findings).

**Confirmed with user: option (a), Business Code/slug on the login form.** No infra dependency, ships as part of this phase. `setup.js`'s pre-login `/status` and `/branding` endpoints would need the same business-code parameter once there's more than one tenant's branding to choose between (today they can stay as-is with zero params, since tenant-zero is the only possible answer — this only becomes a real requirement at the moment tenant #2 is onboarded, not before).

**Risk: Low today** (single tenant, so current no-param behavior is still correct), **but this is a hard gate before onboarding tenant #2** — flagging so it isn't forgotten since nothing forces it to be built earlier.

## 8. The three known gaps (2a-4)

- **`.populate()` — 23 call sites** (corrected during 2a-3 — see note below), across `products.js` (5), `sales.js` (2), `returns.js` (4), `voidRequests.js` (2), `purchaseOrders.js` (10). As documented in `tenantScope.js` since Phase 0: populate's internal secondary query bypasses these pre-hooks entirely — it will never warn, never throw, silently returning cross-tenant data if the referenced document happens to belong to another tenant. Fix per call site: add `match: { tenantId: req.tenantId }` to the populate options (Mongoose supports this natively). Every site is now marked in-code as `populate site N/total` in its route file (done during 2a-3, per file, as each was migrated) — 2a-4 just has to grep for that marker and fix each one; the per-file breakdown is also in §9.
  - **Correction note:** this section originally said "17 call sites." That number never actually matched even the original research pass's own itemized findings (products=5, returns=4, purchaseOrders=10, sales=2, voidRequests=2, which already summed to 23) — it was a bad sum written down at the time, not a recount. Separately, the §9 per-file checklist independently mistranscribed `purchaseOrders.js`'s count as "8" instead of 10. Both numbers are now corrected to the verified total of 23, confirmed by direct reading/grep of each file during its 2a-3 migration.
- **`bulkWrite` — 1 site**, `server.js:430`, the reorder-suggestion job (`Product.bulkWrite(bulkOps)`). Two things need fixing: (1) each individual `updateOne` op's filter needs `tenantId` added defensively, and (2) more importantly, the job's *selection* query (whatever gathers candidate products to compute suggestions for) needs to become a per-tenant loop — "for each active tenant, compute suggestions for that tenant's products" — rather than one global pass across all products. This is a design change to the job's shape, not just a query tweak; flagging as its own checklist item, not a one-line fix.
- **Raw MongoDB driver calls** — none found in `routes/*.js` or `server.js` (only in the Phase 1 rehearsal scripts, which are one-off tooling, explicitly out of scope). Smaller gap than expected — no action needed in the app itself, just a standing rule to avoid introducing raw driver calls without tenant filters in future code.

## 8b. Model-internal query inventory (pre-save hooks / model methods)

Routes aren't the only place unscoped queries live — a handful of models run their own queries internally (number-generation logic, mostly), invisible to the route-by-route checklist in §9. Scanned all 20 model files (`grep` for `find`/`findOne`/`findById`/`countDocuments`/`aggregate`/`updateMany`/`deleteMany` inside `.pre()`/`.post()`/`.methods`/`.statics` blocks, then broadened to the whole file in case a plain helper function did the same). Exactly two exist, both discovered incidentally during 2a-3 (the first one flagged by the shadow-mode plugin while running `sales.test.js`):

| Model | Location | Query | Why it needs `tenantId` |
|---|---|---|---|
| `Sale.js` | `pre("save")`, line 115 | `Setting.findOne().select("receiptPrefix").lean()` | Fetches whichever `Setting` document happens to be first in the collection for the receipt-number prefix — once a second tenant exists, this must fetch *this sale's own tenant's* `receiptPrefix`, not an arbitrary one. `this.tenantId` is available inside the hook. |
| `PurchaseOrder.js` | `generatePoNumber()`, line 17, called from `pre("save")` | `.findOne({ poNumber: { $regex: ^prefix } }).sort({ poNumber: -1 })` | Finds the highest existing PO number to compute the next sequence number, across *all* tenants' purchase orders. Not a security leak (poNumber's real uniqueness constraint is the tenant-scoped compound index from 2a-2), but a data-quality drift: sequence numbers would jump unpredictably per tenant instead of incrementing cleanly within each tenant's own series. `generatePoNumber()` is a standalone function, not a hook method — will need `tenantId` threaded in as a parameter (same pattern as `customers.js`'s `calcBalance`), called as `generatePoNumber(this.tenantId)`. |

No other model file has any embedded query — confirmed by scanning all 20, not just the 4 that had `pre`/`post`/`methods`/`statics` blocks at all (`Sale.js`, `PettyCash.js`, `PurchaseOrder.js`, `User.js` — `PettyCash.js` and `User.js`'s hooks only recalculate fields from `this`, no DB query, not a concern).

**Not fixed now** — tracked here so they aren't lost in the gap between 2a-3 (routes) and 2a-4 (closing the known gaps). Fix alongside the `.populate()` and `bulkWrite` fixes in 2a-4, same reasoning, same batch.

## 9. Route migration completeness checklist (2a-3)

All 19 route files, to be filled in as each is converted. **Canonical pattern established and approved on `categories.js`**: explicit `{ tenantId: req.tenantId }` filters (not the `req.models` wrapper — it doesn't cover `findById`/`findByIdAndUpdate`/`findByIdAndDelete`/`.populate()`/`aggregate`, all used constantly). `findById(id)` → `findOne({ _id: id, tenantId: req.tenantId })`; `findByIdAndUpdate`/`findByIdAndDelete` → `findOneAndUpdate`/`findOneAndDelete` with the same `{_id, tenantId}` filter; `create({...})` gets `tenantId` on the document; cross-model calls into other tenant-scoped collections get the same treatment; helper functions that take an id/document get `tenantId` threaded through as an explicit parameter.

| Route file | Status | Notes |
|---|---|---|
| auth.js | **Done** (all except `/login`) | 13 sites converted across `/employees`, `/register`, `/change-password`, `/:id/toggle`, `/set-my-pin`, `/:id`, `/:id/set-pin`, `/:id`. `/login` deliberately untouched — see §7, it's establishing `tenantId`, not consuming it. |
| setup.js | **Done** (`/details`, `/update`, `/test-email` only) | 3 sites converted. `/status`, `/branding`, `/initialize` deliberately untouched — same deferred category as `/login`: pre-auth (no `req.tenantId` exists yet) and, for `/initialize`, genuinely bootstraps the very first tenant — real multi-tenant onboarding is separate future work (§7's Business Code flow), not a mechanical scoping fix. |
| products.js | **Done** (queries only — `.populate()` deferred to 2a-4) | 10 sites converted, plus `uniqueEAN13()` helper now takes `tenantId` as a parameter. All 5 of the (corrected) 23 `.populate()` sites live here, marked in-code as `populate site N/5`, `match:{tenantId}` deferred to 2a-4. Must-flag: `GET /lookup/:barcode` deliberately searches with no store filter for cross-store duplicate detection — since `barcode` uniqueness is now per-tenant, missing `tenantId` here would be a correctness bug (false "already exists"), not just a leak risk. |
| categories.js | **Done** (`225653c`) | 6 query sites converted (find/findOne/create/findById→findOne/findByIdAndUpdate→findOneAndUpdate/findByIdAndDelete→findOneAndDelete + cross-model `Product.countDocuments` ×2). Canonical pattern reference. |
| stores.js | **Done** | 20 sites converted, including the 13-collection store-rename cascade (`Product`, `Category`, `Customer`, `Sale`, `Expense`, `ExpiredStock`, `PettyCash`, `PurchaseOrder`, `SupplierPayment`, `Repayment`, `Archive`, `User`, `Supplier` — all `updateMany` calls gained `tenantId`). |
| suppliers.js | **Done** | 8 sites converted, including a cross-model `PurchaseOrder.findOne` open-PO check before delete. |
| purchaseOrders.js | **Done** (queries only — `.populate()` deferred to 2a-4) | 27 sites converted — the biggest file in 2a-3. 10 of the (corrected) 23 `.populate()` sites live here — see the §8 correction note; all 10 marked in-code, deferred to 2a-4. Must-flag: `GET /:id/pdf` bypasses the router-level `authMiddleware` entirely (the `router.use()` skips it so a download link can carry the token as a query param) — it does its own manual `jwt.verify()` but never had `req.tenantId` set by anything; added `req.tenantId = req.user?.tenantId` right after the manual verify. Also flagged: the PO create/update item-validation lookups (`Product.findOne`/`Supplier.findOne`) aren't just defense-in-depth — without `tenantId`, a foreign `productId`/`supplierId` would validate successfully and that tenant's real product/supplier data would get embedded directly into this tenant's PO document, a genuine cross-tenant data leak. The stock-receiving update gets the same cross-tenant-stock-corruption-prevention scoping as `sales.js`/`returns.js`/`voidRequests.js`. |
| customers.js | **Done** | ~19 query sites converted across `Customer`/`Sale`/`Repayment`, plus the `calcBalance`/`refreshOverdue` helpers changed to accept `tenantId` as an explicit parameter (threaded through every call site). |
| sales.js | **Done** (queries only — `.populate()` deferred to 2a-4) | 26 sites converted across `POST /`, `GET /`, `PATCH /:id/void`, `PATCH /:id/void-items`. Both `.populate()` sites (on `GET /`'s query) marked in-code, deferred to 2a-4. Must-flag: the stock-decrement `Product.findOneAndUpdate` on sale creation — `tenantId` here means a client-sent `productId` belonging to a different tenant matches nothing and falls to the existing error path, instead of silently decrementing another tenant's stock (same reasoning applied to both void routes' restock updates). Also flagged: the manager/owner PIN-lookup queries in both void routes scope by store *name* only — since store names aren't unique across tenants, `tenantId` was required there too. |
| returns.js | **Done** (queries only — `.populate()` deferred to 2a-4) | 27 sites converted, plus `recalcArchive()` now takes `tenantId` as a third parameter, threaded through both call sites (grep-confirmed no third call site exists). All 4 of the (corrected) 23 `.populate()` sites live here (`GET /` ×2, `PATCH /:id/approve` ×2), marked in-code, deferred to 2a-4. Must-flag: two restock loops (owner auto-approve path, and stage-2 approval's stock restoration) get the same cross-tenant-stock-corruption-prevention scoping as `sales.js`; the `approve-stage1` manager PIN-lookup has the same store-name-collision issue as `sales.js`, fixed the same way. |
| voidRequests.js | **Done** (queries only — `.populate()` deferred to 2a-4) | 17 sites converted across `GET /`, `POST /`, `PATCH /:id/approve`, `PATCH /:id/reject`, `PATCH /:id/approve-pin` (4 restock loops total, the atomic `processing`-status claim, and the owner PIN scan — same patterns as `sales.js`/`returns.js`). Both `.populate()` sites (`GET /`) marked in-code, deferred to 2a-4. **⚠️ No dedicated test file exists for this route** (`voidRequests.test.js` was never written — 17 other route files have one, this doesn't) — verified by diff-review only, not an automated regression run. See the test-coverage-gaps list below. |
| expenses.js | **Done** | 7 sites converted. Cross-model flag: DELETE `/:id`'s petty-cash reversal (`PettyCash.findOne`) now scoped — without it, a shared store name could reverse another tenant's petty cash. |
| pettyCash.js | **Done** | 10 sites converted. Two cross-model flags: the auto-created `Expense` on a Cash Out transaction now carries the same `tenantId` as its originating `PettyCash` record; the transaction-delete route's matching `Expense.findOneAndUpdate` (soft-delete) now scoped too, same leak risk as expenses.js. |
| expiredStock.js | **Done** | 10 sites converted, including `POST /auto-check`'s global expiry scan — noted in-code that if this ever becomes a scheduled cross-tenant job it needs a per-tenant loop (same shape as the §8 reorder-job gap), but as an owner-triggered per-request route today, plain `tenantId` scoping is correct. |
| archives.js | **Done** | 6 sites converted. Verified (empirically, via a throwaway mongodb-memory-server test) that Mongoose's `findOneAndUpdate` with a plain non-`$set` object does a partial update in this Mongoose version, not a full replace — so the upsert-based archive-close `findOneAndUpdate` was safe to scope via the filter alone; added `tenantId` to both the filter and the replacement data anyway for explicitness on the insert path. |
| messages.js | **Done** | 11 sites converted. Two must-flag spots: `GET /owner-id` and the staff-can-only-message-owner check in `POST /` both resolve "the owner" via `User.findOne({role:"owner"})` — without `tenantId`, staff could be handed a different tenant's owner and start messaging a stranger. Both now scoped. |
| weighStation.js | **Done** | 5 sites converted. Must-flag spot: `POST /decode`'s `Product.findOne({pluNumber, ...})` is the checkout-time weight-barcode lookup — `pluNumber` is tenant-scoped (2a-2's compound index), so without `tenantId` here a scanned barcode could resolve to a different tenant's product, charging the wrong price and decrementing the wrong stock. Now scoped. |
| print.js | **Done** | No Mongoose models, no DB queries at all — pure ESC/POS formatting + printer I/O. Nothing to scope. |
| mpesa.js | Not started | **Special case** — `/callback` (server.js:170) is an unauthenticated external Safaricom webhook with no JWT/tenant context at all. It resolves the affected `Sale` via a globally-unique `mpesaCheckoutRequestId` lookup *first*, then must derive `tenantId` from the found Sale document for any subsequent writes. This route needs one deliberate unscoped lookup by design — don't "fix" it to require `tenantId` up front or real M-Pesa callbacks will break. |
| server.js (reorder job) | Not started | The `bulkWrite` gap from §8 |

Each row flips to "Done" only after: (1) code changes, (2) relevant Jest tests pass, (3) manual spot-check confirms identical behavior pre/post (expected, since single-tenant today makes this a no-op change).

## 9b. Test coverage gaps (tracked for pre-go-live)

Routes discovered during 2a-3 to have no dedicated test file, so their tenant-scoping changes were verified by diff-review only, not an automated regression run. Not blocking for 2a-3 itself (the full suite still passes, and the changes are the same mechanical pattern proven correct elsewhere), but each of these needs a real test file before real client data is at stake, and is a natural candidate for extra manual scrutiny during the Phase 5 two-tenant isolation test (§10):

- **`voidRequests.js`** — no `voidRequests.test.js` exists at all. Especially worth prioritizing given this route handles PIN-authorized void approval and stock restoration (money + inventory), the same class of flow that's well-tested in `sales.js`/`returns.js`.

## 10. Go-live gate — before onboarding a real second tenant

All of the following must be true, not just 2a "mostly done":
- Every row in §9 is "Done."
- All 23 `.populate()` sites have explicit `match: { tenantId }` (see §8's correction note for how this number was verified).
- The reorder-suggestion job is per-tenant.
- `required: true` is flipped on all 20 schemas.
- `tenantScope` plugin is in throw mode.
- Login resolves a real tenant identifier (§7) — not just "there's only one, so it doesn't matter."
- 2b (Socket.IO tenant rooms) is complete, given the data-carrying emits identified in §6.
- A dedicated two-tenant isolation test exists and passes (per the original design's "dedicated isolation-test phase") — create a second real Tenant document, seed parallel data, and assert zero cross-tenant leakage across every route and every socket event.
- Every item in §9b's test-coverage-gaps list has a real test file (`voidRequests.js` at minimum), and is given extra manual scrutiny during the two-tenant isolation test above.

## 11. Explicitly out of scope for this document

This is a design document, not implementation. No code has been written or changed to produce this plan. Sub-phase 2a-1 onward each gets its own diff-by-diff review before any edit, same as Phases 0 and 1.
