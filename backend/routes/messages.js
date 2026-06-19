const express = require("express");
const router  = require("express").Router();
const Message = require("../models/Message");
const User    = require("../models/User");
const { authMiddleware, ownerOnly } = require("../middleware/authMiddleware");

router.use(authMiddleware);

// ── Helper ───────────────────────────────────────────────────────────
function isReadByUser(message, userId) {
  return message.readBy.some(r => String(r.userId) === String(userId));
}

// ── 0. GET OWNER ID (staff use this to send first message) ───────────
// Staff need the real owner _id before any conversation exists.
// Without this, activeContact.id falls back to the string "owner"
// and User.findById("owner") returns null — message fails silently.
router.get("/owner-id", async (req, res) => {
  try {
    const owner = await User.findOne({ role: "owner" }).select("_id fullname username");
    if (!owner) {
      return res.status(404).json({ success: false, message: "Owner not found." });
    }
    res.json({
      success:  true,
      ownerId:  owner._id,
      ownerName: owner.fullname || owner.username
    });
  } catch (err) {
    console.error("Owner ID fetch error:", err.message);
    res.status(500).json({ success: false, message: "Failed to fetch owner ID." });
  }
});

// ── 1. GET CONVERSATIONS LIST ────────────────────────────────────────
router.get("/conversations", async (req, res) => {
  try {
    const userId = req.user.id;

    const messages = await Message.find({
      $or: [
        { senderId:    userId },
        { receiverId:  userId },
        { isBroadcast: true   }
      ]
    }).sort({ createdAt: -1 });

    const convMap = new Map();

    for (const msg of messages) {
      let otherId, otherName;

      if (msg.isBroadcast) {
        otherId   = "broadcast";
        otherName = "All Staff";
      } else if (String(msg.senderId) === String(userId)) {
        otherId   = String(msg.receiverId);
        otherName = msg.receiverName;
      } else {
        otherId   = String(msg.senderId);
        otherName = msg.senderName;
      }

      if (!convMap.has(otherId)) {
        convMap.set(otherId, {
          otherId,
          otherName,
          lastMessage:   msg.content,
          lastMessageAt: msg.createdAt,
          unreadCount:   0,
          isBroadcast:   msg.isBroadcast
        });
      }

      const isFromOther = String(msg.senderId) !== String(userId);
      if (isFromOther && !isReadByUser(msg, userId)) {
        convMap.get(otherId).unreadCount += 1;
      }
    }

    const conversations = Array.from(convMap.values())
      .sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt));

    res.json({ success: true, conversations });

  } catch (err) {
    console.error("Conversations GET error:", err.message);
    res.status(500).json({ success: false, message: "Failed to fetch conversations." });
  }
});

// ── 2. GET MESSAGE THREAD ────────────────────────────────────────────
router.get("/thread/:userId", async (req, res) => {
  try {
    const currentId = req.user.id;
    const otherId   = req.params.userId;

    let messages;

    if (otherId === "broadcast") {
      messages = await Message.find({ isBroadcast: true }).sort({ createdAt: 1 });
    } else {
      messages = await Message.find({
        $or: [
          { senderId: currentId, receiverId: otherId },
          { senderId: otherId,   receiverId: currentId }
        ]
      }).sort({ createdAt: 1 });
    }

    // Mark unread messages as read
    const unreadIds = messages
      .filter(m =>
        String(m.senderId) !== String(currentId) &&
        !isReadByUser(m, currentId)
      )
      .map(m => m._id);

    if (unreadIds.length > 0) {
      await Message.updateMany(
        { _id: { $in: unreadIds } },
        { $push: { readBy: { userId: currentId, readAt: new Date() } } }
      );

      const io = req.app.get("io");
      if (io && otherId !== "broadcast") {
        io.to(otherId).emit("messages_read", {
          readBy:   currentId,
          threadId: currentId
        });

        const senderUser = await User.findById(otherId).select("role").catch(() => null);
        if (senderUser?.role === "owner") {
          io.to("owner").emit("messages_read", {
            readBy:   currentId,
            threadId: currentId
          });
        }
      }
    }

    res.json({ success: true, messages });

  } catch (err) {
    console.error("Thread GET error:", err.message);
    res.status(500).json({ success: false, message: "Failed to fetch message thread." });
  }
});

// ── 3. SEND DIRECT MESSAGE ───────────────────────────────────────────
router.post("/", async (req, res) => {
  try {
    const { receiverId, content } = req.body;

    if (!receiverId || !content || !content.trim()) {
      return res.status(400).json({
        success: false,
        message: "Receiver and message content are required."
      });
    }

    const receiver = await User.findById(receiverId).select("fullname username role");
    if (!receiver) {
      return res.status(404).json({ success: false, message: "Recipient not found." });
    }

    // Staff can only message the owner
    if (req.user.role !== "owner") {
      const owner = await User.findOne({ role: "owner" }).select("_id");
      if (!owner || String(receiverId) !== String(owner._id)) {
        return res.status(403).json({
          success: false,
          message: "Staff members can only send messages to the owner."
        });
      }
    }

    const message = new Message({
      senderId:     req.user.id,
      // JWT payload has name: user.fullname || user.username — always correct
      senderName:   req.user.name || req.user.fullname || "Unknown",
      senderRole:   req.user.role,
      receiverId,
      receiverName: receiver.fullname || receiver.username,
      content:      content.trim(),
      isBroadcast:  false,
      readBy:       []
    });

    await message.save();

    const io = req.app.get("io");
    if (io) {
      const payload = {
        message,
        from: req.user.name || req.user.fullname || "Unknown"
      };

      // Emit to receiver's personal ID room only.
      // Do NOT also emit to "owner" room — the owner's socket joins both
      // rooms, so a second emit would deliver the event twice and
      // double-increment the unread badge.
      io.to(String(receiverId)).emit("new_message", payload);
    }

    res.status(201).json({ success: true, message });

  } catch (err) {
    console.error("Send message error:", err.message);
    res.status(500).json({ success: false, message: "Failed to send message.", error: err.message });
  }
});

// ── 4. BROADCAST TO ALL STAFF (owner only) ───────────────────────────
router.post("/broadcast", ownerOnly, async (req, res) => {
  try {
    const { content } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({
        success: false,
        message: "Broadcast message content is required."
      });
    }

    const message = new Message({
      senderId:     req.user.id,
      senderName:   req.user.name || req.user.fullname || "Owner",
      senderRole:   "owner",
      receiverId:   null,
      receiverName: "",
      content:      content.trim(),
      isBroadcast:  true,
      readBy:       [{ userId: req.user.id, readAt: new Date() }]
    });

    await message.save();

    const io = req.app.get("io");
    if (io) {
      io.emit("new_message", {
        message,
        from:        req.user.name || req.user.fullname || "Owner",
        isBroadcast: true
      });
    }

    res.status(201).json({ success: true, message });

  } catch (err) {
    console.error("Broadcast error:", err.message);
    res.status(500).json({ success: false, message: "Failed to send broadcast.", error: err.message });
  }
});

// ── 5. GET UNREAD COUNT ──────────────────────────────────────────────
router.get("/unread-count", async (req, res) => {
  try {
    const userId = req.user.id;

    const unreadCount = await Message.countDocuments({
      $or: [
        { receiverId:  userId },
        { isBroadcast: true   }
      ],
      senderId:        { $ne: userId },
      "readBy.userId": { $ne: userId }
    });

    res.json({ success: true, unreadCount });

  } catch (err) {
    console.error("Unread count error:", err.message);
    res.status(500).json({ success: false, message: "Failed to fetch unread count." });
  }
});

module.exports = router;
