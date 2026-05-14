const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

const { authMiddleware, ownerOnly } = require("../middleware/authMiddleware");

// ── EMPLOYEE ROUTES (Owner Only) ───────────────────────────────────────

// Register new employee (Manager or Cashier)
router.post("/register", authMiddleware, ownerOnly, async (req, res) => {
  try {
    const { username, password, fullname, email, role, store } = req.body;

    const existingUser = await User.findOne({
      $or: [{ username }, { email }]
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "Username or Email already exists"
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const employee = new User({
      username,
      email,
      fullname, // Saved from UI
      password: hashedPassword,
      role,     // Dynamically set to 'manager' or 'cashier'
      store,    // Linked to specific store
      active: true
    });

    await employee.save();
    res.json({ success: true, user: employee });
  } catch (err) {
    console.error("Register error:", err.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Get all employees (Updated to fetch both managers and cashiers)
router.get("/employees", authMiddleware, ownerOnly, async (req, res) => {
  try {
    const employees = await User.find({
      role: { $in: ["manager", "cashier"] }
    }).sort({ createdAt: -1 });

    res.json(employees);
  } catch (err) {
    console.error("Fetch employees error:", err.message);
    res.status(500).json([]);
  }
});

// Update employee
router.put("/:id", authMiddleware, ownerOnly, async (req, res) => {
  try {
    const { fullname, username, email, password, role, store } = req.body;
    const updateData = { fullname, username, email, role, store };

    if (password) updateData.password = await bcrypt.hash(password, 10);

    const user = await User.findByIdAndUpdate(req.params.id, updateData, { new: true });
    res.json({ success: true, user });
  } catch (err) {
    console.error("Update error:", err.message);
    res.status(500).json({ success: false });
  }
});

// Delete employee
router.delete("/:id", authMiddleware, ownerOnly, async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error("Delete error:", err.message);
    res.status(500).json({ success: false });
  }
});

// Toggle employee active status
router.patch("/:id/toggle", authMiddleware, ownerOnly, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    user.active = !user.active;
    await user.save();

    res.json({ success: true, user });
  } catch (err) {
    console.error("Toggle error:", err.message);
    res.status(500).json({ success: false });
  }
});

// ── OWNER SETUP ────────────────────────────────────────────────────────
router.post("/setup", async (req, res) => {
  try {
    const { username, password, name } = req.body;
    const existingOwner = await User.findOne({ role: "owner" });
    if (existingOwner) {
      return res.status(400).json({ success: false, message: "Owner already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const owner = new User({
      username,
      password: hashedPassword,
      role: "owner",
      fullname: name, 
      email: email,
      store: "Headquarters", 
      active: true
    });

    await owner.save();
    res.json({ success: true, id: owner._id, message: "Owner setup complete" });
  } catch (err) {
    console.error("Setup error:", err.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ── LOGIN (Updated with Store & Role) ──────────────────────────────────
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    const user = await User.findOne({ username, active: true });
    if (!user) {
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    // Payload for the JWT
    const payload = {
      id: user._id,
      role: user.role,
      name: user.fullname || user.username,
      store: user.store || "Main Store" // Fallback if store is missing
    };

    const token = jwt.sign(
      payload,
      process.env.JWT_SECRET || "secretkey",
      { expiresIn: "1d" }
    );

    // This JSON object now perfectly matches your AppContext.jsx
    res.json({
      success: true,
      token,
      role: user.role,
      name: user.fullname || user.username,
      store: user.store || "Main Store",
      id: user._id
    });
  } catch (err) {
    console.error("Login error:", err.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ── CHECK SETUP ────────────────────────────────────────────────────────
router.get("/check-setup", async (req, res) => {
  try {
    const owner = await User.findOne({ role: "owner" });
    res.json({ isSetupComplete: !!owner });
  } catch (err) {
    res.status(500).json({ isSetupComplete: false });
  }
});

module.exports = router;