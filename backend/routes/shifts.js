const express = require("express");
const User = require("../models/User");
const { authMiddleware } = require("../middleware/authMiddleware");
const router = express.Router();

// ── GET TODAY'S SHIFT UPDATES ──────────────────────────────────
// This route MUST exist to stop the 404 error
router.get("/today", authMiddleware, async (req, res) => {
  try {
    const closedShifts = await User.find({ 
      role: "employee",
      shiftStatus: "closed"
    }).select("name shiftStatus updatedAt");

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
        time: new Date().toLocaleTimeString("en-KE"),
      });
    }

    res.json({ success: true, employee });
  } catch (err) {
    res.status(500).json({ error: "Failed to close shift" });
  }
});

module.exports = router;