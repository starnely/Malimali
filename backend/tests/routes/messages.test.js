const request = require("supertest");
const createApp = require("../helpers/createApp");
const db = require("../setup/db");
const { makeToken } = require("../helpers/auth");
const { createUser, createMessage } = require("../helpers/seed");
const Message = require("../../models/Message");

const app = createApp();

beforeAll(() => db.connect());
afterEach(() => db.clear());
afterAll(() => db.close());

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/messages/owner-id
// ─────────────────────────────────────────────────────────────────────────────
describe("GET /api/messages/owner-id", () => {
  test("401 — no token", async () => {
    const res = await request(app).get("/api/messages/owner-id");
    expect(res.status).toBe(401);
  });

  test("404 — no owner exists in the database", async () => {
    const cashier = await createUser({ role: "cashier", email: "c@test.com", store: "Main Store" });
    const token = makeToken({ id: cashier._id, role: "cashier", store: "Main Store" });
    const res = await request(app)
      .get("/api/messages/owner-id")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  test("200 — returns ownerId and ownerName", async () => {
    const owner = await createUser({ role: "owner", email: "o@test.com", store: "HQ" });
    const cashier = await createUser({ role: "cashier", email: "c@test.com", store: "Main Store" });
    const token = makeToken({ id: cashier._id, role: "cashier", store: "Main Store" });
    const res = await request(app)
      .get("/api/messages/owner-id")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(String(res.body.ownerId)).toBe(String(owner._id));
    expect(res.body.ownerName).toBe(owner.fullname);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/messages/conversations
// ─────────────────────────────────────────────────────────────────────────────
describe("GET /api/messages/conversations", () => {
  test("401 — no token", async () => {
    const res = await request(app).get("/api/messages/conversations");
    expect(res.status).toBe(401);
  });

  test("returns empty array when the user has no messages", async () => {
    const cashier = await createUser({ role: "cashier", email: "c@test.com", store: "Main Store" });
    const token = makeToken({ id: cashier._id, role: "cashier", store: "Main Store" });
    const res = await request(app)
      .get("/api/messages/conversations")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.conversations).toEqual([]);
  });

  test("multiple messages with the same counterpart produce a single conversation entry", async () => {
    const owner = await createUser({ role: "owner",   email: "o@test.com", store: "HQ" });
    const cashier = await createUser({ role: "cashier", email: "c@test.com", store: "Main Store" });

    await createMessage({ senderId: owner._id,   senderName: owner.fullname,   senderRole: "owner",   receiverId: cashier._id, receiverName: cashier.fullname, content: "Msg 1" });
    await createMessage({ senderId: cashier._id, senderName: cashier.fullname, senderRole: "cashier", receiverId: owner._id,   receiverName: owner.fullname,   content: "Msg 2" });
    await createMessage({ senderId: owner._id,   senderName: owner.fullname,   senderRole: "owner",   receiverId: cashier._id, receiverName: cashier.fullname, content: "Msg 3" });

    const token = makeToken({ id: cashier._id, role: "cashier", store: "Main Store" });
    const res = await request(app)
      .get("/api/messages/conversations")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.conversations.length).toBe(1);
    expect(res.body.conversations[0].otherId).toBe(String(owner._id));
  });

  test("unreadCount reflects unread messages received from the other party", async () => {
    const owner = await createUser({ role: "owner",   email: "o@test.com", store: "HQ" });
    const cashier = await createUser({ role: "cashier", email: "c@test.com", store: "Main Store" });

    // Two unread messages from owner to cashier
    await createMessage({ senderId: owner._id, senderName: owner.fullname, senderRole: "owner", receiverId: cashier._id, receiverName: cashier.fullname, content: "Unread 1", readBy: [] });
    await createMessage({ senderId: owner._id, senderName: owner.fullname, senderRole: "owner", receiverId: cashier._id, receiverName: cashier.fullname, content: "Unread 2", readBy: [] });

    const token = makeToken({ id: cashier._id, role: "cashier", store: "Main Store" });
    const res = await request(app)
      .get("/api/messages/conversations")
      .set("Authorization", `Bearer ${token}`);

    const conv = res.body.conversations.find((c) => c.otherId === String(owner._id));
    expect(conv).toBeDefined();
    expect(conv.unreadCount).toBe(2);
  });

  test("broadcast message appears with otherId='broadcast' and otherName='All Staff'", async () => {
    const owner = await createUser({ role: "owner",   email: "o@test.com", store: "HQ" });
    const cashier = await createUser({ role: "cashier", email: "c@test.com", store: "Main Store" });

    await createMessage({
      senderId: owner._id, senderName: owner.fullname, senderRole: "owner",
      isBroadcast: true, content: "Hello all staff", readBy: [],
    });

    const token = makeToken({ id: cashier._id, role: "cashier", store: "Main Store" });
    const res = await request(app)
      .get("/api/messages/conversations")
      .set("Authorization", `Bearer ${token}`);

    const broadcast = res.body.conversations.find((c) => c.isBroadcast);
    expect(broadcast).toBeDefined();
    expect(broadcast.otherId).toBe("broadcast");
    expect(broadcast.otherName).toBe("All Staff");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/messages/thread/:userId
// ─────────────────────────────────────────────────────────────────────────────
describe("GET /api/messages/thread/:userId", () => {
  test("401 — no token", async () => {
    const res = await request(app).get("/api/messages/thread/someuser");
    expect(res.status).toBe(401);
  });

  test("returns all messages between two users in the thread", async () => {
    const owner = await createUser({ role: "owner",   email: "o@test.com", store: "HQ" });
    const cashier = await createUser({ role: "cashier", email: "c@test.com", store: "Main Store" });

    await createMessage({ senderId: owner._id,   senderName: owner.fullname,   senderRole: "owner",   receiverId: cashier._id, receiverName: cashier.fullname, content: "Hi cashier" });
    await createMessage({ senderId: cashier._id, senderName: cashier.fullname, senderRole: "cashier", receiverId: owner._id,   receiverName: owner.fullname,   content: "Hi owner" });

    const token = makeToken({ id: cashier._id, role: "cashier", store: "Main Store" });
    const res = await request(app)
      .get(`/api/messages/thread/${owner._id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.messages.length).toBe(2);
    const contents = res.body.messages.map((m) => m.content);
    expect(contents).toContain("Hi cashier");
    expect(contents).toContain("Hi owner");
  });

  test("thread/broadcast returns only isBroadcast=true messages", async () => {
    const owner = await createUser({ role: "owner",   email: "o@test.com", store: "HQ" });
    const cashier = await createUser({ role: "cashier", email: "c@test.com", store: "Main Store" });

    await createMessage({ senderId: owner._id, senderName: owner.fullname, senderRole: "owner", isBroadcast: true,  content: "Broadcast msg" });
    await createMessage({ senderId: owner._id, senderName: owner.fullname, senderRole: "owner", receiverId: cashier._id, receiverName: cashier.fullname, content: "Direct msg" });

    const token = makeToken({ id: cashier._id, role: "cashier", store: "Main Store" });
    const res = await request(app)
      .get("/api/messages/thread/broadcast")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.messages.length).toBe(1);
    expect(res.body.messages[0].content).toBe("Broadcast msg");
    expect(res.body.messages[0].isBroadcast).toBe(true);
  });

  test("fetching a thread marks received-unread messages as read (unread-count drops to 0)", async () => {
    const owner = await createUser({ role: "owner",   email: "o@test.com", store: "HQ" });
    const cashier = await createUser({ role: "cashier", email: "c@test.com", store: "Main Store" });

    await createMessage({
      senderId: owner._id, senderName: owner.fullname, senderRole: "owner",
      receiverId: cashier._id, receiverName: cashier.fullname,
      content: "Please read me", readBy: [],
    });

    const token = makeToken({ id: cashier._id, role: "cashier", store: "Main Store" });

    const before = await request(app)
      .get("/api/messages/unread-count")
      .set("Authorization", `Bearer ${token}`);
    expect(before.body.unreadCount).toBe(1);

    await request(app)
      .get(`/api/messages/thread/${owner._id}`)
      .set("Authorization", `Bearer ${token}`);

    const after = await request(app)
      .get("/api/messages/unread-count")
      .set("Authorization", `Bearer ${token}`);
    expect(after.body.unreadCount).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/messages  (send direct message)
// ─────────────────────────────────────────────────────────────────────────────
describe("POST /api/messages", () => {
  test("401 — no token", async () => {
    const res = await request(app).post("/api/messages").send({ receiverId: "x", content: "hello" });
    expect(res.status).toBe(401);
  });

  test("400 — missing content", async () => {
    const owner = await createUser({ role: "owner",   email: "o@test.com", store: "HQ" });
    const cashier = await createUser({ role: "cashier", email: "c@test.com", store: "Main Store" });
    const token = makeToken({ id: cashier._id, role: "cashier", store: "Main Store" });
    const res = await request(app)
      .post("/api/messages")
      .set("Authorization", `Bearer ${token}`)
      .send({ receiverId: String(owner._id) }); // missing content
    expect(res.status).toBe(400);
  });

  test("404 — unknown receiverId", async () => {
    const cashier = await createUser({ role: "cashier", email: "c@test.com", store: "Main Store" });
    const token = makeToken({ id: cashier._id, role: "cashier", store: "Main Store" });
    const res = await request(app)
      .post("/api/messages")
      .set("Authorization", `Bearer ${token}`)
      .send({ receiverId: "000000000000000000000001", content: "hello" });
    expect(res.status).toBe(404);
  });

  test("403 — staff cannot send a direct message to a non-owner peer", async () => {
    const owner   = await createUser({ role: "owner",   email: "o@test.com",  store: "HQ" });
    const cashier1 = await createUser({ role: "cashier", email: "c1@test.com", store: "Main Store" });
    const cashier2 = await createUser({ role: "cashier", email: "c2@test.com", store: "Main Store" });
    const token = makeToken({ id: cashier1._id, role: "cashier", store: "Main Store" });
    const res = await request(app)
      .post("/api/messages")
      .set("Authorization", `Bearer ${token}`)
      .send({ receiverId: String(cashier2._id), content: "Hey peer" });
    expect(res.status).toBe(403);
  });

  test("201 — staff can send a message to the owner", async () => {
    const owner = await createUser({ role: "owner",   email: "o@test.com", store: "HQ" });
    const cashier = await createUser({ role: "cashier", email: "c@test.com",  store: "Main Store" });
    const token = makeToken({ id: cashier._id, role: "cashier", store: "Main Store", name: cashier.fullname });
    const res = await request(app)
      .post("/api/messages")
      .set("Authorization", `Bearer ${token}`)
      .send({ receiverId: String(owner._id), content: "Hi owner" });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.message.content).toBe("Hi owner");
    expect(res.body.message.isBroadcast).toBe(false);
  });

  test("201 — owner can send a message to any staff member", async () => {
    const owner = await createUser({ role: "owner",   email: "o@test.com", store: "HQ" });
    const cashier = await createUser({ role: "cashier", email: "c@test.com",  store: "Main Store" });
    const token = makeToken({ id: owner._id, role: "owner", store: "HQ", name: owner.fullname });
    const res = await request(app)
      .post("/api/messages")
      .set("Authorization", `Bearer ${token}`)
      .send({ receiverId: String(cashier._id), content: "Hi cashier" });

    expect(res.status).toBe(201);
    expect(res.body.message.content).toBe("Hi cashier");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/messages/broadcast
// ─────────────────────────────────────────────────────────────────────────────
describe("POST /api/messages/broadcast", () => {
  test("403 — cashier blocked (ownerOnly)", async () => {
    const cashier = await createUser({ role: "cashier", email: "c@test.com", store: "Main Store" });
    const token = makeToken({ id: cashier._id, role: "cashier", store: "Main Store" });
    const res = await request(app)
      .post("/api/messages/broadcast")
      .set("Authorization", `Bearer ${token}`)
      .send({ content: "Hello all" });
    expect(res.status).toBe(403);
  });

  test("400 — missing content", async () => {
    const owner = await createUser({ role: "owner", email: "o@test.com", store: "HQ" });
    const token = makeToken({ id: owner._id, role: "owner", store: "HQ" });
    const res = await request(app)
      .post("/api/messages/broadcast")
      .set("Authorization", `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(400);
  });

  test("201 — creates broadcast message with isBroadcast=true", async () => {
    const owner = await createUser({ role: "owner", email: "o@test.com", store: "HQ" });
    const token = makeToken({ id: owner._id, role: "owner", store: "HQ", name: owner.fullname });
    const res = await request(app)
      .post("/api/messages/broadcast")
      .set("Authorization", `Bearer ${token}`)
      .send({ content: "Attention all staff" });

    expect(res.status).toBe(201);
    expect(res.body.message.isBroadcast).toBe(true);
    expect(res.body.message.content).toBe("Attention all staff");
    expect(res.body.message.receiverId).toBeNull();
  });

  test("201 — broadcast is auto-marked read by the sender; sender's unread-count stays 0", async () => {
    const owner = await createUser({ role: "owner", email: "o@test.com", store: "HQ" });
    const token = makeToken({ id: owner._id, role: "owner", store: "HQ", name: owner.fullname });

    await request(app)
      .post("/api/messages/broadcast")
      .set("Authorization", `Bearer ${token}`)
      .send({ content: "All hands on deck" });

    const countRes = await request(app)
      .get("/api/messages/unread-count")
      .set("Authorization", `Bearer ${token}`);
    // Sender's own message: senderId === userId → excluded from count
    expect(countRes.body.unreadCount).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/messages/unread-count
// ─────────────────────────────────────────────────────────────────────────────
describe("GET /api/messages/unread-count", () => {
  test("401 — no token", async () => {
    const res = await request(app).get("/api/messages/unread-count");
    expect(res.status).toBe(401);
  });

  test("0 when the user has no messages", async () => {
    const cashier = await createUser({ role: "cashier", email: "c@test.com", store: "Main Store" });
    const token = makeToken({ id: cashier._id, role: "cashier", store: "Main Store" });
    const res = await request(app)
      .get("/api/messages/unread-count")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.unreadCount).toBe(0);
  });

  test("counts unread direct messages sent to the user", async () => {
    const owner = await createUser({ role: "owner",   email: "o@test.com", store: "HQ" });
    const cashier = await createUser({ role: "cashier", email: "c@test.com", store: "Main Store" });

    await createMessage({
      senderId: owner._id, senderName: owner.fullname, senderRole: "owner",
      receiverId: cashier._id, receiverName: cashier.fullname,
      content: "Hey cashier", readBy: [],
    });

    const token = makeToken({ id: cashier._id, role: "cashier", store: "Main Store" });
    const res = await request(app)
      .get("/api/messages/unread-count")
      .set("Authorization", `Bearer ${token}`);
    expect(res.body.unreadCount).toBe(1);
  });

  test("counts unread broadcast messages for non-sender users", async () => {
    const owner = await createUser({ role: "owner",   email: "o@test.com", store: "HQ" });
    const cashier = await createUser({ role: "cashier", email: "c@test.com", store: "Main Store" });

    await createMessage({
      senderId: owner._id, senderName: owner.fullname, senderRole: "owner",
      isBroadcast: true, content: "All-staff notice", readBy: [],
    });

    const token = makeToken({ id: cashier._id, role: "cashier", store: "Main Store" });
    const res = await request(app)
      .get("/api/messages/unread-count")
      .set("Authorization", `Bearer ${token}`);
    expect(res.body.unreadCount).toBe(1);
  });

  test("messages already in readBy are not counted as unread", async () => {
    const owner = await createUser({ role: "owner",   email: "o@test.com", store: "HQ" });
    const cashier = await createUser({ role: "cashier", email: "c@test.com", store: "Main Store" });

    // Message already read by cashier
    await createMessage({
      senderId: owner._id, senderName: owner.fullname, senderRole: "owner",
      receiverId: cashier._id, receiverName: cashier.fullname,
      content: "Already read", readBy: [{ userId: cashier._id }],
    });

    const token = makeToken({ id: cashier._id, role: "cashier", store: "Main Store" });
    const res = await request(app)
      .get("/api/messages/unread-count")
      .set("Authorization", `Bearer ${token}`);
    expect(res.body.unreadCount).toBe(0);
  });
});
