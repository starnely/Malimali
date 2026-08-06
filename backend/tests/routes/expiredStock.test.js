const request = require("supertest");
const createApp = require("../helpers/createApp");
const db = require("../setup/db");
const { makeToken } = require("../helpers/auth");
const { createUser, createProduct, createExpiredStock } = require("../helpers/seed");
const Product = require("../../models/Product");
const ExpiredStock = require("../../models/ExpiredStock");
const { TEST_TENANT_ID } = require("../helpers/tenant");

const app = createApp();

beforeAll(() => db.connect());
afterEach(() => db.clear());
afterAll(() => db.close());

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/expired
// ─────────────────────────────────────────────────────────────────────────────
describe("GET /api/expired", () => {
  test("401 — no token", async () => {
    const res = await request(app).get("/api/expired");
    expect(res.status).toBe(401);
  });

  test("owner sees all stores; cashier sees only their store", async () => {
    const owner   = await createUser({ role: "owner",   email: "o@test.com", store: "HQ" });
    const cashier = await createUser({ role: "cashier", email: "c@test.com", store: "Store A" });
    const prodA = await createProduct({ store: "Store A" });
    const prodB = await createProduct({ store: "Store B" });
    await createExpiredStock(prodA, { store: "Store A" });
    await createExpiredStock(prodB, { store: "Store B" });

    const ownerToken = makeToken({ id: owner._id, role: "owner", store: "HQ" });
    const ownerRes = await request(app).get("/api/expired").set("Authorization", `Bearer ${ownerToken}`);
    expect(ownerRes.body.expired.length).toBe(2);

    const cashierToken = makeToken({ id: cashier._id, role: "cashier", store: "Store A" });
    const cashierRes = await request(app).get("/api/expired").set("Authorization", `Bearer ${cashierToken}`);
    expect(cashierRes.body.expired.length).toBe(1);
    expect(cashierRes.body.expired[0].store).toBe("Store A");
  });

  test("totalLoss is the sum of all returned records", async () => {
    const owner = await createUser({ role: "owner", email: "o@test.com", store: "HQ" });
    const prodA = await createProduct({ store: "Main Store" });
    const prodB = await createProduct({ store: "Main Store" });
    await createExpiredStock(prodA, { totalLoss: 150 });
    await createExpiredStock(prodB, { totalLoss: 250 });

    const token = makeToken({ id: owner._id, role: "owner", store: "HQ" });
    const res = await request(app).get("/api/expired").set("Authorization", `Bearer ${token}`);
    expect(res.body.totalLoss).toBe(400);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/expired/summary
// ─────────────────────────────────────────────────────────────────────────────
describe("GET /api/expired/summary", () => {
  test("groups by store and category with correct totals", async () => {
    const owner = await createUser({ role: "owner", email: "o@test.com", store: "HQ" });
    const prodA = await createProduct({ store: "Store A", category: "Dairy" });
    const prodB = await createProduct({ store: "Store B", category: "Bakery" });
    await createExpiredStock(prodA, { store: "Store A", category: "Dairy",  quantity: 3, totalLoss: 90 });
    await createExpiredStock(prodB, { store: "Store B", category: "Bakery", quantity: 2, totalLoss: 60 });

    const token = makeToken({ id: owner._id, role: "owner", store: "HQ" });
    const res = await request(app).get("/api/expired/summary").set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.totalLoss).toBe(150);
    expect(res.body.byStore["Store A"].totalLoss).toBe(90);
    expect(res.body.byStore["Store B"].count).toBe(2);
    expect(res.body.byCategory["Dairy"].count).toBe(3);
    expect(res.body.byCategory["Bakery"].totalLoss).toBe(60);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/expired/move/:productId
// ─────────────────────────────────────────────────────────────────────────────
describe("POST /api/expired/move/:productId", () => {
  test("403 — cashier cannot move stock to expired", async () => {
    const cashier = await createUser({ role: "cashier", email: "c@test.com", store: "Main Store" });
    const product = await createProduct({ store: "Main Store" });
    const token = makeToken({ id: cashier._id, role: "cashier", store: "Main Store" });
    const res = await request(app)
      .post(`/api/expired/move/${product._id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ quantity: 5 });
    expect(res.status).toBe(403);
  });

  test("404 — unknown product", async () => {
    const owner = await createUser({ role: "owner", email: "o@test.com", store: "HQ" });
    const token = makeToken({ id: owner._id, role: "owner", store: "HQ" });
    const res = await request(app)
      .post("/api/expired/move/000000000000000000000001")
      .set("Authorization", `Bearer ${token}`)
      .send({ quantity: 5 });
    expect(res.status).toBe(404);
  });

  test("400 — quantity exceeds product stock", async () => {
    const owner   = await createUser({ role: "owner", email: "o@test.com", store: "HQ" });
    const product = await createProduct({ stock: 10, store: "Main Store" });
    const token = makeToken({ id: owner._id, role: "owner", store: "HQ" });
    const res = await request(app)
      .post(`/api/expired/move/${product._id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ quantity: 20 });
    expect(res.status).toBe(400);
  });

  test("400 — quantity: 0 is rejected (not silently expired as full stock)", async () => {
    const owner   = await createUser({ role: "owner", email: "o@test.com", store: "HQ" });
    const product = await createProduct({ stock: 10, store: "Main Store" });
    const token = makeToken({ id: owner._id, role: "owner", store: "HQ" });
    const res = await request(app)
      .post(`/api/expired/move/${product._id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ quantity: 0 });
    expect(res.status).toBe(400);
    // Stock must be untouched
    const unchanged = await Product.findOne({ _id: product._id, tenantId: TEST_TENANT_ID });
    expect(unchanged.stock).toBe(10);
  });

  test("400 — negative quantity", async () => {
    const owner   = await createUser({ role: "owner", email: "o@test.com", store: "HQ" });
    const product = await createProduct({ stock: 10, store: "Main Store" });
    const token = makeToken({ id: owner._id, role: "owner", store: "HQ" });
    const res = await request(app)
      .post(`/api/expired/move/${product._id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ quantity: -1 });
    expect(res.status).toBe(400);
  });

  test("creates ExpiredStock record, decrements stock, returns newStock and totalLoss", async () => {
    const owner   = await createUser({ role: "owner", email: "o@test.com", store: "HQ" });
    const product = await createProduct({ stock: 20, buyPrice: 50, sellPrice: 60, store: "Main Store" });
    const token = makeToken({ id: owner._id, role: "owner", store: "HQ" });
    const res = await request(app)
      .post(`/api/expired/move/${product._id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ quantity: 5 });

    expect(res.status).toBe(200);
    expect(res.body.newStock).toBe(15);
    expect(res.body.totalLoss).toBe(250); // 5 × 50

    const updated = await Product.findOne({ _id: product._id, tenantId: TEST_TENANT_ID });
    expect(updated.stock).toBe(15);
    expect(updated.isExpired).toBeFalsy();
  });

  test("when all stock consumed — product marked isExpired and stock set to 0", async () => {
    const owner   = await createUser({ role: "owner", email: "o@test.com", store: "HQ" });
    const product = await createProduct({ stock: 5, buyPrice: 20, sellPrice: 25, store: "Main Store" });
    const token = makeToken({ id: owner._id, role: "owner", store: "HQ" });
    const res = await request(app)
      .post(`/api/expired/move/${product._id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ quantity: 5 });

    expect(res.status).toBe(200);
    expect(res.body.newStock).toBe(0);

    const updated = await Product.findOne({ _id: product._id, tenantId: TEST_TENANT_ID });
    expect(updated.isExpired).toBe(true);
    expect(updated.stock).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/expired/auto-check
// ─────────────────────────────────────────────────────────────────────────────
describe("POST /api/expired/auto-check", () => {
  test("403 — non-owner cannot run auto-check", async () => {
    const manager = await createUser({ role: "manager", email: "m@test.com", store: "Main Store" });
    const token = makeToken({ id: manager._id, role: "manager", store: "Main Store" });
    const res = await request(app)
      .post("/api/expired/auto-check")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  test("moves only stale products; skips already-expired and future-dated ones", async () => {
    const owner = await createUser({ role: "owner", email: "o@test.com", store: "HQ" });

    // Should be moved: past expiry, not yet expired, has stock
    const stale = await createProduct({
      stock: 10, expiryDate: new Date("2020-01-01"), isExpired: false, store: "Main Store",
    });
    // Should be skipped: already processed
    await createProduct({
      stock: 0, expiryDate: new Date("2020-01-01"), isExpired: true, store: "Main Store",
    });
    // Should be skipped: future expiry date
    await createProduct({
      stock: 20, expiryDate: new Date("2099-01-01"), isExpired: false, store: "Main Store",
    });

    const token = makeToken({ id: owner._id, role: "owner", store: "HQ" });
    const res = await request(app)
      .post("/api/expired/auto-check")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.moved).toBe(1);
    expect(res.body.results[0].productName).toBe(stale.name);

    const updated = await Product.findOne({ _id: stale._id, tenantId: TEST_TENANT_ID });
    expect(updated.isExpired).toBe(true);
    expect(updated.stock).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/expired/:id
// ─────────────────────────────────────────────────────────────────────────────
describe("DELETE /api/expired/:id", () => {
  test("403 — non-owner cannot delete", async () => {
    const manager = await createUser({ role: "manager", email: "m@test.com", store: "Main Store" });
    const product = await createProduct({ store: "Main Store" });
    const record  = await createExpiredStock(product);
    const token = makeToken({ id: manager._id, role: "manager", store: "Main Store" });
    const res = await request(app)
      .delete(`/api/expired/${record._id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  test("404 — unknown id", async () => {
    const owner = await createUser({ role: "owner", email: "o@test.com", store: "HQ" });
    const token = makeToken({ id: owner._id, role: "owner", store: "HQ" });
    const res = await request(app)
      .delete("/api/expired/000000000000000000000001")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  test("owner can delete a record; it is absent from DB afterward", async () => {
    const owner   = await createUser({ role: "owner", email: "o@test.com", store: "HQ" });
    const product = await createProduct({ store: "Main Store" });
    const record  = await createExpiredStock(product);
    const token = makeToken({ id: owner._id, role: "owner", store: "HQ" });
    const res = await request(app)
      .delete(`/api/expired/${record._id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(await ExpiredStock.findOne({ _id: record._id, tenantId: TEST_TENANT_ID })).toBeNull();
  });
});
