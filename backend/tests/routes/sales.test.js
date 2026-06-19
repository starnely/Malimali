const request = require("supertest");
const createApp = require("../helpers/createApp");
const db = require("../setup/db");
const { makeToken } = require("../helpers/auth");
const { createUser, createProduct, DEFAULT_PASSWORD } = require("../helpers/seed");
const Sale = require("../../models/Sale");
const Product = require("../../models/Product");

const app = createApp();

beforeAll(() => db.connect());
afterEach(() => db.clear());
afterAll(() => db.close());

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/sales
// ─────────────────────────────────────────────────────────────────────────────
describe("GET /api/sales", () => {
  test("401 — no token", async () => {
    const res = await request(app).get("/api/sales");
    expect(res.status).toBe(401);
  });

  test("cashier only receives their own sales", async () => {
    const cashier1 = await createUser({ role: "cashier", email: "c1@test.com", store: "Main Store" });
    const cashier2 = await createUser({ role: "cashier", email: "c2@test.com", store: "Main Store" });
    const product = await createProduct();

    // One sale per cashier
    await Sale.create({
      items: [{ productId: product._id, qty: 1, price: 15, buyPrice: 10 }],
      total: 15,
      store: "Main Store",
      cashierId: cashier1._id,
      cashier: cashier1.fullname,
      date: "2024-01-01",
      time: "10:00:00 EAT",
      paymentInfo: { paymentMethod: "cash", finalTotal: 15 },
    });
    await Sale.create({
      items: [{ productId: product._id, qty: 1, price: 15, buyPrice: 10 }],
      total: 15,
      store: "Main Store",
      cashierId: cashier2._id,
      cashier: cashier2.fullname,
      date: "2024-01-01",
      time: "10:00:00 EAT",
      paymentInfo: { paymentMethod: "cash", finalTotal: 15 },
    });

    const token = makeToken({ id: cashier1._id, role: "cashier", store: "Main Store" });
    const res = await request(app)
      .get("/api/sales")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.sales.length).toBe(1);
    expect(String(res.body.sales[0].cashierId._id || res.body.sales[0].cashierId)).toBe(
      String(cashier1._id)
    );
  });

  test("manager only receives sales from their own store", async () => {
    const manager = await createUser({ role: "manager", email: "mgr@test.com", store: "Store A" });
    const cashier = await createUser({ role: "cashier", email: "c@test.com", store: "Store B" });
    const product = await createProduct();

    await Sale.create({
      items: [{ productId: product._id, qty: 1, price: 15, buyPrice: 10 }],
      total: 15,
      store: "Store A",
      cashierId: manager._id,
      cashier: manager.fullname,
      date: "2024-01-01",
      time: "10:00:00 EAT",
      paymentInfo: { paymentMethod: "cash", finalTotal: 15 },
    });
    await Sale.create({
      items: [{ productId: product._id, qty: 1, price: 15, buyPrice: 10 }],
      total: 15,
      store: "Store B",
      cashierId: cashier._id,
      cashier: cashier.fullname,
      date: "2024-01-01",
      time: "10:00:00 EAT",
      paymentInfo: { paymentMethod: "cash", finalTotal: 15 },
    });

    const token = makeToken({ id: manager._id, role: "manager", store: "Store A" });
    const res = await request(app)
      .get("/api/sales")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.sales.length).toBe(1);
    expect(res.body.sales[0].store).toBe("Store A");
  });

  test("owner receives all sales; ?store filter narrows results", async () => {
    const owner = await createUser({ role: "owner", email: "owner@test.com", store: "HQ" });
    const product = await createProduct();

    await Sale.create({
      items: [{ productId: product._id, qty: 1, price: 15, buyPrice: 10 }],
      total: 15,
      store: "Store A",
      cashierId: owner._id,
      cashier: "staff",
      date: "2024-01-01",
      time: "10:00:00 EAT",
      paymentInfo: { paymentMethod: "cash", finalTotal: 15 },
    });
    await Sale.create({
      items: [{ productId: product._id, qty: 1, price: 15, buyPrice: 10 }],
      total: 15,
      store: "Store B",
      cashierId: owner._id,
      cashier: "staff",
      date: "2024-01-01",
      time: "10:00:00 EAT",
      paymentInfo: { paymentMethod: "cash", finalTotal: 15 },
    });

    const token = makeToken({ id: owner._id, role: "owner", store: "HQ" });

    const allRes = await request(app)
      .get("/api/sales")
      .set("Authorization", `Bearer ${token}`);
    expect(allRes.body.sales.length).toBe(2);

    const filteredRes = await request(app)
      .get("/api/sales?store=Store A")
      .set("Authorization", `Bearer ${token}`);
    expect(filteredRes.body.sales.length).toBe(1);
    expect(filteredRes.body.sales[0].store).toBe("Store A");
  });

  test("each sale has computed netTotal and isPartiallyReturned fields", async () => {
    const owner = await createUser({ role: "owner", email: "owner@test.com", store: "HQ" });
    const product = await createProduct();

    await Sale.create({
      items: [{ productId: product._id, qty: 3, price: 15, buyPrice: 10 }],
      total: 45,
      store: "HQ",
      cashierId: owner._id,
      cashier: "staff",
      date: "2024-01-01",
      time: "10:00:00 EAT",
      paymentInfo: { paymentMethod: "cash", finalTotal: 45 },
    });

    const token = makeToken({ id: owner._id, role: "owner", store: "HQ" });
    const res = await request(app)
      .get("/api/sales")
      .set("Authorization", `Bearer ${token}`);

    expect(res.body.sales[0]).toHaveProperty("netTotal");
    expect(res.body.sales[0]).toHaveProperty("isPartiallyReturned");
    expect(res.body.sales[0].isPartiallyReturned).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/sales
// ─────────────────────────────────────────────────────────────────────────────
describe("POST /api/sales", () => {
  let cashier, token, product;

  beforeEach(async () => {
    cashier = await createUser({ role: "cashier", email: "c@test.com", store: "Main Store" });
    token = makeToken({ id: cashier._id, role: "cashier", store: cashier.store });
    product = await createProduct({ stock: 50 });
  });

  test("401 — no token", async () => {
    const res = await request(app).post("/api/sales").send({ items: [], total: 0 });
    expect(res.status).toBe(401);
  });

  test("400 — empty items array", async () => {
    const res = await request(app)
      .post("/api/sales")
      .set("Authorization", `Bearer ${token}`)
      .send({ items: [], total: 0 });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/items/i);
  });

  test("400 — item with qty ≤ 0", async () => {
    const res = await request(app)
      .post("/api/sales")
      .set("Authorization", `Bearer ${token}`)
      .send({
        items: [{ productId: product._id, qty: 0, price: 15 }],
        total: 0,
      });
    expect(res.status).toBe(400);
  });

  test("404 — product not found", async () => {
    const res = await request(app)
      .post("/api/sales")
      .set("Authorization", `Bearer ${token}`)
      .send({
        items: [{ productId: "000000000000000000000001", qty: 1, price: 15 }],
        total: 15,
      });
    expect(res.status).toBe(404);
  });

  test("400 — product is expired", async () => {
    const expired = await createProduct({ isExpired: true, stock: 10 });
    const res = await request(app)
      .post("/api/sales")
      .set("Authorization", `Bearer ${token}`)
      .send({
        items: [{ productId: expired._id, qty: 1, price: 15 }],
        total: 15,
      });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/expired/i);
  });

  test("400 — insufficient stock", async () => {
    const lowStock = await createProduct({ stock: 3 });
    const res = await request(app)
      .post("/api/sales")
      .set("Authorization", `Bearer ${token}`)
      .send({
        items: [{ productId: lowStock._id, qty: 10, price: 15 }],
        total: 150,
      });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/insufficient/i);
  });

  test("201 — sale recorded; stock decremented by qty sold", async () => {
    const res = await request(app)
      .post("/api/sales")
      .set("Authorization", `Bearer ${token}`)
      .send({
        items: [{ productId: product._id, qty: 5, price: product.sellPrice }],
        total: product.sellPrice * 5,
        paymentInfo: { paymentMethod: "cash", finalTotal: product.sellPrice * 5 },
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.sale).toBeDefined();
    expect(res.body.sale.receiptId).toMatch(/^RCP-/);

    const updated = await Product.findById(product._id);
    expect(updated.stock).toBe(45); // 50 - 5
  });

  test("201 — price:0 is recorded as 0, not silently replaced by database sellPrice", async () => {
    const res = await request(app)
      .post("/api/sales")
      .set("Authorization", `Bearer ${token}`)
      .send({
        items: [{ productId: product._id, qty: 1, price: 0 }],
        total: 0,
        paymentInfo: { paymentMethod: "cash", finalTotal: 0 },
      });

    expect(res.status).toBe(201);
    expect(res.body.sale.items[0].price).toBe(0);
  });

  test("201 — paymentInfo fields persisted correctly", async () => {
    const res = await request(app)
      .post("/api/sales")
      .set("Authorization", `Bearer ${token}`)
      .send({
        items: [{ productId: product._id, qty: 1, price: 15 }],
        total: 15,
        paymentInfo: {
          paymentMethod: "mpesa",
          mpesaPhone: "0712345678",
          finalTotal: 15,
          discount: 0,
        },
      });

    expect(res.status).toBe(201);
    expect(res.body.sale.paymentInfo.paymentMethod).toBe("mpesa");
    expect(res.body.sale.paymentInfo.mpesaPhone).toBe("0712345678");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/sales/:id/void
// ─────────────────────────────────────────────────────────────────────────────
describe("PATCH /api/sales/:id/void", () => {
  let owner, ownerToken, cashier, cashierToken, product;

  beforeEach(async () => {
    owner = await createUser({ role: "owner", email: "owner@test.com", store: "Main Store" });
    ownerToken = makeToken({ id: owner._id, role: "owner", store: owner.store });
    cashier = await createUser({
      role: "cashier",
      email: "cashier@test.com",
      store: "Main Store",
      username: "testcashier",
    });
    cashierToken = makeToken({ id: cashier._id, role: "cashier", store: cashier.store });
    product = await createProduct({ stock: 50 });
  });

  async function recordSale() {
    const res = await request(app)
      .post("/api/sales")
      .set("Authorization", `Bearer ${cashierToken}`)
      .send({
        items: [{ productId: product._id, qty: 3, price: product.sellPrice }],
        total: product.sellPrice * 3,
        paymentInfo: { paymentMethod: "cash", finalTotal: product.sellPrice * 3 },
      });
    return res.body.sale;
  }

  test("400 — missing manager credentials", async () => {
    const sale = await recordSale();
    const res = await request(app)
      .patch(`/api/sales/${sale._id}/void`)
      .set("Authorization", `Bearer ${cashierToken}`)
      .send({ reason: "customer changed mind" });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/credentials/i);
  });

  test("400 — missing void reason", async () => {
    const sale = await recordSale();
    const res = await request(app)
      .patch(`/api/sales/${sale._id}/void`)
      .set("Authorization", `Bearer ${cashierToken}`)
      .send({ managerUsername: owner.username, managerPassword: DEFAULT_PASSWORD });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/reason/i);
  });

  test("401 — wrong manager password", async () => {
    const sale = await recordSale();
    const res = await request(app)
      .patch(`/api/sales/${sale._id}/void`)
      .set("Authorization", `Bearer ${cashierToken}`)
      .send({
        managerUsername: owner.username,
        managerPassword: "wrongpass",
        reason: "test void",
      });
    expect(res.status).toBe(401);
  });

  test("403 — cashier cannot authorize a void", async () => {
    const sale = await recordSale();
    const res = await request(app)
      .patch(`/api/sales/${sale._id}/void`)
      .set("Authorization", `Bearer ${cashierToken}`)
      .send({
        managerUsername: cashier.username,
        managerPassword: DEFAULT_PASSWORD,
        reason: "test",
      });
    expect(res.status).toBe(403);
  });

  test("400 — cannot void an already-voided sale", async () => {
    const sale = await recordSale();

    // First void
    await request(app)
      .patch(`/api/sales/${sale._id}/void`)
      .set("Authorization", `Bearer ${cashierToken}`)
      .send({
        managerUsername: owner.username,
        managerPassword: DEFAULT_PASSWORD,
        reason: "first void",
      });

    // Second void attempt
    const res = await request(app)
      .patch(`/api/sales/${sale._id}/void`)
      .set("Authorization", `Bearer ${cashierToken}`)
      .send({
        managerUsername: owner.username,
        managerPassword: DEFAULT_PASSWORD,
        reason: "second void",
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/already been voided/i);
  });

  test("200 — sale voided; stock restocked; all items marked voided", async () => {
    const sale = await recordSale();
    const stockBefore = (await Product.findById(product._id)).stock;

    const res = await request(app)
      .patch(`/api/sales/${sale._id}/void`)
      .set("Authorization", `Bearer ${cashierToken}`)
      .send({
        managerUsername: owner.username,
        managerPassword: DEFAULT_PASSWORD,
        reason: "customer returned items",
      });

    expect(res.status).toBe(200);
    expect(res.body.sale.voided).toBe(true);
    expect(res.body.sale.voidReason).toBe("customer returned items");
    expect(res.body.sale.items.every((i) => i.voidStatus === "voided")).toBe(true);

    const stockAfter = (await Product.findById(product._id)).stock;
    expect(stockAfter).toBe(stockBefore + 3); // 3 units restocked
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/sales/:id/void-items
// ─────────────────────────────────────────────────────────────────────────────
describe("PATCH /api/sales/:id/void-items", () => {
  let owner, cashier, cashierToken, product;

  beforeEach(async () => {
    owner = await createUser({ role: "owner", email: "owner@test.com", store: "Main Store" });
    cashier = await createUser({ role: "cashier", email: "cashier@test.com", store: "Main Store" });
    cashierToken = makeToken({ id: cashier._id, role: "cashier", store: cashier.store });
    product = await createProduct({ stock: 50 });
  });

  // Create a two-item sale and return it.
  async function recordTwoItemSale() {
    const product2 = await createProduct({ name: "Second Product", stock: 50 });
    const res = await request(app)
      .post("/api/sales")
      .set("Authorization", `Bearer ${cashierToken}`)
      .send({
        items: [
          { productId: product._id, qty: 3, price: 15 },
          { productId: product2._id, qty: 2, price: 15 },
        ],
        total: 75,
        paymentInfo: { paymentMethod: "cash", finalTotal: 75 },
      });
    return { sale: res.body.sale, product2 };
  }

  test("400 — empty items array", async () => {
    const { sale } = await recordTwoItemSale();
    const res = await request(app)
      .patch(`/api/sales/${sale._id}/void-items`)
      .set("Authorization", `Bearer ${cashierToken}`)
      .send({
        managerUsername: owner.username,
        managerPassword: DEFAULT_PASSWORD,
        reason: "test",
        items: [],
      });
    expect(res.status).toBe(400);
  });

  test("401 — wrong manager credentials", async () => {
    const { sale } = await recordTwoItemSale();
    const itemId = sale.items[0]._id;
    const res = await request(app)
      .patch(`/api/sales/${sale._id}/void-items`)
      .set("Authorization", `Bearer ${cashierToken}`)
      .send({
        managerUsername: owner.username,
        managerPassword: "wrongpass",
        reason: "test",
        items: [{ itemId, voidQty: 1 }],
      });
    expect(res.status).toBe(401);
  });

  test("200 — partial void: only specified item voided; stock restocked for that qty only", async () => {
    const { sale } = await recordTwoItemSale();
    const firstItemId = sale.items[0]._id;
    const stockBefore = (await Product.findById(product._id)).stock;

    const res = await request(app)
      .patch(`/api/sales/${sale._id}/void-items`)
      .set("Authorization", `Bearer ${cashierToken}`)
      .send({
        managerUsername: owner.username,
        managerPassword: DEFAULT_PASSWORD,
        reason: "item damaged",
        items: [{ itemId: firstItemId, voidQty: 2 }],
      });

    expect(res.status).toBe(200);
    expect(res.body.isPartialVoid).toBe(true);
    expect(res.body.sale.voided).toBe(false);

    const stockAfter = (await Product.findById(product._id)).stock;
    expect(stockAfter).toBe(stockBefore + 2);
  });

  test("200 — voiding all items upgrades sale to fully voided", async () => {
    const { sale, product2 } = await recordTwoItemSale();
    const [item1, item2] = sale.items;

    const res = await request(app)
      .patch(`/api/sales/${sale._id}/void-items`)
      .set("Authorization", `Bearer ${cashierToken}`)
      .send({
        managerUsername: owner.username,
        managerPassword: DEFAULT_PASSWORD,
        reason: "full void via items",
        items: [
          { itemId: item1._id, voidQty: item1.qty },
          { itemId: item2._id, voidQty: item2.qty },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.isPartialVoid).toBe(false);
    expect(res.body.sale.voided).toBe(true);
  });

  test("400 — sale already fully voided", async () => {
    const { sale } = await recordTwoItemSale();

    // Full void first
    await request(app)
      .patch(`/api/sales/${sale._id}/void`)
      .set("Authorization", `Bearer ${cashierToken}`)
      .send({
        managerUsername: owner.username,
        managerPassword: DEFAULT_PASSWORD,
        reason: "full void",
      });

    const res = await request(app)
      .patch(`/api/sales/${sale._id}/void-items`)
      .set("Authorization", `Bearer ${cashierToken}`)
      .send({
        managerUsername: owner.username,
        managerPassword: DEFAULT_PASSWORD,
        reason: "try again",
        items: [{ itemId: sale.items[0]._id, voidQty: 1 }],
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/already voided/i);
  });
});
