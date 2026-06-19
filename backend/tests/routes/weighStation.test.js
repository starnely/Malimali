const request = require("supertest");
const createApp = require("../helpers/createApp");
const db = require("../setup/db");
const { makeToken } = require("../helpers/auth");
const { createUser, createProduct } = require("../helpers/seed");

const {
  generateWeightBarcode,
  decodeWeightBarcode,
} = require("../../routes/weighStation");

const app = createApp();

beforeAll(() => db.connect());
afterEach(() => db.clear());
afterAll(() => db.close());

// ─────────────────────────────────────────────────────────────────────────────
// Pure function unit tests (no HTTP, no DB)
// ─────────────────────────────────────────────────────────────────────────────
describe("generateWeightBarcode / decodeWeightBarcode — pure functions", () => {
  test("generateWeightBarcode — produces a 13-digit string starting with '2'", () => {
    const barcode = generateWeightBarcode(1, 500);
    expect(barcode).toHaveLength(13);
    expect(barcode.startsWith("2")).toBe(true);
    expect(/^\d{13}$/.test(barcode)).toBe(true);
  });

  test("generateWeightBarcode — same inputs always produce the same code", () => {
    expect(generateWeightBarcode(7, 432)).toBe(generateWeightBarcode(7, 432));
  });

  test("round-trip: generateWeightBarcode → decodeWeightBarcode recovers PLU and weight", () => {
    const plu = 7;
    const grams = 432;
    const barcode = generateWeightBarcode(plu, grams);
    const decoded = decodeWeightBarcode(barcode);

    expect(decoded).not.toBeNull();
    expect(decoded.isValid).toBe(true);
    expect(decoded.pluNumber).toBe(plu);
    expect(Math.abs(decoded.weightGrams - grams)).toBeLessThan(0.2);
  });

  test("decodeWeightBarcode — returns null for non-'2' prefix (even if 13 chars)", () => {
    expect(decodeWeightBarcode("6001234567890")).toBeNull();
  });

  test("decodeWeightBarcode — returns null for barcodes that are not 13 characters", () => {
    expect(decodeWeightBarcode("2123456")).toBeNull();
    expect(decodeWeightBarcode("20000104320001")).toBeNull();
  });

  test("decodeWeightBarcode — returns isValid: false when check digit is tampered", () => {
    const barcode = generateWeightBarcode(5, 250);
    const lastDigit = parseInt(barcode[12], 10);
    const tampered = barcode.slice(0, 12) + String((lastDigit + 1) % 10);
    const decoded = decodeWeightBarcode(tampered);
    expect(decoded).not.toBeNull();
    expect(decoded.isValid).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/weigh-station/products
// ─────────────────────────────────────────────────────────────────────────────
describe("GET /api/weigh-station/products", () => {
  test("401 — no token", async () => {
    const res = await request(app).get("/api/weigh-station/products");
    expect(res.status).toBe(401);
  });

  test("returns only isWeighed products; non-weighed and expired excluded; store-scoped for non-owners", async () => {
    const cashier = await createUser({ role: "cashier", email: "c@test.com", store: "Store A" });
    await createProduct({ name: "Sugar",  isWeighed: true,  store: "Store A", sellPrice: 100, buyPrice: 80 });
    await createProduct({ name: "Rice",   isWeighed: true,  store: "Store B", sellPrice: 120, buyPrice: 90 });
    await createProduct({ name: "Salt",   isWeighed: false, store: "Store A", sellPrice: 50,  buyPrice: 40 });
    await createProduct({ name: "Flour",  isWeighed: true,  store: "Store A", isExpired: true, sellPrice: 90, buyPrice: 70 });

    const token = makeToken({ id: cashier._id, role: "cashier", store: "Store A" });
    const res = await request(app)
      .get("/api/weigh-station/products")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    const names = res.body.products.map((p) => p.name);
    expect(names).toContain("Sugar");
    expect(names).not.toContain("Rice");   // wrong store
    expect(names).not.toContain("Salt");   // not weighed
    expect(names).not.toContain("Flour");  // expired
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/weigh-station/generate
// ─────────────────────────────────────────────────────────────────────────────
describe("POST /api/weigh-station/generate", () => {
  let token, weighedProduct;

  beforeEach(async () => {
    const cashier = await createUser({ role: "cashier", email: "c@test.com" });
    token = makeToken({ id: cashier._id, role: "cashier", store: cashier.store });
    weighedProduct = await createProduct({
      name: "Maize",
      isWeighed: true,
      pluNumber: 1,
      pricePerKg: 50,
      buyPrice: 40,
      sellPrice: 50,
    });
  });

  test("400 — missing productId", async () => {
    const res = await request(app)
      .post("/api/weigh-station/generate")
      .set("Authorization", `Bearer ${token}`)
      .send({ weightGrams: 500 });
    expect(res.status).toBe(400);
  });

  test("400 — missing weightGrams", async () => {
    const res = await request(app)
      .post("/api/weigh-station/generate")
      .set("Authorization", `Bearer ${token}`)
      .send({ productId: weighedProduct._id });
    expect(res.status).toBe(400);
  });

  test("400 — weightGrams ≤ 0", async () => {
    const res = await request(app)
      .post("/api/weigh-station/generate")
      .set("Authorization", `Bearer ${token}`)
      .send({ productId: weighedProduct._id, weightGrams: 0 });
    expect(res.status).toBe(400);
  });

  test("400 — weightGrams > 99990", async () => {
    const res = await request(app)
      .post("/api/weigh-station/generate")
      .set("Authorization", `Bearer ${token}`)
      .send({ productId: weighedProduct._id, weightGrams: 100000 });
    expect(res.status).toBe(400);
  });

  test("404 — product not found", async () => {
    const res = await request(app)
      .post("/api/weigh-station/generate")
      .set("Authorization", `Bearer ${token}`)
      .send({ productId: "000000000000000000000001", weightGrams: 300 });
    expect(res.status).toBe(404);
  });

  test("400 — product exists but isWeighed is false", async () => {
    const normalProduct = await createProduct({ name: "Chips Pack", isWeighed: false });
    const res = await request(app)
      .post("/api/weigh-station/generate")
      .set("Authorization", `Bearer ${token}`)
      .send({ productId: normalProduct._id, weightGrams: 300 });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/not a weighed item/i);
  });

  test("400 — weighed product has no pluNumber", async () => {
    const noPlu = await createProduct({ name: "Beans", isWeighed: true, pluNumber: null, buyPrice: 50, sellPrice: 80 });
    const res = await request(app)
      .post("/api/weigh-station/generate")
      .set("Authorization", `Bearer ${token}`)
      .send({ productId: noPlu._id, weightGrams: 300 });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/PLU/i);
  });

  test("200 — returns 13-digit barcode; totalPrice = (weightGrams/1000) × pricePerKg", async () => {
    const res = await request(app)
      .post("/api/weigh-station/generate")
      .set("Authorization", `Bearer ${token}`)
      .send({ productId: weighedProduct._id, weightGrams: 500 });

    expect(res.status).toBe(200);
    expect(res.body.barcode).toHaveLength(13);
    expect(res.body.barcode.startsWith("2")).toBe(true);
    expect(res.body.weightKg).toBeCloseTo(0.5);
    expect(res.body.totalPrice).toBeCloseTo(25); // 0.5 kg × KSh 50/kg
    expect(res.body.productName).toBe("Maize");
  });

  test("200 — generated barcode round-trips through decodeWeightBarcode", async () => {
    const res = await request(app)
      .post("/api/weigh-station/generate")
      .set("Authorization", `Bearer ${token}`)
      .send({ productId: weighedProduct._id, weightGrams: 432 });

    expect(res.status).toBe(200);
    const decoded = decodeWeightBarcode(res.body.barcode);
    expect(decoded).not.toBeNull();
    expect(decoded.isValid).toBe(true);
    expect(decoded.pluNumber).toBe(weighedProduct.pluNumber);
    expect(Math.abs(decoded.weightGrams - 432)).toBeLessThan(0.2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/weigh-station/decode
// ─────────────────────────────────────────────────────────────────────────────
describe("POST /api/weigh-station/decode", () => {
  let token, weighedProduct;

  beforeEach(async () => {
    const cashier = await createUser({ role: "cashier", email: "c@test.com" });
    token = makeToken({ id: cashier._id, role: "cashier", store: cashier.store });
    weighedProduct = await createProduct({
      name: "Wheat",
      isWeighed: true,
      pluNumber: 99,
      pricePerKg: 60,
      buyPrice: 45,
      sellPrice: 60,
    });
  });

  test("400 — missing barcode", async () => {
    const res = await request(app)
      .post("/api/weigh-station/decode")
      .set("Authorization", `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(400);
  });

  test("400 — 13-char barcode not starting with '2'", async () => {
    const res = await request(app)
      .post("/api/weigh-station/decode")
      .set("Authorization", `Bearer ${token}`)
      .send({ barcode: "6001234567890" });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/not a valid weight barcode/i);
  });

  test("400 — tampered check digit", async () => {
    const valid = generateWeightBarcode(99, 300);
    const lastDigit = parseInt(valid[12], 10);
    const tampered = valid.slice(0, 12) + String((lastDigit + 1) % 10);

    const res = await request(app)
      .post("/api/weigh-station/decode")
      .set("Authorization", `Bearer ${token}`)
      .send({ barcode: tampered });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/check digit/i);
  });

  test("404 — valid barcode format but no product with that PLU in DB", async () => {
    // PLU 77 does not exist in DB (only PLU 99 was seeded).
    const barcode = generateWeightBarcode(77, 200);
    const res = await request(app)
      .post("/api/weigh-station/decode")
      .set("Authorization", `Bearer ${token}`)
      .send({ barcode });
    expect(res.status).toBe(404);
  });

  test("200 — decodes barcode generated by /generate; returns product, weightKg, totalPrice", async () => {
    const barcode = generateWeightBarcode(99, 400); // PLU 99, 0.4 kg
    const res = await request(app)
      .post("/api/weigh-station/decode")
      .set("Authorization", `Bearer ${token}`)
      .send({ barcode });

    expect(res.status).toBe(200);
    expect(res.body.product.name).toBe("Wheat");
    expect(res.body.product.pluNumber).toBe(99);
    expect(res.body.weightKg).toBeCloseTo(0.4);
    expect(res.body.totalPrice).toBeCloseTo(24); // 0.4 × KSh 60
    expect(res.body.pricePerKg).toBe(60);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/weigh-station/plu-export
// ─────────────────────────────────────────────────────────────────────────────
describe("GET /api/weigh-station/plu-export", () => {
  test("returns text/csv with correct header row", async () => {
    const cashier = await createUser({ role: "cashier", email: "c@test.com" });
    const token = makeToken({ id: cashier._id, role: "cashier", store: cashier.store });
    await createProduct({ name: "Sugar", isWeighed: true, pluNumber: 1, pricePerKg: 80, buyPrice: 60, sellPrice: 80 });

    const res = await request(app)
      .get("/api/weigh-station/plu-export")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/text\/csv/);
    const lines = res.text.split(/\r?\n/);
    expect(lines[0]).toBe("PLU_NO,NAME,UNIT_PRICE,TARE,DEPT");
  });

  test("products without a pluNumber are excluded from CSV rows", async () => {
    const owner = await createUser({ role: "owner", email: "o@test.com", store: "HQ" });
    const token = makeToken({ id: owner._id, role: "owner", store: "HQ" });
    await createProduct({ name: "Maize",  isWeighed: true, pluNumber: 2,    pricePerKg: 50, buyPrice: 40, sellPrice: 50 });
    await createProduct({ name: "Millet", isWeighed: true, pluNumber: null, pricePerKg: 45, buyPrice: 35, sellPrice: 45 });

    const res = await request(app)
      .get("/api/weigh-station/plu-export")
      .set("Authorization", `Bearer ${token}`);

    const lines = res.text.split(/\r?\n/).filter(Boolean);
    expect(lines.length).toBe(2); // header + Maize only
    expect(lines[1]).toContain("MAIZE");
    expect(res.text).not.toContain("MILLET");
  });
});
