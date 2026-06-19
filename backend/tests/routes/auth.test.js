const request = require("supertest");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const createApp = require("../helpers/createApp");
const db = require("../setup/db");
const { makeToken } = require("../helpers/auth");
const { createUser, DEFAULT_PASSWORD } = require("../helpers/seed");
const User = require("../../models/User");

const app = createApp();

beforeAll(() => db.connect());
afterEach(() => db.clear());
afterAll(() => db.close());

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/login
// ─────────────────────────────────────────────────────────────────────────────
describe("POST /api/auth/login", () => {
  test("400 — missing username", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ password: "pass" });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test("400 — missing password", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ username: "alice" });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test("401 — user does not exist", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ username: "nobody", password: "irrelevant" });
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test("401 — wrong password", async () => {
    await createUser({ username: "alice", email: "alice@test.com" });
    const res = await request(app)
      .post("/api/auth/login")
      .send({ username: "alice", password: "wrongpassword" });
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test("403 — suspended account is rejected", async () => {
    await createUser({
      username: "suspended",
      email: "suspended@test.com",
      active: false,
      isActive: false,
    });
    const res = await request(app)
      .post("/api/auth/login")
      .send({ username: "suspended", password: DEFAULT_PASSWORD });
    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  test("200 — valid credentials return token and user shape", async () => {
    await createUser({
      username: "alice",
      email: "alice@test.com",
      role: "cashier",
      store: "Main Store",
    });
    const res = await request(app)
      .post("/api/auth/login")
      .send({ username: "alice", password: DEFAULT_PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.role).toBe("cashier");
    expect(res.body.user.store).toBe("Main Store");
    expect(res.body.user.password).toBeUndefined();
  });

  test("200 — username matching is case-insensitive", async () => {
    await createUser({ username: "CasedUser", email: "cased@test.com" });
    const res = await request(app)
      .post("/api/auth/login")
      .send({ username: "caseduser", password: DEFAULT_PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test("token decodes to correct id, role, and store", async () => {
    const user = await createUser({
      username: "tokentest",
      email: "tokentest@test.com",
      role: "manager",
      store: "Branch A",
    });
    const res = await request(app)
      .post("/api/auth/login")
      .send({ username: "tokentest", password: DEFAULT_PASSWORD });

    const decoded = jwt.verify(res.body.token, process.env.JWT_SECRET);
    expect(String(decoded.id)).toBe(String(user._id));
    expect(decoded.role).toBe("manager");
    expect(decoded.store).toBe("Branch A");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/auth/employees
// ─────────────────────────────────────────────────────────────────────────────
describe("GET /api/auth/employees", () => {
  test("401 — no token", async () => {
    const res = await request(app).get("/api/auth/employees");
    expect(res.status).toBe(401);
  });

  test("403 — cashier is denied", async () => {
    const cashier = await createUser({ role: "cashier", email: "c@test.com" });
    const token = makeToken({ id: cashier._id, role: "cashier", store: cashier.store });
    const res = await request(app)
      .get("/api/auth/employees")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  test("owner sees all non-owner employees; passwords omitted", async () => {
    const owner = await createUser({ role: "owner", email: "owner@test.com", store: "HQ" });
    await createUser({ role: "cashier", email: "emp1@test.com", store: "Store A" });
    await createUser({ role: "manager", email: "mgr@test.com", store: "Store B" });

    const token = makeToken({ id: owner._id, role: "owner", store: owner.store });
    const res = await request(app)
      .get("/api/auth/employees")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.length).toBe(2);
    expect(res.body.every((u) => u.role !== "owner")).toBe(true);
    expect(res.body.every((u) => u.password === undefined)).toBe(true);
  });

  test("manager only sees employees in their own store", async () => {
    const manager = await createUser({
      role: "manager",
      email: "mgr@test.com",
      store: "Store A",
    });
    await createUser({ role: "cashier", email: "emp1@test.com", store: "Store A" });
    await createUser({ role: "cashier", email: "emp2@test.com", store: "Store B" });

    const token = makeToken({ id: manager._id, role: "manager", store: "Store A" });
    const res = await request(app)
      .get("/api/auth/employees")
      .set("Authorization", `Bearer ${token}`);

    // Route query: role ≠ owner AND store = manager's store — manager is included in own results.
    expect(res.status).toBe(200);
    expect(res.body.every((u) => u.store === "Store A")).toBe(true);
    expect(res.body.some((u) => u.store === "Store B")).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/register
// ─────────────────────────────────────────────────────────────────────────────
describe("POST /api/auth/register", () => {
  let owner, ownerToken;

  beforeEach(async () => {
    owner = await createUser({ role: "owner", email: "owner@test.com", store: "HQ" });
    ownerToken = makeToken({ id: owner._id, role: "owner", store: owner.store });
  });

  test("403 — manager cannot register staff", async () => {
    const manager = await createUser({ role: "manager", email: "mgr@test.com" });
    const token = makeToken({ id: manager._id, role: "manager", store: manager.store });
    const res = await request(app)
      .post("/api/auth/register")
      .set("Authorization", `Bearer ${token}`)
      .send({ fullname: "New Staff", username: "newstaff", password: "pass123" });
    expect(res.status).toBe(403);
  });

  test("400 — missing fullname", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ username: "u", password: "pass123" });
    expect(res.status).toBe(400);
  });

  test("400 — missing username", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ fullname: "Full Name", password: "pass123" });
    expect(res.status).toBe(400);
  });

  test("400 — password shorter than 6 characters", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ fullname: "Full Name", username: "newuser", password: "abc" });
    expect(res.status).toBe(400);
  });

  test("403 — cannot create a user with role owner", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ fullname: "Second Owner", username: "owner2", password: "pass123", role: "owner" });
    expect(res.status).toBe(403);
  });

  test("409 — duplicate username (case-insensitive)", async () => {
    await createUser({ username: "takenuser", email: "taken@test.com" });
    const res = await request(app)
      .post("/api/auth/register")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ fullname: "New", username: "TAKENUSER", password: "pass123" });
    expect(res.status).toBe(409);
  });

  test("409 — duplicate email", async () => {
    await createUser({ username: "other", email: "dup@test.com" });
    const res = await request(app)
      .post("/api/auth/register")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ fullname: "New", username: "brandnew", password: "pass123", email: "dup@test.com" });
    expect(res.status).toBe(409);
  });

  test("201 — user created; password stored as hash, not plaintext", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        fullname: "Fresh Staff",
        username: "freshstaff",
        email: "freshstaff@test.com",
        password: "securepass",
        role: "cashier",
        store: "Main Store",
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.user.username).toBe("freshstaff");

    const inDb = await User.findOne({ username: "freshstaff" });
    expect(inDb).not.toBeNull();
    const hashMatches = await bcrypt.compare("securepass", inDb.password);
    expect(hashMatches).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/auth/change-password
// ─────────────────────────────────────────────────────────────────────────────
describe("PUT /api/auth/change-password", () => {
  let user, token;

  beforeEach(async () => {
    user = await createUser({ username: "changeme", email: "changeme@test.com" });
    token = makeToken({ id: user._id, role: user.role, store: user.store });
  });

  test("400 — missing currentPassword", async () => {
    const res = await request(app)
      .put("/api/auth/change-password")
      .set("Authorization", `Bearer ${token}`)
      .send({ newPassword: "newpass123" });
    expect(res.status).toBe(400);
  });

  test("400 — missing newPassword", async () => {
    const res = await request(app)
      .put("/api/auth/change-password")
      .set("Authorization", `Bearer ${token}`)
      .send({ currentPassword: DEFAULT_PASSWORD });
    expect(res.status).toBe(400);
  });

  test("400 — new password same as current", async () => {
    const res = await request(app)
      .put("/api/auth/change-password")
      .set("Authorization", `Bearer ${token}`)
      .send({ currentPassword: DEFAULT_PASSWORD, newPassword: DEFAULT_PASSWORD });
    expect(res.status).toBe(400);
  });

  test("400 — new password under 6 characters", async () => {
    const res = await request(app)
      .put("/api/auth/change-password")
      .set("Authorization", `Bearer ${token}`)
      .send({ currentPassword: DEFAULT_PASSWORD, newPassword: "abc" });
    expect(res.status).toBe(400);
  });

  test("401 — current password is wrong", async () => {
    const res = await request(app)
      .put("/api/auth/change-password")
      .set("Authorization", `Bearer ${token}`)
      .send({ currentPassword: "wrongpass", newPassword: "newpass123" });
    expect(res.status).toBe(401);
  });

  test("200 — password changed; new password works for login", async () => {
    const res = await request(app)
      .put("/api/auth/change-password")
      .set("Authorization", `Bearer ${token}`)
      .send({ currentPassword: DEFAULT_PASSWORD, newPassword: "brandnewpass" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ username: user.username, password: "brandnewpass" });
    expect(loginRes.status).toBe(200);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/auth/:id/toggle
// ─────────────────────────────────────────────────────────────────────────────
describe("PATCH /api/auth/:id/toggle", () => {
  let owner, ownerToken, cashier;

  beforeEach(async () => {
    owner = await createUser({ role: "owner", email: "owner@test.com", store: "HQ" });
    ownerToken = makeToken({ id: owner._id, role: "owner", store: owner.store });
    cashier = await createUser({ role: "cashier", email: "cashier@test.com" });
  });

  test("403 — cashier cannot toggle anyone", async () => {
    const cToken = makeToken({ id: cashier._id, role: "cashier", store: cashier.store });
    const res = await request(app)
      .patch(`/api/auth/${cashier._id}/toggle`)
      .set("Authorization", `Bearer ${cToken}`);
    expect(res.status).toBe(403);
  });

  test("403 — owner cannot toggle their own account", async () => {
    const res = await request(app)
      .patch(`/api/auth/${owner._id}/toggle`)
      .set("Authorization", `Bearer ${ownerToken}`);
    expect(res.status).toBe(403);
  });

  test("403 — cannot toggle another owner account", async () => {
    const owner2 = await createUser({ role: "owner", email: "owner2@test.com", store: "HQ" });
    const res = await request(app)
      .patch(`/api/auth/${owner2._id}/toggle`)
      .set("Authorization", `Bearer ${ownerToken}`);
    expect(res.status).toBe(403);
  });

  test("200 — owner toggles cashier; active and isActive flip together", async () => {
    expect(cashier.active).toBe(true);

    const res = await request(app)
      .patch(`/api/auth/${cashier._id}/toggle`)
      .set("Authorization", `Bearer ${ownerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.user.active).toBe(false);
    expect(res.body.user.isActive).toBe(false);

    // Toggle back
    const res2 = await request(app)
      .patch(`/api/auth/${cashier._id}/toggle`)
      .set("Authorization", `Bearer ${ownerToken}`);
    expect(res2.body.user.active).toBe(true);
    expect(res2.body.user.isActive).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/auth/:id  (update profile)
// ─────────────────────────────────────────────────────────────────────────────
describe("PUT /api/auth/:id", () => {
  let owner, ownerToken, cashier;

  beforeEach(async () => {
    owner = await createUser({ role: "owner", email: "owner@test.com", store: "HQ" });
    ownerToken = makeToken({ id: owner._id, role: "owner", store: owner.store });
    cashier = await createUser({ role: "cashier", email: "cashier@test.com", store: "Main Store" });
  });

  test("404 — user not found", async () => {
    const fakeId = "000000000000000000000001";
    const res = await request(app)
      .put(`/api/auth/${fakeId}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ fullname: "Ghost" });
    expect(res.status).toBe(404);
  });

  test("409 — username already taken by another user", async () => {
    const other = await createUser({ username: "takenname", email: "taken2@test.com" });
    const res = await request(app)
      .put(`/api/auth/${cashier._id}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ username: "takenname" });
    expect(res.status).toBe(409);
  });

  test("403 — cannot assign owner role", async () => {
    const res = await request(app)
      .put(`/api/auth/${cashier._id}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ role: "owner" });
    expect(res.status).toBe(403);
  });

  test("200 — owner can update fullname, role, store, and password", async () => {
    const res = await request(app)
      .put(`/api/auth/${cashier._id}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        fullname: "Updated Name",
        role: "manager",
        store: "Branch B",
        password: "newpassword",
      });

    expect(res.status).toBe(200);
    expect(res.body.user.fullname).toBe("Updated Name");
    expect(res.body.user.role).toBe("manager");
    expect(res.body.user.store).toBe("Branch B");

    // Verify new password works
    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ username: cashier.username, password: "newpassword" });
    expect(loginRes.status).toBe(200);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/auth/:id
// ─────────────────────────────────────────────────────────────────────────────
describe("DELETE /api/auth/:id", () => {
  let owner, ownerToken, cashier;

  beforeEach(async () => {
    owner = await createUser({ role: "owner", email: "owner@test.com", store: "HQ" });
    ownerToken = makeToken({ id: owner._id, role: "owner", store: owner.store });
    cashier = await createUser({ role: "cashier", email: "cashier@test.com" });
  });

  test("403 — owner cannot delete themselves", async () => {
    const res = await request(app)
      .delete(`/api/auth/${owner._id}`)
      .set("Authorization", `Bearer ${ownerToken}`);
    expect(res.status).toBe(403);
  });

  test("403 — cannot delete another owner account", async () => {
    const owner2 = await createUser({ role: "owner", email: "owner2@test.com", store: "HQ" });
    const res = await request(app)
      .delete(`/api/auth/${owner2._id}`)
      .set("Authorization", `Bearer ${ownerToken}`);
    expect(res.status).toBe(403);
  });

  test("404 — user not found", async () => {
    const fakeId = "000000000000000000000001";
    const res = await request(app)
      .delete(`/api/auth/${fakeId}`)
      .set("Authorization", `Bearer ${ownerToken}`);
    expect(res.status).toBe(404);
  });

  test("200 — cashier deleted; no longer findable in DB", async () => {
    const res = await request(app)
      .delete(`/api/auth/${cashier._id}`)
      .set("Authorization", `Bearer ${ownerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const inDb = await User.findById(cashier._id);
    expect(inDb).toBeNull();
  });
});
