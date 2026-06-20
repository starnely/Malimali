const request = require("supertest");
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
  test("400 — missing username or password", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ username: "alice" }); // no password
    expect(res.status).toBe(400);
  });

  test("401 — unknown username", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ username: "nobody", password: "whatever123" });
    expect(res.status).toBe(401);
  });

  test("403 — suspended account (active=false) cannot log in", async () => {
    const user = await createUser({ email: "c@test.com", active: false, isActive: false });
    const res = await request(app)
      .post("/api/auth/login")
      .send({ username: user.username, password: DEFAULT_PASSWORD });
    expect(res.status).toBe(403);
  });

  test("401 — wrong password", async () => {
    const user = await createUser({ email: "c@test.com" });
    const res = await request(app)
      .post("/api/auth/login")
      .send({ username: user.username, password: "wrongpassword" });
    expect(res.status).toBe(401);
  });

  test("200 — returns token, role, store, and nested user object on success", async () => {
    const user = await createUser({ role: "cashier", email: "c@test.com", store: "Main Store" });
    const res = await request(app)
      .post("/api/auth/login")
      .send({ username: user.username, password: DEFAULT_PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.token).toBeDefined();
    expect(res.body.role).toBe("cashier");
    expect(res.body.store).toBe("Main Store");
    expect(res.body.user).toBeDefined();
    expect(res.body.user.fullname).toBe(user.fullname);
    expect(res.body.user.username).toBe(user.username);
  });

  test("200 — username lookup is case-insensitive", async () => {
    const user = await createUser({ email: "c@test.com" });
    const res = await request(app)
      .post("/api/auth/login")
      .send({ username: user.username.toUpperCase(), password: DEFAULT_PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
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

  test("403 — cashier blocked", async () => {
    const cashier = await createUser({ role: "cashier", email: "c@test.com", store: "Main Store" });
    const token = makeToken({ id: cashier._id, role: "cashier", store: "Main Store" });
    const res = await request(app)
      .get("/api/auth/employees")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  test("owner sees all non-owner employees; password field excluded from response", async () => {
    const owner = await createUser({ role: "owner",   email: "o@test.com",  store: "HQ" });
    await createUser({ role: "cashier", email: "c1@test.com", store: "Store A" });
    await createUser({ role: "manager", email: "m@test.com",  store: "Store B" });

    const token = makeToken({ id: owner._id, role: "owner", store: "HQ" });
    const res = await request(app)
      .get("/api/auth/employees")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(2);
    expect(res.body.every((e) => e.role !== "owner")).toBe(true);
    expect(res.body.every((e) => e.password === undefined)).toBe(true);
  });

  test("manager sees only employees in their own store", async () => {
    const manager = await createUser({ role: "manager", email: "m@test.com",  store: "Store A" });
    await createUser({ role: "cashier", email: "c1@test.com", store: "Store A" });
    await createUser({ role: "cashier", email: "c2@test.com", store: "Store B" });

    const token = makeToken({ id: manager._id, role: "manager", store: "Store A" });
    const res = await request(app)
      .get("/api/auth/employees")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    // Manager + Store A cashier = 2; Store B cashier excluded
    expect(res.body.length).toBe(2);
    expect(res.body.every((e) => e.store === "Store A")).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/register
// ─────────────────────────────────────────────────────────────────────────────
describe("POST /api/auth/register", () => {
  test("403 — cashier blocked (ownerOnly)", async () => {
    const cashier = await createUser({ role: "cashier", email: "c@test.com", store: "Main Store" });
    const token = makeToken({ id: cashier._id, role: "cashier", store: "Main Store" });
    const res = await request(app)
      .post("/api/auth/register")
      .set("Authorization", `Bearer ${token}`)
      .send({ fullname: "Alice Smith", username: "alice", password: "password123" });
    expect(res.status).toBe(403);
  });

  test("400 — missing required fields (fullname, username, or password)", async () => {
    const owner = await createUser({ role: "owner", email: "o@test.com", store: "HQ" });
    const token = makeToken({ id: owner._id, role: "owner", store: "HQ" });
    const res = await request(app)
      .post("/api/auth/register")
      .set("Authorization", `Bearer ${token}`)
      .send({ username: "alice" }); // missing fullname and password
    expect(res.status).toBe(400);
  });

  test("400 — password shorter than 6 characters", async () => {
    const owner = await createUser({ role: "owner", email: "o@test.com", store: "HQ" });
    const token = makeToken({ id: owner._id, role: "owner", store: "HQ" });
    const res = await request(app)
      .post("/api/auth/register")
      .set("Authorization", `Bearer ${token}`)
      .send({ fullname: "Alice Smith", username: "alice", password: "12345" });
    expect(res.status).toBe(400);
  });

  test("403 — cannot register an account with role=owner", async () => {
    const owner = await createUser({ role: "owner", email: "o@test.com", store: "HQ" });
    const token = makeToken({ id: owner._id, role: "owner", store: "HQ" });
    const res = await request(app)
      .post("/api/auth/register")
      .set("Authorization", `Bearer ${token}`)
      .send({ fullname: "Alice Smith", username: "alice", password: "password123", role: "owner" });
    expect(res.status).toBe(403);
  });

  test("409 — duplicate username rejected (case-insensitive)", async () => {
    const owner = await createUser({ role: "owner", email: "o@test.com", store: "HQ" });
    await createUser({ role: "cashier", email: "c@test.com", store: "Main Store", username: "alice_jones" });
    const token = makeToken({ id: owner._id, role: "owner", store: "HQ" });
    const res = await request(app)
      .post("/api/auth/register")
      .set("Authorization", `Bearer ${token}`)
      .send({ fullname: "Bob", username: "ALICE_JONES", password: "password123" });
    expect(res.status).toBe(409);
  });

  test("409 — duplicate email rejected", async () => {
    const owner = await createUser({ role: "owner", email: "o@test.com", store: "HQ" });
    await createUser({ role: "cashier", email: "taken@test.com", store: "Main Store" });
    const token = makeToken({ id: owner._id, role: "owner", store: "HQ" });
    const res = await request(app)
      .post("/api/auth/register")
      .set("Authorization", `Bearer ${token}`)
      .send({ fullname: "Bob", username: "bob_new", password: "password123", email: "taken@test.com" });
    expect(res.status).toBe(409);
  });

  test("201 — creates user; email lowercased; defaults applied; password is hashed", async () => {
    const owner = await createUser({ role: "owner", email: "o@test.com", store: "HQ" });
    const token = makeToken({ id: owner._id, role: "owner", store: "HQ" });
    const res = await request(app)
      .post("/api/auth/register")
      .set("Authorization", `Bearer ${token}`)
      .send({
        fullname: "Alice Smith",
        username: "alice_staff",
        email: "ALICE@TEST.COM",
        password: "securepass",
        role: "cashier",
        store: "Main Store",
      });

    expect(res.status).toBe(201);
    expect(res.body.user.fullname).toBe("Alice Smith");
    expect(res.body.user.username).toBe("alice_staff");
    expect(res.body.user.email).toBe("alice@test.com");
    expect(res.body.user.role).toBe("cashier");
    expect(res.body.user.active).toBe(true);
    expect(res.body.user.shiftStatus).toBe("closed");

    const saved = await User.findOne({ username: "alice_staff" });
    expect(saved.password).not.toBe("securepass");
    expect(saved.password).toMatch(/^\$2[ab]\$/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/auth/change-password
// ─────────────────────────────────────────────────────────────────────────────
describe("PUT /api/auth/change-password", () => {
  test("401 — no token", async () => {
    const res = await request(app)
      .put("/api/auth/change-password")
      .send({ currentPassword: "a", newPassword: "b" });
    expect(res.status).toBe(401);
  });

  test("400 — missing currentPassword or newPassword", async () => {
    const user = await createUser({ email: "c@test.com" });
    const token = makeToken({ id: user._id, role: "cashier", store: "Main Store" });
    const res = await request(app)
      .put("/api/auth/change-password")
      .set("Authorization", `Bearer ${token}`)
      .send({ currentPassword: DEFAULT_PASSWORD }); // missing newPassword
    expect(res.status).toBe(400);
  });

  test("400 — new password shorter than 6 characters", async () => {
    const user = await createUser({ email: "c@test.com" });
    const token = makeToken({ id: user._id, role: "cashier", store: "Main Store" });
    const res = await request(app)
      .put("/api/auth/change-password")
      .set("Authorization", `Bearer ${token}`)
      .send({ currentPassword: DEFAULT_PASSWORD, newPassword: "123" });
    expect(res.status).toBe(400);
  });

  test("400 — new password same as current password", async () => {
    const user = await createUser({ email: "c@test.com" });
    const token = makeToken({ id: user._id, role: "cashier", store: "Main Store" });
    const res = await request(app)
      .put("/api/auth/change-password")
      .set("Authorization", `Bearer ${token}`)
      .send({ currentPassword: DEFAULT_PASSWORD, newPassword: DEFAULT_PASSWORD });
    expect(res.status).toBe(400);
  });

  test("401 — wrong current password", async () => {
    const user = await createUser({ email: "c@test.com" });
    const token = makeToken({ id: user._id, role: "cashier", store: "Main Store" });
    const res = await request(app)
      .put("/api/auth/change-password")
      .set("Authorization", `Bearer ${token}`)
      .send({ currentPassword: "wrongpassword", newPassword: "newpassword123" });
    expect(res.status).toBe(401);
  });

  test("200 — updates password; new password works on subsequent login", async () => {
    const user = await createUser({ email: "c@test.com" });
    const token = makeToken({ id: user._id, role: "cashier", store: "Main Store" });

    const changeRes = await request(app)
      .put("/api/auth/change-password")
      .set("Authorization", `Bearer ${token}`)
      .send({ currentPassword: DEFAULT_PASSWORD, newPassword: "newpassword123" });
    expect(changeRes.status).toBe(200);
    expect(changeRes.body.success).toBe(true);

    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ username: user.username, password: "newpassword123" });
    expect(loginRes.status).toBe(200);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/auth/:id/toggle
// ─────────────────────────────────────────────────────────────────────────────
describe("PATCH /api/auth/:id/toggle", () => {
  test("403 — manager blocked (ownerOnly)", async () => {
    const manager = await createUser({ role: "manager", email: "m@test.com", store: "Main Store" });
    const cashier = await createUser({ role: "cashier", email: "c@test.com",  store: "Main Store" });
    const token = makeToken({ id: manager._id, role: "manager", store: "Main Store" });
    const res = await request(app)
      .patch(`/api/auth/${cashier._id}/toggle`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  test("403 — owner cannot toggle their own account", async () => {
    const owner = await createUser({ role: "owner", email: "o@test.com", store: "HQ" });
    const token = makeToken({ id: owner._id, role: "owner", store: "HQ" });
    const res = await request(app)
      .patch(`/api/auth/${owner._id}/toggle`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  test("404 — unknown id", async () => {
    const owner = await createUser({ role: "owner", email: "o@test.com", store: "HQ" });
    const token = makeToken({ id: owner._id, role: "owner", store: "HQ" });
    const res = await request(app)
      .patch("/api/auth/000000000000000000000001/toggle")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  test("403 — cannot toggle another owner account", async () => {
    const owner1 = await createUser({ role: "owner", email: "o1@test.com", store: "HQ" });
    const owner2 = await createUser({ role: "owner", email: "o2@test.com", store: "HQ" });
    const token = makeToken({ id: owner1._id, role: "owner", store: "HQ" });
    const res = await request(app)
      .patch(`/api/auth/${owner2._id}/toggle`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  test("200 — toggles active and isActive: active → inactive → active", async () => {
    const owner   = await createUser({ role: "owner",   email: "o@test.com", store: "HQ" });
    const cashier = await createUser({ role: "cashier", email: "c@test.com", store: "Main Store" });
    const token = makeToken({ id: owner._id, role: "owner", store: "HQ" });

    const first = await request(app)
      .patch(`/api/auth/${cashier._id}/toggle`)
      .set("Authorization", `Bearer ${token}`);
    expect(first.status).toBe(200);
    expect(first.body.user.active).toBe(false);
    expect(first.body.user.isActive).toBe(false);

    const second = await request(app)
      .patch(`/api/auth/${cashier._id}/toggle`)
      .set("Authorization", `Bearer ${token}`);
    expect(second.status).toBe(200);
    expect(second.body.user.active).toBe(true);
    expect(second.body.user.isActive).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/auth/:id
// ─────────────────────────────────────────────────────────────────────────────
describe("PUT /api/auth/:id", () => {
  test("403 — manager blocked (ownerOnly)", async () => {
    const manager = await createUser({ role: "manager", email: "m@test.com", store: "Main Store" });
    const cashier = await createUser({ role: "cashier", email: "c@test.com",  store: "Main Store" });
    const token = makeToken({ id: manager._id, role: "manager", store: "Main Store" });
    const res = await request(app)
      .put(`/api/auth/${cashier._id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ fullname: "Updated" });
    expect(res.status).toBe(403);
  });

  test("404 — unknown id", async () => {
    const owner = await createUser({ role: "owner", email: "o@test.com", store: "HQ" });
    const token = makeToken({ id: owner._id, role: "owner", store: "HQ" });
    const res = await request(app)
      .put("/api/auth/000000000000000000000001")
      .set("Authorization", `Bearer ${token}`)
      .send({ fullname: "Updated" });
    expect(res.status).toBe(404);
  });

  test("403 — cannot assign owner role through this endpoint", async () => {
    const owner   = await createUser({ role: "owner",   email: "o@test.com", store: "HQ" });
    const cashier = await createUser({ role: "cashier", email: "c@test.com",  store: "Main Store" });
    const token = makeToken({ id: owner._id, role: "owner", store: "HQ" });
    const res = await request(app)
      .put(`/api/auth/${cashier._id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ role: "owner" });
    expect(res.status).toBe(403);
  });

  test("409 — username already taken by another account", async () => {
    const owner   = await createUser({ role: "owner",   email: "o@test.com",  store: "HQ" });
    await createUser({ role: "cashier", email: "c1@test.com", store: "Main Store", username: "alice_taken" });
    const cashier = await createUser({ role: "cashier", email: "c2@test.com", store: "Main Store" });
    const token = makeToken({ id: owner._id, role: "owner", store: "HQ" });
    const res = await request(app)
      .put(`/api/auth/${cashier._id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ username: "alice_taken" });
    expect(res.status).toBe(409);
  });

  test("409 — email already registered to another account", async () => {
    const owner   = await createUser({ role: "owner",   email: "o@test.com",       store: "HQ" });
    await createUser({ role: "cashier", email: "taken@test.com", store: "Main Store" });
    const cashier = await createUser({ role: "cashier", email: "c2@test.com",      store: "Main Store" });
    const token = makeToken({ id: owner._id, role: "owner", store: "HQ" });
    const res = await request(app)
      .put(`/api/auth/${cashier._id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ email: "taken@test.com" });
    expect(res.status).toBe(409);
  });

  test("400 — password update rejected when shorter than 6 characters", async () => {
    const owner   = await createUser({ role: "owner",   email: "o@test.com", store: "HQ" });
    const cashier = await createUser({ role: "cashier", email: "c@test.com",  store: "Main Store" });
    const token = makeToken({ id: owner._id, role: "owner", store: "HQ" });
    const res = await request(app)
      .put(`/api/auth/${cashier._id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ password: "12345" });
    expect(res.status).toBe(400);
  });

  test("200 — updates fullname, role, and store correctly", async () => {
    const owner   = await createUser({ role: "owner",   email: "o@test.com", store: "HQ" });
    const cashier = await createUser({ role: "cashier", email: "c@test.com",  store: "Main Store" });
    const token = makeToken({ id: owner._id, role: "owner", store: "HQ" });
    const res = await request(app)
      .put(`/api/auth/${cashier._id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ fullname: "New Name", role: "manager", store: "Branch A" });

    expect(res.status).toBe(200);
    expect(res.body.user.fullname).toBe("New Name");
    expect(res.body.user.role).toBe("manager");
    expect(res.body.user.store).toBe("Branch A");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/auth/:id
// ─────────────────────────────────────────────────────────────────────────────
describe("DELETE /api/auth/:id", () => {
  test("403 — manager blocked (ownerOnly)", async () => {
    const manager = await createUser({ role: "manager", email: "m@test.com", store: "Main Store" });
    const cashier = await createUser({ role: "cashier", email: "c@test.com",  store: "Main Store" });
    const token = makeToken({ id: manager._id, role: "manager", store: "Main Store" });
    const res = await request(app)
      .delete(`/api/auth/${cashier._id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  test("403 — owner cannot delete their own account", async () => {
    const owner = await createUser({ role: "owner", email: "o@test.com", store: "HQ" });
    const token = makeToken({ id: owner._id, role: "owner", store: "HQ" });
    const res = await request(app)
      .delete(`/api/auth/${owner._id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  test("404 — unknown id", async () => {
    const owner = await createUser({ role: "owner", email: "o@test.com", store: "HQ" });
    const token = makeToken({ id: owner._id, role: "owner", store: "HQ" });
    const res = await request(app)
      .delete("/api/auth/000000000000000000000001")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  test("403 — cannot delete another owner account", async () => {
    const owner1 = await createUser({ role: "owner", email: "o1@test.com", store: "HQ" });
    const owner2 = await createUser({ role: "owner", email: "o2@test.com", store: "HQ" });
    const token = makeToken({ id: owner1._id, role: "owner", store: "HQ" });
    const res = await request(app)
      .delete(`/api/auth/${owner2._id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  test("200 — hard-deletes the account and confirms it no longer exists", async () => {
    const owner   = await createUser({ role: "owner",   email: "o@test.com", store: "HQ" });
    const cashier = await createUser({ role: "cashier", email: "c@test.com",  store: "Main Store" });
    const token = makeToken({ id: owner._id, role: "owner", store: "HQ" });
    const res = await request(app)
      .delete(`/api/auth/${cashier._id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const gone = await User.findById(cashier._id);
    expect(gone).toBeNull();
  });
});
