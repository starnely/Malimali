const mongoose = require("mongoose");
const db = require("../setup/db");

// This test file requires model files directly (not via createApp.js), so it
// needs its own copy of the same guard: the plugin must register before any
// model schema compiles.
require("../../plugins/tenantScope");

const Tenant = require("../../models/Tenant");
const Category = require("../../models/Category");

beforeAll(() => db.connect());
afterEach(() => db.clear());
afterAll(() => db.close());

describe("Phase 0 — Tenant model", () => {
  test("creates a tenant with a unique slug", async () => {
    const tenant = await Tenant.create({ name: "Acme Corp", slug: "acme-corp" });
    expect(tenant._id).toBeDefined();
    expect(tenant.status).toBe("trial"); // default
  });

  test("rejects a duplicate slug", async () => {
    await Tenant.create({ name: "Acme Corp", slug: "acme-corp" });
    await expect(Tenant.create({ name: "Acme Corp 2", slug: "acme-corp" }))
      .rejects.toThrow();
  });
});

describe("Phase 0 — tenantScope shadow-mode plugin", () => {
  let warnSpy;

  beforeEach(() => {
    warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  test("adds an optional tenantId field to an existing schema (Category)", () => {
    const paths = Category.schema.paths;
    expect(paths.tenantId).toBeDefined();
    expect(paths.tenantId.instance).toBe("ObjectId");
    expect(paths.tenantId.isRequired).toBeFalsy();
  });

  test("warns (does not throw, still returns data) when a query has no tenantId filter", async () => {
    await Category.create({ name: "beverages", store: "Main Store" });

    const found = await Category.find({ store: "Main Store" });

    expect(found.length).toBe(1); // shadow mode never blocks the query
    const shadowWarnings = warnSpy.mock.calls.filter(
      (args) => args[0] && args[0].includes("[tenantScope:SHADOW]")
    );
    expect(shadowWarnings.length).toBeGreaterThan(0);
    expect(shadowWarnings[0][0]).toContain("Category.find");
  });

  test("does not warn when a query already includes a tenantId filter", async () => {
    const tenantId = new mongoose.Types.ObjectId();
    await Category.create({ name: "beverages", store: "Main Store", tenantId });

    await Category.find({ tenantId });

    const shadowWarnings = warnSpy.mock.calls.filter(
      (args) => args[0] && args[0].includes("[tenantScope:SHADOW]")
    );
    expect(shadowWarnings.length).toBe(0);
  });
});
