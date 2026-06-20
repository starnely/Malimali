const request = require("supertest");
const createApp = require("../helpers/createApp");
const db = require("../setup/db");
const { makeToken } = require("../helpers/auth");
const { createUser, createArchive, createSale } = require("../helpers/seed");

const app = createApp();

beforeAll(() => db.connect());
afterEach(() => db.clear());
afterAll(() => db.close());

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/archives
// ─────────────────────────────────────────────────────────────────────────────
describe("GET /api/archives", () => {
  test("401 — no token", async () => {
    const res = await request(app).get("/api/archives");
    expect(res.status).toBe(401);
  });

  test("owner sees all archives across all stores", async () => {
    const owner = await createUser({ role: "owner", email: "o@test.com", store: "HQ" });
    await createArchive({ employeeName: "Alice", store: "Store A", date: "2024-01-10" });
    await createArchive({ employeeName: "Bob",   store: "Store B", date: "2024-01-10" });

    const token = makeToken({ id: owner._id, role: "owner", store: "HQ" });
    const res = await request(app).get("/api/archives").set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    const names = res.body.archives.map((a) => a.employeeName);
    expect(names).toContain("Alice");
    expect(names).toContain("Bob");
  });

  test("owner ?store= filter narrows to that store only", async () => {
    const owner = await createUser({ role: "owner", email: "o@test.com", store: "HQ" });
    await createArchive({ employeeName: "Alice", store: "Store A", date: "2024-01-10" });
    await createArchive({ employeeName: "Bob",   store: "Store B", date: "2024-01-10" });

    const token = makeToken({ id: owner._id, role: "owner", store: "HQ" });
    const res = await request(app)
      .get("/api/archives?store=Store A")
      .set("Authorization", `Bearer ${token}`);

    const names = res.body.archives.map((a) => a.employeeName);
    expect(names).toContain("Alice");
    expect(names).not.toContain("Bob");
  });

  test("manager sees only archives for their own store", async () => {
    const manager = await createUser({ role: "manager", email: "m@test.com", store: "Store A" });
    await createArchive({ employeeName: "Alice", store: "Store A", date: "2024-01-10" });
    await createArchive({ employeeName: "Bob",   store: "Store B", date: "2024-01-10" });

    const token = makeToken({ id: manager._id, role: "manager", store: "Store A" });
    const res = await request(app).get("/api/archives").set("Authorization", `Bearer ${token}`);

    const names = res.body.archives.map((a) => a.employeeName);
    expect(names).toContain("Alice");
    expect(names).not.toContain("Bob");
  });

  test("cashier sees only their own archives (matched by name from token)", async () => {
    const cashier = await createUser({ role: "cashier", email: "c@test.com", store: "Store A" });
    await createArchive({ employeeName: "Alice", store: "Store A", date: "2024-01-10" });
    await createArchive({ employeeName: "Bob",   store: "Store A", date: "2024-01-10" });

    const token = makeToken({ id: cashier._id, role: "cashier", store: "Store A", name: "Alice" });
    const res = await request(app).get("/api/archives").set("Authorization", `Bearer ${token}`);

    const names = res.body.archives.map((a) => a.employeeName);
    expect(names).toContain("Alice");
    expect(names).not.toContain("Bob");
  });

  test("400 — cashier token has no name or fullname field", async () => {
    const cashier = await createUser({ role: "cashier", email: "c@test.com", store: "Store A" });
    // Intentionally omit name and fullname from token payload
    const token = makeToken({ id: cashier._id, role: "cashier", store: "Store A" });
    const res = await request(app).get("/api/archives").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(400);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/archives  (close shift)
// ─────────────────────────────────────────────────────────────────────────────
describe("POST /api/archives", () => {
  test("401 — no token", async () => {
    const res = await request(app).post("/api/archives").send({ date: "2024-01-15" });
    expect(res.status).toBe(401);
  });

  test("400 — token has no name or fullname", async () => {
    const cashier = await createUser({ role: "cashier", email: "c@test.com", store: "Main Store" });
    const token = makeToken({ id: cashier._id, role: "cashier", store: "Main Store" });
    const res = await request(app)
      .post("/api/archives")
      .set("Authorization", `Bearer ${token}`)
      .send({ date: "2024-01-15" });
    expect(res.status).toBe(400);
  });

  test("400 — double-close: same employee already has a record for that date", async () => {
    const cashier = await createUser({ role: "cashier", email: "c@test.com", store: "Main Store" });
    await createArchive({ employeeName: "Alice", date: "2024-01-15", store: "Main Store" });
    const token = makeToken({ id: cashier._id, role: "cashier", store: "Main Store", name: "Alice" });
    const res = await request(app)
      .post("/api/archives")
      .set("Authorization", `Bearer ${token}`)
      .send({ date: "2024-01-15" });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/already closed/i);
  });

  test("200 — calculates revenue, profit, transactions, and itemsSold from actual sales", async () => {
    const cashier = await createUser({ role: "cashier", email: "c@test.com", store: "Main Store" });
    // createSale default: qty 1, price 50, buyPrice 30 → revenue=50, profit=20
    await createSale({
      cashier: "Alice",
      date: "2024-01-15",
      store: "Main Store",
      paymentInfo: { paymentMethod: "cash", finalTotal: 50 },
    });

    const token = makeToken({ id: cashier._id, role: "cashier", store: "Main Store", name: "Alice" });
    const res = await request(app)
      .post("/api/archives")
      .set("Authorization", `Bearer ${token}`)
      .send({ date: "2024-01-15" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.archive.revenue).toBe(50);
    expect(res.body.archive.profit).toBe(20);
    expect(res.body.archive.transactions).toBe(1);
    expect(res.body.archive.itemsSold).toBe(1);
  });

  test("200 — payment breakdown correctly split by method", async () => {
    const cashier = await createUser({ role: "cashier", email: "c@test.com", store: "Main Store" });
    await createSale({
      cashier: "Alice", date: "2024-01-15", store: "Main Store",
      paymentInfo: { paymentMethod: "cash",   finalTotal: 100 }, total: 100,
    });
    await createSale({
      cashier: "Alice", date: "2024-01-15", store: "Main Store",
      paymentInfo: { paymentMethod: "mpesa",  finalTotal: 200 }, total: 200,
    });
    await createSale({
      cashier: "Alice", date: "2024-01-15", store: "Main Store",
      paymentInfo: { paymentMethod: "credit", finalTotal: 50  }, total: 50,
    });

    const token = makeToken({ id: cashier._id, role: "cashier", store: "Main Store", name: "Alice" });
    const res = await request(app)
      .post("/api/archives")
      .set("Authorization", `Bearer ${token}`)
      .send({ date: "2024-01-15" });

    expect(res.status).toBe(200);
    expect(res.body.archive.paymentBreakdown.cash).toBe(100);
    expect(res.body.archive.paymentBreakdown.mpesa).toBe(200);
    expect(res.body.archive.paymentBreakdown.credit).toBe(50);
  });

  test("200 — openingFloat, actualCash, and variance saved correctly", async () => {
    const cashier = await createUser({ role: "cashier", email: "c@test.com", store: "Main Store" });
    // Cash sale of 200; opening float 1000; actual cash handed over 1150
    await createSale({
      cashier: "Alice", date: "2024-01-15", store: "Main Store",
      paymentInfo: { paymentMethod: "cash", finalTotal: 200 }, total: 200,
    });

    const token = makeToken({ id: cashier._id, role: "cashier", store: "Main Store", name: "Alice" });
    const res = await request(app)
      .post("/api/archives")
      .set("Authorization", `Bearer ${token}`)
      .send({ date: "2024-01-15", openingFloat: 1000, actualCash: 1150 });

    expect(res.status).toBe(200);
    expect(res.body.archive.openingFloat).toBe(1000);
    expect(res.body.archive.actualCash).toBe(1150);
    // expectedCash = 1000 + 200 = 1200; variance = 1150 - 1200 = -50 (short)
    expect(res.body.archive.variance).toBe(-50);
  });
});
