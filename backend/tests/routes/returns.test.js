const request = require("supertest");
const createApp = require("../helpers/createApp");
const db = require("../setup/db");
const { makeToken } = require("../helpers/auth");
const { createUser, createProduct } = require("../helpers/seed");
const Sale = require("../../models/Sale");
const Product = require("../../models/Product");

const app = createApp();

beforeAll(() => db.connect());
afterEach(() => db.clear());
afterAll(() => db.close());

// ── Helpers ────────────────────────────────────────────────────────────────
async function createSale(user, items, paymentMethod = "cash") {
  const total = items.reduce((s, i) => s + i.qty * i.price, 0);
  return Sale.create({
    items: items.map(i => ({
      productId:    i.product._id,
      qty:          i.qty,
      price:        i.price,
      buyPrice:     i.product.buyPrice,
      returnStatus: "none",
      voidStatus:   "none",
      voidedQty:    0,
    })),
    total,
    store:     user.store || "Main Store",
    cashierId: user._id,
    cashier:   user.fullname || user.username,
    date:      "2024-06-01",
    time:      "10:00:00 EAT",
    paymentInfo: { paymentMethod, finalTotal: total },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/returns
// ─────────────────────────────────────────────────────────────────────────────
describe("POST /api/returns", () => {
  test("401 — no token", async () => {
    const res = await request(app).post("/api/returns").send({});
    expect(res.status).toBe(401);
  });

  test("400 — missing saleId or items", async () => {
    const cashier = await createUser({ role: "cashier", email: "c@test.com" });
    const token = makeToken({ id: cashier._id, role: "cashier", store: cashier.store });

    const res = await request(app)
      .post("/api/returns")
      .set("Authorization", `Bearer ${token}`)
      .send({ reason: "damaged" });
    expect(res.status).toBe(400);
  });

  test("404 — sale not found", async () => {
    const cashier = await createUser({ role: "cashier", email: "c@test.com" });
    const token = makeToken({ id: cashier._id, role: "cashier", store: cashier.store });

    const res = await request(app)
      .post("/api/returns")
      .set("Authorization", `Bearer ${token}`)
      .send({
        saleId: "000000000000000000000001",
        items:  [{ productId: "000000000000000000000002", qty: 1 }],
        reason: "damaged",
      });
    expect(res.status).toBe(404);
  });

  test("403 — cashier cannot submit return for another cashier's sale", async () => {
    const cashier1 = await createUser({ role: "cashier", email: "c1@test.com" });
    const cashier2 = await createUser({ role: "cashier", email: "c2@test.com" });
    const product  = await createProduct();
    const sale     = await createSale(cashier1, [{ product, qty: 2, price: 50 }]);

    const token = makeToken({ id: cashier2._id, role: "cashier", store: cashier2.store });
    const res = await request(app)
      .post("/api/returns")
      .set("Authorization", `Bearer ${token}`)
      .send({
        saleId: sale._id,
        items:  [{ saleItemId: sale.items[0]._id, productId: product._id, qty: 1 }],
        reason: "wrong item",
      });
    expect(res.status).toBe(403);
  });

  test("400 — returned qty exceeds eligible qty", async () => {
    const cashier = await createUser({ role: "cashier", email: "c@test.com" });
    const product  = await createProduct({ stock: 10 });
    const sale     = await createSale(cashier, [{ product, qty: 2, price: 50 }]);
    const token    = makeToken({ id: cashier._id, role: "cashier", store: cashier.store });

    const res = await request(app)
      .post("/api/returns")
      .set("Authorization", `Bearer ${token}`)
      .send({
        saleId: sale._id,
        items:  [{ saleItemId: sale.items[0]._id, productId: product._id, qty: 5 }],
        reason: "too many",
      });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/exceeds/i);
  });

  test("201 — refundAmount uses stored sale price, not client price", async () => {
    const cashier = await createUser({ role: "cashier", email: "c@test.com" });
    const product  = await createProduct({ stock: 10, sellPrice: 50 });
    const sale     = await createSale(cashier, [{ product, qty: 2, price: 50 }]);
    const token    = makeToken({ id: cashier._id, role: "cashier", store: cashier.store });

    const res = await request(app)
      .post("/api/returns")
      .set("Authorization", `Bearer ${token}`)
      .send({
        saleId: sale._id,
        // client sends inflated price — server must ignore it
        items: [{ saleItemId: sale.items[0]._id, productId: product._id, qty: 1, price: 9999 }],
        reason: "damaged",
      });

    expect(res.status).toBe(201);
    expect(res.body.return.refundAmount).toBe(50); // 1 × stored price 50, not 9999
    expect(res.body.return.items[0].sellPrice).toBe(50);
  });

  test("201 — sale item is marked pending; duplicate detection blocks second request", async () => {
    const cashier = await createUser({ role: "cashier", email: "c@test.com" });
    const product  = await createProduct({ stock: 10 });
    const sale     = await createSale(cashier, [{ product, qty: 3, price: 40 }]);
    const token    = makeToken({ id: cashier._id, role: "cashier", store: cashier.store });

    const first = await request(app)
      .post("/api/returns")
      .set("Authorization", `Bearer ${token}`)
      .send({
        saleId: sale._id,
        items:  [{ saleItemId: sale.items[0]._id, productId: product._id, qty: 1 }],
        reason: "changed mind",
      });
    expect(first.status).toBe(201);

    // Second request while first is still pending
    const second = await request(app)
      .post("/api/returns")
      .set("Authorization", `Bearer ${token}`)
      .send({
        saleId: sale._id,
        items:  [{ saleItemId: sale.items[0]._id, productId: product._id, qty: 1 }],
        reason: "changed mind",
      });
    expect(second.status).toBe(400);
    expect(second.body.message).toMatch(/pending/i);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// REGRESSION: duplicate line items — only the targeted item is affected
// ─────────────────────────────────────────────────────────────────────────────
describe("duplicate line-item return — regression for saleItemId matching", () => {
  test("returning one of two identical-product line items leaves the other untouched", async () => {
    const owner   = await createUser({ role: "owner", email: "o@test.com" });
    const cashier = await createUser({ role: "cashier", email: "c@test.com", store: owner.store });
    const product = await createProduct({ stock: 20, sellPrice: 60, buyPrice: 40 });
    const ownerToken   = makeToken({ id: owner._id,   role: "owner",   store: owner.store });
    const cashierToken = makeToken({ id: cashier._id, role: "cashier", store: cashier.store });

    // Use the actual sale endpoint so stock is properly deducted (3+5=8 units).
    // The same product appears TWICE as separate line items.
    const saleRes = await request(app)
      .post("/api/sales")
      .set("Authorization", `Bearer ${cashierToken}`)
      .send({
        items: [
          { productId: product._id, qty: 3, price: 60 },
          { productId: product._id, qty: 5, price: 60 },
        ],
        total: 480,
        paymentInfo: { paymentMethod: "cash", finalTotal: 480 },
      });
    expect(saleRes.status).toBe(201);
    const sale = saleRes.body.sale;

    const itemA = sale.items[0]; // qty 3 — will NOT be returned
    const itemB = sale.items[1]; // qty 5 — will return 2 of these

    // ── Step 1: submit return targeting itemB by saleItemId ──────────
    const submitRes = await request(app)
      .post("/api/returns")
      .set("Authorization", `Bearer ${cashierToken}`)
      .send({
        saleId: sale._id,
        items: [{
          saleItemId: itemB._id,       // explicitly target the second line item
          productId:  product._id,
          qty:        2,
        }],
        reason: "customer changed mind",
      });

    expect(submitRes.status).toBe(201);
    expect(submitRes.body.return.refundAmount).toBe(120); // 2 × 60

    // Fetch the updated sale and verify only itemB is pending
    const saleAfterSubmit = await Sale.findById(sale._id);
    const savedItemA = saleAfterSubmit.items.id(itemA._id);
    const savedItemB = saleAfterSubmit.items.id(itemB._id);

    expect(savedItemA.returnStatus).toBe("none");   // untouched
    expect(savedItemB.returnStatus).toBe("pending"); // marked pending

    // ── Step 2: owner approves the return ────────────────────────────
    const returnId = submitRes.body.return._id;
    const approveRes = await request(app)
      .patch(`/api/returns/${returnId}/approve`)
      .set("Authorization", `Bearer ${ownerToken}`);

    expect(approveRes.status).toBe(200);

    // ── Step 3: verify only the targeted line item was updated ───────
    const saleAfterApprove = await Sale.findById(sale._id);
    const finalItemA = saleAfterApprove.items.id(itemA._id);
    const finalItemB = saleAfterApprove.items.id(itemB._id);

    expect(finalItemA.returnStatus).toBe("none");    // still untouched
    expect(finalItemA.returnedQty).toBeFalsy();       // no returnedQty set

    expect(finalItemB.returnStatus).toBe("approved");
    expect(finalItemB.returnedQty).toBe(2);           // only 2 returned, not all 5

    // ── Step 4: stock restored by exactly the returned qty (2), not 3+5 ──
    const updatedProduct = await Product.findById(product._id);
    // product started at stock:20, sale deducted 3+5=8, return adds back 2
    expect(updatedProduct.stock).toBe(14);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/returns/:id/approve
// ─────────────────────────────────────────────────────────────────────────────
describe("PATCH /api/returns/:id/approve", () => {
  test("403 — cashier cannot approve returns", async () => {
    const cashier = await createUser({ role: "cashier", email: "c@test.com" });
    const token   = makeToken({ id: cashier._id, role: "cashier", store: cashier.store });

    const res = await request(app)
      .patch("/api/returns/000000000000000000000001/approve")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  test("404 — return record not found", async () => {
    const owner = await createUser({ role: "owner", email: "o@test.com" });
    const token = makeToken({ id: owner._id, role: "owner", store: owner.store });

    const res = await request(app)
      .patch("/api/returns/000000000000000000000001/approve")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  test("400 — already approved", async () => {
    const owner   = await createUser({ role: "owner", email: "o@test.com" });
    const cashier = await createUser({ role: "cashier", email: "c@test.com", store: owner.store });
    const product = await createProduct({ stock: 10 });
    const sale    = await createSale(cashier, [{ product, qty: 2, price: 50 }]);
    const token   = makeToken({ id: owner._id, role: "owner", store: owner.store });

    const submitRes = await request(app)
      .post("/api/returns")
      .set("Authorization", `Bearer ${makeToken({ id: cashier._id, role: "cashier", store: cashier.store })}`)
      .send({
        saleId: sale._id,
        items:  [{ saleItemId: sale.items[0]._id, productId: product._id, qty: 1 }],
        reason: "faulty",
      });

    const returnId = submitRes.body.return._id;
    await request(app)
      .patch(`/api/returns/${returnId}/approve`)
      .set("Authorization", `Bearer ${token}`);

    const again = await request(app)
      .patch(`/api/returns/${returnId}/approve`)
      .set("Authorization", `Bearer ${token}`);
    expect(again.status).toBe(400);
    expect(again.body.message).toMatch(/already been approved/i);
  });

  test("200 — stock restored and sale finalTotal decremented", async () => {
    const owner   = await createUser({ role: "owner", email: "o@test.com" });
    const cashier = await createUser({ role: "cashier", email: "c@test.com", store: owner.store });
    const product = await createProduct({ stock: 10, sellPrice: 80 });
    const sale    = await createSale(cashier, [{ product, qty: 4, price: 80 }]);
    const ownerToken   = makeToken({ id: owner._id,   role: "owner",   store: owner.store });
    const cashierToken = makeToken({ id: cashier._id, role: "cashier", store: cashier.store });

    await request(app)
      .post("/api/returns")
      .set("Authorization", `Bearer ${cashierToken}`)
      .send({
        saleId: sale._id,
        items:  [{ saleItemId: sale.items[0]._id, productId: product._id, qty: 2 }],
        reason: "damaged",
      })
      .then(r => request(app)
        .patch(`/api/returns/${r.body.return._id}/approve`)
        .set("Authorization", `Bearer ${ownerToken}`)
      );

    const updatedProduct = await Product.findById(product._id);
    // createSale inserts directly (no stock deduction), so approve only adds back 2
    expect(updatedProduct.stock).toBe(12); // 10 + 2 returned

    const updatedSale = await Sale.findById(sale._id);
    // original total 320, refund 160 (2 × 80), finalTotal should now be 160
    expect(updatedSale.paymentInfo.finalTotal).toBe(160);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/returns/:id/reject
// ─────────────────────────────────────────────────────────────────────────────
describe("PATCH /api/returns/:id/reject", () => {
  test("200 — sale item returnStatus reset to rejected; stock not touched", async () => {
    const owner   = await createUser({ role: "owner", email: "o@test.com" });
    const cashier = await createUser({ role: "cashier", email: "c@test.com", store: owner.store });
    const product = await createProduct({ stock: 10 });
    const sale    = await createSale(cashier, [{ product, qty: 3, price: 50 }]);
    const ownerToken   = makeToken({ id: owner._id,   role: "owner",   store: owner.store });
    const cashierToken = makeToken({ id: cashier._id, role: "cashier", store: cashier.store });

    const submitRes = await request(app)
      .post("/api/returns")
      .set("Authorization", `Bearer ${cashierToken}`)
      .send({
        saleId: sale._id,
        items:  [{ saleItemId: sale.items[0]._id, productId: product._id, qty: 2 }],
        reason: "wrong size",
      });

    const returnId = submitRes.body.return._id;
    const rejectRes = await request(app)
      .patch(`/api/returns/${returnId}/reject`)
      .set("Authorization", `Bearer ${ownerToken}`);

    expect(rejectRes.status).toBe(200);
    expect(rejectRes.body.return.status).toBe("rejected");

    // Sale item should be rejected; stock should not have changed
    const updatedSale    = await Sale.findById(sale._id);
    const updatedProduct = await Product.findById(product._id);

    expect(updatedSale.items[0].returnStatus).toBe("rejected");
    expect(updatedProduct.stock).toBe(10); // no stock movement on reject
  });
});
