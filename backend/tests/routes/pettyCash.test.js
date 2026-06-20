const request = require("supertest");
const createApp = require("../helpers/createApp");
const db = require("../setup/db");
const { makeToken } = require("../helpers/auth");
const { createUser, createPettyCash, createExpense } = require("../helpers/seed");
const PettyCash = require("../../models/PettyCash");
const Expense = require("../../models/Expense");

const app = createApp();

// Match the route's todayEAT() exactly so seeded records are found by date-sensitive endpoints
const todayEAT = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString().split("T")[0];

beforeAll(() => db.connect());
afterEach(() => db.clear());
afterAll(() => db.close());

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/petty-cash/today
// ─────────────────────────────────────────────────────────────────────────────
describe("GET /api/petty-cash/today", () => {
  test("401 — no token", async () => {
    const res = await request(app).get("/api/petty-cash/today");
    expect(res.status).toBe(401);
  });

  test("returns null when no record exists for today", async () => {
    const owner = await createUser({ role: "owner", email: "o@test.com", store: "HQ" });
    const token = makeToken({ id: owner._id, role: "owner", store: "HQ" });
    const res = await request(app)
      .get("/api/petty-cash/today?store=Main Store")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.record).toBeNull();
  });

  test("returns existing record for today", async () => {
    const manager = await createUser({ role: "manager", email: "m@test.com", store: "Main Store" });
    await createPettyCash({ date: todayEAT, store: "Main Store", openingFloat: 500 });
    const token = makeToken({ id: manager._id, role: "manager", store: "Main Store" });
    const res = await request(app)
      .get("/api/petty-cash/today?store=Main Store")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.record).not.toBeNull();
    expect(res.body.record.openingFloat).toBe(500);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/petty-cash/history
// ─────────────────────────────────────────────────────────────────────────────
describe("GET /api/petty-cash/history", () => {
  test("401 — no token", async () => {
    const res = await request(app).get("/api/petty-cash/history");
    expect(res.status).toBe(401);
  });

  test("403 — cashier blocked", async () => {
    const cashier = await createUser({ role: "cashier", email: "c@test.com", store: "Main Store" });
    const token = makeToken({ id: cashier._id, role: "cashier", store: "Main Store" });
    const res = await request(app)
      .get("/api/petty-cash/history")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  test("returns all records; ?from= / ?to= filters by date range", async () => {
    const owner = await createUser({ role: "owner", email: "o@test.com", store: "HQ" });
    await createPettyCash({ date: "2024-01-10", store: "Main Store" });
    await createPettyCash({ date: "2024-02-15", store: "Main Store" });
    const token = makeToken({ id: owner._id, role: "owner", store: "HQ" });

    const all = await request(app)
      .get("/api/petty-cash/history")
      .set("Authorization", `Bearer ${token}`);
    expect(all.body.records.length).toBe(2);

    const filtered = await request(app)
      .get("/api/petty-cash/history?from=2024-01-01&to=2024-01-31")
      .set("Authorization", `Bearer ${token}`);
    expect(filtered.body.records.length).toBe(1);
    expect(filtered.body.records[0].date).toBe("2024-01-10");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/petty-cash/:date
// ─────────────────────────────────────────────────────────────────────────────
describe("GET /api/petty-cash/:date", () => {
  test("403 — cashier blocked", async () => {
    const cashier = await createUser({ role: "cashier", email: "c@test.com", store: "Main Store" });
    const token = makeToken({ id: cashier._id, role: "cashier", store: "Main Store" });
    const res = await request(app)
      .get("/api/petty-cash/2024-01-15")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  test("404 — no record for that date", async () => {
    const owner = await createUser({ role: "owner", email: "o@test.com", store: "HQ" });
    const token = makeToken({ id: owner._id, role: "owner", store: "HQ" });
    const res = await request(app)
      .get("/api/petty-cash/2024-01-15?store=Main Store")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  test("returns record for given date", async () => {
    const owner = await createUser({ role: "owner", email: "o@test.com", store: "HQ" });
    await createPettyCash({ date: "2024-01-15", store: "Main Store", openingFloat: 750 });
    const token = makeToken({ id: owner._id, role: "owner", store: "HQ" });
    const res = await request(app)
      .get("/api/petty-cash/2024-01-15?store=Main Store")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.record.openingFloat).toBe(750);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/petty-cash/open
// ─────────────────────────────────────────────────────────────────────────────
describe("POST /api/petty-cash/open", () => {
  test("403 — cashier blocked", async () => {
    const cashier = await createUser({ role: "cashier", email: "c@test.com", store: "Main Store" });
    const token = makeToken({ id: cashier._id, role: "cashier", store: "Main Store" });
    const res = await request(app)
      .post("/api/petty-cash/open")
      .set("Authorization", `Bearer ${token}`)
      .send({ store: "Main Store", openingFloat: 500 });
    expect(res.status).toBe(403);
  });

  test("201 — creates record with correct openingFloat and openedBy", async () => {
    const manager = await createUser({ role: "manager", email: "m@test.com", store: "Main Store" });
    const token = makeToken({ id: manager._id, role: "manager", store: "Main Store", name: "Jane" });
    const res = await request(app)
      .post("/api/petty-cash/open")
      .set("Authorization", `Bearer ${token}`)
      .send({ store: "Main Store", openingFloat: 500 });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.record.openingFloat).toBe(500);
    expect(res.body.record.netBalance).toBe(500);
    expect(res.body.record.openedBy).toBe("Jane");
  });

  test("409 — cannot open twice on the same day", async () => {
    const manager = await createUser({ role: "manager", email: "m@test.com", store: "Main Store" });
    await createPettyCash({ date: todayEAT, store: "Main Store" });
    const token = makeToken({ id: manager._id, role: "manager", store: "Main Store" });
    const res = await request(app)
      .post("/api/petty-cash/open")
      .set("Authorization", `Bearer ${token}`)
      .send({ store: "Main Store", openingFloat: 500 });
    expect(res.status).toBe(409);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/petty-cash/transaction
// ─────────────────────────────────────────────────────────────────────────────
describe("POST /api/petty-cash/transaction", () => {
  test("403 — cashier blocked", async () => {
    const cashier = await createUser({ role: "cashier", email: "c@test.com", store: "Main Store" });
    const token = makeToken({ id: cashier._id, role: "cashier", store: "Main Store" });
    const res = await request(app)
      .post("/api/petty-cash/transaction")
      .set("Authorization", `Bearer ${token}`)
      .send({ store: "Main Store", type: "in", amount: 100 });
    expect(res.status).toBe(403);
  });

  test("404 — no open record for today", async () => {
    const manager = await createUser({ role: "manager", email: "m@test.com", store: "Main Store" });
    const token = makeToken({ id: manager._id, role: "manager", store: "Main Store" });
    const res = await request(app)
      .post("/api/petty-cash/transaction")
      .set("Authorization", `Bearer ${token}`)
      .send({ store: "Main Store", type: "in", amount: 100 });
    expect(res.status).toBe(404);
  });

  test("400 — invalid transaction type", async () => {
    const manager = await createUser({ role: "manager", email: "m@test.com", store: "Main Store" });
    await createPettyCash({ date: todayEAT, store: "Main Store" });
    const token = makeToken({ id: manager._id, role: "manager", store: "Main Store" });
    const res = await request(app)
      .post("/api/petty-cash/transaction")
      .set("Authorization", `Bearer ${token}`)
      .send({ store: "Main Store", type: "invalid", amount: 100 });
    expect(res.status).toBe(400);
  });

  test("400 — cash-out prevented when it would overdraw the balance", async () => {
    const manager = await createUser({ role: "manager", email: "m@test.com", store: "Main Store" });
    await createPettyCash({ date: todayEAT, store: "Main Store", openingFloat: 100 });
    const token = makeToken({ id: manager._id, role: "manager", store: "Main Store" });
    const res = await request(app)
      .post("/api/petty-cash/transaction")
      .set("Authorization", `Bearer ${token}`)
      .send({ store: "Main Store", type: "out", amount: 200 });
    expect(res.status).toBe(400);
  });

  test("400 — cannot add transaction to a closed record", async () => {
    const manager = await createUser({ role: "manager", email: "m@test.com", store: "Main Store" });
    await createPettyCash({ date: todayEAT, store: "Main Store", openingFloat: 500, isClosed: true });
    const token = makeToken({ id: manager._id, role: "manager", store: "Main Store" });
    const res = await request(app)
      .post("/api/petty-cash/transaction")
      .set("Authorization", `Bearer ${token}`)
      .send({ store: "Main Store", type: "in", amount: 100 });
    expect(res.status).toBe(400);
  });

  test("cash-in raises netBalance; no Expense document created", async () => {
    const manager = await createUser({ role: "manager", email: "m@test.com", store: "Main Store" });
    await createPettyCash({ date: todayEAT, store: "Main Store", openingFloat: 500 });
    const token = makeToken({ id: manager._id, role: "manager", store: "Main Store" });
    const res = await request(app)
      .post("/api/petty-cash/transaction")
      .set("Authorization", `Bearer ${token}`)
      .send({ store: "Main Store", type: "in", amount: 200, description: "Float top-up" });
    expect(res.status).toBe(200);
    expect(res.body.record.netBalance).toBe(700);
    const expenseCount = await Expense.countDocuments({ fromPettyCash: true });
    expect(expenseCount).toBe(0);
  });

  test("cash-out lowers netBalance AND auto-creates a linked Expense document", async () => {
    const manager = await createUser({ role: "manager", email: "m@test.com", store: "Main Store" });
    await createPettyCash({ date: todayEAT, store: "Main Store", openingFloat: 500 });
    const token = makeToken({ id: manager._id, role: "manager", store: "Main Store", name: "Jane" });
    const res = await request(app)
      .post("/api/petty-cash/transaction")
      .set("Authorization", `Bearer ${token}`)
      .send({ store: "Main Store", type: "out", amount: 150, description: "Water bill", expenseCategory: "utilities" });
    expect(res.status).toBe(200);
    expect(res.body.record.netBalance).toBe(350);
    const expense = await Expense.findOne({ fromPettyCash: true });
    expect(expense).not.toBeNull();
    expect(expense.amount).toBe(150);
    expect(expense.category).toBe("utilities");
    expect(expense.recordedBy).toBe("Jane");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/petty-cash/close
// ─────────────────────────────────────────────────────────────────────────────
describe("POST /api/petty-cash/close", () => {
  test("403 — cashier blocked", async () => {
    const cashier = await createUser({ role: "cashier", email: "c@test.com", store: "Main Store" });
    const token = makeToken({ id: cashier._id, role: "cashier", store: "Main Store" });
    const res = await request(app)
      .post("/api/petty-cash/close")
      .set("Authorization", `Bearer ${token}`)
      .send({ store: "Main Store", closingFloat: 500 });
    expect(res.status).toBe(403);
  });

  test("404 — no record for today", async () => {
    const manager = await createUser({ role: "manager", email: "m@test.com", store: "Main Store" });
    const token = makeToken({ id: manager._id, role: "manager", store: "Main Store" });
    const res = await request(app)
      .post("/api/petty-cash/close")
      .set("Authorization", `Bearer ${token}`)
      .send({ store: "Main Store", closingFloat: 500 });
    expect(res.status).toBe(404);
  });

  test("200 — closes record; records closingFloat and closedBy", async () => {
    const manager = await createUser({ role: "manager", email: "m@test.com", store: "Main Store" });
    await createPettyCash({ date: todayEAT, store: "Main Store", openingFloat: 500 });
    const token = makeToken({ id: manager._id, role: "manager", store: "Main Store", name: "Jane" });
    const res = await request(app)
      .post("/api/petty-cash/close")
      .set("Authorization", `Bearer ${token}`)
      .send({ store: "Main Store", closingFloat: 480 });
    expect(res.status).toBe(200);
    expect(res.body.record.isClosed).toBe(true);
    expect(res.body.record.closingFloat).toBe(480);
    expect(res.body.record.closedBy).toBe("Jane");
  });

  test("400 — cannot close an already-closed record", async () => {
    const manager = await createUser({ role: "manager", email: "m@test.com", store: "Main Store" });
    await createPettyCash({ date: todayEAT, store: "Main Store", isClosed: true });
    const token = makeToken({ id: manager._id, role: "manager", store: "Main Store" });
    const res = await request(app)
      .post("/api/petty-cash/close")
      .set("Authorization", `Bearer ${token}`)
      .send({ store: "Main Store", closingFloat: 500 });
    expect(res.status).toBe(400);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/petty-cash/:recordId/transaction/:txId
// ─────────────────────────────────────────────────────────────────────────────
describe("DELETE /api/petty-cash/:recordId/transaction/:txId", () => {
  test("404 — record not found", async () => {
    const manager = await createUser({ role: "manager", email: "m@test.com", store: "Main Store" });
    const token = makeToken({ id: manager._id, role: "manager", store: "Main Store" });
    const res = await request(app)
      .delete("/api/petty-cash/000000000000000000000001/transaction/000000000000000000000002")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  test("400 — cannot delete from a closed record", async () => {
    const manager = await createUser({ role: "manager", email: "m@test.com", store: "Main Store" });
    const pc = await createPettyCash({
      date: "2024-01-15",
      store: "Main Store",
      isClosed: true,
      transactions: [{ type: "in", amount: 100, description: "Top-up" }],
    });
    const txId = pc.transactions[0]._id;
    const token = makeToken({ id: manager._id, role: "manager", store: "Main Store" });
    const res = await request(app)
      .delete(`/api/petty-cash/${pc._id}/transaction/${txId}`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  test("404 — transaction id not found in record", async () => {
    const manager = await createUser({ role: "manager", email: "m@test.com", store: "Main Store" });
    const pc = await createPettyCash({ date: "2024-01-15", store: "Main Store" });
    const token = makeToken({ id: manager._id, role: "manager", store: "Main Store" });
    const res = await request(app)
      .delete(`/api/petty-cash/${pc._id}/transaction/000000000000000000000002`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  test("removes transaction and recalculates netBalance", async () => {
    const manager = await createUser({ role: "manager", email: "m@test.com", store: "Main Store" });
    const pc = await createPettyCash({
      date: "2024-01-15",
      store: "Main Store",
      openingFloat: 1000,
      transactions: [{ type: "in", amount: 200, description: "Top-up" }],
    });
    const txId = pc.transactions[0]._id;
    const token = makeToken({ id: manager._id, role: "manager", store: "Main Store" });
    const res = await request(app)
      .delete(`/api/petty-cash/${pc._id}/transaction/${txId}`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.record.transactions).toHaveLength(0);
    expect(res.body.record.netBalance).toBe(1000);
  });

  test("cash-out removal also soft-deletes the matching linked expense", async () => {
    const manager = await createUser({ role: "manager", email: "m@test.com", store: "Main Store" });
    const pc = await createPettyCash({
      date: "2024-01-15",
      store: "Main Store",
      openingFloat: 1000,
      transactions: [{ type: "out", amount: 150, description: "Rent", recordedBy: "Jane" }],
    });
    const txId = pc.transactions[0]._id;
    await createExpense({
      amount: 150,
      description: "[Petty Cash] Rent",
      store: "Main Store",
      date: "2024-01-15",
      fromPettyCash: true,
      recordedBy: "Jane",
    });
    const token = makeToken({ id: manager._id, role: "manager", store: "Main Store", name: "Jane" });
    const res = await request(app)
      .delete(`/api/petty-cash/${pc._id}/transaction/${txId}`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    const expense = await Expense.findOne({ fromPettyCash: true });
    expect(expense.isDeleted).toBe(true);
  });
});
