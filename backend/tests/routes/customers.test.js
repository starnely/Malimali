const request = require("supertest");
const createApp = require("../helpers/createApp");
const db = require("../setup/db");
const { makeToken } = require("../helpers/auth");
const {
  createUser,
  createProduct,
  createCustomer,
  createCreditSale,
  createRepayment,
} = require("../helpers/seed");
const Customer = require("../../models/Customer");
const Sale = require("../../models/Sale");
const { TEST_TENANT_ID } = require("../helpers/tenant");

const app = createApp();

beforeAll(() => db.connect());
afterEach(() => db.clear());
afterAll(() => db.close());

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/customers
// ─────────────────────────────────────────────────────────────────────────────
describe("GET /api/customers", () => {
  test("401 — no token", async () => {
    const res = await request(app).get("/api/customers");
    expect(res.status).toBe(401);
  });

  test("cashier sees only their store", async () => {
    const cashier = await createUser({ role: "cashier", email: "c@test.com", store: "Store A" });
    await createCustomer({ name: "Alice", store: "Store A" });
    await createCustomer({ name: "Bob", store: "Store B" });

    const token = makeToken({ id: cashier._id, role: "cashier", store: "Store A" });
    const res = await request(app).get("/api/customers").set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    const names = res.body.map((c) => c.name);
    expect(names).toContain("Alice");
    expect(names).not.toContain("Bob");
  });

  test("owner sees all stores; ?store= narrows results", async () => {
    const owner = await createUser({ role: "owner", email: "o@test.com", store: "HQ" });
    await createCustomer({ name: "Alice", store: "Store A" });
    await createCustomer({ name: "Bob", store: "Store B" });

    const token = makeToken({ id: owner._id, role: "owner", store: "HQ" });

    const allRes = await request(app).get("/api/customers").set("Authorization", `Bearer ${token}`);
    expect(allRes.body.length).toBe(2);

    const filtered = await request(app)
      .get("/api/customers?store=Store A")
      .set("Authorization", `Bearer ${token}`);
    expect(filtered.body.length).toBe(1);
    expect(filtered.body[0].name).toBe("Alice");
  });

  test("?search= matches by name and phone (case-insensitive)", async () => {
    const owner = await createUser({ role: "owner", email: "o@test.com", store: "HQ" });
    await createCustomer({ name: "Alice Mwangi", phone: "0712345678", store: "Main Store" });
    await createCustomer({ name: "Bob Kamau",    phone: "0799999999", store: "Main Store" });

    const token = makeToken({ id: owner._id, role: "owner", store: "HQ" });

    const nameRes = await request(app)
      .get("/api/customers?search=alice")
      .set("Authorization", `Bearer ${token}`);
    expect(nameRes.body.length).toBe(1);
    expect(nameRes.body[0].name).toBe("Alice Mwangi");

    const phoneRes = await request(app)
      .get("/api/customers?search=0799")
      .set("Authorization", `Bearer ${token}`);
    expect(phoneRes.body.length).toBe(1);
    expect(phoneRes.body[0].name).toBe("Bob Kamau");
  });

  test("?overdue=true returns only flagged customers", async () => {
    const owner = await createUser({ role: "owner", email: "o@test.com", store: "HQ" });
    await createCustomer({ name: "Overdue", store: "Main Store", overdue: true });
    await createCustomer({ name: "Good",    store: "Main Store", overdue: false });

    const token = makeToken({ id: owner._id, role: "owner", store: "HQ" });
    const res = await request(app)
      .get("/api/customers?overdue=true")
      .set("Authorization", `Bearer ${token}`);

    expect(res.body.length).toBe(1);
    expect(res.body[0].name).toBe("Overdue");
  });

  test("balance, totalBorrowed, totalSales computed from credit sales and repayments", async () => {
    const owner   = await createUser({ role: "owner", email: "o@test.com", store: "HQ" });
    const product  = await createProduct({ store: "Main Store" });
    const customer = await createCustomer({ name: "Debtor", store: "Main Store" });

    // Two credit sales of 100 each
    await createCreditSale(product, customer._id);
    await createCreditSale(product, customer._id);
    // Partial repayment of 50 → balance = 150
    await createRepayment(customer, { amount: 50 });

    const token = makeToken({ id: owner._id, role: "owner", store: "HQ" });
    const res = await request(app).get("/api/customers").set("Authorization", `Bearer ${token}`);

    const debtor = res.body.find((c) => c.name === "Debtor");
    expect(debtor.totalBorrowed).toBe(200);
    expect(debtor.totalSales).toBe(2);
    expect(debtor.balance).toBe(150);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/customers/:id
// ─────────────────────────────────────────────────────────────────────────────
describe("GET /api/customers/:id", () => {
  test("404 — unknown id", async () => {
    const owner = await createUser({ role: "owner", email: "o@test.com", store: "HQ" });
    const token = makeToken({ id: owner._id, role: "owner", store: "HQ" });
    const res = await request(app)
      .get("/api/customers/000000000000000000000001")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  test("returns customer + sales + repayments + computed balance", async () => {
    const owner    = await createUser({ role: "owner", email: "o@test.com", store: "HQ" });
    const product  = await createProduct({ store: "Main Store" });
    const customer = await createCustomer({ name: "Debtor", store: "Main Store" });
    await createCreditSale(product, customer._id);    // 100 credit
    await createRepayment(customer, { amount: 30 });  // 30 paid

    const token = makeToken({ id: owner._id, role: "owner", store: "HQ" });
    const res = await request(app)
      .get(`/api/customers/${customer._id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.customer.name).toBe("Debtor");
    expect(res.body.customer.balance).toBe(70);
    expect(res.body.sales).toHaveLength(1);
    expect(res.body.repayments).toHaveLength(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/customers/from-sale
// ─────────────────────────────────────────────────────────────────────────────
describe("POST /api/customers/from-sale", () => {
  test("400 — missing required fields (no saleId)", async () => {
    const cashier = await createUser({ role: "cashier", email: "c@test.com", store: "Main Store" });
    const token = makeToken({ id: cashier._id, role: "cashier", store: "Main Store" });
    const res = await request(app)
      .post("/api/customers/from-sale")
      .set("Authorization", `Bearer ${token}`)
      .send({ customerName: "Alice", store: "Main Store" }); // missing saleId
    expect(res.status).toBe(400);
  });

  test("creates a new customer and patches the sale", async () => {
    const cashier = await createUser({ role: "cashier", email: "c@test.com", store: "Main Store" });
    const product = await createProduct({ store: "Main Store" });
    const sale = await Sale.create({
      items: [{ productId: product._id, qty: 1, price: 50, buyPrice: 30 }],
      total: 50,
      store: "Main Store",
      cashier: cashier.fullname,
      date: "2024-01-01",
      time: "10:00:00 EAT",
      paymentInfo: { paymentMethod: "cash", finalTotal: 50 },
      tenantId: TEST_TENANT_ID,
    });

    const token = makeToken({ id: cashier._id, role: "cashier", store: "Main Store" });
    const res = await request(app)
      .post("/api/customers/from-sale")
      .set("Authorization", `Bearer ${token}`)
      .send({ customerName: "New Customer", phone: "0711111111", store: "Main Store", saleId: sale._id });

    expect(res.status).toBe(200);
    expect(res.body.customer.name).toBe("New Customer");

    const updated = await Sale.findById(sale._id);
    expect(String(updated.paymentInfo.customerId)).toBe(String(res.body.customer._id));
  });

  test("reuses an existing customer matched by phone", async () => {
    const cashier  = await createUser({ role: "cashier", email: "c@test.com", store: "Main Store" });
    const product  = await createProduct({ store: "Main Store" });
    const existing = await createCustomer({ name: "Jane Doe", phone: "0722222222", store: "Main Store" });
    const sale = await Sale.create({
      items: [{ productId: product._id, qty: 1, price: 50, buyPrice: 30 }],
      total: 50, store: "Main Store", cashier: "Cashier",
      date: "2024-01-01", time: "10:00:00 EAT",
      paymentInfo: { paymentMethod: "cash", finalTotal: 50 },
      tenantId: TEST_TENANT_ID,
    });

    const token = makeToken({ id: cashier._id, role: "cashier", store: "Main Store" });
    const res = await request(app)
      .post("/api/customers/from-sale")
      .set("Authorization", `Bearer ${token}`)
      .send({ customerName: "Jane", phone: "0722222222", store: "Main Store", saleId: sale._id });

    expect(res.status).toBe(200);
    expect(String(res.body.customer._id)).toBe(String(existing._id));
  });

  test("reuses existing customer matched by name (case-insensitive)", async () => {
    const cashier  = await createUser({ role: "cashier", email: "c@test.com", store: "Main Store" });
    const product  = await createProduct({ store: "Main Store" });
    const existing = await createCustomer({ name: "John Doe", store: "Main Store" });
    const sale = await Sale.create({
      items: [{ productId: product._id, qty: 1, price: 50, buyPrice: 30 }],
      total: 50, store: "Main Store", cashier: "Cashier",
      date: "2024-01-01", time: "10:00:00 EAT",
      paymentInfo: { paymentMethod: "cash", finalTotal: 50 },
      tenantId: TEST_TENANT_ID,
    });

    const token = makeToken({ id: cashier._id, role: "cashier", store: "Main Store" });
    const res = await request(app)
      .post("/api/customers/from-sale")
      .set("Authorization", `Bearer ${token}`)
      .send({ customerName: "john doe", store: "Main Store", saleId: sale._id });

    expect(res.status).toBe(200);
    expect(String(res.body.customer._id)).toBe(String(existing._id));
  });

  test("merges phone onto existing customer that had none", async () => {
    const cashier  = await createUser({ role: "cashier", email: "c@test.com", store: "Main Store" });
    const product  = await createProduct({ store: "Main Store" });
    const existing = await createCustomer({ name: "No Phone", phone: "", store: "Main Store" });
    const sale = await Sale.create({
      items: [{ productId: product._id, qty: 1, price: 50, buyPrice: 30 }],
      total: 50, store: "Main Store", cashier: "Cashier",
      date: "2024-01-01", time: "10:00:00 EAT",
      paymentInfo: { paymentMethod: "cash", finalTotal: 50 },
      tenantId: TEST_TENANT_ID,
    });

    const token = makeToken({ id: cashier._id, role: "cashier", store: "Main Store" });
    await request(app)
      .post("/api/customers/from-sale")
      .set("Authorization", `Bearer ${token}`)
      .send({ customerName: "No Phone", phone: "0733333333", store: "Main Store", saleId: sale._id });

    const updated = await Customer.findById(existing._id);
    expect(updated.phone).toBe("0733333333");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/customers/:id/repayments
// ─────────────────────────────────────────────────────────────────────────────
describe("POST /api/customers/:id/repayments", () => {
  test("400 — amount ≤ 0", async () => {
    const cashier  = await createUser({ role: "cashier", email: "c@test.com", store: "Main Store" });
    const customer = await createCustomer({ store: "Main Store" });
    const token = makeToken({ id: cashier._id, role: "cashier", store: "Main Store", name: "Cashier" });
    const res = await request(app)
      .post(`/api/customers/${customer._id}/repayments`)
      .set("Authorization", `Bearer ${token}`)
      .send({ amount: 0 });
    expect(res.status).toBe(400);
  });

  test("400 — amount exceeds current balance", async () => {
    const cashier  = await createUser({ role: "cashier", email: "c@test.com", store: "Main Store" });
    const product  = await createProduct({ store: "Main Store" });
    const customer = await createCustomer({ store: "Main Store" });
    await createCreditSale(product, customer._id); // balance = 100
    const token = makeToken({ id: cashier._id, role: "cashier", store: "Main Store", name: "Cashier" });
    const res = await request(app)
      .post(`/api/customers/${customer._id}/repayments`)
      .set("Authorization", `Bearer ${token}`)
      .send({ amount: 200 });
    expect(res.status).toBe(400);
  });

  test("creates repayment and returns correct newBalance", async () => {
    const cashier  = await createUser({ role: "cashier", email: "c@test.com", store: "Main Store" });
    const product  = await createProduct({ store: "Main Store" });
    const customer = await createCustomer({ store: "Main Store" });
    await createCreditSale(product, customer._id); // balance = 100
    const token = makeToken({ id: cashier._id, role: "cashier", store: "Main Store", name: "Cashier" });
    const res = await request(app)
      .post(`/api/customers/${customer._id}/repayments`)
      .set("Authorization", `Bearer ${token}`)
      .send({ amount: 40 });
    expect(res.status).toBe(200);
    expect(res.body.newBalance).toBe(60);
  });

  test("full repayment clears the overdue flag", async () => {
    const cashier  = await createUser({ role: "cashier", email: "c@test.com", store: "Main Store" });
    const product  = await createProduct({ store: "Main Store" });
    const customer = await createCustomer({ store: "Main Store", overdue: true });
    await createCreditSale(product, customer._id); // balance = 100
    const token = makeToken({ id: cashier._id, role: "cashier", store: "Main Store", name: "Cashier" });
    const res = await request(app)
      .post(`/api/customers/${customer._id}/repayments`)
      .set("Authorization", `Bearer ${token}`)
      .send({ amount: 100 });
    expect(res.status).toBe(200);
    expect(res.body.newBalance).toBe(0);
    const updated = await Customer.findById(customer._id);
    expect(updated.overdue).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/customers/:id/blacklist
// ─────────────────────────────────────────────────────────────────────────────
describe("PATCH /api/customers/:id/blacklist", () => {
  test("403 — cashier cannot blacklist", async () => {
    const cashier  = await createUser({ role: "cashier", email: "c@test.com", store: "Main Store" });
    const customer = await createCustomer({ store: "Main Store" });
    const token = makeToken({ id: cashier._id, role: "cashier", store: "Main Store" });
    const res = await request(app)
      .patch(`/api/customers/${customer._id}/blacklist`)
      .set("Authorization", `Bearer ${token}`)
      .send({ blacklisted: true, reason: "Bad payer" });
    expect(res.status).toBe(403);
  });

  test("owner can blacklist a customer", async () => {
    const owner    = await createUser({ role: "owner", email: "o@test.com", store: "HQ" });
    const customer = await createCustomer({ store: "Main Store" });
    const token = makeToken({ id: owner._id, role: "owner", store: "HQ", name: "Owner" });
    const res = await request(app)
      .patch(`/api/customers/${customer._id}/blacklist`)
      .set("Authorization", `Bearer ${token}`)
      .send({ blacklisted: true, reason: "Repeated default" });
    expect(res.status).toBe(200);
    expect(res.body.customer.blacklisted).toBe(true);
    expect(res.body.customer.blacklistReason).toBe("Repeated default");
    expect(res.body.customer.blacklistedBy).toBe("Owner");
  });

  test("owner can un-blacklist a customer", async () => {
    const owner    = await createUser({ role: "owner", email: "o@test.com", store: "HQ" });
    const customer = await createCustomer({
      store: "Main Store",
      blacklisted: true,
      blacklistReason: "Old reason",
      blacklistedBy: "Owner",
    });
    const token = makeToken({ id: owner._id, role: "owner", store: "HQ", name: "Owner" });
    const res = await request(app)
      .patch(`/api/customers/${customer._id}/blacklist`)
      .set("Authorization", `Bearer ${token}`)
      .send({ blacklisted: false });
    expect(res.status).toBe(200);
    expect(res.body.customer.blacklisted).toBe(false);
    expect(res.body.customer.blacklistReason).toBe("");
    expect(res.body.customer.blacklistedBy).toBe("");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/customers/check-overdue
// ─────────────────────────────────────────────────────────────────────────────
describe("POST /api/customers/check-overdue", () => {
  test("403 — cashier cannot run overdue check", async () => {
    const cashier = await createUser({ role: "cashier", email: "c@test.com", store: "Main Store" });
    const token = makeToken({ id: cashier._id, role: "cashier", store: "Main Store" });
    const res = await request(app)
      .post("/api/customers/check-overdue")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  test("flags customers with a past promiseDate and unpaid balance", async () => {
    const owner    = await createUser({ role: "owner", email: "o@test.com", store: "HQ" });
    const product  = await createProduct({ store: "Main Store" });
    const customer = await createCustomer({ store: "Main Store", overdue: false });
    await createCreditSale(product, customer._id, {
      paymentInfo: { finalTotal: 100, promiseDate: "2020-01-01" },
    });

    const token = makeToken({ id: owner._id, role: "owner", store: "HQ" });
    const res = await request(app)
      .post("/api/customers/check-overdue")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);

    const updated = await Customer.findById(customer._id);
    expect(updated.overdue).toBe(true);
  });
});
