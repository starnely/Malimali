const request = require("supertest");
const createApp = require("../helpers/createApp");
const db = require("../setup/db");
const { makeToken } = require("../helpers/auth");
const { createUser, createProduct } = require("../helpers/seed");
const Sale = require("../../models/Sale");
const Product = require("../../models/Product");
const { TEST_TENANT_ID } = require("../helpers/tenant");

// Prevent any real calls to Safaricom during tests
jest.mock("../../utils/mpesaClient", () => ({
  initiateSTKPush:  jest.fn(),
  queryStkStatus:   jest.fn(),
  getResultMessage: jest.fn((code, fallback) => fallback || "Payment failed"),
}));
const { initiateSTKPush, queryStkStatus } = require("../../utils/mpesaClient");

const app = createApp();

beforeAll(() => db.connect());
beforeEach(() => {
  // Safe default so any test that reaches the callback-resolution path
  // without explicitly mocking a result doesn't crash on destructuring
  // undefined — mirrors resultCode -1 ("still processing / query itself
  // failed"), i.e. "leave everything as pending" unless a test overrides it.
  queryStkStatus.mockResolvedValue({ resultCode: -1, resultDesc: "not mocked for this test" });
});
afterEach(async () => { await db.clear(); jest.clearAllMocks(); });
afterAll(() => db.close());

// ─────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────
const CHECKOUT_ID = "ws_CO_TEST_CALLBACK_001";

async function seedPendingSale(cashierId) {
  const product = await createProduct({ stock: 5, sellPrice: 300, buyPrice: 150 });
  const sale = await Sale.create({
    items: [{ productId: product._id, qty: 1, price: 300, buyPrice: 150 }],
    total: 300,
    store: "Main Store",
    cashierId,
    cashier: "Test Cashier",
    status: "pending",
    mpesaCheckoutRequestId: CHECKOUT_ID,
    date: "2024-01-01",
    time: "10:00:00 EAT",
    paymentInfo: {
      paymentMethod:      "mpesa",
      mpesaPhone:         "254712345678",
      finalTotal:         300,
      mpesaPart:          300,
      mpesaReceiptNumber: "",
    },
    tenantId: TEST_TENANT_ID,
  });
  return { sale, product };
}

function successCallback(checkoutRequestId = CHECKOUT_ID) {
  return {
    Body: {
      stkCallback: {
        MerchantRequestID: "MER-TEST-001",
        CheckoutRequestID: checkoutRequestId,
        ResultCode: 0,
        ResultDesc: "The service request is processed successfully.",
        CallbackMetadata: {
          Item: [
            { Name: "Amount",             Value: 300 },
            { Name: "MpesaReceiptNumber", Value: "NLJ7RT61SV" },
            { Name: "TransactionDate",    Value: 20240101143045 },
            { Name: "PhoneNumber",        Value: 254712345678 },
          ],
        },
      },
    },
  };
}

function failureCallback(resultCode = 1032, checkoutRequestId = CHECKOUT_ID) {
  return {
    Body: {
      stkCallback: {
        MerchantRequestID: "MER-TEST-001",
        CheckoutRequestID: checkoutRequestId,
        ResultCode: resultCode,
        ResultDesc: "Request cancelled by user",
      },
    },
  };
}

// ─────────────────────────────────────────────────────────────────────
// POST /api/mpesa/stk-push
// ─────────────────────────────────────────────────────────────────────
describe("POST /api/mpesa/stk-push", () => {
  test("401 — no token", async () => {
    const res = await request(app).post("/api/mpesa/stk-push").send({});
    expect(res.status).toBe(401);
  });

  test("400 — missing phone", async () => {
    const cashier = await createUser({ role: "cashier" });
    const product = await createProduct({ stock: 5, sellPrice: 100 });
    const token   = makeToken({ id: cashier._id, role: "cashier", store: "Main Store" });

    const res = await request(app)
      .post("/api/mpesa/stk-push")
      .set("Authorization", `Bearer ${token}`)
      .send({
        cartItems:  [{ productId: String(product._id), qty: 1, price: 100 }],
        amount:     100,
        finalTotal: 100,
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/phone/i);
  });

  test("400 — empty cart", async () => {
    const cashier = await createUser({ role: "cashier" });
    const token   = makeToken({ id: cashier._id, role: "cashier", store: "Main Store" });

    const res = await request(app)
      .post("/api/mpesa/stk-push")
      .set("Authorization", `Bearer ${token}`)
      .send({ phone: "0712345678", cartItems: [], finalTotal: 100 });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/cart/i);
  });

  test("400 — insufficient stock (transaction aborts, stock unchanged)", async () => {
    initiateSTKPush.mockResolvedValue({ checkoutRequestId: "ws_X", merchantRequestId: "m_X" });

    const cashier = await createUser({ role: "cashier" });
    const product = await createProduct({ stock: 1, sellPrice: 200 });
    const token   = makeToken({ id: cashier._id, role: "cashier", store: "Main Store" });

    const res = await request(app)
      .post("/api/mpesa/stk-push")
      .set("Authorization", `Bearer ${token}`)
      .send({
        phone:      "0712345678",
        amount:     400,
        finalTotal: 400,
        cartItems:  [{ productId: String(product._id), qty: 2, price: 200 }],
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/insufficient stock/i);

    const unchanged = await Product.findOne({ _id: product._id, tenantId: TEST_TENANT_ID });
    expect(unchanged.stock).toBe(1);
  });

  test("202 — success: pending sale created, stock decremented, checkoutRequestId returned", async () => {
    initiateSTKPush.mockResolvedValue({
      checkoutRequestId: "ws_CO_SUCCESS_001",
      merchantRequestId: "MER_SUCCESS_001",
    });

    const cashier = await createUser({ role: "cashier" });
    const product = await createProduct({ stock: 5, sellPrice: 500 });
    const token   = makeToken({ id: cashier._id, role: "cashier", store: "Main Store" });

    const res = await request(app)
      .post("/api/mpesa/stk-push")
      .set("Authorization", `Bearer ${token}`)
      .send({
        phone:      "0712345678",
        amount:     500,
        finalTotal: 500,
        cartItems:  [{ productId: String(product._id), qty: 1, price: 500 }],
      });

    expect(res.status).toBe(202);
    expect(res.body.success).toBe(true);
    expect(res.body.checkoutRequestId).toBe("ws_CO_SUCCESS_001");
    expect(res.body.saleId).toBeTruthy();

    // Sale created as pending with checkoutRequestId stored
    const sale = await Sale.findOne({ _id: res.body.saleId, tenantId: TEST_TENANT_ID });
    expect(sale.status).toBe("pending");
    expect(sale.mpesaCheckoutRequestId).toBe("ws_CO_SUCCESS_001");
    expect(sale.paymentInfo.paymentMethod).toBe("mpesa");
    expect(sale.paymentInfo.finalTotal).toBe(500);

    // Stock was decremented
    const after = await Product.findOne({ _id: product._id, tenantId: TEST_TENANT_ID });
    expect(after.stock).toBe(4);
  });

  test("502 — STK push fails: route returns error and STK was attempted", async () => {
    initiateSTKPush.mockRejectedValue(new Error("Safaricom unreachable"));

    const cashier = await createUser({ role: "cashier" });
    const product = await createProduct({ stock: 5, sellPrice: 500 });
    const token   = makeToken({ id: cashier._id, role: "cashier", store: "Main Store" });

    const res = await request(app)
      .post("/api/mpesa/stk-push")
      .set("Authorization", `Bearer ${token}`)
      .send({
        phone:      "0712345678",
        amount:     500,
        finalTotal: 500,
        cartItems:  [{ productId: String(product._id), qty: 1, price: 500 }],
      });

    expect(res.status).toBe(502);
    expect(res.body.success).toBe(false);
    // Confirm the route actually tried Safaricom (not short-circuited)
    expect(initiateSTKPush).toHaveBeenCalledTimes(1);
    // No confirmed sale should exist (any orphaned pending is handled via manual void)
    const confirmed = await Sale.findOne({ status: "confirmed", "paymentInfo.paymentMethod": "mpesa", tenantId: TEST_TENANT_ID });
    expect(confirmed).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────
// POST /api/mpesa/callback
// ─────────────────────────────────────────────────────────────────────
describe("POST /api/mpesa/callback", () => {
  test("always responds 200 to Safaricom regardless of payload", async () => {
    const res = await request(app)
      .post("/api/mpesa/callback")
      .send({});
    expect(res.status).toBe(200);
    expect(res.body.ResultCode).toBe(0);
  });

  test("success callback: sale confirmed, receipt number stored", async () => {
    const cashier = await createUser({ role: "cashier" });
    await seedPendingSale(cashier._id);

    // Daraja itself is what decides the outcome now — this is what
    // resolvePendingSale actually reads.
    queryStkStatus.mockResolvedValue({ resultCode: 0, resultDesc: "The service request is processed successfully." });

    await request(app)
      .post("/api/mpesa/callback")
      .send(successCallback());

    // Give the async post-response processing time to finish
    await new Promise(r => setTimeout(r, 150));

    const sale = await Sale.findOne({ mpesaCheckoutRequestId: CHECKOUT_ID, tenantId: TEST_TENANT_ID });
    expect(sale.status).toBe("confirmed");
    expect(sale.paymentInfo.mpesaReceiptNumber).toBe("NLJ7RT61SV");
    expect(queryStkStatus).toHaveBeenCalledWith(CHECKOUT_ID);
  });

  test("failure callback: sale marked failed, items restocked", async () => {
    const cashier = await createUser({ role: "cashier" });
    const { product } = await seedPendingSale(cashier._id);
    const stockBefore = product.stock; // 5 (createProduct default)

    queryStkStatus.mockResolvedValue({ resultCode: 1032, resultDesc: "Request cancelled by user" });

    await request(app)
      .post("/api/mpesa/callback")
      .send(failureCallback(1032));

    await new Promise(r => setTimeout(r, 150));

    const sale = await Sale.findOne({ mpesaCheckoutRequestId: CHECKOUT_ID, tenantId: TEST_TENANT_ID });
    expect(sale.status).toBe("failed");

    // The 1 unit that was decremented during stk-push must be returned
    const after = await Product.findOne({ _id: product._id, tenantId: TEST_TENANT_ID });
    expect(after.stock).toBe(stockBefore + 1);
  });

  test("payload claims SUCCESS but Daraja Query API says failed/cancelled — sale follows Daraja, not the payload", async () => {
    // Regression guard for the exact bug that was removed: the callback
    // route must never trust ResultCode/CallbackMetadata off the request
    // body. Here the body lies (claims success); the mocked Query API is
    // the only thing that should decide what actually happens.
    const cashier = await createUser({ role: "cashier" });
    const { product } = await seedPendingSale(cashier._id);
    const stockBefore = product.stock;

    queryStkStatus.mockResolvedValue({ resultCode: 1032, resultDesc: "Request cancelled by user" });

    await request(app)
      .post("/api/mpesa/callback")
      .send(successCallback()); // body says ResultCode: 0 — must be ignored

    await new Promise(r => setTimeout(r, 150));

    const sale = await Sale.findOne({ mpesaCheckoutRequestId: CHECKOUT_ID, tenantId: TEST_TENANT_ID });
    expect(sale.status).toBe("failed");
    // Forged receipt number from the body must never be stored
    expect(sale.paymentInfo.mpesaReceiptNumber).toBe("");

    // Restocked per Daraja's real (failed) answer, not left decremented
    // as a "success" payload would otherwise imply.
    const after = await Product.findOne({ _id: product._id, tenantId: TEST_TENANT_ID });
    expect(after.stock).toBe(stockBefore + 1);
  });

  test("Daraja Query API throws/times out — sale stays pending, never guessed from the payload", async () => {
    const cashier = await createUser({ role: "cashier" });
    const { product } = await seedPendingSale(cashier._id);
    const stockBefore = product.stock;

    queryStkStatus.mockRejectedValue(new Error("Network timeout"));

    await request(app)
      .post("/api/mpesa/callback")
      .send(successCallback()); // even a "success" payload must not become a fallback

    await new Promise(r => setTimeout(r, 150));

    const sale = await Sale.findOne({ mpesaCheckoutRequestId: CHECKOUT_ID, tenantId: TEST_TENANT_ID });
    expect(sale.status).toBe("pending");
    expect(sale.paymentInfo.mpesaReceiptNumber).toBe("");

    // Neither the confirm path nor the restock-on-failure path ran
    const after = await Product.findOne({ _id: product._id, tenantId: TEST_TENANT_ID });
    expect(after.stock).toBe(stockBefore);
  });

  test("unknown CheckoutRequestID is silently ignored (still responds 200)", async () => {
    const res = await request(app)
      .post("/api/mpesa/callback")
      .send(successCallback("ws_CO_NONEXISTENT_XYZ"));

    expect(res.status).toBe(200);

    await new Promise(r => setTimeout(r, 100));
    // No sale should have been modified
    const count = await Sale.countDocuments({ status: "confirmed", tenantId: TEST_TENANT_ID });
    expect(count).toBe(0);
  });

  test("callback for already-confirmed sale is ignored (idempotent)", async () => {
    const cashier = await createUser({ role: "cashier" });
    const { sale } = await seedPendingSale(cashier._id);

    // First callback — Daraja confirms
    queryStkStatus.mockResolvedValue({ resultCode: 0, resultDesc: "success" });
    await request(app).post("/api/mpesa/callback").send(successCallback());
    await new Promise(r => setTimeout(r, 150));

    const afterFirst = await Sale.findOne({ _id: sale._id, tenantId: TEST_TENANT_ID });
    expect(afterFirst.status).toBe("confirmed");
    expect(queryStkStatus).toHaveBeenCalledTimes(1);

    // Second callback — even mocked to report a definitive failure here,
    // it must be ignored: resolvePendingSale's status:"pending" guard
    // returns before ever calling queryStkStatus a second time, so this
    // mock value should never even be consulted.
    queryStkStatus.mockResolvedValue({ resultCode: 1032, resultDesc: "cancelled" });
    await request(app).post("/api/mpesa/callback").send(failureCallback());
    await new Promise(r => setTimeout(r, 150));

    const afterSecond = await Sale.findOne({ _id: sale._id, tenantId: TEST_TENANT_ID });
    expect(afterSecond.status).toBe("confirmed"); // unchanged
    expect(queryStkStatus).toHaveBeenCalledTimes(1); // never queried again — guard short-circuited first
  });
});

// ─────────────────────────────────────────────────────────────────────
// GET /api/mpesa/status/:checkoutRequestId
// ─────────────────────────────────────────────────────────────────────
describe("GET /api/mpesa/status/:checkoutRequestId", () => {
  test("401 — no token", async () => {
    const res = await request(app).get(`/api/mpesa/status/${CHECKOUT_ID}`);
    expect(res.status).toBe(401);
  });

  test("404 — unknown checkoutRequestId", async () => {
    const cashier = await createUser({ role: "cashier" });
    const token   = makeToken({ id: cashier._id, role: "cashier" });

    const res = await request(app)
      .get("/api/mpesa/status/ws_CO_NONEXISTENT")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  test("returns current status of a pending sale", async () => {
    const cashier = await createUser({ role: "cashier" });
    await seedPendingSale(cashier._id);
    const token = makeToken({ id: cashier._id, role: "cashier" });

    const res = await request(app)
      .get(`/api/mpesa/status/${CHECKOUT_ID}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.status).toBe("pending");
    expect(res.body.saleId).toBeTruthy();
  });

  test("returns confirmed status and receipt number after successful callback", async () => {
    const cashier = await createUser({ role: "cashier" });
    await seedPendingSale(cashier._id);

    queryStkStatus.mockResolvedValue({ resultCode: 0, resultDesc: "success" });

    // Simulate callback
    await request(app).post("/api/mpesa/callback").send(successCallback());
    await new Promise(r => setTimeout(r, 150));

    const token = makeToken({ id: cashier._id, role: "cashier" });
    const res   = await request(app)
      .get(`/api/mpesa/status/${CHECKOUT_ID}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("confirmed");
    expect(res.body.mpesaReceiptNumber).toBe("NLJ7RT61SV");
  });
});
