const request = require("supertest");
const createApp = require("../helpers/createApp");
const db = require("../setup/db");
const { makeToken } = require("../helpers/auth");
const { createUser, createProduct, createCategory } = require("../helpers/seed");
const Category = require("../../models/Category");

const app = createApp();

beforeAll(() => db.connect());
afterEach(() => db.clear());
afterAll(() => db.close());

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/categories
// ─────────────────────────────────────────────────────────────────────────────
describe("GET /api/categories", () => {
  test("401 — no token", async () => {
    const res = await request(app).get("/api/categories");
    expect(res.status).toBe(401);
  });

  test("cashier sees global + own store only; other store categories excluded", async () => {
    const cashier = await createUser({ role: "cashier", email: "c@test.com", store: "Store A" });
    await createCategory({ name: "global cat", store: null });
    await createCategory({ name: "store a cat", store: "Store A" });
    await createCategory({ name: "store b cat", store: "Store B" });

    const token = makeToken({ id: cashier._id, role: "cashier", store: "Store A" });
    const res = await request(app).get("/api/categories").set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    const names = res.body.categories.map((c) => c.name);
    expect(names).toContain("global cat");
    expect(names).toContain("store a cat");
    expect(names).not.toContain("store b cat");
  });

  test("owner with no ?store= sees all categories across all stores", async () => {
    const owner = await createUser({ role: "owner", email: "o@test.com", store: "HQ" });
    await createCategory({ name: "global cat", store: null });
    await createCategory({ name: "store a cat", store: "Store A" });
    await createCategory({ name: "store b cat", store: "Store B" });

    const token = makeToken({ id: owner._id, role: "owner", store: "HQ" });
    const res = await request(app).get("/api/categories").set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.categories.length).toBe(3);
  });

  test("?store= returns global + that store's categories only", async () => {
    const owner = await createUser({ role: "owner", email: "o@test.com", store: "HQ" });
    await createCategory({ name: "global cat", store: null });
    await createCategory({ name: "store a cat", store: "Store A" });
    await createCategory({ name: "store b cat", store: "Store B" });

    const token = makeToken({ id: owner._id, role: "owner", store: "HQ" });
    const res = await request(app)
      .get("/api/categories?store=Store A")
      .set("Authorization", `Bearer ${token}`);

    const names = res.body.categories.map((c) => c.name);
    expect(names).toContain("global cat");
    expect(names).toContain("store a cat");
    expect(names).not.toContain("store b cat");
  });

  test("productCount reflects actual products using that category", async () => {
    const owner = await createUser({ role: "owner", email: "o@test.com", store: "HQ" });
    await createCategory({ name: "electronics", store: null });
    await createProduct({ category: "electronics", store: "Main Store" });
    await createProduct({ category: "electronics", store: "Main Store" });

    const token = makeToken({ id: owner._id, role: "owner", store: "HQ" });
    const res = await request(app).get("/api/categories").set("Authorization", `Bearer ${token}`);

    const cat = res.body.categories.find((c) => c.name === "electronics");
    expect(cat.productCount).toBe(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/categories
// ─────────────────────────────────────────────────────────────────────────────
describe("POST /api/categories", () => {
  test("403 — cashier blocked (ownerOnly)", async () => {
    const cashier = await createUser({ role: "cashier", email: "c@test.com", store: "Main Store" });
    const token = makeToken({ id: cashier._id, role: "cashier", store: "Main Store" });
    const res = await request(app)
      .post("/api/categories")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Electronics" });
    expect(res.status).toBe(403);
  });

  test("403 — manager blocked (ownerOnly)", async () => {
    const manager = await createUser({ role: "manager", email: "m@test.com", store: "Main Store" });
    const token = makeToken({ id: manager._id, role: "manager", store: "Main Store" });
    const res = await request(app)
      .post("/api/categories")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Electronics" });
    expect(res.status).toBe(403);
  });

  test("400 — missing name", async () => {
    const owner = await createUser({ role: "owner", email: "o@test.com", store: "HQ" });
    const token = makeToken({ id: owner._id, role: "owner", store: "HQ" });
    const res = await request(app)
      .post("/api/categories")
      .set("Authorization", `Bearer ${token}`)
      .send({ description: "No name provided" });
    expect(res.status).toBe(400);
  });

  test("409 — duplicate name within the same scope", async () => {
    const owner = await createUser({ role: "owner", email: "o@test.com", store: "HQ" });
    await createCategory({ name: "electronics", store: null });
    const token = makeToken({ id: owner._id, role: "owner", store: "HQ" });
    const res = await request(app)
      .post("/api/categories")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Electronics" }); // normalized = "electronics", store = null → duplicate
    expect(res.status).toBe(409);
  });

  test("201 — creates category; name lowercased; omitted store defaults to null (global)", async () => {
    const owner = await createUser({ role: "owner", email: "o@test.com", store: "HQ" });
    const token = makeToken({ id: owner._id, role: "owner", store: "HQ" });
    const res = await request(app)
      .post("/api/categories")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Electronics", description: "Electronic items" });
    expect(res.status).toBe(201);
    expect(res.body.category.name).toBe("electronics");
    expect(res.body.category.store).toBeNull();
    expect(res.body.category.description).toBe("Electronic items");
  });

  test("201 — same name is allowed in a different store", async () => {
    const owner = await createUser({ role: "owner", email: "o@test.com", store: "HQ" });
    await createCategory({ name: "beverages", store: "Store A" });
    const token = makeToken({ id: owner._id, role: "owner", store: "HQ" });
    const res = await request(app)
      .post("/api/categories")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Beverages", store: "Store B" });
    expect(res.status).toBe(201);
    expect(res.body.category.store).toBe("Store B");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/categories/:id
// ─────────────────────────────────────────────────────────────────────────────
describe("PUT /api/categories/:id", () => {
  test("403 — cashier blocked", async () => {
    const cashier = await createUser({ role: "cashier", email: "c@test.com", store: "Main Store" });
    const cat = await createCategory({ name: "electronics" });
    const token = makeToken({ id: cashier._id, role: "cashier", store: "Main Store" });
    const res = await request(app)
      .put(`/api/categories/${cat._id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Updated" });
    expect(res.status).toBe(403);
  });

  test("400 — missing name", async () => {
    const owner = await createUser({ role: "owner", email: "o@test.com", store: "HQ" });
    const cat = await createCategory({ name: "electronics" });
    const token = makeToken({ id: owner._id, role: "owner", store: "HQ" });
    const res = await request(app)
      .put(`/api/categories/${cat._id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ description: "no name" });
    expect(res.status).toBe(400);
  });

  test("404 — unknown id", async () => {
    const owner = await createUser({ role: "owner", email: "o@test.com", store: "HQ" });
    const token = makeToken({ id: owner._id, role: "owner", store: "HQ" });
    const res = await request(app)
      .put("/api/categories/000000000000000000000001")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Updated" });
    expect(res.status).toBe(404);
  });

  test("409 — name conflicts with a different existing category in the same scope", async () => {
    const owner = await createUser({ role: "owner", email: "o@test.com", store: "HQ" });
    await createCategory({ name: "beverages", store: null });
    const cat = await createCategory({ name: "electronics", store: null });
    const token = makeToken({ id: owner._id, role: "owner", store: "HQ" });
    const res = await request(app)
      .put(`/api/categories/${cat._id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Beverages" }); // conflicts with existing global "beverages"
    expect(res.status).toBe(409);
  });

  test("200 — updates name and description; name normalized to lowercase", async () => {
    const owner = await createUser({ role: "owner", email: "o@test.com", store: "HQ" });
    const cat = await createCategory({ name: "electronics", description: "Old desc" });
    const token = makeToken({ id: owner._id, role: "owner", store: "HQ" });
    const res = await request(app)
      .put(`/api/categories/${cat._id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Gadgets", description: "New desc" });
    expect(res.status).toBe(200);
    expect(res.body.category.name).toBe("gadgets");
    expect(res.body.category.description).toBe("New desc");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/categories/:id
// ─────────────────────────────────────────────────────────────────────────────
describe("DELETE /api/categories/:id", () => {
  test("403 — cashier blocked", async () => {
    const cashier = await createUser({ role: "cashier", email: "c@test.com", store: "Main Store" });
    const cat = await createCategory({ name: "electronics" });
    const token = makeToken({ id: cashier._id, role: "cashier", store: "Main Store" });
    const res = await request(app)
      .delete(`/api/categories/${cat._id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  test("404 — unknown id", async () => {
    const owner = await createUser({ role: "owner", email: "o@test.com", store: "HQ" });
    const token = makeToken({ id: owner._id, role: "owner", store: "HQ" });
    const res = await request(app)
      .delete("/api/categories/000000000000000000000001")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  test("400 — blocked when products use this category", async () => {
    const owner = await createUser({ role: "owner", email: "o@test.com", store: "HQ" });
    const cat = await createCategory({ name: "electronics" });
    await createProduct({ category: "electronics", store: "Main Store" });
    const token = makeToken({ id: owner._id, role: "owner", store: "HQ" });
    const res = await request(app)
      .delete(`/api/categories/${cat._id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/product/i);
  });

  test("200 — deletes category and confirms it no longer exists", async () => {
    const owner = await createUser({ role: "owner", email: "o@test.com", store: "HQ" });
    const cat = await createCategory({ name: "electronics" });
    const token = makeToken({ id: owner._id, role: "owner", store: "HQ" });
    const res = await request(app)
      .delete(`/api/categories/${cat._id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const gone = await Category.findById(cat._id);
    expect(gone).toBeNull();
  });
});
