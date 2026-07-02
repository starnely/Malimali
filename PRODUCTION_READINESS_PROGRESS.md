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

### Touch / Responsive Pass — Code Complete ✅

All 21 authenticated routes have had the touch/responsive pass applied (see Screens Completed table above). Every route has: constrained-scroll fix, hover guards, `:active` states, 36/44px touch targets, `touch-action: manipulation`, `user-select: none`. Build is clean on all changes.

---

### Three Serious Bugs Found and Fixed (this session)

**1. Store rename → data corruption across 13 collections (backend)**
Any store rename silently orphaned every linked product, sale, expense, archive, customer, PO, etc. because `store` is stored as a plain string name across 13 collections with no cascade on rename. Fixed in `backend/routes/stores.js` PUT handler: captures `oldName` before update, runs `Promise.all` with 13 `updateMany`/`arrayFilters` calls after a successful rename. Partial cascade failure is caught and returns `cascadeWarning: true` without failing the response. `Stores.jsx` now calls `fetchProducts()` after rename and shows a dismissible warning banner on `cascadeWarning`. One-time repair script run to fix 134 historically orphaned documents across 4 dead store name mappings.

**2. Floating-point display garbage across 22 locations (frontend)**
IEEE 754 float noise (e.g. `63.07899999999999`) appeared on any quantity display site where `Array.reduce()` accumulated weighed-product quantities. Root cause confirmed via screenshots on Sales History. Fix: `fmtQty(n)` utility added to `utils.js` (`+Number(n).toFixed(3)` — strips noise, preserves meaningful decimals, converts whole numbers to integers). Applied to all 22 display sites across 12 files: SalesStats, EmployeeCard, DateGroup, Dashboard ×3, EmployeeSalesModal ×3, Profile, StockOut, ArchiveCard ×2, DailySummaryModal ×2, DailyReport ×2, MonthlyReport ×4, Reports. Arithmetic/comparison code untouched.

**3. False Setup Wizard on transient network error (frontend + backend)**
`AppContext.checkSetup` catch block called `setIsSetupComplete(false)` on ANY error including `ERR_CONNECTION_REFUSED`, routing users to the Setup Wizard during backend restarts. Fixed: `connectionError` boolean state + `retryTimerRef` + `runSetupCheck` useCallback. Network/HTTP errors now set `connectionError: true` and auto-retry after 5 s. Only a clean `{ isSetup: false }` from a reachable backend triggers the Setup Wizard. App.jsx shows a "Can't reach server — Retrying automatically…" screen with spinner and "Retry now" button on connection error. Confirmed working by user.

---

### Navigation Overhaul (this session) — see Navigation section below for full detail

Summary of all navigation changes shipped today, all build-confirmed:

| Change | Files | Status |
|---|---|---|
| Sidebar brand logo/name → clickable home link (role-based) | `Sidebar.jsx`, `Topbar.module.css` | ✅ Done |
| Topbar duplicate logo removed; plain title restored | `Topbar.jsx` | ✅ Done |
| Conditional back-arrow replaced with scalable breadcrumb trail (`parentRoutes` map) | `Topbar.jsx`, `Topbar.module.css` | ✅ Done |
| Merged mobile header: 56px Sidebar nav bar eliminated, hamburger moved to Topbar | `AppContext.jsx`, `Sidebar.jsx`, `Topbar.jsx`, `App.jsx` | ✅ Done |
| `<Navigate>` without `replace` back-button trap fixed | `App.jsx` | ✅ Done |
| Vestigial `parentRoutes['/monthly-report']` removed (route doesn't exist — Monthly Report is a tab in Reports) | `Topbar.jsx` | ✅ Done |

---

### Outstanding: Real-Device Verification

All code is build-clean. None of the following have been confirmed on a real phone since changes were applied:

**Priority — these had confirmed real-phone failures before the fix was applied:**

| Screen | Route | What to verify |
|---|---|---|
| Purchase Orders | `/purchase-orders` | Zero-height collapse fix (mobile-scroll pattern); stacked card layout at ≤768px; Create PO modal combobox panel height + items stacked cards; 44px touch targets throughout |
| Sales History | `/sales-history` | Zero-height collapse fix; SalesFilters condensed layout (search+date row, CAT_MAX=3 category overflow, store chip row); sticky employee header sticks correctly at `top: 0` beneath the **now-merged single Topbar** (old fix assumed 56px offset — that offset is gone; `top: 0` is still correct but verify visually); receipt card height cap (220px, scrollable tbody, sticky thead) |

**Back-office screens — constrained-scroll fix applied proactively, first-time device verification:**

| Screen | Route | What to verify |
|---|---|---|
| Products | `/products` | Mobile card view; sticky filter section (`top-0 z-20`, title scrolls away); card width 24px padding alignment; chip overflow dropdowns; 44px action buttons |
| Employees | `/employees` | Scroll, 44px modal buttons |
| Categories | `/categories` | Scroll, table overflow, 44px Add/Edit/Delete |
| Suppliers | `/suppliers` | Scroll, 44px table action buttons |
| Stores | `/stores` | Scroll, store rename cascade warning banner |
| StockOut | `/stock-out` | Scroll, 44px POS Terminal button |
| DailyArchives | `/daily-archives` | Scroll, ArchiveCard touch targets |
| ExpiredStock | `/expired-stock` | Scroll, 44px Move button |
| Settings | `/settings` | 2-col grid collapses to 1-col on mobile; scroll |
| Profile | `/profile` | 2-col grid collapses to 1-col on mobile; items-sold stat correct |
| Reports | `/reports` | Scroll, hover guards don't stick on touch |
| DailyReport | `/daily-report` | Scroll |
| PettyCash | `/petty-cash` | Scroll |

**Also verify on device after navigation overhaul:**
- Merged Topbar bar (single bar, `h-[62px]`): hamburger opens drawer, drawer overlays bar correctly, breadcrumb shows on `/profile` and `/settings`, plain title shows on all other pages
- Sidebar drawer brand logo → navigates home and closes drawer
- Back button steps through pages one at a time (no more back-button trap at `/` for non-owners)

---

### Outstanding: App.jsx `100dvh` Shared-Shell (code done, device verification pending)

`height: '100dvh'` is now applied universally in App.jsx (outer wrapper and inner content div — the old `calc(100dvh - 56px)` mobile adjustment was removed as part of the merged header change). The code is correct. **What is still pending:** real-device confirmation that `100dvh` matches the visible viewport on iOS and Android (browser chrome can shrink `100vh` but `100dvh` is supposed to be reliable). Verify once Purchase Orders and Sales History pass their scroll fix tests on device — those are the two screens where the original zero-height collapse was reproduced.

---

### Optional Follow-up: Sticky Filter Pattern

The "filters scroll away on mobile" issue is fixed on Products (split header: title div scrolls, filter wrapper `sticky top-0 z-20 md:static`). The same pattern applies to four other screens but is **not yet fixed** — address in a later pass if it becomes a user complaint:

| Screen | Route | What scrolls away |
|---|---|---|
| Sales History | `/sales-history` | SalesStats + SalesFilters header div scrolls away entirely |
| Purchase Orders | `/purchase-orders` | Filter inputs in header scroll away |
| Customers | `/customers` | Filter row scrolls away |
| Reports | `/reports` | Filter/summary section scrolls away |

Fix pattern: split into title div (scrolls) + filter wrapper (`sticky top-0 z-20 md:static` + `background: var(--bg-page)`). Identical to Products fix.

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

## Navigation Improvements (post-audit)

Navigation audit (2026-06-29) found: all routes are flat (no nested URL paths), all sidebar routes directly reachable, "deep" content (modals, panels, accordions) stays on same URL so browser back is not a modal issue.

### V1 — Implemented then superseded (2026-06-29 → 2026-06-30)

Initial implementation added: (1) clickable logo button in Topbar LEFT navigating home, (2) conditional `MdArrowBack` back-arrow button for `/monthly-report`, `/profile`, `/settings`. Both were committed to main but found to have two issues: the Topbar logo duplicated the sidebar's already-visible brand logo (redundant on both mobile and desktop), and the back-arrow approach required a manually maintained `backRoutes` map that doesn't scale to future pages and offers no visual context about where the arrow leads.

### V2 — Implemented and build-confirmed ✅ (2026-06-30)

**Change 1 — Sidebar brand section is the home link (Topbar logo removed):**
- `Topbar.jsx`: removed logo `<button>` wrapper, `MdArrowBack` import, and `backTarget`/`backRoutes` constants. `homeRoute` kept (used for breadcrumb parent links). Topbar LEFT is now `[title/breadcrumb div] [pill shortcuts (desktop-only, unchanged)]` — no logo.
- `Topbar.module.css`: removed `.logoBtn` class. Added `.breadcrumbLink` class (background none, border none, cursor pointer, primary color 13px/600, hover underline guard via `@media (hover: hover)`, active opacity 0.7, touch-action/user-select).
- `Sidebar.jsx`: destructured `isManager` from `useApp()`, added `homeRoute` (owner/manager → `/`, cashier → `/barcodes`). In drawer brand section: logo image/initial + company name `<div>` wrapped in a `<button>` (`flex: 1; min-width: 0; touch-action: manipulation`) — `onClick={() => { navigate(homeRoute); setIsOpen(false) }}` (closes drawer on mobile, no-op on desktop). Mouse hover/down/up opacity via inline handlers. `MdClose` stays separate (not part of home-click target). In mobile top nav bar: brand `<div>` replaced with `<button>` → `navigate(homeRoute)` with touchStart/touchEnd opacity feedback.

**Desktop before/after:**
- Topbar: `[logo btn → home] [h1 title + subtitle] [shortcuts]` → `[h1/breadcrumb + subtitle] [shortcuts]` (title gets more horizontal space, no logo duplication)
- Sidebar: brand area not interactive → logo + company name is a clickable button with hover/active opacity

**Mobile before/after:**
- Topbar: `[logo btn → home] [h1 title + subtitle]` → `[h1/breadcrumb + subtitle]` (no logo)
- Top nav bar: `<div>` with initial + company name (not tappable) → `<button>` → navigates home, touch opacity feedback
- Sidebar drawer: brand section not interactive → logo + company name `<button>` → home + closes drawer

**Change 2 — Breadcrumb trail replaces back arrow:**
- `Topbar.jsx`: `parentRoutes = { '/monthly-report': { label: 'Reports', to: '/reports' }, '/profile': { label: 'Home', to: homeRoute }, '/settings': { label: 'Home', to: homeRoute } }`. When `parentRoute = parentRoutes[location.pathname]` is defined: `[parent link (13px/600, primary, underline hover)] [› (text-muted)] [current page (text-base/bold, truncate)]`. When not (all top-level routes): plain `<h1>` unchanged. Identical on desktop and mobile — no breakpoint gating.
- Scalable: one line in `parentRoutes` to register any new deep page.

**Build:** zero errors, 3.48s, 206 modules. Pending real-device verification.

### V3 — Mobile merged top bar ✅ (2026-06-30)

**Goal:** Eliminate the two-bar stack on mobile (Sidebar's 56px fixed nav bar + Topbar) by collapsing them into a single Topbar with the hamburger moved into it.

**Files changed (4):**

- `AppContext.jsx`: added `const [sidebarOpen, setSidebarOpen] = useState(false)` + both exposed in context value. This lifts the sidebar drawer's open/close state out of Sidebar's local state so that Topbar can write it without prop threading.
- `Sidebar.jsx`: replaced local `const [isOpen, setIsOpen] = useState(false)` with `sidebarOpen, setSidebarOpen` from `useApp()`. Removed the entire mobile fixed top nav bar block (`<div className="fixed top-0 left-0 right-0 h-14 ...">` containing the home-link button and hamburger). Removed `MdMenu` import (no longer used in Sidebar). Mobile branch in return now only renders: backdrop overlay (when open) + sliding drawer. All `setIsOpen(false)` calls in NavLink/NavGroup/MdClose replaced with `setSidebarOpen(false)` via replace_all.
- `Topbar.jsx`: added `MdMenu` import; destructured `setSidebarOpen` from `useApp()`; added `<button onClick={() => setSidebarOpen(true)} className={\`md:hidden p-2 rounded-lg ${tb.iconBtn}\`}>` as the first child of the LEFT group — `md:hidden` keeps it invisible on desktop (≥768px).
- `App.jsx`: removed `marginTop: isMobile ? '56px' : '0'` → `marginTop: 0` and `height: isMobile ? 'calc(100dvh - 56px)' : '100dvh'` → `height: '100dvh'`. The 56px offset was solely to push content below the now-deleted fixed nav bar.

**Desktop before/after (confirmed unchanged):**
- Sidebar fixed at left, `marginLeft: 230px`, Topbar unchanged. `marginTop: 0` and `height: 100dvh` were already the desktop values — converging the mobile branch to the same values causes zero layout change on desktop. Hamburger is `md:hidden` so never renders. ✓

**Mobile before/after:**
- Before: Two bars. Sidebar's `fixed z-[999] h-14` nav bar (56px) + Topbar `sticky z-50 h-[62px]` below it — combined ~118px of top chrome. Content started at `marginTop: 56px`.
- After: One bar. Topbar `sticky top-0 z-50 h-[62px]` containing `[☰ hamburger] [page title/breadcrumb + subtitle] [right icons]`. Content starts at `marginTop: 0`, `height: 100dvh`. ~56px reclaimed. ✓

**Drawer open/close and z-index (confirmed):**
- Hamburger `onClick={() => setSidebarOpen(true)}` → backdrop renders at `z-[1000]`, drawer at `z-[1001]` — both above Topbar's `z-50`. Drawer correctly overlays the merged bar. `MdClose` inside drawer still calls `setSidebarOpen(false)`. NavLink/NavGroup `onMobileClose` still calls `setSidebarOpen(false)`. ✓

**Tablet boundary check (768–900px):**
- Hamburger uses `md:hidden` (Tailwind `md:` = ≥768px). At exactly 768px and above, hamburger disappears, Sidebar becomes the fixed left panel via the `isMobile` JS check (`useWindowSize`). The two breakpoints align: both `md:` CSS and `isMobile` in `useWindowSize` use 768px as the boundary. No gap at the tablet edge. ✓

**Build:** zero errors, 5.23s, 206 modules. Pending real-device verification.

**Flagged as follow-up** (not yet fixed): Sales History SalesFilters, Purchase Orders filters, Customers filters all have same "filters scroll away on mobile" issue as Products (fixed). Pattern: `sticky top-0 z-20 md:static + background: var(--bg-page)` on filter wrapper.

### V3 follow-up — Back-button audit + Navigate fix ✅ (2026-06-30)

**Audit finding:** Full grep of all `navigate()` calls across the codebase found only one `{ replace: true }` — `Products.jsx:269`, which replaces the same URL to clear `productToEdit` from location state after opening the edit modal. Intentional and correct. All other programmatic navigation (sidebar NavLinks, dashboard cards, breadcrumb links, home-link buttons, shortcut pills, profile/settings links) uses default push. Today's additions (sidebar brand, breadcrumb, hamburger) use push — none cause the reported back-button symptom.

**Root cause 1 — fixed:** `App.jsx` had two `<Navigate>` components without `replace`:
- `<Navigate to="/barcodes" />` for non-owners at `/`
- `<Navigate to="/" />` for unmatched routes (`*`)

React Router v6 `<Navigate>` without `replace` **pushes** a new history entry. For redirect routes this is always wrong — if the user ever navigates back to the redirected URL, they are immediately pushed forward again, creating a back-button trap. Fixed by adding `replace` to both: `<Navigate to="/barcodes" replace />` and `<Navigate to="/" replace />`.

**Root cause 2 — intentional, documented:** The reported symptom "Dashboard → Reports → Monthly Report → back → jumps to Dashboard" was traced to the fact that `/monthly-report` is not a registered route. `MonthlyReport` is rendered as a conditional tab inside `Reports.jsx` (`{activeTab === 'monthly' && <MonthlyReport />}`). Clicking the Monthly Report tab changes component state only — the URL stays `/reports`, no history entry is added. Pressing back therefore goes to the previous URL before `/reports`, which is Dashboard. **Decision (2026-06-30): accept this behavior. Tabs within a page do not create browser history entries — this is standard tab behavior.** The vestigial `parentRoutes['/monthly-report']` breadcrumb entry in Topbar.jsx was removed (that route does not exist; the entry silently did nothing). If a future requirement calls for each report tab to be deep-linkable or back-navigable, the fix is to register `/monthly-report` as a real route in App.jsx and drive the Reports `activeTab` from the URL.

**Logout/session-expiry navigation:** `window.location.href = '/login'` in AppContext (both manual logout and 401 auto-logout). Confirmed intentional — full page reload clears React Router history, preventing back-navigation into authenticated pages after logout. No change.

**Build:** zero errors, 3.11s, 206 modules.

## Known Cleanup Items (post all-screens pass)

- **`ProductCombobox` portal vs. `containerRef` mismatch** (`PurchaseOrders.jsx`) — The "close on outside click" `mousedown` listener checks `containerRef.current.contains(e.target)`. The panel is rendered via `createPortal` to `document.body` and is NOT a DOM descendant of `containerRef`, so any tap on a panel item is treated as an "outside" click and calls `close()` before the item's `onMouseDown` handler runs. Selection still works today because React 18 batches state updates and `onChange(id)` commits synchronously before the re-render, but it's fragile. Fix when refactoring ProductCombobox: either add `panelRef` to the outside-click check (`!containerRef.current.contains(e.target) && !panelRef.current.contains(e.target)`) or switch to a `pointerdown` approach that checks both refs.

- **`Mycredits.module.css` duplicate rules** — `.list`, `.saleCard`, `.progressSection`, `.progressTrack`, `.progressFill`, and `.metaDates` are each defined twice in the file. The second (collapsible-card) block correctly overrides the first (grid layout) block via CSS cascade, so there is no bug. Clean up the dead first definitions once all screens are done.
- **Topbar warning + chat button sticky hover on touch** — these buttons have dynamic inline `background` (conditional on `lowStockCount`/`unreadMsgCount`) which prevents a clean CSS hover replacement. Their `onMouseEnter/Leave` JS handlers remain; on touch, hover tint may stick briefly. Minor cosmetic issue; revisit if flagged by users.
- **`CreateUserModal.jsx` dead code** — `src/components/modals/CreateUserModal.jsx` is defined but never imported anywhere in the codebase. Discovered during the back-button modal audit. Safe to delete when doing a cleanup pass.

## Back-Button Modal History Integration ✅ (2026-06-30)

### Architecture

All 36 modals/panels/overlays in the app were audited. Every single one is pure component `useState` — opening any modal did not push a history entry or change the URL. Phone back button therefore skipped over open modals and jumped to the previous route.

**Pattern chosen: `location.state`-based history entries (no visible URL change)**

Opening a Tier 1 modal pushes a new history entry with `location.state = { ...existingState, [stateKey]: key }` — the pathname and URL are unchanged, so the address bar shows nothing different. Closing calls `navigate(-1)` which pops the entry; the modal key is gone from state, the component unmounts. Page reload clears `location.state` → modal stays closed on reload (acceptable for all Tier 1 modals). No URL query params are used anywhere.

**Hook: `src/hooks/useHistoryModal.js`**

```js
export function useHistoryModal(key, stateKey = 'modal') {
  // isOpen = location.state?.[stateKey] === key
  // open() = navigate(pathname + search, { state: { ...existingState, [stateKey]: key } })
  // close() = navigate(-1)
  return [isOpen, open, close]
}
```

Two state keys are used to allow page-level modals and the Topbar Chat modal to coexist in `location.state` without overwriting each other:
- `stateKey = 'modal'` (default) — page-level Tier 1 modals (Products form, PO Create, PO Edit, Checkout)
- `stateKey = 'chatModal'` — Chat modal, opened from Topbar on any page

This means a user can have a ProductFormPanel open AND open Chat at the same time — Chat pushes `{ modal: 'products-form', chatModal: 'chat' }`. Back button closes Chat first (latest history entry), then the form (next entry). Each level is independent.

### Tier 1 modals — history-aware (back button closes them)

| Modal | stateKey | key | Files changed |
|---|---|---|---|
| Add Product / Edit Product (ProductFormPanel) | `modal` | `'products-form'` | `Products.jsx` |
| Create PO | `modal` | `'po-create'` | `PurchaseOrders.jsx` |
| Edit PO | `modal` | `'po-edit'` | `PurchaseOrders.jsx` |
| Checkout Modal (POS Terminal) | `modal` | `'checkout'` | `Barcodes.jsx` |
| Chat Modal | `chatModal` | `'chat'` | `Topbar.jsx` |

**Edit PO detail:** `editingPO` (the entity) stays in local `useState`. A `useEffect` clears it when `showEditPO` transitions to `false` (covers both back-button close and programmatic close). The modal renders only when `showEditPO && editingPO` — both must be true.

**Checkout detail:** `setShowCheckout` prop passed to `ScanPanel` is replaced with `openCheckout`. ScanPanel calls it as `setShowCheckout(true)` — the argument is ignored since `openCheckout()` takes no parameters. All four `setShowCheckout(false)` calls in `Barcodes.jsx` are replaced with `closeCheckout()`.

### Tier 3 modals — pure state, unchanged (intentional)

All 30+ remaining modals (Delete Confirms ×5, Restock, Repayment, Blacklist, PettyCash transactions, Void, Return, Receive PO, Email PO, Invoice, Payment, Employee Sales, Daily Summary, Debtor Panel, Pending Returns Panel, Expired Stock Move, Expense Add, Employee/Supplier/Store/Category CRUD, Login help) remain as pure `useState`. Rationale: these are fast-action dialogs (≤10 second interactions). Users do not "enter" them in the same way as a form. Back-button-closes-modal for a Delete Confirm would require a double-back to leave the page, which is more surprising than the current behavior. Leave them as-is.

**Build:** zero errors, 3.57s, 207 modules (one new — `useHistoryModal.js`).

## Session Work Log (2026-06-30)

### 1. POS Terminal "gray bars" — DIAGNOSED AND FIXED ✅ (2026-06-30)

**Original symptom:** On `/barcodes` POS Terminal, most product cards in the Stan Retail grid appeared gray/disabled — user described as "stuck loading skeletons (gray bars)", similar to the earlier empty-grid symptom.

**DB diagnostic run (2026-06-30):** Queried Store collection and `products.distinct('store')` directly via Node.js + MongoDB driver. Result: **zero mismatches**. Store names `"Stan Retail"` and `"Stan Liqour"` match exactly in both collections. 16 total products, all stock > 0, none expired. Data corruption theory eliminated.

**Real cause — weighed items:** 8 of 12 Stan Retail products are `isWeighed: true` (Cow-peas, Green Grams, Peas, Potatoes, Rice, Sugar, Tomatoes, washing powder). All have positive stock. The `posProductCardDisabled` class (opacity: 0.4 + grayscale) was applied to weighed items the same as out-of-stock items, making 8/12 cards in Stan Retail appear gray. The "⚖ Scan label" guidance text was barely readable at 0.4 opacity. Stan Liqour's 4 products are all normal/tappable.

**Fix applied — split disabled styles (build-confirmed, zero errors, 3.81s):**

*`POS.module.css`*: Added `.posProductCardWeighed { opacity: 0.72; cursor: not-allowed; }` alongside the unchanged `.posProductCardDisabled { opacity: 0.4; cursor: not-allowed; filter: grayscale(0.3); }`. No grayscale on weighed variant — preserves the blue `var(--primary)` "⚖ Scan label" color so cashiers can clearly read the scan instruction.

*`ScanPanel.jsx`* (line ~332): Split the single ternary into two conditions:
```jsx
outOfStock                       ? p.posProductCardDisabled : '',
product.isWeighed && !outOfStock ? p.posProductCardWeighed  : '',
```
Edge case: a weighed item that is also out of stock gets `posProductCardDisabled` (full 0.4 dim) — it is completely unavailable even via scanner.

**Disabled button attribute unchanged:** `disabled={outOfStock || product.isWeighed}` — tap-blocking is enforced by the HTML `disabled` attribute independent of visual class. `cursor: not-allowed` is explicitly set on both CSS classes so the visual cue is consistent.

---

### 2. POS Terminal — compact product cards on mobile ✅ (2026-06-30)

**Request:** Make product cards smaller/more compact on mobile only, more cards visible without scrolling. Keep vertical scroll. Desktop unchanged.

**Implemented in `src/styles/POS.module.css` inside `@media (max-width: 767px)`. Zero JSX changes. Zero desktop changes. Build-confirmed (zero errors, 3.81s).**

| Selector | Property | Before | After |
|---|---|---|---|
| `.posProductGrid` | `grid-template-columns` | `minmax(140px, 1fr)` | `minmax(110px, 1fr)` |
| `.posProductGrid` | `gap` | `8px` | `6px` |
| `.posProductGrid` | `padding` | `10px 14px` | `8px 10px` |
| `.posProductCardBody` | `padding` | `10px` | `8px` |
| `.posProductCat` | `margin-bottom` | `3px` | `2px` |
| `.posProductName` | `font-size` | `12px` | `11px` |
| `.posProductName` | `margin-bottom` | `7px` | `4px` |
| `.posProductPrice` | `font-size` | `14px` | `12px` |
| `.posProductPrice` | `margin-bottom` | `5px` | `3px` |
| `.posCartBadge` | `top` / `right` | `7px` | `5px` |
| `.posCartBadge` | `width` / `height` | `20px` | `18px` |
| `.posCartBadge` | `font-size` | `10px` | `9px` |

**Net effect:** On a 375px phone, grid goes from 2 → 3 columns (`floor((355+6)/(110+6)) = 3`). Cards are ~15% shorter from tighter margins. Combined: ~50% more products visible per screen height. `-webkit-line-clamp: 2` unchanged — product names stay 2-line to preserve readability under checkout time pressure. Vertical scroll preserved.

---

### 3. Tier 1 Modal Back-Button — Test Checklist (pending user sign-off)

The following checklist was generated and given to the user. Implementation is complete and build-confirmed (zero errors, 3.57s, 207 modules). Awaiting user verification on device before moving on.

**Add / Edit Product (`/products` → ProductFormPanel):**
- [ ] Mobile: Tap "Add Product" → panel slides up → press phone back button → panel closes, stay on Products
- [ ] Mobile: Tap "Edit" on any product → panel opens → press back → panel closes, Products remains visible
- [ ] Mobile: Open edit panel → make no changes → press back → panel closes cleanly (no unsaved-changes prompt — correct, none exists)
- [ ] Desktop: Add Product opens right-side panel, Escape or × closes it (back button not tested on desktop)
- [ ] Both: Backdrop tap closes panel (Products.jsx `onClick={closeModal}` on the overlay div)
- [ ] Both: After save (edit flow), panel auto-closes after 1s via `setTimeout(() => closeModal(), 1000)` — confirm this still fires

**Create PO / Edit PO (`/purchase-orders` → CreatePOModal / EditPOModal):**
- [ ] Mobile: Tap "+ New PO" → modal opens → press back → modal closes, Purchase Orders list visible
- [ ] Mobile: Tap Edit on any PO → edit modal opens → press back → edit modal closes AND `editingPO` entity is cleared (confirm: re-tapping edit loads fresh PO data, not stale)
- [ ] Mobile: Open edit PO → make no changes → press back → closes cleanly
- [ ] Both: `onSaved` path — save PO → modal closes → list refreshes (programmatic `closeCreatePO()` / `closeEditPO()` path, not back button)
- [ ] Both: `onClose` path — tap × on modal → closes (same as back button but via button)

**Checkout Modal (`/barcodes` → CheckoutModal):**
- [ ] Mobile: Add item to cart → tap "Charge" → checkout opens → press back → checkout closes, cart still intact, back on POS terminal
- [ ] Mobile: Complete checkout → receipt shows → tap Done/New Sale → back button does NOT reopen checkout (history entry was popped by `closeCheckout()` in `handleCheckoutConfirm`)
- [ ] Both: "Charge" button disabled when cart empty (unchanged — `onClick={() => cart.length > 0 && setShowCheckout(true)}`)
- [ ] Both: Scanner input refocuses after checkout closes (the `useEffect` on `[tab, showCheckout, receipt, cart]`)

**Chat Modal (Topbar — all pages):**
- [ ] Mobile: Open chat from Topbar → press back → chat closes, stay on current page
- [ ] Both: Open chat on Products page while Add Product panel is open → chat uses `stateKey='chatModal'`, form uses `stateKey='modal'` → state is `{ modal: 'products-form', chatModal: 'chat' }` → back closes chat first, second back closes form
- [ ] Both: `onClose={() => closeChat()}` on ChatModal → × button closes modal normally

---

### 4. Live Search Audit — Complete ✅ (2026-06-30)

**Audit scope:** Every search/filter input across all 21 authenticated routes.

**Finding:** Every search box in the app already filters instantly on keystroke (client-side filter over the already-fetched list). The single exception is the Customers screen (`/customers`), which uses a 300 ms `setTimeout` debounce inside a `useCallback` + `useEffect` chain before firing a server-side search. **This is intentional and correct** — the Customers list is paginated/server-side because the dataset can be arbitrarily large. The 300 ms debounce is the standard pattern for server-side typeahead. No changes needed anywhere.

**Verdict:** Nothing to fix. All 21 screens confirmed.

---

### 5. POS Terminal — Horizontal Scroll Product Strip ✅ (2026-06-30)

**Request:** Change the product grid from a vertical-scroll grid to a horizontal-scroll flex strip on mobile only (~3 cards visible at a time). Desktop unchanged.

**Implementation (CSS-only, zero JSX changes):**

`src/styles/POS.module.css` — `@media (max-width: 767px)` block rewritten:

```css
/* Terminal layout: flex column so posLeft shrinks, posRight fills rest */
.posTerminal { display: flex; flex-direction: column; }
.posLeft     { flex: 0 0 auto; }        /* shrink-wraps to content; overflow: hidden kept */
.posRight    { flex: 1; max-height: none; }

/* Product grid: horizontal scroll strip */
.posProductGrid {
  flex: none; display: flex; flex-wrap: nowrap;
  overflow-x: auto; overflow-y: hidden;
  touch-action: pan-x; scrollbar-width: none;
  -webkit-overflow-scrolling: touch;
  padding: 8px 10px; gap: 6px;
}
.posProductGrid::-webkit-scrollbar { display: none; }

/* Exactly 3 cards fill any phone width (375–430px+) */
.posProductCard { flex-shrink: 0; width: calc((100vw - 22px) / 3); }

/* Empty/loading: fill full strip width */
.posGridEmpty   { flex: 1; min-width: 280px; }
```

`calc((100vw - 22px) / 3)` formula: `100vw − left padding (10px) − 2 gaps (12px) = available width / 3`. Card 3 ends exactly at the viewport edge; card 4 starts ~6px off-screen, signaling there's more to swipe.

**Regressions found and fixed (same session):**

Two bugs appeared after the first implementation attempt:

| Bug | Root cause | Fix |
|---|---|---|
| 4th card partially visible (width wrong) | Fixed `width: 112px` too narrow for wide phones (430px): 3×112 + 2×6 + 10 = 358px, leaving 72px visible for card 4 | Replaced with `calc((100vw − 22px) / 3)` — exactly 3 cards on any phone |
| Horizontal swipe did nothing | `.posLeft { overflow: visible }` in original attempt broke the scroll context — a parent with `overflow: visible` prevents child `overflow-x: auto` from creating a bounded scroll container | Removed the `.posLeft` override entirely. Flex approach (`flex: 0 0 auto`) doesn't need it; base `overflow: hidden` on posLeft is preserved and correct |
| Checkout area broken (green bar, no total) | Same `overflow: visible` + `grid-template-rows: auto 1fr` approach caused posRight to get zero height, crushing the flex column inside it | Replaced `grid-template-rows` approach with `display: flex; flex-direction: column` on `.posTerminal`. posLeft gets `flex: 0 0 auto`, posRight gets `flex: 1; max-height: none` |

**Desktop / tablet:** Entirely unaffected. The `@media (max-width: 767px)` block only fires below 768px. All desktop layout rules unchanged.

**Build:** zero errors (confirmed after each fix iteration).

---

### 6. POS Terminal — Weighed-Item UX (three issues) ✅ (2026-06-30)

Three separate issues with the manual barcode entry flow on `/barcodes` → ScanPanel.

**Issue 1 — Instant product name display (was: generic placeholder text)**

*Before:* After typing a weight barcode (e.g. `2000060692007`), the dropdown showed `"Weighed item label — Press Enter to decode and add"` — a generic placeholder. The product name was not decoded until Enter was pressed.

*Fix:* Client-side instant decode, no API round-trip needed. EAN-13 weight barcodes encode all necessary data in the digits: `2[PLU×5][weight×10×5][0][check]`. Added `decodeWeightBarcode()` to `src/utils/barcodeUtils.js`:

```js
export function decodeWeightBarcode(code) {
  const pluNumber = parseInt(trimmed.substring(1, 6), 10)   // digits 1-5
  const weightKg  = parseInt(trimmed.substring(6, 11), 10) / 10 / 1000  // digits 6-10
  return { pluNumber, weightKg }
}
```

Added `decodedWeighInfo` `useMemo` in `ScanPanel.jsx` that cross-references `pluNumber` against the already-loaded `products[]` array (each product has `pluNumber` from the Product model). The product name, weight (3 dp), and estimated total are displayed the instant a 13-digit weight barcode is typed — before Enter is pressed. Server still validates the check digit on commit. No API call needed for display.

*Dropdown shows:* `"Rice — 0.547 kg"` + `"KSh 109 · Tap or press Enter to add"` vs the old generic placeholder.

**Issue 2 — Dropdown row clickable/tappable (was: Enter-only)**

*Before:* The decoded weighed-item row was a `<div>` — not focusable, not interactive on touch.

*Fix:* Changed to `<button className={p.posManualMatchRow} onClick={commitManual} disabled={decodingManual}>`. Both `onClick` (pointer/keyboard) and tap (touch) now commit the item, identical to pressing Enter. Disabled during in-flight decode to prevent double-submission.

**Issue 3 — Weighed cards visually distinct (was: opacity difference only)**

*Before:* Weighed product cards were `opacity: 0.72` — distinguishable only by subtle dimming. No color cue.

*Fix:* Added muted-blue border + wash to `.posProductCardWeighed` in `POS.module.css`:

```css
.posProductCardWeighed {
  opacity: 0.72;
  cursor: not-allowed;
  border-color: rgba(30, 95, 165, 0.55);   /* muted primary blue */
  background: rgba(30, 95, 165, 0.05);     /* very light blue wash */
}
```

Color rationale: primary brand blue (matches the ⚖ icon already shown on the card) at low opacity — clearly distinct from the normal gray border/white background, clearly distinct from out-of-stock (grayscale 0.3), does not look like an error state. `.posProductCardInCart` still uses `!important` on border/background so the in-cart badge overrides the weighed styling correctly when a weighed item is in the cart.

**Build:** zero errors, 207 modules.

---

### 7. Barcodes Table — Mobile Scroll, Sticky Header, fmtQty ✅ (2026-06-30)

**Problem:** The "All Product Barcodes" table on `/barcodes` has 8 columns. On mobile (≤768px), `.tableCard { overflow: hidden }` clipped the table at the card's right edge — the Barcode, Product ID, Type, Stock, and Sell Price columns were invisible with no way to scroll. Column headers also scrolled away, leaving no context for which column was which. Stock column displayed raw floats (IEEE 754 noise).

**Fix — `Barcodes.module.css` `@media (max-width: 768px)` block + one JSX import:**

```css
@media (max-width: 768px) {
  .tableCard {
    overflow-x: auto;
    overflow-y: auto;
    max-height: calc(100svh - 260px);   /* ~10–12 rows visible; remainder scrollable */
    -webkit-overflow-scrolling: touch;
    touch-action: pan-x pan-y;
  }
  .barcodeTable thead tr {
    position: sticky;
    top: 0;
    z-index: 1;
    background: var(--bg-muted);        /* opaque — covers rows scrolling beneath */
  }
}
```

**Sticky header pattern:** Identical to `SaleCard.jsx:122–126` (Sales History receipt table) — the scroll container has `overflow-y: auto` + `max-height`, and `<thead> <tr>` gets `position: sticky; top: 0; z-index: 1; background: var(--bg-muted)`. `100svh` (small viewport height, excludes mobile browser chrome) minus ~260px of page chrome (Topbar + tabs + toolbar + hint) gives ~490px on a standard phone — 10–12 rows visible before scroll.

**fmtQty on Stock column (`ProductBarcodesTable.jsx`):**
- Added `import { fmtQty } from '@/utils/utils'`
- Stock display: `{currentStock} {p.unit}` → `{fmtQty(currentStock)} {p.unit}`
- `currentStock` raw value left untouched for `stockClass` threshold comparisons (≤3 critical, ≤6 low)
- Print output (`handlePrintTable` reads `printRef.current.innerHTML`) automatically picks up the formatted values

**Desktop:** Base `.tableCard { overflow: hidden }` untouched. Media block fires only at ≤768px. Zero desktop change. `printRef` wraps the inner `<div>` not `.tableCard`, so print layout is unaffected.

**Build:** zero errors, 2.40s.

---

## Open Items — Pending Action (as of 2026-06-30)

### NOT STARTED: Setup Wizard Screen

`/setup` (SetupWizard) has a `SetupWizard.module.css` with scroll + button fixes applied (listed in Screens Completed table), but the **actual Setup Wizard user-facing flow** (onboarding steps: store creation, first user, initial stock) has never been built. This is a separate feature build, not a CSS fix. Requires its own planning session.

### NOT STARTED: App.jsx `100dvh` shared-shell (Part 2)

`App.jsx` lines 62, 68: `height: '100dvh'` was set as part of the merged-header change (V3 navigation overhaul removed the 56px offset). Code is in place. **What is outstanding:** real-device confirmation that `100dvh` matches the visible viewport correctly on iOS Safari and Android Chrome (browser UI chrome can shrink `100vh` but `100dvh` should be reliable). Hold verification until Purchase Orders and Sales History pass their real-device scroll tests.

### Pending: Real-Device Verification

All code is build-clean. The following have NOT been confirmed on a real phone since the fixes were applied:

**Priority — these had confirmed real-phone failures before the fix:**

| Screen | Route | What to verify |
|---|---|---|
| Purchase Orders | `/purchase-orders` | Zero-height collapse fix; stacked card layout ≤768px; Create PO modal combobox height + stacked items cards; 44px touch targets throughout |
| Sales History | `/sales-history` | Zero-height collapse fix; SalesFilters condensed layout (search+date row, category overflow chips, store chip row); sticky employee header at `top: 0` under merged single Topbar |

**POS Terminal — all changes from this session (first-device verification):**

| Feature | What to verify |
|---|---|
| Horizontal product strip | 3 cards visible, swipe left/right scrolls, card 4 starts off-screen as expected |
| `calc((100vw − 22px) / 3)` width | Exactly 3 full cards at 375px, 390px, 430px (no 4th card peeking in) |
| Checkout area | Total amount visible, "Charge Customer" button present and tappable, no broken green bar |
| Weighed cards | Blue border + blue wash visible; distinct from normal (gray) and OOS (grayscale) cards |
| Instant barcode decode | Type `2000060692007` → popup shows product name + weight immediately (before Enter) |
| Tap to add weighed item | Tap decoded row → item added (no Enter required) |

**Back-office screens — constrained-scroll fix applied proactively, first-time device verification:**

| Screen | Route | What to verify |
|---|---|
| Products | `/products` | Mobile card view; chip overflow dropdowns; 44px action buttons |
| Employees | `/employees` | Scroll, 44px modal buttons |
| Categories | `/categories` | Scroll, table overflow, 44px Add/Edit/Delete |
| Suppliers | `/suppliers` | Scroll, 44px table action buttons |
| Stores | `/stores` | Scroll, store rename cascade warning banner |
| StockOut | `/stock-out` | Scroll, 44px POS Terminal button |
| DailyArchives | `/daily-archives` | Scroll, ArchiveCard touch targets |
| ExpiredStock | `/expired-stock` | Scroll, 44px Move button |
| Settings | `/settings` | 2-col grid collapses to 1-col on mobile |
| Profile | `/profile` | 2-col grid collapses to 1-col on mobile |
| Reports | `/reports` | Scroll, hover guards don't stick on touch |
| DailyReport | `/daily-report` | Scroll |
| PettyCash | `/petty-cash` | Scroll |

**Navigation overhaul (device verification):**
- Merged Topbar (single bar, 62px): hamburger opens drawer, breadcrumb shows on `/profile` + `/settings`
- Sidebar brand → navigates home and closes drawer
- Back button steps one page at a time (no redirect trap at `/` for non-owners)

### Pending: Tier 1 Modal Back-Button Checklist (see Section 3 above)

Four modals + Chat await real-device confirmation. Checklist is in Section 3.

### Known Cleanup (deferred)

- `CreateUserModal.jsx` — never imported anywhere; safe to delete
- `Mycredits.module.css` — 6 class definitions duplicated; second block wins via cascade (no bug), dead first definitions can be removed
- `ProductCombobox` portal fragility — `containerRef.contains(e.target)` misses portal clicks; works today due to React 18 batching but is fragile
- Topbar warning + chat buttons — dynamic inline `background` blocks CSS hover replacement; JS `onMouseEnter/Leave` handlers remain; brief sticky hover tint on touch (cosmetic only)

### 13. HTTPS for Local Development (Camera Scanning prerequisite) 🔄 IN PROGRESS (2026-07-01)

**Why:** `getUserMedia` (phone camera API) requires a secure context — HTTPS or `localhost`. The app is served over LAN HTTP (`http://192.168.1.169:5174`), so camera access is browser-blocked on any real phone. Additionally, an HTTPS frontend making HTTP API calls is blocked as "mixed content" by all modern browsers, so **both** the Vite dev server and the Express backend must be HTTPS.

**Blocker:** mkcert is not installed on this machine. It must be installed before any file changes can be made.

**Install step (Admin PowerShell — not yet done):**
```powershell
winget install FiloSottile.mkcert
# close and reopen PowerShell, then:
mkcert --version
mkcert -install
```

**Certificate generation (after install — run from `frontend/malimali-system/`):**
```powershell
New-Item -ItemType Directory -Force certs
cd certs
mkcert -key-file key.pem -cert-file cert.pem localhost 192.168.1.169
```

**9 file changes queued (not yet applied — awaiting mkcert install):**

| # | File | Change |
|---|---|---|
| 1 | `frontend/malimali-system/.gitignore` | Add `certs/` — private key must not be committed |
| 2 | `frontend/malimali-system/vite.config.js` | Add `import fs`; add `https: { key, cert }` to server block |
| 3 | `frontend/malimali-system/.env` | `VITE_API_URL` → `https://192.168.1.169:5000` (mixed content fix) |
| 4 | `backend/server.js` | Replace `app.listen(...)` with `https.createServer({ key, cert }, app).listen(...)` |
| 5 | `backend/.env` | Add `https://localhost:5174` and `https://192.168.1.169:5174` to `FRONTEND_URL` |

No code changes needed to CORS logic — `server.js` already does exact-match against `ALLOWED_ORIGINS` split from `FRONTEND_URL`; adding the HTTPS origins to `.env` is sufficient.

**Phone trust setup (required after certs generated):**
- Run `mkcert -CAROOT` to find the root CA file
- Android: Settings → Security → Encryption & credentials → Install a certificate → CA certificate (`rootCA.pem`)
- iOS: AirDrop `rootCA.pem` → open → Settings → General → VPN & Device Management → install, then General → About → Certificate Trust Settings → enable

**Next action:** User runs the three mkcert commands above → confirms version output → all 5 file changes applied immediately.

---

### 12. SMS Receipts — Africa's Talking Sandbox Auth Unresolved ⚠️ (2026-07-01)

**Code status: complete and correct.** The SMS receipt feature (`backend/utils/smsReceipt.js`) is fully implemented using a direct `fetch` POST (no SDK) to `https://api.sandbox.africastalking.com/version1/messaging`. The request format, headers (`apiKey` with capital K per AT docs), form-encoded body, phone normalisation, fire-and-forget callback integration, and debug logging are all correct.

**Unresolved: Africa's Talking sandbox returns 401 "supplied authentication is invalid"** despite correct credentials format. Investigation so far:

- AT_USERNAME=`sandbox`, AT_API_KEY=9-character sandbox key (correct length for AT sandbox keys)
- SDK version 0.8.0 investigated — `username: 'sandbox'` correctly triggers `Common.enableSandbox()` internally (URL switches to `https://api.sandbox.africastalking.com`)
- SDK replaced with direct `fetch` to rule out any SDK initialization issue — same 401
- Header uses `apiKey` (capital K, matching AT docs exactly)
- Body sends `username=sandbox` + `to=+254...` + `message=...` as `application/x-www-form-urlencoded`
- AT returns full error body (logged): `"supplied authentication is invalid"`
- Debug logging confirms env vars are read correctly (masked key matches what was pasted from AT dashboard)

**Most likely cause: AT account/sandbox configuration issue, not a code issue.** Possible causes:
1. Sandbox API key not yet activated — AT sandbox accounts sometimes require email verification before the API key works
2. Key copied from wrong section of AT dashboard — sandbox key is under a separate "Sandbox" tab, not the main API key tab
3. AT sandbox service intermittent — the AT sandbox has known reliability issues

**Resolution path:**
1. Log into Africa's Talking dashboard → verify email is confirmed
2. Navigate to Sandbox tab (not the main API section) → copy the key shown there
3. Try a direct `curl` test from the server machine to confirm the key works independently of Node.js:
```powershell
curl -X POST https://api.sandbox.africastalking.com/version1/messaging `
  -H "apiKey: YOUR_KEY_HERE" `
  -H "Accept: application/json" `
  -H "Content-Type: application/x-www-form-urlencoded" `
  -d "username=sandbox&to=%2B254712345678&message=test"
```
4. If `curl` also returns 401: AT account issue — contact AT support or recreate sandbox app
5. If `curl` returns 201: Node.js environment issue — check for whitespace/invisible chars in `.env` AT_API_KEY value

**Impact: zero impact on M-Pesa payment flow.** SMS is fire-and-forget — a 401 is caught, logged, and discarded. Sales, receipts, stock deduction, and socket notifications all proceed normally.

---

### 11. SMS Receipts via Africa's Talking — M-Pesa Payments ✅ (2026-07-01)

**Scope:** Every confirmed M-Pesa payment now triggers an automatic SMS receipt to the customer's phone. Pure backend feature — zero frontend changes.

**Files changed (5):**

| File | Change |
|---|---|
| `backend/package.json` | `africastalking` added (16 new packages) |
| `backend/utils/smsReceipt.js` | New utility — lazy AT client init, phone normalisation, message format, fire-and-forget send |
| `backend/routes/mpesa.js` | `require('../utils/smsReceipt')` added; fire-and-forget call after `sale.save()` in `ResultCode === 0` branch |
| `backend/.env` | Three new AT variables appended with sandbox placeholders |
| `backend/.env.example` | New file — all env vars documented with comments and guidance |

**SMS message format (compact, always ≤160 chars):**

```
Main Store
Receipt: RCP-789012-345
3 items · KSh 1,850
Mpesa: QGH9KL2M3P
2026-07-01
Thank you!
```

All values come from fields already present on the `sale` document at callback time — no additional DB query or populate needed: `sale.store`, `sale.receiptId`, `sale.items.length`, `sale.paymentInfo.finalTotal ?? sale.total`, `mpesaReceiptNumber` (from callback metadata), `sale.date`.

**Placement in callback handler (`backend/routes/mpesa.js`):**

Fire-and-forget immediately after `await sale.save()`, before the socket emits — same pattern as `WeighBarcodeLog` audit trail. The Safaricom callback `res.json(...)` is sent before the async processing block runs, so SMS delivery never touches the HTTP response latency.

**Lazy initialisation — no startup failures with placeholder credentials:**

The Africa's Talking SDK client is created inside `getSmsClient()` on first call to `sendSmsReceipt()`, not at module load time. At startup with `AT_API_KEY=placeholder`, the module loads cleanly. The SDK only fails when an actual `sms.send()` call is attempted — at that point the error is caught and logged. Confirmed: `node -e "require('./utils/smsReceipt')"` returns with zero errors.

**Sandbox vs production toggle — env vars only, zero code changes:**

| Variable | Sandbox | Production |
|---|---|---|
| `AT_USERNAME` | `sandbox` | your AT account username |
| `AT_API_KEY` | sandbox key from AT dashboard | live key from AT dashboard |
| `AT_SENDER_ID` | (blank) — AT uses `AFRICASTALKING` | your registered sender ID (e.g. `MALIPOS`) |

**Phone number normalisation:** `mpesaPhone` can arrive as `07XXXXXXXX`, `2547XXXXXXXX`, or `+2547XXXXXXXX`. The `normalizePhone()` helper in `smsReceipt.js` converts all three to E.164 (`+254...`) before sending. Missing/blank phone number is handled gracefully — logs a warning and returns without sending.

**To enable in sandbox:**
1. Create free account at africastalking.com
2. Dashboard → API Key → copy sandbox key
3. Set `AT_API_KEY=<copied key>` in `.env` (leave `AT_USERNAME=sandbox`)
4. Trigger a test M-Pesa payment through the sandbox STK push flow
5. Check AT dashboard → Sandbox → SMS → Sent Messages for delivery confirmation

---

### 10. Manual Entry Bar — Exact-Match Barcode Bug Fix ✅ (2026-06-30)

**Severity: Data integrity. Real sales were at risk.**

**Root cause:** `manualMatch` memo in `ScanPanel.jsx` used `.includes()` substring matching on all three axes — barcode, Product ID, and product name. Typing any short partial string (e.g. `"38"`) fired a green-checkmark confident match against the first product whose barcode happened to contain that substring anywhere. Pressing Enter or tapping immediately called `addToCart()` with no further validation. Confirmed via screenshot: typing `"38"` matched and added "Cake" (barcode containing `"38"` as a substring). No error, no warning, no confirmation.

**All three matching axes were broken in different ways:**

| Axis | Before | Risk |
|---|---|---|
| Barcode | `.includes()` substring | Partial digits match wrong product — confirmed bug |
| Product ID | `.includes()` substring | **Higher risk than barcode:** MongoDB ObjectIDs are 24-char hex strings; any 1–3 char hex input matches some ID in a typical product list |
| Name | `.includes()` substring | Typing a single letter adds the first product whose name contains it — name search has no place in a code-entry bar |

**Fix — `manualMatch` memo rewritten to exact-match only (`ScanPanel.jsx`):**

```js
// BEFORE — substring match on all three axes
return products.find(prod =>
  !prod.isWeighed && (
    String(prod.barcode || '').toLowerCase().includes(code.toLowerCase()) ||
    String(prod._id || '').toLowerCase().includes(code.toLowerCase()) ||
    prod.name?.toLowerCase().includes(code.toLowerCase())
  )
) || null

// AFTER — exact match on barcode and ID; name matching removed entirely
const lower = code.toLowerCase()
return products.find(prod =>
  !prod.isWeighed && (
    (prod.barcode && String(prod.barcode).toLowerCase() === lower) ||
    prod._id === lower
  )
) || null
```

**What the fix does:**
- Barcode: `===` exact match (case-insensitive for non-EAN alphanumeric edge cases)
- Product ID: `===` exact match — cashier must type all 24 hex chars; no substring accident possible
- Name: removed entirely — belongs in the search bar (`search` state → `filteredProducts` memo), which already does substring/includes correctly and never touches the cart

**What is unchanged:**
- Physical scanner: uses `scanInputRef` / `handleScanKeyDown` in `Barcodes.jsx` — a completely separate input, never touches `manualMatch`. Unaffected.
- Search bar: separate `search` state, `filteredProducts` memo still uses name-includes for grid filtering. Unaffected.
- Weighed items: excluded by `!prod.isWeighed` guard (Issue 2 fix). Unchanged.
- `commitManual()` call site: still calls `addToCart(manualMatch.barcode || manualMatch._id)` on match. The fix is entirely in what `manualMatch` returns.

**Cashier UX after fix:**
- Typing `"38"` → no match → "No product found" ✓
- Typing `"cake"` → no match → "No product found" (use search bar to browse) ✓
- Typing full 13-digit EAN-13 barcode → exact match → product added ✓
- Physical scanner (outputs full barcode in one burst) → unaffected ✓
- Typing full 24-char ObjectID (fallback when label is damaged) → exact match ✓

**Build:** zero errors, 2.83s, 207 modules.

---

### Flagged Future Consideration — Weighed-Barcode Single-Use Prevention

**Not implementing now.** Physical workflow makes accidental reuse essentially impossible (label is on the item the customer walks out with). Deliberate reuse requires real effort and is partially self-limiting by stock depletion. Decision: watch via audit log, don't block.

**If reuse is ever detected via the `weighbarcodelogs` audit trail**, the full prevention system would be:
- `usedWeighBarcodes` collection storing accepted codes with a short TTL (e.g. 24h, matching physical label freshness)
- Check against this collection in the `/api/weigh-station/decode` handler before accepting a barcode
- Alternative: time-based nonce in barcode generation (would require DIGI SM-500 compatibility check)

The audit trail (Section 8) must be running and showing repeated entries before this is worth building.

---

### 8. Weighed-Barcode Audit Trail ✅ (2026-06-30)

**Context:** Weighed-item barcodes have no single-use mechanism — the same 13-digit code can be decoded and committed any number of times. Full single-use prevention (TTL table, signed nonces) deferred as "watch, don't block" given physical workflow makes accidental reuse essentially impossible and deliberate reuse is partially self-limiting by stock depletion.

**Lightweight mitigation: fire-and-forget audit log on every successful decode.**

**New model — `backend/models/WeighBarcodeLog.js`:**
- Fields: `barcode` (indexed), `pluNumber` (indexed), `weightGrams`, `weightKg`, `totalPrice`, `productId`, `productName`, `store`, `cashierId`, `cashierName`, `decodedAt` (indexed, Date)
- Collection: `weighbarcodelogs`
- No TTL — kept indefinitely for audit purposes

**Write point — `backend/routes/weighStation.js` `/decode` handler:**
- Fires immediately after `res.json(...)` (response already sent — cashier never waits for log write)
- Fire-and-forget: `.create({...}).catch(err => console.error('[WeighBarcodeLog]', err.message))`
- A log write failure is a server warning only; it never fails or slows the decode response

**Querying the audit trail (MongoDB shell):**
```js
// Spot barcode reuse — all decodes of one specific code
db.weighbarcodelogs.find({ barcode: '2000060692007' }).sort({ decodedAt: -1 })

// All decodes of a PLU across all cashiers
db.weighbarcodelogs.find({ pluNumber: 6 }).sort({ decodedAt: -1 })

// Barcodes decoded more than once — reuse candidates
db.weighbarcodelogs.aggregate([
  { $group: { _id: '$barcode', count: { $sum: 1 }, cashiers: { $addToSet: '$cashierName' } } },
  { $match: { count: { $gt: 1 } } },
  { $sort: { count: -1 } }
])
```

**Files changed:** `backend/models/WeighBarcodeLog.js` (new, 16 lines), `backend/routes/weighStation.js` (+1 require, +12 lines after `res.json()`). Zero frontend changes. Zero new routes. Backend syntax: clean. Frontend build: zero errors, 2.60s.

---

### 9. Weighed-Barcode Manual Entry UX — Issues 1a + 2 ✅ (2026-06-30)

**Issue 1a — Silent commit failure replaced with visible error feedback (`ScanPanel.jsx`):**

Root cause: when a mistyped weight barcode passed the client-side preview (no check-digit validation client-side, by design) but was rejected by the server's check-digit check, `commitManual()` silently called `setDecodingManual(false); return` — no message, no banner, nothing. Cashier couldn't tell whether the item was added.

Fix — `ScanPanel.jsx`:
- Added `const [manualError, setManualError] = useState('')`
- Added `useEffect(() => { setManualError('') }, [manualCode])` — error clears the instant the cashier edits the field, so it never lingers after correction
- `!data.success` branch: `setManualError(data.message || 'Invalid barcode — check the digits and try again'); setDecodingManual(false); return` — server message surfaced verbatim (e.g. "Barcode check digit is invalid"); `manualCode` stays in the input so the cashier sees what they mistyped
- `catch` block: `setManualError('Could not reach server — check your connection and try again.'); setDecodingManual(false); return` — same pattern for network failures; code stays in input
- Both failure paths `return` before the post-try `setManualCode('')`, so the input is only cleared on success
- Added `{manualError && <div className={p.posErrorBanner}>…</div>}` immediately below the existing `scanError` banner in JSX — reuses the same styled banner class

**Issue 2 — Weighed products excluded from manual-entry name match (`ScanPanel.jsx`):**

Root cause: `manualMatch` memo matched by `prod.name` with no `isWeighed` guard. Typing "rice" in the manual entry bar surfaced the weighed "Rice" product as a tappable button, which called `addToCart(rice._id)` — the wrong code path (no weight data, no price-per-kg calculation).

Fix: added `!prod.isWeighed &&` guard to `products.find()` in `manualMatch`. Weighed products now fall through to "No product found" in the dropdown, directing cashiers to the search bar (for browsing) or the scan flow (for adding). Added a comment above the memo explaining why the guard is there. Normal products unaffected.

**Build:** zero errors, 2.59s, 207 modules.

---

## API URL Centralization (completed earlier)

All 26 frontend source files that hardcoded `http://localhost:5000` now import from `src/config/api.js`. Switch environments with a single `.env` edit (`VITE_API_URL`).

---

## Future Feature — Dual-Mode Scanning + M-Pesa Digital Receipts

**Status: NOT started. Not yet scoped. Requires a dedicated planning session before any implementation.**

This is a significant feature touching camera/hardware APIs, a barcode-scanning library, M-Pesa webhook handling, and potentially a new SMS gateway. It must not be started without a full fresh planning pass — the primary risk is destabilizing the existing physical-scanner flow that stores currently depend on in production.

### Requirements

**1. Dual-mode checkout (same underlying logic, two input paths)**

Stores must be able to use EITHER:
- **Physical scanner + receipt printer** — large-scale / supermarket setup (current production mode, must not be changed or risked)
- **Phone camera as scanner, no printer** — small-scale retailer setup (new mode)

Both modes feed into the **exact same cart / sale / checkout logic**. Camera-scanned items must behave identically to scanner-read items: same `addToCart()` call, same stock deduction, same sale record in the database, same receipt object. The camera mode is purely an alternative *input path* — nothing downstream changes.

**2. Camera-based barcode scanning**

Use the phone's camera via the browser to read product barcodes and add items to cart. `html5-qrcode` is **already listed in this project's dependencies** (confirmed in the original codebase audit) — no new package install required, just integration. Camera stream should activate on the Scan tab when camera mode is selected, decode the barcode, and call the same `addToCart(barcode)` function the physical scanner uses.

**3. M-Pesa-based digital receipts**

When a customer pays via M-Pesa:
1. Capture the phone number they paid from (already collected in the checkout form)
2. Once payment is validated and confirmed via the M-Pesa Daraja callback (already configured — `MPESA_CALLBACK_URL` in `backend/.env`, callback handler exists in backend routes)
3. Automatically send the customer a digital receipt to that number

**OPEN QUESTION before implementation — delivery channel:**
- **SMS** — requires a new third-party SMS gateway integration (e.g. Africa's Talking, which has a Kenya-focused API). New dependency, new API key, new cost per message.
- **Other channels** — to be evaluated at planning time (WhatsApp Business API, email if phone number resolves to a registered account, etc.)

This decision must be made at the start of the planning session. Do not begin implementation until the channel is chosen and the integration approach is agreed.

**4. No-printer mode**

In camera mode, no physical receipt is printed. Every transaction is still fully recorded in the database (same `recordMultipleSales()` call, same Sale document schema, same receipt object) and retrievable in Sales History, Daily Archives, and Reports — identical to scanner-mode transactions. The only difference is that no paper receipt is generated.

### Planning prerequisites (before next session on this feature)

- [ ] Decide digital receipt delivery channel (SMS via Africa's Talking vs other)
- [ ] Confirm `html5-qrcode` version in `package.json` and check for any known mobile browser compatibility issues (iOS Safari camera permissions, Android Chrome)
- [ ] Audit the existing M-Pesa callback handler in backend routes — confirm it receives confirmation payload reliably and understand retry/timeout behavior
- [ ] Design the mode-switching UI: how does the cashier/owner toggle between scanner mode and camera mode? Per-session toggle in the tab bar? Per-store setting in Settings?
- [ ] Confirm whether the camera stream and the hidden `scanInputRef` (physical scanner input) can coexist without interfering — the hidden input currently has `autoFocus` which may conflict with the camera UI on some browsers

---

## End-of-Session Backlog — Full Remaining Work (2026-06-30)

Everything below is confirmed outstanding as of the end of this session. Nothing here has been skipped by accident — each item is a deliberate defer with the reason recorded.

### A. Real-device verification (code done, device not yet confirmed)

All of the following have been code-changed and build-confirmed. None have been tested on a physical phone since the changes were applied.

**Priority — had confirmed real-phone failures before fix was applied:**

| Screen | Route | What to verify |
|---|---|---|
| Purchase Orders | `/purchase-orders` | Zero-height collapse fix; stacked card layout ≤768px; Create PO modal combobox height + item cards on mobile; 44px touch targets |
| Sales History | `/sales-history` | Zero-height collapse fix; SalesFilters layout (search+date row, 3-chip overflow, store chips); sticky employee header at `top: 0` under the merged single Topbar |

**Back-office screens — first-time device verification:**

| Screen | Route | What to verify |
|---|---|---|
| Products | `/products` | Mobile card view; sticky filter `top-0 z-20`; chip overflow dropdowns; 44px action buttons |
| Employees | `/employees` | Scroll, 44px modal buttons |
| Categories | `/categories` | Scroll, table overflow, 44px Add/Edit/Delete |
| Suppliers | `/suppliers` | Scroll, 44px table action buttons |
| Stores | `/stores` | Scroll, store rename cascade warning banner |
| StockOut | `/stock-out` | Scroll, 44px POS Terminal button |
| DailyArchives | `/daily-archives` | Scroll, ArchiveCard touch targets |
| ExpiredStock | `/expired-stock` | Scroll, 44px Move button |
| Settings | `/settings` | 2-col grid collapses to 1-col; scroll |
| Profile | `/profile` | 2-col grid collapses to 1-col; items-sold stat |
| Reports | `/reports` | Scroll, hover guards don't stick on touch |
| DailyReport | `/daily-report` | Scroll |
| PettyCash | `/petty-cash` | Scroll |

**Navigation — verify after V3 merged bar:**
- Single Topbar with hamburger opens drawer, drawer overlays bar correctly
- Breadcrumb shows on `/profile` and `/settings`
- Sidebar brand button navigates home and closes drawer
- Back button steps through pages one at a time (no trap at `/` for non-owners)

**POS Terminal — verify after today's fixes (updated — see POS layout change below):**
- Weighed item cards appear at `opacity: 0.72` with readable "⚖ Scan label" text
- Out-of-stock cards appear at `opacity: 0.4` (fully dimmed, unchanged)
- Mobile product grid scrolls **horizontally** (~3 cards visible, swipe sideways)
- Cart panel fills the majority of the screen below the product strip
- Desktop layout unchanged

**Tier 1 modal back-button — verify on device:**
- Add/Edit Product: back button closes panel, stays on Products
- Create/Edit PO: back button closes modal, Edit PO clears `editingPO` entity
- Checkout Modal: back button closes checkout, cart preserved
- Chat Modal: back button closes chat from any page; coexists with page-level modal

### G. POS Terminal — horizontal-scroll product grid + cart reflow ✅ (2026-06-30)

**Context:** The product grid is a secondary/fallback affordance. Primary flow is physical barcode scanning → item added to cart directly. Cashiers browse the grid only when a scan fails, then use the search bar. This makes a compact horizontal strip more appropriate than a tall scrollable grid that dominates the screen.

**Approved plan — two parts, all changes in `POS.module.css` inside `@media (max-width: 767px)`, zero JSX changes:**

**Part A — posProductGrid: grid → horizontal flex strip**
- `grid-template-columns: repeat(auto-fill, minmax(110px, 1fr))` removed; replaced with `display: flex; flex-wrap: nowrap; overflow-x: auto; overflow-y: hidden; touch-action: pan-x; scrollbar-width: none; -webkit-overflow-scrolling: touch; flex: none`
- `.posProductCard` gets `flex-shrink: 0; width: 112px` — ~3 cards visible at a time on a 375px phone
- `.posGridEmpty` gets `flex: 1; min-width: 280px` — empty/loading state takes full strip width
- Same category-pills horizontal-scroll pattern (`posCatBar`) — consistent interaction idiom
- Compact card-body sizing rules from the previous change (padding, font sizes, cart badge) remain unchanged and work in flex context

**Part B — terminal layout: cart fills freed height**
- `grid-template-rows: 1fr auto` (960px rule) overridden to `auto 1fr` at ≤767px
- posLeft shrink-wraps to content (~320px: search + manual entry + cat pills + horizontal strip)
- posRight gets `max-height: none` (removes 42vh cap) and fills the `1fr` remainder (~380px on a 375×812 phone)
- Cart becomes the dominant element on mobile — appropriate for checkout workflow
- `.posLeft { overflow: visible }` — no longer clips internal scroll (grid no longer scrolls internally)

**Desktop/tablet impact:** Zero. All rules inside `@media (max-width: 767px)`. Tablets (768–960px) retain vertical-grid layout from the existing 960px breakpoint.

---

### H. Live Search Audit — COMPLETE ✅ (2026-06-30)

**Finding: Every search input in the codebase already filters live on every keystroke. Nothing to fix.**

Full inventory — all 13 search inputs found across the app:

| Screen | File | State var | Filter mechanism | Verdict |
|---|---|---|---|---|
| POS — product search | `ScanPanel.jsx:177` | `search` | `useMemo([products, activeCategory, search])` | ✅ Instant |
| POS — Barcodes tab | `ProductBarcodesTable.jsx:67` | `search` | In-render `.filter()` | ✅ Instant |
| POS — Generate Barcodes | `GenerateBarcodes.jsx:64` | `searchQuery` | In-render `.filter()` | ✅ Instant |
| Products | `ProductFilters.jsx:88` | `search` | In-render `.filter()` in Products.jsx | ✅ Instant |
| Sales History | `SalesFilters.jsx:88` | `search` | In-render `.filter()` in SalesHistory.jsx | ✅ Instant |
| Purchase Orders | `PurchaseOrders.jsx:237` | `searchText` | `useMemo([orders, searchText])` | ✅ Instant |
| Employees | `Employees.jsx:112` | `searchTerm` | In-render `.filter()` | ✅ Instant |
| Weigh Station | `WeighStation.jsx:400` | `search` | In-render `.filter()` | ✅ Instant |
| Daily Archives | `DailyArchives.jsx:97` | `search` | In-render date comparison | ✅ Instant (date picker) |
| Chat Modal | `ChatModal.jsx:454` | `search` | In-render `.filter()` on contacts | ✅ Instant |
| Customers | `Customers.jsx:557` | `search` | `useCallback` deps → `useEffect` → 300ms `setTimeout` → `fetchCustomers({ search })` API call | ⚠️ 300ms debounced — **intentional, correct, leave as-is** |
| Suppliers | — | — | No search input (active/archived toggle only) | N/A |
| Expenses | — | — | No search input | N/A |

**Customers is intentionally different** and correct: the customer list is fetched server-side with a `?search=` query parameter rather than filtered client-side. 300ms debounce prevents API flooding on every keystroke and handles out-of-order responses (via `let active = true` cancel flag). 300ms is below the perceptible-lag threshold. No change needed.

**`onKeyDown` Enter handlers confirmed non-search** (all correct): Login form submit, barcode scanner input, manual code input in ScanPanel, barcode capture in ProductFormPanel, weight/amount entry in WeighStation, combobox keyboard nav in PurchaseOrders, accessibility keyboard shortcuts on div-as-button elements. None gate a text search.

**No debounce library imported anywhere in `src/`.** The only `debounce` mention in the frontend is a comment in a test file about the checkout credit-check's 500ms delay (unrelated to search).

---

### I. POS Terminal — Weighed-item manual entry UX ✅ (2026-06-30)

Three improvements to the manual barcode/label entry flow on `/barcodes`:

**Issue 1 — Instant product name decode (was: generic placeholder)**
- **Root cause:** The decode API (`POST /api/weigh-station/decode`) was the only decode path. It runs only on commit (Enter), so the dropdown had no product data to show beforehand — just a static placeholder.
- **Fix:** Added `decodeWeightBarcode()` to `barcodeUtils.js`. It's a pure math function (no API): parses PLU from digits [1-5] and weight from digits [6-10] of the EAN-13 code. Added `decodedWeighInfo` `useMemo` in `ScanPanel.jsx` that cross-references `pluNumber` against the already-loaded `products` array. Result: as soon as 13 digits are typed/scanned, the dropdown shows `"Sugar — 0.692 kg"` and `"KSh 89 · Tap or press Enter to add"` — no network request, no waiting.
- **Fallback:** If the PLU isn't found in the local products array (e.g. owner viewing a different store), falls back to `"Weighed item label — Press Enter to decode and add"`. The server still validates the check digit and stock on commit either way.
- **Files:** `src/utils/barcodeUtils.js` (new export), `src/pages/Barcodes/ScanPanel.jsx` (new import + useMemo + dropdown JSX)

**Issue 2 — Dropdown row is now clickable/tappable (was: non-interactive div)**
- Changed the weighed dropdown row from `<div style={{ cursor: 'default' }}>` to `<button onClick={commitManual} disabled={decodingManual}>` — matching the existing normal-product match row pattern.
- Works on both desktop (click) and mobile (tap). Enter continues to work as before.
- While decoding, the button is `disabled` and meta text changes to `"Reading weight & price…"`.

**Issue 3 — Weighed cards visually distinct in product grid**
- Added `border-color: rgba(30, 95, 165, 0.55)` and `background: rgba(30, 95, 165, 0.05)` to `.posProductCardWeighed` in `POS.module.css`.
- Three visually distinct card states: normal (gray border, white bg), weighed (muted blue border, faint blue wash, opacity 0.72), out-of-stock (opacity 0.4 + grayscale).
- In-cart overrides weighed via `!important` on both border and background — correct for weighed items added to cart via label scan.

---

### B. App.jsx `100dvh` shared-shell (code done, device verification pending)

`height: '100dvh'` applied in App.jsx outer wrapper and inner content div. Old `calc(100dvh - 56px)` mobile offset removed (the 56px bar it compensated for was deleted in V3). Code is correct. **Pending:** real-device confirmation that `100dvh` matches the visible viewport on iOS and Android. Verify once Purchase Orders and Sales History pass their scroll tests on device.

### C. Setup Wizard screen build (outstanding, not started)

The `/setup` route and `SetupWizard.module.css` touch-pass were applied earlier. The actual Setup Wizard **screen content** (wizard steps, form fields for initial store/owner setup) was flagged as a separate build task. Status: not yet started. Requires its own planning pass to define the step sequence and validation logic.

### D. Sticky filter pattern rollout (optional follow-up)

The "filters scroll away on mobile" issue was fixed on Products (split header: title scrolls, filters `sticky top-0 z-20 md:static`). The same pattern is not yet applied to four other screens. Address if it becomes a user complaint:

| Screen | Route | What scrolls away |
|---|---|---|
| Sales History | `/sales-history` | SalesStats + SalesFilters header |
| Purchase Orders | `/purchase-orders` | Filter inputs in header |
| Customers | `/customers` | Filter row |
| Reports | `/reports` | Filter/summary section |

Fix pattern: split into title div (scrolls) + filter wrapper (`sticky top-0 z-20 md:static` + `background: var(--bg-page)`).

### E. Future Feature — Dual-Mode Scanning + M-Pesa Digital Receipts

See dedicated section above. Not started. Requires full planning session before any implementation.

### F. Known cleanup items (low priority, safe to defer)

- `CreateUserModal.jsx` — dead code, never imported anywhere. Safe to delete in a cleanup pass.
- `Mycredits.module.css` — 6 CSS class definitions are duplicated (second block correctly overrides first via cascade). Clean up the dead first definitions.
- `ProductCombobox` portal vs `containerRef` outside-click mismatch — fragile but currently works. Fix when refactoring the combobox.
- Topbar warning + chat button sticky hover on touch — dynamic inline `background` prevents clean CSS hover replacement. Minor cosmetic issue.
- **Split M-Pesa verification state is in-memory, not persisted.** `pendingVerifications` Map in `backend/routes/mpesa.js` is stored in-memory only. If the server restarts during the ~60s window between sending a split STK push and receiving Safaricom's callback, the verification state is lost and the split payment falls through to a timeout on the cashier's screen, even if the customer actually paid. Not a money-safety bug (fails safe as a timeout, not a false success) but should be moved to a persistent MongoDB collection (e.g. `PendingMpesaVerification`) before relying on this in daily production use with real cashiers. Related to Bug 2 (ngrok callback URL) — both should be resolved together once the system is deployed with stable hosting.

---

## Camera Scanning Feature ✅ (2026-07-01)

### Overview

Full camera-based barcode scanning implemented across two surfaces. The physical scanner path (`handleScanKeyDown → processScan`) is unchanged. Camera is an additive alternative input path.

**Files changed:** `Barcodes.jsx`, `ScanPanel.jsx` (new), `CameraScanner.jsx` (new), `POS.module.css`, `ProductFormPanel.jsx`

### POS Terminal — camera toggle

- `CameraScanner.jsx` — new full-screen overlay component using `html5-qrcode v2.3.8`
- Ref-sync pattern (`onScanRef`, `onCloseRef` updated in depless `useEffect`) prevents stale-closure in the long-lived async scanner callback
- `firedRef` prevents double-fire on fast reads
- Config: `fps: 20`, `qrbox: { width: 240, height: 240 }` (square, any angle), `formatsToSupport: [EAN_13, EAN_8, UPC_A, UPC_E, CODE_128, CODE_39]`, `useBarCodeDetectorIfSupported: true`
- `BarcodeDetector` (Android Chrome/Samsung Internet) handles multi-angle barcodes natively; ZXing JS fallback for other browsers
- Camera button added to `ScanPanel.jsx` search header; closes and refocuses scanner input on scan (desktop only — see keyboard fix below)

### Add/Edit Product — barcode scanner

- `CameraScanner` reused in `ProductFormPanel.jsx` Scan Product mode
- `onScan`: calls `setBarcode(code); handleScan(code)` — identical to physical scanner path

### Stale-closure bug fix

`processScan` captured `products = []` at mount because `addToCart` was missing from its `useCallback` deps. Fixed by memoizing the full chain: `findProduct → useCallback([products])` → `addToCart → useCallback([findProduct])` → `processScan → useCallback([currentUser?.token, addWeighedItem, addToCart])`.

---

## Keyboard Popup Fixes ✅ (2026-07-02)

### Root cause

Three distinct mechanisms caused the software keyboard to pop up unexpectedly on mobile (`pointer: coarse`) devices:

1. **JS `.focus()` calls** with no mobile guard — called whenever state changed (cart update, modal close, tab switch)
2. **`autoFocus` prop** on inputs inside modals that open on mobile-used screens
3. **Browser focus restoration** — when a DOM overlay (CameraScanner) unmounts, Android Chrome scans forward in tab order to find the next focusable element. The hidden scanner input (`type="text"`, implicit `tabIndex=0`) was first in the DOM and received focus automatically, bypassing all our React guards

### Fix pattern used throughout

```js
const isTouchDevice = () => window.matchMedia('(pointer: coarse)').matches
```

Added as module-level constant in each file that needs it. No import, no hook, evaluated at call-time so it always reflects the current device.

### Changes applied

| File | What changed | Mechanism fixed |
|---|---|---|
| `ScanPanel.jsx` | `autoFocus={!isTouchDevice()}` on hidden scanner input | Pattern 2 — autoFocus |
| `ScanPanel.jsx` | `tabIndex={isTouchDevice() ? -1 : 0}` on hidden scanner input | Pattern 3 — browser focus restoration after CameraScanner unmount |
| `ScanPanel.jsx` | Camera `onClose` setTimeout gated: `if (!isTouchDevice())` | Pattern 1 — JS focus |
| `Barcodes.jsx` | `useEffect([tab, showCheckout, receipt, cart])` gated: `&& !isTouchDevice()` | Pattern 1 — JS focus on cart change |
| `Barcodes.jsx` | Receipt `onClose` setTimeout gated | Pattern 1 — JS focus |
| `Barcodes.jsx` | Checkout `onCancel` setTimeout gated | Pattern 1 — JS focus |
| `WeighStation.jsx` | `useEffect([selectedProduct, inputMode])` wrapped in `if (!isTouchDevice())` | Pattern 1 — JS focus on product tap |
| `WeighStation.jsx` | `clearAfterAction()` post-print focus wrapped in `if (!isTouchDevice())` | Pattern 1 — JS focus after print |
| `Customers.jsx` | `autoFocus` → `autoFocus={!isTouchDevice()}` on payment amount input | Pattern 2 — autoFocus in mobile-used modal |
| `Mycredits.jsx` | `autoFocus` → `autoFocus={!isTouchDevice()}` on repayment amount input | Pattern 2 — autoFocus in cashier-facing modal |
| `Expenses.jsx` | `autoFocus={!isOwner}` → `autoFocus={!isTouchDevice()}` | Pattern 2 — wrong condition; cashiers on mobile were still getting focus |

**Build:** zero errors after all changes.

### Intentionally left unchanged (audit confirmed correct)

| Location | Reason |
|---|---|
| `CheckoutModal.jsx:411, 456, 687, 764` | User deliberately opens checkout and must type; keyboard is expected |
| `ScanPanel.jsx` `manualRef` at lines 159, 167 | User typed a code to reach these; keyboard already open |
| `ChatModal.jsx:236` | Refocus after send keeps conversation flowing; expected chat UX |
| `Categories.jsx:336`, `ProductFormPanel.jsx:229` | Desktop-admin paths; deliberate typing context |
| `DailyReport.jsx:618` | Targets `<select>` — opens native picker, not text keyboard |

### Medium-priority items — also fixed ✅ (2026-07-02)

These were originally deferred (back-office / desktop screens) but fixed in the same session:

| File | Line | What | Screen |
|---|---|---|---|
| `PurchaseOrders.jsx` | 1184 | `autoFocus` → `autoFocus={!isTouchDevice()}` | Record Invoice modal |
| `PurchaseOrders.jsx` | 1370 | `autoFocus` → `autoFocus={!isTouchDevice()}` | Make Payment modal |
| `PurchaseOrders.jsx` | 1787 | `autoFocus` → `autoFocus={!isTouchDevice()}` | Send Email PO modal |
| `PettyCash.jsx` | 515 | `autoFocus` → `autoFocus={!isTouchDevice()}` | Open Petty Cash modal |
| `PettyCash.jsx` | 585 | `autoFocus` → `autoFocus={!isTouchDevice()}` | Cash in/out modal |

`isTouchDevice` helper added at module level in both files. Build: zero errors, 3.71s.

**Keyboard popup audit — fully resolved.** Every `autoFocus` and `.focus()` call across the entire frontend is now either gated by `!isTouchDevice()` or confirmed intentional (see "Intentionally left unchanged" table above).
