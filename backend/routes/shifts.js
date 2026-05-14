const express = require("express");
const User = require("../models/User");
const { authMiddleware } = require("../middleware/authMiddleware");
const router = express.Router();

// ── GET TODAY'S SHIFT UPDATES ──────────────────────────────────
router.get("/today", authMiddleware, async (req, res) => {
  try {
    // We define "Today" based on the start and end of the current UTC day
    // to keep filtering consistent regardless of server local time.
    const startOfToday = new Date();
    startOfToday.setUTCHours(0, 0, 0, 0);

    const endOfToday = new Date();
    endOfToday.setUTCHours(23, 59, 59, 999);

    const closedShifts = await User.find({
      role: "employee",
      shiftStatus: "closed",
      // Filter using UTC range for database accuracy
      updatedAt: { 
        $gte: startOfToday, 
        $lte: endOfToday 
      }
    }).select("name shiftStatus updatedAt");

    // We send raw data; the React frontend will use .toLocaleTimeString('en-KE')
    res.json(closedShifts);
  } catch (err) {
    console.error("Error fetching shifts:", err);
    res.status(500).json({ error: "Failed to fetch shifts" });
  }
});

// ── CLOSE SHIFT ────────────────────────────────────────────────
router.patch("/close", authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== "employee") {
      return res.status(403).json({ error: "Only employees can close shifts" });
    }

    const employeeId = req.user.id;
    
    // findByIdAndUpdate will automatically update the 'updatedAt' field 
    // if timestamps: true is set in your Mongoose schema.
    const employee = await User.findByIdAndUpdate(
      employeeId,
      { shiftStatus: "closed" },
      { new: true }
    );

    const io = req.app.get("io");
    if (io) {
      io.to("owner").emit("shiftClosed", {
        employeeId,
        employeeName: employee.name,
        status: "closed",
        // ✅ CRITICAL: Send ISO String. 
        // This allows the owner's dashboard to format it locally.
        time: new Date().toISOString(), 
      });
    }

    res.json({ success: true, employee });
  } catch (err) {
    console.error("Error closing shift:", err);
    res.status(500).json({ error: "Failed to close shift" });
  }
});

module.exports = router;