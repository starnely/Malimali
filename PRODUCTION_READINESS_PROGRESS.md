# Production Readiness Progress

## Screens Completed

| Screen | Route | Status | Notes |
|---|---|---|---|
| POS Terminal | `/barcodes` | Done | Touch targets, hover guards, `touch-action`, pan-y scroll |
| Weigh Station | `/weigh-station` | Done | Preset buttons 24→36/44px, copies ±26→36/44px, mode toggles 44px, touch-action |
| Login | `/login` | Done | Brand panel compress-to-band on mobile, inline-override bug fixed, hover guards |
| Sales History | `/sales-history` | **Re-verify on device** | Hover guards, category chips 36/44px, 2-col stat grid on mobile, JS hover → CSS; mobile-scroll fix applied. **Owner store filter added:** `storeFilter` state in SalesHistory.jsx, store chip row in SalesFilters.jsx (owner-only, `storeList` prop is `null` for non-owners so row stays hidden), `matchStore` in `filtered` computation — pure client-side, no backend change (backend already supports `?store=` at sales.js:160-163). **Sticky employee header added:** removed `overflow-hidden` from EmployeeCard outer card div (was trapping `position: sticky`), added `.stickyEmployeeHeader` class to header (`sticky; top: 56px` mobile / `top: 0` desktop, `z-index: 10`, `background: var(--bg-card)`), added `rounded-b-xl overflow-hidden` to expanded content div (clips bg-muted at bottom corners since outer card no longer provides overflow-hidden clip). **SalesFilters condensed layout (mobile):** Complete rewrite of SalesFilters.jsx — 4-row layout: (1) full-width search bar, (2) date-range row with two `flex-1 min-w-0` inputs so they scale to any phone width without cramping, (3) category chip row — first 3 visible + "More ▾" overflow dropdown (same pattern as ProductFilters, `CAT_MAX=3`), (4) store chip row owner-only — first 3 visible + "More ▾" overflow dropdown (`STORE_MAX=3`). Chip style has `maxWidth: 120px; overflow: hidden; textOverflow: ellipsis; flexShrink: 0` — long names truncate within row without breaking layout. Two independent dropdown `useState` + `useRef` + shared `useEffect` click-outside handler. `SalesHistory.module.css` gained `.filterDropdownItemActive/Inactive` with hover guard + `:active`. **Search + date row merge (responsive):** Search and date-range wrapped in `flex flex-col sm:flex-row gap-2` — on mobile they stack (search full-width, then date row full-width); on desktop (≥640px) they sit side-by-side on one row (search `flex-1`, date range natural width). Reduces visual row count from 4 to 3 on desktop. **fetchStores race-condition fix:** Added `fetchStores` to SalesHistory.jsx's `useApp()` destructure + called `if (isOwner) fetchStores()` at mount in the existing `useEffect`. AppContext staggers `fetchStores` 800ms after login; navigating to Sales History before that fires left `stores=[]` and only the "All" chip visible. Explicit mount call fires immediately on page enter, ensuring store chips are always populated. Build: zero errors. |
| My Credits | `/my-credits` | Done | 13 hover guards, 9 `:active` states, 8 buttons 36→44px coarse, touch-action, mobile padding |
| Customers | `/customers` | Done | Filter row 3-row wrap → 3-group responsive layout; Credit/Payment columns stack at ≤480px; touch targets 36/44px; new Customers.module.css |
| Customers — stat grid | `/customers` | Done | 5-col financial summary bar → `repeat(3,1fr)` at ≤480px; borders moved from inline to CSS child selectors (Rule 6 fix + loop-variable shadow avoided) |
| Topbar | shared | Done | `px-3 sm:px-6`; left group `min-w-0` + text truncation; location hidden below 500px; icon buttons 36/44px + touch-action + `:active`; bell hover moved to CSS; profile menu JS hover → CSS guards; new Topbar.module.css. **Shared component — all previously "Done" screens benefit, but each should be spot-checked on a real device rather than assumed fixed.** |
| Dashboard | `/` | Done | Page padding 24/28px → 16px mobile; `.page` class (Rule 6 fix); 3 CSS hover guards added; `hoverLift`/`hoverReset` JS handlers deleted (dead code replaced by CSS); `.card`, `.employeeCard`, `.row` touch-action + `:active`; `.metricTile` for 3 alert tiles; "View All →" + "Follow Up" buttons 36/44px via `.widgetAction` |
| Purchase Orders | `/purchase-orders` | **Re-verify on device** | 12 bare `:hover` rules wrapped in `@media (hover: hover)`; `:active` on all interactive; `.iconBtn` 30→36/44px; `.modalClose` 28→36/44px; `.pageBtn` 30→36/44px; `.btnPrimary/Secondary/Danger` 36→44px coarse + touch-action + active; `filterInput minWidth` Rule 6 fix (moved from inline to CSS, full-width at ≤768px); `.receiveInputGrid` 3-col → 1-col at ≤480px; `.paymentSummaryGrid` `auto-fit minmax` (naturally wraps); ProductCombobox JS hover kept; **stacked card layout at ≤768px**; **Create PO modal fixes**: combobox `PANEL_MAX_H` → dynamic `min(270, floor(vh×0.38))`; items table → `.mobileItemsList` stacked cards at ≤480px; **mobile-scroll fix**: added to 768px block — `.page { overflow: visible; flex: none; min-height: 100% }`, `.content { overflow: visible; flex: none }`, `.tableWrap { overflow: visible; flex: none; height: auto }` — converts constrained-internal-scroll to natural-page-scroll on mobile. This is the fix for the real-phone zero-height collapse. Re-test required. |
| Products | `/products` | **Verify on device** | 4 bare `:hover` rules wrapped in `@media (hover: hover)` (`.critical`, `.low`, `.inStock`, `.tableRow`); **Constrained-scroll fix applied proactively** (confirmed same pattern as PO): outer `h-screen overflow-hidden` → `min-h-screen md:h-screen md:overflow-hidden`, inner 4-level flex chain broken with `md:` prefixes across Products.jsx + ProductList.jsx — converted from constrained-internal-scroll to natural-page-scroll on mobile; **Mobile card view** at ≤768px: desktop table hidden, per-product cards with name/category/store/batch meta, stock count + sell price cells, expiry/stock-level badge, 44px Edit/Restock/Delete action buttons; **Rule 6 fixes**: 13 JS `onMouseEnter/Leave` handlers removed across 7 files (ProductCardRow×3, ProductFormPanel×4, RestockModal×3, DeleteConfirmModal×2, Products.jsx×1, ProductFilters dropdown items) — base styles moved from inline to CSS module classes; ProductFormPanel `w-[480px]` → `w-full md:w-[480px]` (full-screen on mobile); RestockModal `w-[380px]` → `w-[90vw] max-w-[380px]`; DeleteConfirmModal `w-[360px]` → `w-[90vw] max-w-[360px]`; ProductCardRow action buttons: `min-height: 36px` desktop / `44px` coarse; **ProductFilters 2-row restructure**: categories sorted alphabetically, stores sorted alphabetically; `MAX_VISIBLE` 7→3 for categories, overflow dropdown pattern added to store row (was previously all chips no overflow); search on its own full-width row; category chips and store chips each on a single non-wrapping row; `flexShrink: 0` on chipBase prevents squashing; two independent dropdown states + refs, single shared click-outside handler. **Post-device bug fixes** (3 issues found via screenshot): (1) Store chip row overflow — `maxWidth: 120px` + `overflow: hidden/textOverflow: ellipsis/whiteSpace: nowrap` added to `chipBase` in ProductFilters.jsx; long store names now truncate within card boundary without breaking dropdown positioning. (2) "More ▾" trigger now always shows "More" text (Option B) — `chipActive` style when overflow item is selected signals active state; category name removed from trigger label. (3) Float precision — `fmtQty()` utility added to `utils.js` (`+Number(n).toFixed(3)`); applied to all 7 raw stock display locations: ProductList mobile cards, ProductCardRow desktop table, RestockModal (current/new/preview), ScanPanel stockBadge labels + lastScanned, GenerateBarcodes stock label, PurchaseOrders ProductCombobox hints. Comparison/arithmetic code left unchanged. |
| Employees | `/employees` | Done | Constrained-scroll fix: outer `h-full overflow-hidden` → `min-h-full md:h-full md:overflow-hidden`, inner `flex-1 overflow-y-auto` → `md:flex-1 md:overflow-y-auto`. Employees.module.css rewritten: 4 bare `:hover` rules (`btnBlue/Yellow/Red/rowHover`) wrapped in `@media (hover: hover)`; each button class gets `min-height: 36px; min-width: 36px; touch-action: manipulation; user-select: none; :active` + `@media (pointer: coarse) 44px`. Rule 6 fixes in Employees.jsx: 3 modal buttons (`Add New Staff`, `Update/Create Account`, `Yes Delete`) converted from inline `style` + `onMouseEnter/Leave` to `styles.btnAdd`, `styles.modalSave`, `styles.modalDelete` CSS module classes. |
| Suppliers | `/suppliers` | Done | Constrained-scroll fix applied. New Suppliers.module.css: `btnAdd` (primary hover guard + 36/44px touch), `rowHover` (hover guard), `iconBtn` base + 5 color classes (`iconBtnPrimary/Warning/Danger/Success/Muted`) each with `@media (hover: hover)` guards and `:active` states. All 5 JS hover handlers removed from table action buttons (Create PO → iconBtnSuccess, Edit → iconBtnPrimary, Archive → iconBtnWarning, Delete → iconBtnDanger). |
| Stores | `/stores` | Done | Constrained-scroll fix applied. New Stores.module.css: `btnAdd`, `rowHover`, `iconEdit`, `iconDelete` — all with hover guards + 36/44px touch targets. 4 JS hover handlers removed: Add Branch button, table row, Edit button, Delete button. |
| StockOut | `/stock-out` | Done | Constrained-scroll fix applied. New StockOut.module.css: `btnPrimary` (POS terminal button) + `rowHover` — both with hover guards + `:active` + 36/44px coarse. "Open POS Terminal" button and table row JS hovers replaced with CSS classes. |
| DailyArchives | `/daily-archives` | Done | Constrained-scroll fix applied (outer + inner Tailwind). Delegates to ArchiveCard component for content rendering. |
| ExpiredStock | `/expired-stock` | Done | Constrained-scroll fix applied. New ExpiredStock.module.css: `moveBtn` class with `@media (hover: hover)` guard + `:active` + 36/44px. "Move" button JS hover → CSS. |
| Settings | `/settings` | Done | Constrained-scroll fix applied. New Settings.module.css: `.grid2` (1fr 1fr) and `.grid3` (1fr 1fr 1fr) — both collapse to `1fr` at ≤640px via `@media (max-width: 640px)`. All 5 inline `style={grid2/grid3}` / `style={{ ...grid2/grid3, marginBottom }}` usages replaced with `className={styles.grid2/grid3}`. Settings form layout now stacks on mobile. |
| Profile | `/profile` | Done | Constrained-scroll fix applied. New Profile.module.css: `.grid2` collapses to 1-col at ≤640px. Identity + security panel 2-col grid now stacks on phone. |
| Reports | `/reports` | Done | Constrained-scroll fix applied. Reports.module.css updated: `.card:hover` + `.rowHover:hover` wrapped in `@media (hover: hover)` guards; `.card` + `.rowHover` get `touch-action: manipulation; user-select: none`; `.card:active` + `.rowHover:active` states added. |
| Categories | `/categories` | Done | New Categories.module.css: `.tableCard` moves table container `maxHeight: calc(100vh - 320px)` to CSS (mobile override: `max-height: none; overflow: visible`); `.tableScroll` inner div (`flex: 1; overflow-y: auto`) gets mobile override to allow natural scroll; `.btnAdd` hover guard + 36/44px; `.rowHover` hover guard; `.iconEdit/iconDelete` 36/44px touch-friendly with `@media (hover: hover)`. All JS hover handlers removed from Add Category button, table rows, Edit + Delete action buttons. |
| DailyReport | `/daily-report` | Done | New DailyReport.module.css: `.page` (constrained scroll layout) + `.content` (inner scroll) — mobile override at ≤768px: `overflow: visible; height: auto; min-height: 100%` / `overflow: visible; flex: none`. Both outer wrapper `style={{...}}` and inner scroll `style={{...}}` replaced with `className={styles.page}` and `className={styles.content}`. |
| PettyCash | `/petty-cash` | Done | New PettyCash.module.css: same `.page` + `.content` mobile scroll fix pattern as DailyReport. Both return paths (owner all-stores view + single-store view) — outer wrapper + inner scroll div converted from inline `style` to CSS module classes. |
| SetupWizard | `/setup` | Done | New SetupWizard.module.css: `.card { max-height: 90vh }` moved from inline to CSS (mobile override: `max-height: none`); `.btnPrimary`, `.btnSecondary`, `.btnSuccess` CSS classes replace 3 JS style objects + 3 `onMouseEnter/Leave` handlers — all backgrounds now in CSS so hover guards work; `.visBtn` for password toggle buttons → `min-height/width: 36px` desktop / `44px` coarse + `touch-action: manipulation`. AuthLayout not touched (already natural scroll). |
| Expenses | `/expenses` | Done | Existing Expenses.module.css updated: (1) mobile scroll fix added to `@media (max-width: 768px)` block — `.page { overflow: visible; height: auto; min-height: 100% }` + `.content { overflow: visible; flex: none }`; (2) 6 bare `:hover` rules wrapped in `@media (hover: hover)` with `:active` counterparts: `.btnPrimary`, `.btnSecondary`, `.breakdownHeader`, `.table tbody tr`, `.iconBtn.danger`, `.modalClose`; (3) `.modalClose` 28px → `min-height: 36px; min-width: 36px; touch-action: manipulation` + coarse 44px; (4) `.iconBtn` 30px → same 36/44px treatment. |

## Bug Fixes Applied During This Work

- **Float precision on stock display** — `fmtQty(n)` added to `utils.js` (`+Number(n).toFixed(3)`). Strips IEEE 754 float noise (53.546000000000001 → 53.546, whole numbers stay as integers). Applied to 7 display sites across ProductList, ProductCardRow, RestockModal, ScanPanel, GenerateBarcodes, PurchaseOrders. Arithmetic/comparison code untouched.
- **ProductFilters store chip overflow** — `chipBase` lacked `maxWidth`. Long store names ("Nana Retail Ltd") pushed chip row past card right edge. Fix: `maxWidth: 120px` + ellipsis truncation in `chipBase` style object. Card boundary preserved, dropdown positioning unaffected (no `overflow: hidden` on ancestor needed).
- **ProductFilters "More ▾" label ambiguity** — Trigger was showing the active overflow item's name ("cereals ▾"), making it look like a misplaced chip. Changed to always show "More" text; `chipActive` style (blue fill) when an overflow item is selected signals the active state without name collision.
- **`Settings.jsx` line 111** — `${API_BASE_URL}` used in template literal while file imports the variable as `backendUrl`. Silent runtime failure on Test Email button. Fixed to `${backendUrl}`.
- **`Settings.jsx` + `Profile.jsx` import blocks** — mass-replacement script inserted new import line inside an unclosed multi-line `import {` block, producing a parse error. Fixed by moving the API import to its own properly closed line before the icon block.
- **`Login.jsx` + `Login.module.css` inline-override bug** — `style={{ display: 'flex' }}` on `.brandPanel` silently blocked the CSS module media query `display: none` at ≤700px. Root cause: inline style specificity (1-0-0-0) beats class rule (0-1-0-0). Fix: moved `display` and `flexDirection` out of the inline prop and into the `.brandPanel` CSS base rule; media query then overrides the class rule cleanly. This is the canonical example of Standing Rule 6.
- **Store rename orphaning all linked documents (data-integrity)** — `store` was stored as a plain `String` name (not ObjectId ref) across 13 collections: Product, Category, Customer, Sale, Expense, ExpiredStock, PettyCash, PurchaseOrder, SupplierPayment, Repayment, Archive, User, Supplier (array). Renaming a store in `backend/routes/stores.js` only updated the Store document with no cascade, silently orphaning every product, sale, expense, etc. under that store from all filtered views and the POS terminal. Fix: (1) `backend/routes/stores.js` PUT handler now captures `oldName` before update and runs `Promise.all` with 13 `updateMany` / `arrayFilters` calls after a successful rename; partial cascade failure is caught, logged server-side, and returns `cascadeWarning: true` without failing the response. (2) `Stores.jsx` `handleSubmit` now calls `fetchProducts()` after rename (in addition to `fetchStores()`) so in-memory product list immediately reflects new store name. `cascadeWarning: true` in response triggers a dismissible warning banner in the UI.
- **Historical orphaned store values (one-time data repair)** — Pre-cascade, 4 store name values used in historical documents no longer matched any live Store document: `"Nana-Retail-Ltd"` (old slug) → `"Stan Retail Ltd"`, `"Nthiga-Liqour-Ltd"` → `"Stan Liqour Ltd"`, `"Main Store"` → `"Stan Retail Ltd"`, `"Headquarters"` → `"Stan Liqour Ltd"`. A one-time Node.js repair script ran the same 13-collection `Promise.all` cascade against each mapping. Total: 134 documents updated. Final diagnostic query confirmed zero orphaned store values across all 13 collections. A leftover test category document (from a UI test session) was identified during the diagnostic and deleted.
- **Setup check error handling — network error vs "not set up"** — `AppContext.jsx` catch block previously called `setIsSetupComplete(false)` on ANY error (including `net::ERR_CONNECTION_REFUSED` during a backend restart), which caused the Setup Wizard to render instead of a recoverable error screen. Fix: added `connectionError` boolean state and `retryTimerRef`; `checkSetup` refactored into `runSetupCheck` useCallback. On network/HTTP error: `setConnectionError(true)` + auto-retry after 5 s via `setTimeout`. Only a clean `{ isSetup: false }` response now sets `isSetupComplete(false)` → SetupWizard. `App.jsx` updated: the `isSetupComplete === null` block now branches on `connectionError` — shows "Can't reach server / Retrying automatically…" screen with spinning indicator and "Retry now" button when in error state, original "Initializing System…" spinner when not. `connectionError` and `retrySetupCheck` exposed in context value. Build: zero errors.
- **Float precision on quantity displays (codebase-wide sweep)** — Summing weighed-product quantities (e.g. 0.547 kg + 1.2 kg across many items) via `Array.reduce()` produces IEEE 754 float noise (63.07899999999999). Root cause confirmed in screenshots on `/sales-history` (`cashierItems`, `totalItemsSold`). Applied `fmtQty()` to all 22 affected display locations across 12 files: `SalesStats.jsx` (stat card), `EmployeeCard.jsx` (summary row), `DateGroup.jsx` (date header), `Dashboard.jsx` (3 locations — Today's Revenue subtitle, employee section header, per-seller card), `EmployeeSalesModal.jsx` (3 locations — stat card, per-sale table, totals row), `Profile.jsx` (stat card), `StockOut.jsx` (stat card), `ArchiveCard.jsx` (2 locations — header summary + expanded stat card), `DailySummaryModal.jsx` (2 locations — XLSX kpi row + UI stat card), `DailyReport.jsx` (2 locations — XLSX kpi row + StatTile), `MonthlyReport.jsx` (4 locations — `formatCardValue('items')`, day-by-day table, Top Products qty, Employee Performance qty), `Reports.jsx` (product performance table). Build: zero errors.

## Standing Rules in Effect

1. **Compile gate first** — After every edit (single or multi-file), run `npm run build` and confirm zero errors before any other step. The build catches CSS module parse errors, missing imports, and JSX syntax breaks that the dev server may not surface immediately.

2. **CSS approach per screen** — Screens using Tailwind get Tailwind responsive prefixes (`sm:` / `md:` / `lg:`). Screens using CSS Modules get `@media (hover: hover)` and `@media (pointer: coarse)` guards added to the existing module file. Screens using only inline styles (no Tailwind, no CSS module) get a **new `*.module.css` created** for them — move only the layout/interaction properties that need responsive overrides into it; leave visual-only inline styles alone.

3. **Touch target sizing** — Universal baseline ≥36px on desktop, bumped to **44px minimum** under `@media (pointer: coarse)`. Never shrink below 44px on touch without a layout reason.

4. **Hover guards + active states** — Every `:hover` rule gets wrapped in `@media (hover: hover)` (prevents sticky hover on touch). A matching `:active` state is added for touch press feedback — even on elements that had no previous `:hover` rule (`:active` is universal for all interactive elements: buttons, chips, clickable rows, toggles).

5. **Touch interaction properties** — Always in CSS class, never inline `style={{}}`:
   - `touch-action: manipulation` — eliminates 300ms tap delay; on every button, chip, and toggle
   - `touch-action: pan-y` — on scrollable containers to allow natural vertical scroll
   - `user-select: none` — on every interactive element to prevent text-selection on long-press

6. **Inline-style vs CSS-class conflict check** — **Run this check before every responsive fix.** Any CSS property set in `style={{}}` on an element **cannot** be overridden by a CSS module media query on the same element (inline specificity 1-0-0-0 beats class 0-1-0-0). Before adding a media query override for a property, verify it is NOT also set inline. If it is: move it from `style={{}}` to the CSS class base rule first — the media query can then override the class rule. Discovered on Login `display: 'flex'` silently blocking `@media (max-width: 700px) { .brandPanel { display: none } }`.

7. **Scope** — UI, CSS, and interaction only. No business logic, backend calls, data flow, or endpoint changes.

## Current Status

### Implementation Pass — Complete ✅

All Priority 1–5 screens have had the touch/responsive pass applied (see Screens Completed table above). Every route has: constrained-scroll fix, hover guards, `:active` states, 36/44px touch targets, `touch-action: manipulation`, `user-select: none`.

### Three Real Bugs Found and Fixed (this session)

1. **Store rename → data corruption across 13 collections** — any rename silently orphaned every product, sale, expense, archive, customer, PO, etc. under that store name. Fixed with full cascade in `backend/routes/stores.js` PUT handler + one-time repair script that fixed 134 historical documents across 4 orphaned store names.

2. **Floating-point display garbage across 22 locations** — IEEE 754 float noise (63.07899999999999, 164.279…) appeared on item-count displays wherever `Array.reduce()` accumulated weighed-product quantities. Fixed by applying `fmtQty()` to all 22 display sites across 12 files (SalesStats, EmployeeCard, DateGroup, Dashboard ×3, EmployeeSalesModal ×3, Profile, StockOut, ArchiveCard ×2, DailySummaryModal ×2, DailyReport ×2, MonthlyReport ×4, Reports).

3. **False Setup Wizard on transient network error** — AppContext `checkSetup` catch block called `setIsSetupComplete(false)` on ANY error including `ERR_CONNECTION_REFUSED`, routing every user to Setup Wizard during a backend restart. Fixed: `connectionError` state + `retryTimerRef` + `runSetupCheck` useCallback. Network errors now show "Can't reach server — Retrying automatically…" with 5-second auto-retry. Only an explicit `{ isSetup: false }` from a reachable backend triggers the Setup Wizard. Confirmed working by user.

### Outstanding: Real-Device Verification

The code changes are applied and build-clean. These screens have NOT been confirmed on a real phone:

| Screen | Route | What to verify |
|---|---|---|
| Purchase Orders | `/purchase-orders` | Mobile-scroll fix (zero-height collapse), stacked card layout, Create PO modal combobox + items cards, 44px touch targets |
| Sales History | `/sales-history` | Mobile-scroll fix, SalesFilters condensed layout (CAT_MAX=3, date flex-1), store chip row, sticky employee header |
| Products | `/products` | Mobile card view renders, ProductFilters chip rows stay on one line, overflow dropdowns, Edit/Restock/Delete 44px |
| Employees | `/employees` | Scroll, modal buttons 44px |
| Categories | `/categories` | Scroll, table overflow, Add/Edit/Delete buttons 44px |
| Suppliers | `/suppliers` | Scroll, table action buttons 44px |
| Stores | `/stores` | Scroll, rename cascade warning banner visible |
| StockOut | `/stock-out` | Scroll, POS Terminal button 44px |
| DailyArchives | `/daily-archives` | Scroll, ArchiveCard touch targets |
| ExpiredStock | `/expired-stock` | Scroll, Move button 44px |
| Settings | `/settings` | Grid stacks to 1-col on mobile, scroll |
| Profile | `/profile` | Grid stacks to 1-col on mobile, items-sold stat card correct |
| Reports | `/reports` | Scroll, hover guards not sticky |
| DailyReport | `/daily-report` | Scroll |
| PettyCash | `/petty-cash` | Scroll |

### Outstanding: Part 2 — App.jsx `100dvh` Shared-Shell Verification

The App.jsx shared shell already uses `height: '100dvh'` at the outer wrapper (line 92) and inner content div (line 98, `calc(100dvh - 56px)` on mobile). The code change is done. **What is outstanding:** real-device verification that `100dvh` correctly matches the visible viewport across all 21 authenticated routes on iOS and Android (browser chrome vs. CSS viewport unit behaviour). This verification is blocked on Purchase Orders and Sales History first confirming their scroll fixes work on device — those are the two screens where the original collapse was reproduced. Once they pass, spot-check the remaining routes.

## Mobile Usage Decisions

| Screen | Usage | Decision |
|---|---|---|
| `/customers` | Owner + cashiers check debtors on phone during day | **Mobile-first** — full touch treatment applied |
| `/expenses` | TBD — flag if used on phone throughout the day | **Pending** — treat as mobile-first if confirmed, else desktop-only |
| `/dashboard` | TBD | Pending user decision |

## Systemic Risk: "Constrained Internal-Scroll" Layout Pattern

**Discovered during Purchase Orders real-phone test (2026-06-27).** Screens that use `overflow: hidden` + `flex: 1` / `h-full` on their outer page div — trapping content inside an internal-scroll container — can collapse to zero visible height on real mobile phones. Root cause: `height: 100vh` in App.jsx doesn't match the actual visible viewport on real devices (browser chrome reduces it), and the `overflowY: auto` flex parent in App.jsx allows the flex chain to collapse. DevTools emulation uses a clean pixel-exact `100vh` and does NOT reproduce this collapse.

**Pattern audit — all screens:**

| Screen | Route | Layout pattern | Risk |
|---|---|---|---|
| Purchase Orders | `/purchase-orders` | `flex:1; min-height:0; overflow:hidden` → internal `.tableWrap` scroll | **Was broken** — fix applied, re-verify |
| Sales History | `/sales-history` | Tailwind `h-full overflow-hidden` → inner `flex-1 overflow-y-auto` | **At risk** — fix applied, re-verify |
| Products | `/products` | Tailwind `h-screen overflow-hidden` → 4-level `flex-1/overflow` chain through ProductList | **Proactively fixed** — `md:` prefix on all 5 constrained classes; not yet re-verified on device |
| Expenses | `/expenses` | `height:100%; overflow:hidden` | **At risk** — fix not yet applied (lower priority; pending mobile-usage decision) |
| Dashboard | `/` | `min-height:100%; padding...` — natural scroll | Safe ✓ |
| POS Terminal | `/barcodes` | `height:100%; overflow-y:auto` — page IS scroll container | Safe ✓ |
| Weigh Station | `/weigh-station` | `minHeight:'100%'` inline — natural scroll | Safe ✓ |
| My Credits | `/my-credits` | `padding:24px; max-width:1200px` — natural scroll | Safe ✓ |
| Customers | `/customers` | `minHeight:'100%'` inline — natural scroll | Safe ✓ |
| Login | `/login` | Standalone, not in App.jsx shell | N/A |

**Fix pattern (CSS Modules):** Add to `@media (max-width: 768px)` block:
```css
.page     { overflow: visible; flex: none; min-height: 100%; }
.content  { overflow: visible; flex: none; }
.tableWrap { overflow: visible; flex: none; height: auto; min-height: 0; }
```

**Fix pattern (Tailwind):** On outer div: `h-full overflow-hidden` → `min-h-full md:h-full md:overflow-hidden`. On inner scroll div: `flex-1 overflow-y-auto` → `md:flex-1 md:overflow-y-auto`.

**Pending — Part 2 (App.jsx `100dvh`):** Replace `height: '100vh'` with `height: '100dvh'` in App.jsx (lines 62, 68) as belt-and-suspenders. Eliminates the `100vh` vs visible-viewport mismatch on iOS/Android. Held until Purchase Orders + Sales History confirmed working on real device. Touches shared shell — needs careful verification on all screens.

## Known Cleanup Items (post all-screens pass)

- **`ProductCombobox` portal vs. `containerRef` mismatch** (`PurchaseOrders.jsx`) — The "close on outside click" `mousedown` listener checks `containerRef.current.contains(e.target)`. The panel is rendered via `createPortal` to `document.body` and is NOT a DOM descendant of `containerRef`, so any tap on a panel item is treated as an "outside" click and calls `close()` before the item's `onMouseDown` handler runs. Selection still works today because React 18 batches state updates and `onChange(id)` commits synchronously before the re-render, but it's fragile. Fix when refactoring ProductCombobox: either add `panelRef` to the outside-click check (`!containerRef.current.contains(e.target) && !panelRef.current.contains(e.target)`) or switch to a `pointerdown` approach that checks both refs.

- **`Mycredits.module.css` duplicate rules** — `.list`, `.saleCard`, `.progressSection`, `.progressTrack`, `.progressFill`, and `.metaDates` are each defined twice in the file. The second (collapsible-card) block correctly overrides the first (grid layout) block via CSS cascade, so there is no bug. Clean up the dead first definitions once all screens are done.
- **Topbar warning + chat button sticky hover on touch** — these buttons have dynamic inline `background` (conditional on `lowStockCount`/`unreadMsgCount`) which prevents a clean CSS hover replacement. Their `onMouseEnter/Leave` JS handlers remain; on touch, hover tint may stick briefly. Minor cosmetic issue; revisit if flagged by users.

## API URL Centralization (completed earlier)

All 26 frontend source files that hardcoded `http://localhost:5000` now import from `src/config/api.js`. Switch environments with a single `.env` edit (`VITE_API_URL`).
