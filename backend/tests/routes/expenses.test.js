const request = require("supertest");
const createApp = require("../helpers/createApp");
const db = require("../setup/db");
const { makeToken } = require("../helpers/auth");
const { createUser, createExpense, createPettyCash } = require("../helpers/seed");
const Expense = require("../../models/Expense");
const PettyCash = require("../../models/PettyCash");

const app = createApp();

beforeAll(() => db.connect());
afterEach(() => db.clear());
afterAll(() => db.close());

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/expenses
// ─────────────────────────────────────────────────────────────────────────────
describe("GET /api/expenses", () => {
  test("401 — no token", async () => {
    const res = await request(app).get("/api/expenses");
    expect(res.status).toBe(401);
  });

  test("soft-deleted expenses are excluded", async () => {
    const owner = await createUser({ role: "owner", email: "o@test.com", store: "HQ" });
    await createExpense({ description: "Active",  isDeleted: false });
    await createExpense({ description: "Deleted", isDeleted: true });

    const token = makeToken({ id: owner._id, role: "owner", store: "HQ" });
    const res = await request(app).get("/api/expenses").set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.expenses.length).toBe(1);
    expect(res.body.expenses[0].description).toBe("Active");
  });

  test("?category= filters by category", async () => {
    const owner = await createUser({ role: "owner", email: "o@test.com", store: "HQ" });
    await createExpense({ category: "rent",  description: "Rent" });
    await createExpense({ category: "other", description: "Other" });

    const token = makeToken({ id: owner._id, role: "owner", store: "HQ" });
    const res = await request(app)
      .get("/api/expenses?category=rent")
      .set("Authorization", `Bearer ${token}`);

    expect(res.body.expenses.length).toBe(1);
    expect(res.body.expenses[0].category).toBe("rent");
  });

  test("?from= / ?to= date range filter", async () => {
    const owner = await createUser({ role: "owner", email: "o@test.com", store: "HQ" });
    await createExpense({ date: "2024-01-10", description: "In range" });
    await createExpense({ date: "2024-02-15", description: "Out of range" });

    const token = makeToken({ id: owner._id, role: "owner", store: "HQ" });
    const res = await request(app)
      .get("/api/expenses?from=2024-01-01&to=2024-01-31")
      .set("Authorization", `Bearer ${token}`);

    expect(res.body.expenses.length).toBe(1);
    expect(res.body.expenses[0].description).toBe("In range");
  });

  test("cashier sees only their own expenses (filtered by recordedBy)", async () => {
    const cashier = await createUser({ role: "cashier", email: "c@test.com", store: "Main Store" });
    await createExpense({ recordedBy: "Alice",  description: "Alice expense" });
    await createExpense({ recordedBy: "Bob",    description: "Bob expense" });

    const token = makeToken({ id: cashier._id, role: "cashier", store: "Main Store", name: "Alice" });
    const res = await request(app).get("/api/expenses").set("Authorization", `Bearer ${token}`);

    expect(res.body.expenses.length).toBe(1);
    expect(res.body.expenses[0].recordedBy).toBe("Alice");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/expenses/summary
// ─────────────────────────────────────────────────────────────────────────────
describe("GET /api/expenses/summary", () => {
  test("groups by category and sums amounts; grandTotal is correct", async () => {
    const owner = await createUser({ role: "owner", email: "o@test.com", store: "HQ" });
    await createExpense({ category: "rent",      amount: 500 });
    await createExpense({ category: "rent",      amount: 300 });
    await createExpense({ category: "utilities", amount: 200 });

    const token = makeToken({ id: owner._id, role: "owner", store: "HQ" });
    const res = await request(app).get("/api/expenses/summary").set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.grandTotal).toBe(1000);

    const rentEntry = res.body.summary.find((s) => s._id === "rent");
    expect(rentEntry.total).toBe(800);

    const utilEntry = res.body.summary.find((s) => s._id === "utilities");
    expect(utilEntry.total).toBe(200);
  });

  test("?from= / ?to= range applied to the aggregation", async () => {
    const owner = await createUser({ role: "owner", email: "o@test.com", store: "HQ" });
    await createExpense({ category: "rent", amount: 500, date: "2024-01-10" });
    await createExpense({ category: "rent", amount: 999, date: "2024-03-01" }); // outside range

    const token = makeToken({ id: owner._id, role: "owner", store: "HQ" });
    const res = await request(app)
      .get("/api/expenses/summary?from=2024-01-01&to=2024-01-31")
      .set("Authorization", `Bearer ${token}`);

    expect(res.body.grandTotal).toBe(500);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/expenses/monthly
// ─────────────────────────────────────────────────────────────────────────────
describe("GET /api/expenses/monthly", () => {
  test("returns expenses for the requested year/month window", async () => {
    const owner = await createUser({ role: "owner", email: "o@test.com", store: "HQ" });
    await createExpense({ amount: 100, date: "2024-06-10", description: "June A" });
    await createExpense({ amount: 200, date: "2024-06-25", description: "June B" });
    await createExpense({ amount: 999, date: "2024-07-01", description: "July"   }); // outside

    const token = makeToken({ id: owner._id, role: "owner", store: "HQ" });
    const res = await request(app)
      .get("/api/expenses/monthly?year=2024&month=6")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.expenses.length).toBe(2);
    expect(res.body.grandTotal).toBe(300);
    expect(res.body.byDate["2024-06-10"]).toBe(100);
    expect(res.body.byDate["2024-06-25"]).toBe(200);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/expenses
// ─────────────────────────────────────────────────────────────────────────────
describe("POST /api/expenses", () => {
  test("400 — amount ≤ 0", async () => {
    const cashier = await createUser({ role: "cashier", email: "c@test.com", store: "Main Store" });
    const token = makeToken({ id: cashier._id, role: "cashier", store: "Main Store" });
    const res = await request(app)
      .post("/api/expenses")
      .set("Authorization", `Bearer ${token}`)
      .send({ amount: 0, category: "rent" });
    expect(res.status).toBe(400);
  });

  test("201 — creates expense with correct fields", async () => {
    const cashier = await createUser({ role: "cashier", email: "c@test.com", store: "Main Store" });
    const token = makeToken({ id: cashier._id, role: "cashier", store: "Main Store", name: "Alice" });
    const res = await request(app)
      .post("/api/expenses")
      .set("Authorization", `Bearer ${token}`)
      .send({ amount: 350, category: "utilities", description: "Water bill", store: "Main Store" });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.expense.amount).toBe(350);
    expect(res.body.expense.category).toBe("utilities");
    expect(res.body.expense.recordedBy).toBe("Alice");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/expenses/:id
// ─────────────────────────────────────────────────────────────────────────────
describe("PUT /api/expenses/:id", () => {
  test("403 — cashier cannot update expenses", async () => {
    const cashier = await createUser({ role: "cashier", email: "c@test.com", store: "Main Store" });
    const expense = await createExpense();
    const token = makeToken({ id: cashier._id, role: "cashier", store: "Main Store" });
    const res = await request(app)
      .put(`/api/expenses/${expense._id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ amount: 999 });
    expect(res.status).toBe(403);
  });

  test("404 — unknown id", async () => {
    const owner = await createUser({ role: "owner", email: "o@test.com", store: "HQ" });
    const token = makeToken({ id: owner._id, role: "owner", store: "HQ" });
    const res = await request(app)
      .put("/api/expenses/000000000000000000000001")
      .set("Authorization", `Bearer ${token}`)
      .send({ amount: 999 });
    expect(res.status).toBe(404);
  });

  test("400 — cannot update a soft-deleted expense", async () => {
    const owner   = await createUser({ role: "owner", email: "o@test.com", store: "HQ" });
    const expense = await createExpense({ isDeleted: true });
    const token = makeToken({ id: owner._id, role: "owner", store: "HQ" });
    const res = await request(app)
      .put(`/api/expenses/${expense._id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ amount: 999 });
    expect(res.status).toBe(400);
  });

  test("updates amount, category, and description", async () => {
    const owner   = await createUser({ role: "owner", email: "o@test.com", store: "HQ" });
    const expense = await createExpense({ amount: 100, category: "other", description: "Old" });
    const token = makeToken({ id: owner._id, role: "owner", store: "HQ" });
    const res = await request(app)
      .put(`/api/expenses/${expense._id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ amount: 250, category: "rent", description: "New desc" });

    expect(res.status).toBe(200);
    expect(res.body.expense.amount).toBe(250);
    expect(res.body.expense.category).toBe("rent");
    expect(res.body.expense.description).toBe("New desc");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/expenses/:id
// ─────────────────────────────────────────────────────────────────────────────
describe("DELETE /api/expenses/:id", () => {
  test("403 — cashier cannot delete expenses", async () => {
    const cashier = await createUser({ role: "cashier", email: "c@test.com", store: "Main Store" });
    const expense = await createExpense();
    const token = makeToken({ id: cashier._id, role: "cashier", store: "Main Store" });
    const res = await request(app)
      .delete(`/api/expenses/${expense._id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(403);
  });

  test("404 — unknown id", async () => {
    const owner = await createUser({ role: "owner", email: "o@test.com", store: "HQ" });
    const token = makeToken({ id: owner._id, role: "owner", store: "HQ" });
    const res = await request(app)
      .delete("/api/expenses/000000000000000000000001")
      .set("Authorization", `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(404);
  });

  test("soft-deletes the expense; subsequent GET excludes it", async () => {
    const owner   = await createUser({ role: "owner", email: "o@test.com", store: "HQ" });
    const expense = await createExpense({ description: "To delete" });
    const token = makeToken({ id: owner._id, role: "owner", store: "HQ" });

    const del = await request(app)
      .delete(`/api/expenses/${expense._id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({});
    expect(del.status).toBe(200);
    expect(del.body.success).toBe(true);

    const record = await Expense.findById(expense._id);
    expect(record.isDeleted).toBe(true);

    const list = await request(app).get("/api/expenses").set("Authorization", `Bearer ${token}`);
    expect(list.body.expenses.find((e) => String(e._id) === String(expense._id))).toBeUndefined();
  });

  test("fromPettyCash + open day — removes matching tx, restores petty cash balance", async () => {
    const owner = await createUser({ role: "owner", email: "o@test.com", store: "HQ" });
    const expense = await createExpense({
      amount: 200,
      description: "Rent payment",
      store: "Main Store",
      date: "2024-01-15",
      fromPettyCash: true,
    });
    const pc = await createPettyCash({
      store: "Main Store",
      date: "2024-01-15",
      isClosed: false,
      openingFloat: 1000,
      transactions: [{ type: "out", amount: 200, description: "Rent payment" }],
    });

    const token = makeToken({ id: owner._id, role: "owner", store: "HQ" });
    const res = await request(app)
      .delete(`/api/expenses/${expense._id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.warning).toBeUndefined(); // no warning — reversal succeeded

    const updatedPc = await PettyCash.findById(pc._id);
    expect(updatedPc.transactions.length).toBe(0);
    expect(updatedPc.netBalance).toBe(1000); // openingFloat fully restored
  });

  test("fromPettyCash + closed day — expense deleted with warning; petty cash untouched", async () => {
    const owner = await createUser({ role: "owner", email: "o@test.com", store: "HQ" });
    const expense = await createExpense({
      amount: 200,
      description: "Rent payment",
      store: "Main Store",
      date: "2024-01-15",
      fromPettyCash: true,
    });
    const pc = await createPettyCash({
      store: "Main Store",
      date: "2024-01-15",
      isClosed: true, // day is closed — no reversal possible
      openingFloat: 1000,
      transactions: [{ type: "out", amount: 200, description: "Rent payment" }],
    });

    const token = makeToken({ id: owner._id, role: "owner", store: "HQ" });
    const res = await request(app)
      .delete(`/api/expenses/${expense._id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.warning).toBeDefined();

    const updatedExpense = await Expense.findById(expense._id);
    expect(updatedExpense.isDeleted).toBe(true);

    const updatedPc = await PettyCash.findById(pc._id);
    expect(updatedPc.transactions.length).toBe(1); // tx NOT removed
  });
});
