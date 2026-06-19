const request = require("supertest");
const createApp = require("../helpers/createApp");
const db = require("../setup/db");
const { makeToken } = require("../helpers/auth");
const { createUser, createProduct, createPurchaseOrder, createSupplierPayment } = require("../helpers/seed");
const PurchaseOrder = require("../../models/PurchaseOrder");
const Product = require("../../models/Product");

const app = createApp();

beforeAll(() => db.connect());
afterEach(() => db.clear());
afterAll(() => db.close());

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

// Creates an owner + product + PO and returns all three with a token.
async function setup(storeOverride = "Main Store") {
  const owner = await createUser({ role: "owner", email: "o@test.com", store: storeOverride });
  const product = await createProduct({ store: storeOverride });
  const po = await createPurchaseOrder(product, { store: storeOverride });
  const token = makeToken({ id: owner._id, role: "owner", store: storeOverride });
  return { owner, product, po, token };
}

// Advances a PO to received+invoiced state directly so it appears in /outstanding.
async function makeOutstandingPo(product, store = "Main Store") {
  const po = await createPurchaseOrder(product, { store });
  po.status = "received";
  po.invoiceAmount = 500;
  po.balance = 500;
  po.paymentStatus = "unpaid";
  await po.save();
  return po;
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/purchase-orders
// ─────────────────────────────────────────────────────────────────────────────
describe("GET /api/purchase-orders", () => {
  test("401 — no token", async () => {
    const res = await request(app).get("/api/purchase-orders");
    expect(res.status).toBe(401);
  });

  test("?store filter returns only that store's POs", async () => {
    const owner = await createUser({ role: "owner", email: "o@test.com", store: "HQ" });
    const token = makeToken({ id: owner._id, role: "owner", store: "HQ" });
    const pA = await createProduct({ store: "Store A" });
    const pB = await createProduct({ store: "Store B" });
    await createPurchaseOrder(pA, { store: "Store A" });
    await createPurchaseOrder(pB, { store: "Store B" });

    const res = await request(app)
      .get("/api/purchase-orders?store=Store A")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.purchaseOrders.every((p) => p.store === "Store A")).toBe(true);
    expect(res.body.count).toBe(1);
  });

  test("?status=draft returns only draft POs", async () => {
    const owner = await createUser({ role: "owner", email: "o@test.com", store: "HQ" });
    const token = makeToken({ id: owner._id, role: "owner", store: "HQ" });
    const product = await createProduct();
    const draftPo = await createPurchaseOrder(product);
    // Make a non-draft PO
    await createPurchaseOrder(product, { status: "sent" });

    const res = await request(app)
      .get("/api/purchase-orders?status=draft")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.purchaseOrders.every((p) => p.status === "draft")).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/purchase-orders/outstanding
// ─────────────────────────────────────────────────────────────────────────────
describe("GET /api/purchase-orders/outstanding", () => {
  test("returns only received+invoiced+unpaid POs; draft PO excluded", async () => {
    const { owner, product, token } = await setup();
    // Draft PO — should NOT appear
    await createPurchaseOrder(product);
    // Received, invoiced, unpaid — SHOULD appear
    await makeOutstandingPo(product);

    const res = await request(app)
      .get("/api/purchase-orders/outstanding")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    // All returned POs must satisfy the outstanding criteria
    expect(res.body.purchaseOrders.every((p) => p.invoiceAmount > 0)).toBe(true);
    expect(res.body.purchaseOrders.every((p) => ["unpaid", "partial"].includes(p.paymentStatus))).toBe(true);
    expect(res.body.purchaseOrders.every((p) => ["received", "partial"].includes(p.status))).toBe(true);
  });

  test("response includes totalOutstanding as sum of balances", async () => {
    const { owner, product, token } = await setup();
    const po1 = await makeOutstandingPo(product);  // balance: 500
    const po2 = await makeOutstandingPo(product);  // balance: 500

    const res = await request(app)
      .get("/api/purchase-orders/outstanding")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.totalOutstanding).toBe(po1.balance + po2.balance);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/purchase-orders/supplier-payments
// ─────────────────────────────────────────────────────────────────────────────
describe("GET /api/purchase-orders/supplier-payments", () => {
  test("returns payments list with total; ?store filter applies", async () => {
    const { owner, product, po, token } = await setup("Store A");
    await createSupplierPayment(po, { store: "Store A", amount: 200 });
    await createSupplierPayment(po, { store: "Store B", amount: 300 });

    const all = await request(app)
      .get("/api/purchase-orders/supplier-payments")
      .set("Authorization", `Bearer ${token}`);
    expect(all.status).toBe(200);
    expect(all.body.total).toBe(500);

    const filtered = await request(app)
      .get("/api/purchase-orders/supplier-payments?store=Store A")
      .set("Authorization", `Bearer ${token}`);
    expect(filtered.body.total).toBe(200);
    expect(filtered.body.payments.length).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/purchase-orders/:id
// ─────────────────────────────────────────────────────────────────────────────
describe("GET /api/purchase-orders/:id", () => {
  test("404 — PO not found", async () => {
    const { token } = await setup();
    const res = await request(app)
      .get("/api/purchase-orders/000000000000000000000001")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  test("200 — returns PO with populated items.productId", async () => {
    const { po, token } = await setup();
    const res = await request(app)
      .get(`/api/purchase-orders/${po._id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.purchaseOrder.poNumber).toBe(po.poNumber);
    expect(res.body.purchaseOrder.items[0].productId).toBeTruthy();
    expect(res.body.purchaseOrder.items[0].productId.name).toBe("Test Product");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/purchase-orders
// ─────────────────────────────────────────────────────────────────────────────
describe("POST /api/purchase-orders", () => {
  test("403 — cashier cannot create PO", async () => {
    const cashier = await createUser({ role: "cashier", email: "c@test.com" });
    const product = await createProduct();
    const token = makeToken({ id: cashier._id, role: "cashier", store: cashier.store });

    const res = await request(app)
      .post("/api/purchase-orders")
      .set("Authorization", `Bearer ${token}`)
      .send({ items: [{ productId: product._id, qtyOrdered: 5, unitCost: 10 }] });
    expect(res.status).toBe(403);
  });

  test("400 — empty items array", async () => {
    const { token } = await setup();
    const res = await request(app)
      .post("/api/purchase-orders")
      .set("Authorization", `Bearer ${token}`)
      .send({ items: [] });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/at least one item/i);
  });

  test("400 — item missing unitCost", async () => {
    const { product, token } = await setup();
    const res = await request(app)
      .post("/api/purchase-orders")
      .set("Authorization", `Bearer ${token}`)
      .send({ items: [{ productId: product._id, qtyOrdered: 5 }] }); // no unitCost
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/productId, qtyOrdered, and unitCost/i);
  });

  test("404 — item productId not found", async () => {
    const { token } = await setup();
    const res = await request(app)
      .post("/api/purchase-orders")
      .set("Authorization", `Bearer ${token}`)
      .send({ items: [{ productId: "000000000000000000000001", qtyOrdered: 5, unitCost: 10 }] });
    expect(res.status).toBe(404);
  });

  test("201 — PO created with auto poNumber, computed totalOrderedCost, draft status", async () => {
    const { product, token } = await setup();
    const res = await request(app)
      .post("/api/purchase-orders")
      .set("Authorization", `Bearer ${token}`)
      .send({
        supplierName: "My Supplier",
        store: "Main Store",
        items: [{ productId: product._id, qtyOrdered: 10, unitCost: 8 }],
      });

    expect(res.status).toBe(201);
    expect(res.body.purchaseOrder.poNumber).toMatch(/^PO-\d{6}-\d{4}$/);
    expect(res.body.purchaseOrder.totalOrderedCost).toBe(80); // 10 × 8
    expect(res.body.purchaseOrder.status).toBe("draft");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/purchase-orders/:id
// ─────────────────────────────────────────────────────────────────────────────
describe("PUT /api/purchase-orders/:id", () => {
  test("404 — PO not found", async () => {
    const { token } = await setup();
    const res = await request(app)
      .put("/api/purchase-orders/000000000000000000000001")
      .set("Authorization", `Bearer ${token}`)
      .send({ notes: "X" });
    expect(res.status).toBe(404);
  });

  test("400 — cannot edit a non-draft PO", async () => {
    const { product, token } = await setup();
    const sentPo = await createPurchaseOrder(product, { status: "sent" });

    const res = await request(app)
      .put(`/api/purchase-orders/${sentPo._id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ notes: "trying to update sent PO" });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Only draft orders can be edited/i);
  });

  test("200 — notes and expectedDate updated on draft PO", async () => {
    const { po, token } = await setup();
    const res = await request(app)
      .put(`/api/purchase-orders/${po._id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ notes: "Rush delivery", expectedDate: "2026-07-01" });

    expect(res.status).toBe(200);
    expect(res.body.purchaseOrder.notes).toBe("Rush delivery");
    expect(res.body.purchaseOrder.expectedDate).toBe("2026-07-01");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/purchase-orders/:id/send
// ─────────────────────────────────────────────────────────────────────────────
describe("PATCH /api/purchase-orders/:id/send", () => {
  test("404 — PO not found", async () => {
    const { token } = await setup();
    const res = await request(app)
      .patch("/api/purchase-orders/000000000000000000000001/send")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  test("400 — already sent (not a draft)", async () => {
    const { product, token } = await setup();
    const sentPo = await createPurchaseOrder(product, { status: "sent" });

    const res = await request(app)
      .patch(`/api/purchase-orders/${sentPo._id}/send`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/already/i);
  });

  test("200 — draft PO status becomes sent; sentAt is set", async () => {
    const { po, token } = await setup();
    const res = await request(app)
      .patch(`/api/purchase-orders/${po._id}/send`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.purchaseOrder.status).toBe("sent");
    expect(res.body.purchaseOrder.sentAt).not.toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/purchase-orders/:id/receive
// ─────────────────────────────────────────────────────────────────────────────
describe("PATCH /api/purchase-orders/:id/receive", () => {
  test("400 — already fully received", async () => {
    const { product, token } = await setup();
    const receivedPo = await createPurchaseOrder(product, { status: "received" });

    const res = await request(app)
      .patch(`/api/purchase-orders/${receivedPo._id}/receive`)
      .set("Authorization", `Bearer ${token}`)
      .send({ items: [{ itemId: receivedPo.items[0]._id.toString(), qtyReceived: 5 }] });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/already received/i);
  });

  test("400 — no items in request body", async () => {
    const { po, token } = await setup();
    const res = await request(app)
      .patch(`/api/purchase-orders/${po._id}/receive`)
      .set("Authorization", `Bearer ${token}`)
      .send({ items: [] });
    expect(res.status).toBe(400);
  });

  test("200 — partial receive increments stock; PO status becomes partial", async () => {
    const { product, po, token } = await setup();
    const stockBefore = product.stock; // 100

    const res = await request(app)
      .patch(`/api/purchase-orders/${po._id}/receive`)
      .set("Authorization", `Bearer ${token}`)
      .send({ items: [{ itemId: po.items[0]._id.toString(), qtyReceived: 5 }] });

    expect(res.status).toBe(200);
    expect(res.body.purchaseOrder.status).toBe("partial"); // 5 of 10 received
    const updated = await Product.findById(product._id);
    expect(updated.stock).toBe(stockBefore + 5);
  });

  test("200 — full receive sets status to received", async () => {
    const { product, po, token } = await setup();
    const orderedQty = po.items[0].qtyOrdered; // 10

    const res = await request(app)
      .patch(`/api/purchase-orders/${po._id}/receive`)
      .set("Authorization", `Bearer ${token}`)
      .send({ items: [{ itemId: po.items[0]._id.toString(), qtyReceived: orderedQty }] });

    expect(res.status).toBe(200);
    expect(res.body.purchaseOrder.status).toBe("received");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/purchase-orders/:id/invoice
// ─────────────────────────────────────────────────────────────────────────────
describe("PATCH /api/purchase-orders/:id/invoice", () => {
  test("404 — PO not found", async () => {
    const { token } = await setup();
    const res = await request(app)
      .patch("/api/purchase-orders/000000000000000000000001/invoice")
      .set("Authorization", `Bearer ${token}`)
      .send({ invoiceAmount: 100 });
    expect(res.status).toBe(404);
  });

  test("400 — invoiceAmount ≤ 0", async () => {
    const { po, token } = await setup();
    const res = await request(app)
      .patch(`/api/purchase-orders/${po._id}/invoice`)
      .set("Authorization", `Bearer ${token}`)
      .send({ invoiceAmount: 0 });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/greater than 0/i);
  });

  test("200 — invoice recorded; balance = invoiceAmount; paymentStatus = unpaid", async () => {
    const { po, token } = await setup();
    const res = await request(app)
      .patch(`/api/purchase-orders/${po._id}/invoice`)
      .set("Authorization", `Bearer ${token}`)
      .send({ invoiceAmount: 400, invoiceNumber: "INV-001", invoiceDate: "2026-06-15" });

    expect(res.status).toBe(200);
    const updated = res.body.purchaseOrder;
    expect(updated.invoiceAmount).toBe(400);
    expect(updated.balance).toBe(400); // amountPaid=0, so balance=invoiceAmount
    expect(updated.paymentStatus).toBe("unpaid");
    expect(updated.invoiceNumber).toBe("INV-001");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/purchase-orders/:id/payments
// ─────────────────────────────────────────────────────────────────────────────
describe("POST /api/purchase-orders/:id/payments", () => {
  // Each test needs a PO with an invoice recorded.
  let token, po;

  beforeEach(async () => {
    const owner = await createUser({ role: "owner", email: "o@test.com", store: "Main Store" });
    token = makeToken({ id: owner._id, role: "owner", store: "Main Store" });
    const product = await createProduct();
    const created = await createPurchaseOrder(product);
    // Record invoice directly so we can control the state precisely
    created.invoiceAmount = 1000;
    created.balance = 1000;
    created.paymentStatus = "unpaid";
    await created.save();
    po = created;
  });

  test("400 — invoice not recorded (invoiceAmount = 0)", async () => {
    const product = await createProduct();
    const noPo = await createPurchaseOrder(product); // invoiceAmount defaults to 0
    const res = await request(app)
      .post(`/api/purchase-orders/${noPo._id}/payments`)
      .set("Authorization", `Bearer ${token}`)
      .send({ amount: 100, method: "cash" });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/invoice/i);
  });

  test("400 — PO already fully paid", async () => {
    po.paymentStatus = "paid";
    await po.save();
    const res = await request(app)
      .post(`/api/purchase-orders/${po._id}/payments`)
      .set("Authorization", `Bearer ${token}`)
      .send({ amount: 100, method: "cash" });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/already fully paid/i);
  });

  test("400 — amount exceeds remaining balance", async () => {
    const res = await request(app)
      .post(`/api/purchase-orders/${po._id}/payments`)
      .set("Authorization", `Bearer ${token}`)
      .send({ amount: 9999, method: "cash" });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/exceeds balance/i);
  });

  test("400 — invalid payment method", async () => {
    const res = await request(app)
      .post(`/api/purchase-orders/${po._id}/payments`)
      .set("Authorization", `Bearer ${token}`)
      .send({ amount: 100, method: "cheque" });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/cash, mpesa, or bank/i);
  });

  test("201 — payment recorded; balance updated; paymentStatus becomes paid when settled", async () => {
    const res = await request(app)
      .post(`/api/purchase-orders/${po._id}/payments`)
      .set("Authorization", `Bearer ${token}`)
      .send({ amount: 1000, method: "mpesa", reference: "MPE123" });

    expect(res.status).toBe(201);
    expect(res.body.payment.amount).toBe(1000);
    expect(res.body.payment.method).toBe("mpesa");
    expect(res.body.purchaseOrder.amountPaid).toBe(1000);
    expect(res.body.purchaseOrder.balance).toBe(0);
    expect(res.body.purchaseOrder.paymentStatus).toBe("paid");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/purchase-orders/:id/payments
// ─────────────────────────────────────────────────────────────────────────────
describe("GET /api/purchase-orders/:id/payments", () => {
  test("200 — returns all payments for PO with total sum", async () => {
    const { po, token } = await setup();
    await createSupplierPayment(po, { amount: 200 });
    await createSupplierPayment(po, { amount: 150 });

    const res = await request(app)
      .get(`/api/purchase-orders/${po._id}/payments`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.payments).toHaveLength(2);
    expect(res.body.total).toBe(350);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/purchase-orders/:id/cancel
// ─────────────────────────────────────────────────────────────────────────────
describe("PATCH /api/purchase-orders/:id/cancel", () => {
  test("403 — manager cannot cancel PO", async () => {
    const manager = await createUser({ role: "manager", email: "m@test.com" });
    const product = await createProduct();
    const po = await createPurchaseOrder(product);
    const token = makeToken({ id: manager._id, role: "manager", store: manager.store });

    const res = await request(app)
      .patch(`/api/purchase-orders/${po._id}/cancel`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  test("400 — cannot cancel a fully received PO", async () => {
    const { token, product } = await setup();
    const receivedPo = await createPurchaseOrder(product, { status: "received" });

    const res = await request(app)
      .patch(`/api/purchase-orders/${receivedPo._id}/cancel`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Cannot cancel a fully received/i);
  });

  test("200 — owner can cancel a draft PO; status becomes cancelled", async () => {
    const { po, token } = await setup();
    const res = await request(app)
      .patch(`/api/purchase-orders/${po._id}/cancel`)
      .set("Authorization", `Bearer ${token}`)
      .send({ reason: "Supplier unavailable" });

    expect(res.status).toBe(200);
    expect(res.body.purchaseOrder.status).toBe("cancelled");
    expect(res.body.purchaseOrder.cancelledAt).not.toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/purchase-orders/:id
// ─────────────────────────────────────────────────────────────────────────────
describe("DELETE /api/purchase-orders/:id", () => {
  test("403 — manager cannot delete PO", async () => {
    const manager = await createUser({ role: "manager", email: "m@test.com" });
    const product = await createProduct();
    const po = await createPurchaseOrder(product);
    const token = makeToken({ id: manager._id, role: "manager", store: manager.store });

    const res = await request(app)
      .delete(`/api/purchase-orders/${po._id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  test("400 — cannot delete a sent PO (not draft or cancelled)", async () => {
    const { product, token } = await setup();
    const sentPo = await createPurchaseOrder(product, { status: "sent" });

    const res = await request(app)
      .delete(`/api/purchase-orders/${sentPo._id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/draft or cancelled/i);
  });

  test("200 — draft PO deleted; no longer findable in DB", async () => {
    const { po, token } = await setup();
    const res = await request(app)
      .delete(`/api/purchase-orders/${po._id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const inDb = await PurchaseOrder.findById(po._id);
    expect(inDb).toBeNull();
  });
});
