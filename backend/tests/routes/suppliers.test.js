const request = require("supertest");
const createApp = require("../helpers/createApp");
const db = require("../setup/db");
const { makeToken } = require("../helpers/auth");
const { createUser, createProduct, createSupplier, createPurchaseOrder } = require("../helpers/seed");
const Supplier = require("../../models/Supplier");

const app = createApp();

beforeAll(() => db.connect());
afterEach(() => db.clear());
afterAll(() => db.close());

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/suppliers
// ─────────────────────────────────────────────────────────────────────────────
describe("GET /api/suppliers", () => {
  test("401 — no token", async () => {
    const res = await request(app).get("/api/suppliers");
    expect(res.status).toBe(401);
  });

  test("returns only active suppliers by default; archived excluded", async () => {
    const owner = await createUser({ role: "owner", email: "o@test.com", store: "HQ" });
    await createSupplier({ name: "Active Supplier",   isActive: true });
    await createSupplier({ name: "Archived Supplier", isActive: false });

    const token = makeToken({ id: owner._id, role: "owner", store: "HQ" });
    const res = await request(app).get("/api/suppliers").set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    const names = res.body.suppliers.map((s) => s.name);
    expect(names).toContain("Active Supplier");
    expect(names).not.toContain("Archived Supplier");
  });

  test("?all=true includes archived (inactive) suppliers", async () => {
    const owner = await createUser({ role: "owner", email: "o@test.com", store: "HQ" });
    await createSupplier({ name: "Active Supplier",   isActive: true });
    await createSupplier({ name: "Archived Supplier", isActive: false });

    const token = makeToken({ id: owner._id, role: "owner", store: "HQ" });
    const res = await request(app)
      .get("/api/suppliers?all=true")
      .set("Authorization", `Bearer ${token}`);

    const names = res.body.suppliers.map((s) => s.name);
    expect(names).toContain("Active Supplier");
    expect(names).toContain("Archived Supplier");
  });

  test("?store= returns global (empty stores array) + matching store; other store excluded", async () => {
    const owner = await createUser({ role: "owner", email: "o@test.com", store: "HQ" });
    await createSupplier({ name: "Global Supplier",   stores: [] });
    await createSupplier({ name: "Store A Supplier",  stores: ["Store A"] });
    await createSupplier({ name: "Store B Supplier",  stores: ["Store B"] });

    const token = makeToken({ id: owner._id, role: "owner", store: "HQ" });
    const res = await request(app)
      .get("/api/suppliers?store=Store A")
      .set("Authorization", `Bearer ${token}`);

    const names = res.body.suppliers.map((s) => s.name);
    expect(names).toContain("Global Supplier");
    expect(names).toContain("Store A Supplier");
    expect(names).not.toContain("Store B Supplier");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/suppliers
// ─────────────────────────────────────────────────────────────────────────────
describe("POST /api/suppliers", () => {
  test("403 — cashier blocked (ownerOnly)", async () => {
    const cashier = await createUser({ role: "cashier", email: "c@test.com", store: "Main Store" });
    const token = makeToken({ id: cashier._id, role: "cashier", store: "Main Store" });
    const res = await request(app)
      .post("/api/suppliers")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "New Supplier" });
    expect(res.status).toBe(403);
  });

  test("400 — missing name", async () => {
    const owner = await createUser({ role: "owner", email: "o@test.com", store: "HQ" });
    const token = makeToken({ id: owner._id, role: "owner", store: "HQ" });
    const res = await request(app)
      .post("/api/suppliers")
      .set("Authorization", `Bearer ${token}`)
      .send({ company: "Acme Ltd" });
    expect(res.status).toBe(400);
  });

  test("409 — duplicate company name", async () => {
    const owner = await createUser({ role: "owner", email: "o@test.com", store: "HQ" });
    await createSupplier({ name: "Existing", company: "Acme Ltd" });
    const token = makeToken({ id: owner._id, role: "owner", store: "HQ" });
    const res = await request(app)
      .post("/api/suppliers")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Another", company: "Acme Ltd" });
    expect(res.status).toBe(409);
  });

  test("201 — creates supplier; email stored lowercase; stores saved", async () => {
    // Supplier creation is ownerOnly (routes/suppliers.js) — confirmed intentional,
    // not a stale restriction, so this test uses an owner, not a manager.
    const owner = await createUser({ role: "owner", email: "o2@test.com", store: "Main Store" });
    const token = makeToken({ id: owner._id, role: "owner", store: "Main Store" });
    const res = await request(app)
      .post("/api/suppliers")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "Fresh Farms",
        company: "Fresh Farms Ltd",
        email: "CONTACT@FRESHFARMS.COM",
        phone: "0700000001",
        stores: ["Main Store"],
      });
    expect(res.status).toBe(201);
    expect(res.body.supplier.name).toBe("Fresh Farms");
    expect(res.body.supplier.email).toBe("contact@freshfarms.com");
    expect(res.body.supplier.stores).toContain("Main Store");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/suppliers/:id
// ─────────────────────────────────────────────────────────────────────────────
describe("PUT /api/suppliers/:id", () => {
  test("403 — cashier blocked", async () => {
    const cashier = await createUser({ role: "cashier", email: "c@test.com", store: "Main Store" });
    const supplier = await createSupplier({ name: "Supplier X" });
    const token = makeToken({ id: cashier._id, role: "cashier", store: "Main Store" });
    const res = await request(app)
      .put(`/api/suppliers/${supplier._id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Updated" });
    expect(res.status).toBe(403);
  });

  test("400 — missing name", async () => {
    const owner = await createUser({ role: "owner", email: "o@test.com", store: "HQ" });
    const supplier = await createSupplier({ name: "Supplier X" });
    const token = makeToken({ id: owner._id, role: "owner", store: "HQ" });
    const res = await request(app)
      .put(`/api/suppliers/${supplier._id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ phone: "0700000001" });
    expect(res.status).toBe(400);
  });

  test("404 — unknown id", async () => {
    const owner = await createUser({ role: "owner", email: "o@test.com", store: "HQ" });
    const token = makeToken({ id: owner._id, role: "owner", store: "HQ" });
    const res = await request(app)
      .put("/api/suppliers/000000000000000000000001")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Updated" });
    expect(res.status).toBe(404);
  });

  test("409 — company name conflicts with a different supplier", async () => {
    const owner = await createUser({ role: "owner", email: "o@test.com", store: "HQ" });
    await createSupplier({ name: "Other",      company: "Taken Ltd" });
    const supplier = await createSupplier({ name: "Target" });
    const token = makeToken({ id: owner._id, role: "owner", store: "HQ" });
    const res = await request(app)
      .put(`/api/suppliers/${supplier._id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Target", company: "Taken Ltd" });
    expect(res.status).toBe(409);
  });

  test("200 — updates name, phone, and stores", async () => {
    const owner = await createUser({ role: "owner", email: "o@test.com", store: "HQ" });
    const supplier = await createSupplier({ name: "Old Name", stores: [] });
    const token = makeToken({ id: owner._id, role: "owner", store: "HQ" });
    const res = await request(app)
      .put(`/api/suppliers/${supplier._id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "New Name", phone: "0711111111", stores: ["Branch A", "Branch B"] });
    expect(res.status).toBe(200);
    expect(res.body.supplier.name).toBe("New Name");
    expect(res.body.supplier.phone).toBe("0711111111");
    expect(res.body.supplier.stores).toEqual(expect.arrayContaining(["Branch A", "Branch B"]));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/suppliers/:id/archive
// ─────────────────────────────────────────────────────────────────────────────
describe("PATCH /api/suppliers/:id/archive", () => {
  test("403 — manager blocked (ownerOnly)", async () => {
    const manager = await createUser({ role: "manager", email: "m@test.com", store: "Main Store" });
    const supplier = await createSupplier({ name: "Supplier X" });
    const token = makeToken({ id: manager._id, role: "manager", store: "Main Store" });
    const res = await request(app)
      .patch(`/api/suppliers/${supplier._id}/archive`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  test("404 — unknown id", async () => {
    const owner = await createUser({ role: "owner", email: "o@test.com", store: "HQ" });
    const token = makeToken({ id: owner._id, role: "owner", store: "HQ" });
    const res = await request(app)
      .patch("/api/suppliers/000000000000000000000001/archive")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  test("toggles isActive: active → archived → active", async () => {
    const owner = await createUser({ role: "owner", email: "o@test.com", store: "HQ" });
    const supplier = await createSupplier({ name: "Toggle Me", isActive: true });
    const token = makeToken({ id: owner._id, role: "owner", store: "HQ" });

    const first = await request(app)
      .patch(`/api/suppliers/${supplier._id}/archive`)
      .set("Authorization", `Bearer ${token}`);
    expect(first.status).toBe(200);
    expect(first.body.supplier.isActive).toBe(false);

    const second = await request(app)
      .patch(`/api/suppliers/${supplier._id}/archive`)
      .set("Authorization", `Bearer ${token}`);
    expect(second.status).toBe(200);
    expect(second.body.supplier.isActive).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/suppliers/:id
// ─────────────────────────────────────────────────────────────────────────────
describe("DELETE /api/suppliers/:id", () => {
  test("403 — manager blocked (ownerOnly)", async () => {
    const manager = await createUser({ role: "manager", email: "m@test.com", store: "Main Store" });
    const supplier = await createSupplier({ name: "Supplier X" });
    const token = makeToken({ id: manager._id, role: "manager", store: "Main Store" });
    const res = await request(app)
      .delete(`/api/suppliers/${supplier._id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  test("404 — unknown id", async () => {
    const owner = await createUser({ role: "owner", email: "o@test.com", store: "HQ" });
    const token = makeToken({ id: owner._id, role: "owner", store: "HQ" });
    const res = await request(app)
      .delete("/api/suppliers/000000000000000000000001")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  test("409 — blocked when supplier has an open purchase order", async () => {
    const owner = await createUser({ role: "owner", email: "o@test.com", store: "HQ" });
    const supplier = await createSupplier({ name: "Busy Supplier" });
    const product = await createProduct({ store: "Main Store" });
    await createPurchaseOrder(product, { supplierId: supplier._id, status: "draft" });
    const token = makeToken({ id: owner._id, role: "owner", store: "HQ" });
    const res = await request(app)
      .delete(`/api/suppliers/${supplier._id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(409);
  });

  test("200 — hard-deletes when no open purchase orders", async () => {
    const owner = await createUser({ role: "owner", email: "o@test.com", store: "HQ" });
    const supplier = await createSupplier({ name: "Safe Delete" });
    const token = makeToken({ id: owner._id, role: "owner", store: "HQ" });
    const res = await request(app)
      .delete(`/api/suppliers/${supplier._id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const gone = await Supplier.findById(supplier._id);
    expect(gone).toBeNull();
  });
});
