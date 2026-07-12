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

- **`.populate()` — 17 call sites**, all in `products.js`, `returns.js`, `purchaseOrders.js`, `sales.js`, `voidRequests.js`. As documented in `tenantScope.js` since Phase 0: populate's internal secondary query bypasses these pre-hooks entirely — it will never warn, never throw, silently returning cross-tenant data if the referenced document happens to belong to another tenant. Fix per call site: add `match: { tenantId: req.tenantId }` to the populate options (Mongoose supports this natively). Full list of the 17 sites is in the research notes for this doc; each becomes one line in the route-migration checklist in §9.
- **`bulkWrite` — 1 site**, `server.js:430`, the reorder-suggestion job (`Product.bulkWrite(bulkOps)`). Two things need fixing: (1) each individual `updateOne` op's filter needs `tenantId` added defensively, and (2) more importantly, the job's *selection* query (whatever gathers candidate products to compute suggestions for) needs to become a per-tenant loop — "for each active tenant, compute suggestions for that tenant's products" — rather than one global pass across all products. This is a design change to the job's shape, not just a query tweak; flagging as its own checklist item, not a one-line fix.
- **Raw MongoDB driver calls** — none found in `routes/*.js` or `server.js` (only in the Phase 1 rehearsal scripts, which are one-off tooling, explicitly out of scope). Smaller gap than expected — no action needed in the app itself, just a standing rule to avoid introducing raw driver calls without tenant filters in future code.

## 9. Route migration completeness checklist (2a-3)

All 19 route files, to be filled in as each is converted. **Canonical pattern established and approved on `categories.js`**: explicit `{ tenantId: req.tenantId }` filters (not the `req.models` wrapper — it doesn't cover `findById`/`findByIdAndUpdate`/`findByIdAndDelete`/`.populate()`/`aggregate`, all used constantly). `findById(id)` → `findOne({ _id: id, tenantId: req.tenantId })`; `findByIdAndUpdate`/`findByIdAndDelete` → `findOneAndUpdate`/`findOneAndDelete` with the same `{_id, tenantId}` filter; `create({...})` gets `tenantId` on the document; cross-model calls into other tenant-scoped collections get the same treatment; helper functions that take an id/document get `tenantId` threaded through as an explicit parameter.

| Route file | Status | Notes |
|---|---|---|
| auth.js | Not started | Login itself can't filter by `req.tenantId` (that's what it's establishing) — see §7 |
| setup.js | Not started | `/status`, `/branding` are pre-login/public — see §7; `/details`, `/update` are post-login, straightforward |
| products.js | Not started | 5 of the 17 `.populate()` sites live here |
| categories.js | **Done** (`225653c`) | 6 query sites converted (find/findOne/create/findById→findOne/findByIdAndUpdate→findOneAndUpdate/findByIdAndDelete→findOneAndDelete + cross-model `Product.countDocuments` ×2). Canonical pattern reference. |
| stores.js | **Done** | 20 sites converted, including the 13-collection store-rename cascade (`Product`, `Category`, `Customer`, `Sale`, `Expense`, `ExpiredStock`, `PettyCash`, `PurchaseOrder`, `SupplierPayment`, `Repayment`, `Archive`, `User`, `Supplier` — all `updateMany` calls gained `tenantId`). |
| suppliers.js | **Done** | 8 sites converted, including a cross-model `PurchaseOrder.findOne` open-PO check before delete. |
| purchaseOrders.js | Not started | 8 of the 17 `.populate()` sites live here |
| customers.js | **Done** | ~19 query sites converted across `Customer`/`Sale`/`Repayment`, plus the `calcBalance`/`refreshOverdue` helpers changed to accept `tenantId` as an explicit parameter (threaded through every call site). |
| sales.js | Not started | 2 `.populate()` sites |
| returns.js | Not started | 4 `.populate()` sites |
| voidRequests.js | Not started | 2 `.populate()` sites |
| expenses.js | Not started | |
| pettyCash.js | Not started | |
| expiredStock.js | Not started | |
| archives.js | Not started | |
| messages.js | Not started | (no bulkWrite here — see §2 correction) |
| weighStation.js | Not started | 4 endpoints, none reviewed in depth yet for auth/tenant implications |
| print.js | Not started | 1 endpoint (`/receipt`), reads Settings/Sale data for formatting — low DB-write risk but unreviewed |
| mpesa.js | Not started | **Special case** — `/callback` (server.js:170) is an unauthenticated external Safaricom webhook with no JWT/tenant context at all. It resolves the affected `Sale` via a globally-unique `mpesaCheckoutRequestId` lookup *first*, then must derive `tenantId` from the found Sale document for any subsequent writes. This route needs one deliberate unscoped lookup by design — don't "fix" it to require `tenantId` up front or real M-Pesa callbacks will break. |
| server.js (reorder job) | Not started | The `bulkWrite` gap from §8 |

Each row flips to "Done" only after: (1) code changes, (2) relevant Jest tests pass, (3) manual spot-check confirms identical behavior pre/post (expected, since single-tenant today makes this a no-op change).

## 10. Go-live gate — before onboarding a real second tenant

All of the following must be true, not just 2a "mostly done":
- Every row in §9 is "Done."
- All 17 `.populate()` sites have explicit `match: { tenantId }`.
- The reorder-suggestion job is per-tenant.
- `required: true` is flipped on all 20 schemas.
- `tenantScope` plugin is in throw mode.
- Login resolves a real tenant identifier (§7) — not just "there's only one, so it doesn't matter."
- 2b (Socket.IO tenant rooms) is complete, given the data-carrying emits identified in §6.
- A dedicated two-tenant isolation test exists and passes (per the original design's "dedicated isolation-test phase") — create a second real Tenant document, seed parallel data, and assert zero cross-tenant leakage across every route and every socket event.

## 11. Explicitly out of scope for this document

This is a design document, not implementation. No code has been written or changed to produce this plan. Sub-phase 2a-1 onward each gets its own diff-by-diff review before any edit, same as Phases 0 and 1.
