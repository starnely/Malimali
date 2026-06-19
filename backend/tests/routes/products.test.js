const request = require("supertest");
const createApp = require("../helpers/createApp");
const db = require("../setup/db");
const { makeToken } = require("../helpers/auth");
const { createUser, createProduct } = require("../helpers/seed");
const Product = require("../../models/Product");

const app = createApp();

beforeAll(() => db.connect());
afterEach(() => db.clear());
afterAll(() => db.close());

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/products
// ─────────────────────────────────────────────────────────────────────────────
describe("GET /api/products", () => {
  test("401 — no token", async () => {
    const res = await request(app).get("/api/products");
    expect(res.status).toBe(401);
  });

  test("cashier sees only their store; expired products excluded", async () => {
    const cashier = await createUser({ role: "cashier", email: "c@test.com", store: "Store A" });
    await createProduct({ name: "Alpha", store: "Store A" });
    await createProduct({ name: "Beta",  store: "Store B" });
    await createProduct({ name: "Gamma", store: "Store A", isExpired: true });

    const token = makeToken({ id: cashier._id, role: "cashier", store: "Store A" });
    const res = await request(app).get("/api/products").set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    const names = res.body.products.map((p) => p.name);
    expect(names).toContain("Alpha");
    expect(names).not.toContain("Beta");    // wrong store
    expect(names).not.toContain("Gamma");   // expired
  });

  test("owner sees all stores; ?store filter narrows results", async () => {
    const owner = await createUser({ role: "owner", email: "o@test.com", store: "HQ" });
    await createProduct({ name: "Alpha", store: "Store A" });
    await createProduct({ name: "Beta",  store: "Store B" });

    const token = makeToken({ id: owner._id, role: "owner", store: "HQ" });

    const allRes = await request(app).get("/api/products").set("Authorization", `Bearer ${token}`);
    expect(allRes.body.products.length).toBe(2);

    const filtered = await request(app)
      .get("/api/products?store=Store A")
      .set("Authorization", `Bearer ${token}`);
    expect(filtered.body.products.length).toBe(1);
    expect(filtered.body.products[0].name).toBe("Alpha");
  });

  test("results are sorted alphabetically by name", async () => {
    const owner = await createUser({ role: "owner", email: "o@test.com", store: "HQ" });
    await createProduct({ name: "Zebra" });
    await createProduct({ name: "Apple" });
    await createProduct({ name: "Mango" });

    const token = makeToken({ id: owner._id, role: "owner", store: "HQ" });
    const res = await request(app).get("/api/products").set("Authorization", `Bearer ${token}`);

    const names = res.body.products.map((p) => p.name);
    expect(names).toEqual([...names].sort());
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/products/low-stock
// ─────────────────────────────────────────────────────────────────────────────
describe("GET /api/products/low-stock", () => {
  test("returns only products where stock ≤ reorderLevel", async () => {
    const owner = await createUser({ role: "owner", email: "o@test.com", store: "HQ" });
    await createProduct({ name: "Low",  stock: 3,  reorderLevel: 5 });
    await createProduct({ name: "High", stock: 20, reorderLevel: 5 });

    const token = makeToken({ id: owner._id, role: "owner", store: "HQ" });
    const res = await request(app)
      .get("/api/products/low-stock")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    const names = res.body.products.map((p) => p.name);
    expect(names).toContain("Low");
    expect(names).not.toContain("High");
  });

  test("products with stock > reorderLevel are absent", async () => {
    const cashier = await createUser({ role: "cashier", email: "c@test.com", store: "Main Store" });
    await createProduct({ stock: 100, reorderLevel: 5 });

    const token = makeToken({ id: cashier._id, role: "cashier", store: "Main Store" });
    const res = await request(app)
      .get("/api/products/low-stock")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.products.length).toBe(0);
  });

  test("response includes count field matching array length", async () => {
    const owner = await createUser({ role: "owner", email: "o@test.com", store: "HQ" });
    await createProduct({ name: "ProductAa", stock: 1, reorderLevel: 5 });
    await createProduct({ name: "ProductBb", stock: 2, reorderLevel: 5 });

    const token = makeToken({ id: owner._id, role: "owner", store: "HQ" });
    const res = await request(app)
      .get("/api/products/low-stock")
      .set("Authorization", `Bearer ${token}`);

    expect(res.body.count).toBe(res.body.products.length);
    expect(res.body.count).toBe(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/products/:id
// ─────────────────────────────────────────────────────────────────────────────
describe("GET /api/products/:id", () => {
  test("404 — product not found", async () => {
    const owner = await createUser({ role: "owner", email: "o@test.com", store: "HQ" });
    const token = makeToken({ id: owner._id, role: "owner", store: "HQ" });
    const res = await request(app)
      .get("/api/products/000000000000000000000001")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  test("200 — returns single product", async () => {
    const cashier = await createUser({ role: "cashier", email: "c@test.com", store: "Main Store" });
    const product = await createProduct({ name: "SpecificProduct" });
    const token = makeToken({ id: cashier._id, role: "cashier", store: cashier.store });

    const res = await request(app)
      .get(`/api/products/${product._id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.product.name).toBe("SpecificProduct");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/products
// ─────────────────────────────────────────────────────────────────────────────
describe("POST /api/products", () => {
  const validBody = {
    name: "New Product",
    category: "Groceries",
    buyPrice: 10,
    sellPrice: 15,
    stock: 50,
    unit: "pcs",
    store: "Main Store",
  };

  test("403 — cashier cannot create products", async () => {
    const cashier = await createUser({ role: "cashier", email: "c@test.com" });
    const token = makeToken({ id: cashier._id, role: "cashier", store: cashier.store });
    const res = await request(app)
      .post("/api/products")
      .set("Authorization", `Bearer ${token}`)
      .send(validBody);
    expect(res.status).toBe(403);
  });

  test("201 — barcode auto-generated as 13-digit EAN starting with 600 when omitted", async () => {
    const manager = await createUser({ role: "manager", email: "m@test.com" });
    const token = makeToken({ id: manager._id, role: "manager", store: manager.store });

    const res = await request(app)
      .post("/api/products")
      .set("Authorization", `Bearer ${token}`)
      .send(validBody);

    expect(res.status).toBe(201);
    expect(res.body.product.barcode).toMatch(/^600\d{10}$/);
  });

  test("201 — custom barcode provided is stored verbatim", async () => {
    const owner = await createUser({ role: "owner", email: "o@test.com", store: "HQ" });
    const token = makeToken({ id: owner._id, role: "owner", store: "HQ" });

    const res = await request(app)
      .post("/api/products")
      .set("Authorization", `Bearer ${token}`)
      .send({ ...validBody, barcode: "123456789012" });

    expect(res.status).toBe(201);
    expect(res.body.product.barcode).toBe("123456789012");
  });

  test("409 — duplicate barcode", async () => {
    const owner = await createUser({ role: "owner", email: "o@test.com", store: "HQ" });
    const token = makeToken({ id: owner._id, role: "owner", store: "HQ" });
    await createProduct({ barcode: "DUPE123456" });

    const res = await request(app)
      .post("/api/products")
      .set("Authorization", `Bearer ${token}`)
      .send({ ...validBody, barcode: "DUPE123456" });

    expect(res.status).toBe(409);
  });

  test("201 — weighed product fields stored correctly", async () => {
    const owner = await createUser({ role: "owner", email: "o@test.com", store: "HQ" });
    const token = makeToken({ id: owner._id, role: "owner", store: "HQ" });

    const res = await request(app)
      .post("/api/products")
      .set("Authorization", `Bearer ${token}`)
      .send({
        ...validBody,
        sellPrice: 10,
        isWeighed: true,
        pricePerKg: 250,
        pluNumber: 42,
      });

    expect(res.status).toBe(201);
    expect(res.body.product.isWeighed).toBe(true);
    expect(res.body.product.pricePerKg).toBe(250);
    expect(res.body.product.pluNumber).toBe(42);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/products/:id
// ─────────────────────────────────────────────────────────────────────────────
describe("PUT /api/products/:id", () => {
  test("403 — cashier cannot update products", async () => {
    const cashier = await createUser({ role: "cashier", email: "c@test.com" });
    const product = await createProduct();
    const token = makeToken({ id: cashier._id, role: "cashier", store: cashier.store });

    const res = await request(app)
      .put(`/api/products/${product._id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Hacked Name", category: "Cat", buyPrice: 1, sellPrice: 2, stock: 1 });
    expect(res.status).toBe(403);
  });

  test("404 — product not found", async () => {
    const owner = await createUser({ role: "owner", email: "o@test.com", store: "HQ" });
    const token = makeToken({ id: owner._id, role: "owner", store: "HQ" });
    const res = await request(app)
      .put("/api/products/000000000000000000000001")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Updated", category: "Cat", buyPrice: 1, sellPrice: 2, stock: 1 });
    expect(res.status).toBe(404);
  });

  test("409 — barcode collision with another product", async () => {
    const owner = await createUser({ role: "owner", email: "o@test.com", store: "HQ" });
    const token = makeToken({ id: owner._id, role: "owner", store: "HQ" });
    await createProduct({ barcode: "TAKEN111" });
    const target = await createProduct({ barcode: "TARGET222" });

    const res = await request(app)
      .put(`/api/products/${target._id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "UpdatedName", category: "Cat", buyPrice: 1, sellPrice: 2, stock: 1, barcode: "TAKEN111" });
    expect(res.status).toBe(409);
  });

  test("200 — name, price, stock, store update correctly", async () => {
    const owner = await createUser({ role: "owner", email: "o@test.com", store: "HQ" });
    const token = makeToken({ id: owner._id, role: "owner", store: "HQ" });
    const product = await createProduct({ name: "Old Name", sellPrice: 15, stock: 10 });

    const res = await request(app)
      .put(`/api/products/${product._id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "New Name",
        category: product.category,
        buyPrice: product.buyPrice,
        sellPrice: 20,
        stock: 99,
        store: "Branch X",
      });

    expect(res.status).toBe(200);
    expect(res.body.product.name).toBe("New Name");
    expect(res.body.product.sellPrice).toBe(20);
    expect(res.body.product.stock).toBe(99);
    expect(res.body.product.store).toBe("Branch X");
  });

  test("200 — existing barcode preserved when no barcode sent in body", async () => {
    const owner = await createUser({ role: "owner", email: "o@test.com", store: "HQ" });
    const token = makeToken({ id: owner._id, role: "owner", store: "HQ" });
    const product = await createProduct({ barcode: "KEEP999" });

    const res = await request(app)
      .put(`/api/products/${product._id}`)
      .set("Authorization", `Bearer ${token}`)
      // no barcode field sent
      .send({ name: "Updated", category: product.category, buyPrice: 5, sellPrice: 10, stock: 5 });

    expect(res.status).toBe(200);
    expect(res.body.product.barcode).toBe("KEEP999");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/products/:id
// ─────────────────────────────────────────────────────────────────────────────
describe("DELETE /api/products/:id", () => {
  test("403 — manager cannot delete products", async () => {
    const manager = await createUser({ role: "manager", email: "m@test.com" });
    const product = await createProduct();
    const token = makeToken({ id: manager._id, role: "manager", store: manager.store });

    const res = await request(app)
      .delete(`/api/products/${product._id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  test("404 — product not found", async () => {
    const owner = await createUser({ role: "owner", email: "o@test.com", store: "HQ" });
    const token = makeToken({ id: owner._id, role: "owner", store: "HQ" });
    const res = await request(app)
      .delete("/api/products/000000000000000000000001")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  test("200 — product deleted; no longer findable in DB", async () => {
    const owner = await createUser({ role: "owner", email: "o@test.com", store: "HQ" });
    const token = makeToken({ id: owner._id, role: "owner", store: "HQ" });
    const product = await createProduct();

    const res = await request(app)
      .delete(`/api/products/${product._id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const inDb = await Product.findById(product._id);
    expect(inDb).toBeNull();
  });
});
