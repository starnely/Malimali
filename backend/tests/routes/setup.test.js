const request = require("supertest");
const createApp = require("../helpers/createApp");
const db = require("../setup/db");
const { makeToken } = require("../helpers/auth");
const { createUser, createSetting } = require("../helpers/seed");
const Setting = require("../../models/Setting");
const User = require("../../models/User");

const app = createApp();

// Activation code injected by globalSetup.js
const ACTIVATION_CODE = "TEST-ACTIVATION-CODE";

beforeAll(() => db.connect());
afterEach(() => db.clear());
afterAll(() => db.close());

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/setup/status
// ─────────────────────────────────────────────────────────────────────────────
describe("GET /api/setup/status", () => {
  test("empty DB — isSetup, hasOwner, and isActivated are all false", async () => {
    const res = await request(app).get("/api/setup/status");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.isSetup).toBe(false);
    expect(res.body.hasOwner).toBe(false);
    expect(res.body.isActivated).toBe(false);
  });

  test("after seeding settings and owner — all flags are true", async () => {
    await createSetting({ isActivated: true });
    await createUser({ role: "owner", email: "o@test.com", store: "HQ" });

    const res = await request(app).get("/api/setup/status");
    expect(res.status).toBe(200);
    expect(res.body.isSetup).toBe(true);
    expect(res.body.hasOwner).toBe(true);
    expect(res.body.isActivated).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/setup/details
// ─────────────────────────────────────────────────────────────────────────────
describe("GET /api/setup/details", () => {
  test("404 — no settings document in the database", async () => {
    const res = await request(app).get("/api/setup/details");
    expect(res.status).toBe(404);
  });

  test("200 — returns settings when they exist", async () => {
    await createSetting({ companyName: "Acme Corp" });

    const res = await request(app).get("/api/setup/details");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.settings.companyName).toBe("Acme Corp");
  });

  test("200 — smtp.password is stripped (returned as empty string)", async () => {
    await createSetting({ smtp: { host: "smtp.test.com", user: "no-reply@test.com", password: "super-secret-encrypted" } });

    const res = await request(app).get("/api/setup/details");
    expect(res.status).toBe(200);
    expect(res.body.settings.smtp.password).toBe("");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/setup/initialize
// ─────────────────────────────────────────────────────────────────────────────
describe("POST /api/setup/initialize", () => {
  const valid = {
    companyName:    "My Shop",
    ownerName:      "Alice Owner",
    ownerEmail:     "alice@myshop.com",
    ownerPassword:  "securepass",
    activationCode: ACTIVATION_CODE,
  };

  test("400 — missing companyName", async () => {
    const { companyName, ...body } = valid;
    const res = await request(app).post("/api/setup/initialize").send(body);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/company name/i);
  });

  test("400 — missing ownerPassword", async () => {
    const { ownerPassword, ...body } = valid;
    const res = await request(app).post("/api/setup/initialize").send(body);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/password/i);
  });

  test("400 — password shorter than 6 characters", async () => {
    const res = await request(app)
      .post("/api/setup/initialize")
      .send({ ...valid, ownerPassword: "abc" });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/6 characters/i);
  });

  test("400 — invalid owner email format", async () => {
    const res = await request(app)
      .post("/api/setup/initialize")
      .send({ ...valid, ownerEmail: "not-an-email" });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/email/i);
  });

  test("401 — wrong activation code", async () => {
    const res = await request(app)
      .post("/api/setup/initialize")
      .send({ ...valid, activationCode: "WRONG-KEY" });
    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/activation/i);
  });

  test("400 — system already initialized (double-init blocked)", async () => {
    await request(app).post("/api/setup/initialize").send(valid);
    const res = await request(app)
      .post("/api/setup/initialize")
      .send({ ...valid, ownerEmail: "other@myshop.com" });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/already initialized/i);
  });

  test("201 — creates settings and owner user on success", async () => {
    const res = await request(app).post("/api/setup/initialize").send(valid);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);

    const settings = await Setting.findOne();
    expect(settings).not.toBeNull();
    expect(settings.companyName).toBe("My Shop");
    expect(settings.isActivated).toBe(true);

    const owner = await User.findOne({ role: "owner" });
    expect(owner).not.toBeNull();
    expect(owner.store).toBe("Headquarters");
    expect(owner.email).toBe("alice@myshop.com");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/setup/update
// ─────────────────────────────────────────────────────────────────────────────
describe("PUT /api/setup/update", () => {
  test("401 — no token", async () => {
    const res = await request(app).put("/api/setup/update").send({ companyName: "New Name" });
    expect(res.status).toBe(401);
  });

  test("403 — cashier blocked (ownerOnly)", async () => {
    const cashier = await createUser({ role: "cashier", email: "c@test.com", store: "Main Store" });
    const token = makeToken({ id: cashier._id, role: "cashier", store: "Main Store" });
    const res = await request(app)
      .put("/api/setup/update")
      .set("Authorization", `Bearer ${token}`)
      .send({ companyName: "Hack" });
    expect(res.status).toBe(403);
  });

  test("404 — no settings exist", async () => {
    const owner = await createUser({ role: "owner", email: "o@test.com", store: "HQ" });
    const token = makeToken({ id: owner._id, role: "owner", store: "HQ" });
    const res = await request(app)
      .put("/api/setup/update")
      .set("Authorization", `Bearer ${token}`)
      .send({ companyName: "Updated" });
    expect(res.status).toBe(404);
  });

  test("400 — invalid business email format", async () => {
    const owner = await createUser({ role: "owner", email: "o@test.com", store: "HQ" });
    await createSetting();
    const token = makeToken({ id: owner._id, role: "owner", store: "HQ" });
    const res = await request(app)
      .put("/api/setup/update")
      .set("Authorization", `Bearer ${token}`)
      .send({ email: "bad-email" });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/email/i);
  });

  test("400 — invalid printerType", async () => {
    const owner = await createUser({ role: "owner", email: "o@test.com", store: "HQ" });
    await createSetting();
    const token = makeToken({ id: owner._id, role: "owner", store: "HQ" });
    const res = await request(app)
      .put("/api/setup/update")
      .set("Authorization", `Bearer ${token}`)
      .send({ printerType: "bluetooth" });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/printer type/i);
  });

  test("400 — taxRate greater than 1", async () => {
    const owner = await createUser({ role: "owner", email: "o@test.com", store: "HQ" });
    await createSetting();
    const token = makeToken({ id: owner._id, role: "owner", store: "HQ" });
    const res = await request(app)
      .put("/api/setup/update")
      .set("Authorization", `Bearer ${token}`)
      .send({ taxRate: 1.5 });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/tax rate/i);
  });

  test("400 — all payment methods are invalid", async () => {
    const owner = await createUser({ role: "owner", email: "o@test.com", store: "HQ" });
    await createSetting();
    const token = makeToken({ id: owner._id, role: "owner", store: "HQ" });
    const res = await request(app)
      .put("/api/setup/update")
      .set("Authorization", `Bearer ${token}`)
      .send({ paymentMethods: ["bitcoin", "paypal"] });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/payment method/i);
  });

  test("200 — updates fields and returns sanitized settings (smtp.password stripped)", async () => {
    const owner = await createUser({ role: "owner", email: "o@test.com", store: "HQ" });
    await createSetting({ smtp: { host: "smtp.test.com", password: "some-encrypted-value" } });
    const token = makeToken({ id: owner._id, role: "owner", store: "HQ" });
    const res = await request(app)
      .put("/api/setup/update")
      .set("Authorization", `Bearer ${token}`)
      .send({ companyName: "Updated Shop", currency: "USD", receiptFooter: "Thank you!" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.settings.companyName).toBe("Updated Shop");
    expect(res.body.settings.currency).toBe("USD");
    expect(res.body.settings.receiptFooter).toBe("Thank you!");
    expect(res.body.settings.smtp.password).toBe("");
  });
});
