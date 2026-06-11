const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    // ── Sender ──────────────────────────────────────────────────────
    senderId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      "User",
      required: true
    },
    senderName: {
      type:     String,
      required: true,
      trim:     true
    },
    senderRole: {
      type: String,
      enum: ["owner", "manager", "cashier", "employee"],
      required: true
    },

    // ── Receiver ─────────────────────────────────────────────────────
    // null when isBroadcast is true
    receiverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref:  "User",
      default: null
    },
    receiverName: {
      type:    String,
      trim:    true,
      default: ""
    },

    // ── Content ──────────────────────────────────────────────────────
    content: {
      type:     String,
      required: [true, "Message content is required"],
      trim:     true,
      maxlength: [1000, "Message cannot exceed 1000 characters"]
    },

    // ── Broadcast flag ───────────────────────────────────────────────
    // true = sent to all staff, receiverId is null
    isBroadcast: {
      type:    Boolean,
      default: false
    },

    // ── Read receipts ────────────────────────────────────────────────
    // Array of { userId, readAt } — one entry per user who read it
    readBy: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref:  "User"
        },
        readAt: {
          type:    Date,
          default: Date.now
        }
      }
    ]
  },
  { timestamps: true }
);

// ── Indexes for fast conversation queries ────────────────────────────
// Fetch all messages between two users
messageSchema.index({ senderId: 1, receiverId: 1, createdAt: -1 });

// Fetch all broadcast messages
messageSchema.index({ isBroadcast: 1, createdAt: -1 });

// Fetch all messages involving a user (sent or received)
messageSchema.index({ receiverId: 1, createdAt: -1 });

module.exports = mongoose.models.Message || mongoose.model("Message", messageSchema);