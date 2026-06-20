const request = require("supertest");
const createApp = require("../helpers/createApp");
const db = require("../setup/db");
const { makeToken } = require("../helpers/auth");
const { createUser, createStore } = require("../helpers/seed");
const Store = require("../../models/Store");

const app = createApp();

beforeAll(() => db.connect());
afterEach(() => db.clear());
afterAll(() => db.close());

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/stores
// ─────────────────────────────────────────────────────────────────────────────
describe("GET /api/stores", () => {
  test("401 — no token", async () => {
    const res = await request(app).get("/api/stores");
    expect(res.status).toBe(401);
  });

  test("returns all stores sorted alphabetically by name", async () => {
    const cashier = await createUser({ role: "cashier", email: "c@test.com", store: "Main Store" });
    await createStore({ name: "Zebra Store" });
    await createStore({ name: "Alpha Store" });
    await createStore({ name: "Main Store" });

    const token = makeToken({ id: cashier._id, role: "cashier", store: "Main Store" });
    const res = await request(app).get("/api/stores").set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const names = res.body.stores.map((s) => s.name);
    expect(names[0]).toBe("Alpha Store");
    expect(names[names.length - 1]).toBe("Zebra Store");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/stores
// ─────────────────────────────────────────────────────────────────────────────
describe("POST /api/stores", () => {
  test("403 — cashier blocked (ownerOnly)", async () => {
    const cashier = await createUser({ role: "cashier", email: "c@test.com", store: "Main Store" });
    const token = makeToken({ id: cashier._id, role: "cashier", store: "Main Store" });
    const res = await request(app)
      .post("/api/stores")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "New Branch" });
    expect(res.status).toBe(403);
  });

  test("403 — manager blocked (ownerOnly)", async () => {
    const manager = await createUser({ role: "manager", email: "m@test.com", store: "Main Store" });
    const token = makeToken({ id: manager._id, role: "manager", store: "Main Store" });
    const res = await request(app)
      .post("/api/stores")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "New Branch" });
    expect(res.status).toBe(403);
  });

  test("400 — missing name", async () => {
    const owner = await createUser({ role: "owner", email: "o@test.com", store: "HQ" });
    const token = makeToken({ id: owner._id, role: "owner", store: "HQ" });
    const res = await request(app)
      .post("/api/stores")
      .set("Authorization", `Bearer ${token}`)
      .send({ location: "Nairobi" });
    expect(res.status).toBe(400);
  });

  test("409 — duplicate store name", async () => {
    const owner = await createUser({ role: "owner", email: "o@test.com", store: "HQ" });
    await createStore({ name: "Branch A" });
    const token = makeToken({ id: owner._id, role: "owner", store: "HQ" });
    const res = await request(app)
      .post("/api/stores")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Branch A" });
    expect(res.status).toBe(409);
  });

  test("201 — creates store with name, location, and phone", async () => {
    const owner = await createUser({ role: "owner", email: "o@test.com", store: "HQ" });
    const token = makeToken({ id: owner._id, role: "owner", store: "HQ" });
    const res = await request(app)
      .post("/api/stores")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Westlands Branch", location: "Westlands, Nairobi", phone: "0700000001" });

    expect(res.status).toBe(201);
    expect(res.body.store.name).toBe("Westlands Branch");
    expect(res.body.store.location).toBe("Westlands, Nairobi");
    expect(res.body.store.phone).toBe("0700000001");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/stores/:id
// ─────────────────────────────────────────────────────────────────────────────
describe("PUT /api/stores/:id", () => {
  test("403 — cashier blocked (ownerOnly)", async () => {
    const cashier = await createUser({ role: "cashier", email: "c@test.com", store: "Main Store" });
    const store = await createStore({ name: "Branch A" });
    const token = makeToken({ id: cashier._id, role: "cashier", store: "Main Store" });
    const res = await request(app)
      .put(`/api/stores/${store._id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Renamed" });
    expect(res.status).toBe(403);
  });

  test("400 — missing name", async () => {
    const owner = await createUser({ role: "owner", email: "o@test.com", store: "HQ" });
    const store = await createStore({ name: "Branch A" });
    const token = makeToken({ id: owner._id, role: "owner", store: "HQ" });
    const res = await request(app)
      .put(`/api/stores/${store._id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ location: "No name" });
    expect(res.status).toBe(400);
  });

  test("404 — unknown id", async () => {
    const owner = await createUser({ role: "owner", email: "o@test.com", store: "HQ" });
    const token = makeToken({ id: owner._id, role: "owner", store: "HQ" });
    const res = await request(app)
      .put("/api/stores/000000000000000000000001")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Does Not Exist" });
    expect(res.status).toBe(404);
  });

  test("409 — name already used by another store", async () => {
    const owner = await createUser({ role: "owner", email: "o@test.com", store: "HQ" });
    await createStore({ name: "Taken Name" });
    const store = await createStore({ name: "Original Name" });
    const token = makeToken({ id: owner._id, role: "owner", store: "HQ" });
    const res = await request(app)
      .put(`/api/stores/${store._id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Taken Name" });
    expect(res.status).toBe(409);
  });

  test("200 — updates name, location, and phone", async () => {
    const owner = await createUser({ role: "owner", email: "o@test.com", store: "HQ" });
    const store = await createStore({ name: "Old Name" });
    const token = makeToken({ id: owner._id, role: "owner", store: "HQ" });
    const res = await request(app)
      .put(`/api/stores/${store._id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "New Name", location: "CBD", phone: "0722000000" });

    expect(res.status).toBe(200);
    expect(res.body.store.name).toBe("New Name");
    expect(res.body.store.location).toBe("CBD");
    expect(res.body.store.phone).toBe("0722000000");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/stores/:id
// ─────────────────────────────────────────────────────────────────────────────
describe("DELETE /api/stores/:id", () => {
  test("403 — cashier blocked (ownerOnly)", async () => {
    const cashier = await createUser({ role: "cashier", email: "c@test.com", store: "Main Store" });
    const store = await createStore({ name: "Branch A" });
    const token = makeToken({ id: cashier._id, role: "cashier", store: "Main Store" });
    const res = await request(app)
      .delete(`/api/stores/${store._id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  test("404 — unknown id", async () => {
    const owner = await createUser({ role: "owner", email: "o@test.com", store: "HQ" });
    const token = makeToken({ id: owner._id, role: "owner", store: "HQ" });
    const res = await request(app)
      .delete("/api/stores/000000000000000000000001")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  test("200 — deletes the store and confirms it no longer exists", async () => {
    const owner = await createUser({ role: "owner", email: "o@test.com", store: "HQ" });
    const store = await createStore({ name: "Closing Branch" });
    const token = makeToken({ id: owner._id, role: "owner", store: "HQ" });
    const res = await request(app)
      .delete(`/api/stores/${store._id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const gone = await Store.findById(store._id);
    expect(gone).toBeNull();
  });
});
