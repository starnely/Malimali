const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { authMiddleware, ownerOnly } = require("../middleware/authMiddleware");

// Staff management is owner/manager visibility — never broadcast to the
// affected cashier's peers, and never include password/hash in the payload.
function broadcastStaffEvent(io, eventName, user) {
  if (!io) return
  io.to("owner").to(`manager-${user.store}`).emit(eventName, {
    _id: user._id, fullname: user.fullname, username: user.username,
    role: user.role, store: user.store, active: user.active,
  })
}

// ── 1. LOGIN ─────────────────────────────────────────────────────────
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: "Username and password are required."
      });
    }

    const sanitized = username.trim();
    const user = await User.findOne({
      username: { $regex: new RegExp(`^${sanitized}$`, "i") }
    });

    if (!user) {
      return res.status(401).json({ success: false, message: "Invalid username or password." });
    }

    if (user.active === false || user.isActive === false) {
      return res.status(403).json({
        success: false,
        message: "Your account has been suspended. Please contact management."
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: "Invalid username or password." });
    }

    const JWT_SECRET = process.env.JWT_SECRET;
    if (!JWT_SECRET) {
      console.error("CRITICAL: JWT_SECRET is not defined in environment.");
      return res.status(500).json({ success: false, message: "Server configuration error. Please contact support." });
    }

    const tokenPayload = {
      id:    user._id,
      role:  user.role,
      name:  user.fullname || user.username,
      store: user.store
    };

    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: "24h" });

    res.json({
      success:     true,
      token,
      id:          user._id,
      _id:         user._id,
      fullname:    user.fullname,
      username:    user.username,
      role:        user.role,
      store:       user.store,
      shiftStatus: user.shiftStatus,
      user: {
        id:          user._id,
        _id:         user._id,
        fullname:    user.fullname,
        username:    user.username,
        role:        user.role,
        store:       user.store,
        shiftStatus: user.shiftStatus
      }
    });

  } catch (err) {
    console.error("Login error:", err.message);
    res.status(500).json({ success: false, message: "Server error during login.", error: err.message });
  }
});

// ── 2. GET ALL EMPLOYEES (owner/manager only) ────────────────────────
router.get("/employees", authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== "owner" && req.user.role !== "manager") {
      return res.status(403).json({ success: false, message: "Access denied: Management clearance required." });
    }

    let query = { role: { $ne: "owner" } };
    if (req.user.role === "manager") {
      query.store = req.user.store;
    }

    // Select approvalPin to check presence, then strip the hash before sending
    const rawEmployees = await User.find(query).select("-password").sort({ createdAt: -1 });
    const employees = rawEmployees.map(u => {
      const obj = u.toObject()
      const hasPinSet = !!obj.approvalPin
      delete obj.approvalPin  // never expose the hash
      obj.hasPinSet = hasPinSet
      return obj
    })
    res.json(employees);

  } catch (err) {
    console.error("Employee fetch error:", err.message);
    res.status(500).json({ success: false, message: "Failed to fetch employee roster.", error: err.message });
  }
});

// ── 3. REGISTER NEW STAFF (owner only) ──────────────────────────────
router.post("/register", authMiddleware, ownerOnly, async (req, res) => {
  try {
    const { fullname, username, email, password, role, store } = req.body;

    if (!fullname || !username || !password) {
      return res.status(400).json({ success: false, message: "Fullname, username, and password are required." });
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, message: "Password must be at least 6 characters." });
    }
    if (role === "owner") {
      return res.status(403).json({ success: false, message: "Cannot create another owner account." });
    }

    const sanitized = username.trim();
    const existingUsername = await User.findOne({
      username: { $regex: new RegExp(`^${sanitized}$`, "i") }
    });
    if (existingUsername) {
      return res.status(409).json({ success: false, message: "This username is already taken. Please choose another." });
    }

    if (email && email.trim()) {
      const existingEmail = await User.findOne({ email: email.trim().toLowerCase() });
      if (existingEmail) {
        return res.status(409).json({ success: false, message: "This email is already registered to another account." });
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      fullname:    fullname.trim(),
      username:    sanitized,
      email:       email ? email.trim().toLowerCase() : "",
      password:    hashedPassword,
      role:        role  || "cashier",
      store:       store || "",
      active:      true,
      isActive:    true,
      shiftStatus: "closed"
    });

    await newUser.save();

    broadcastStaffEvent(req.app.get("io"), "staffCreated", newUser);

    return res.status(201).json({
      success: true,
      message: "Staff account created successfully.",
      user: {
        id:          newUser._id,
        _id:         newUser._id,
        fullname:    newUser.fullname,
        username:    newUser.username,
        email:       newUser.email,
        role:        newUser.role,
        store:       newUser.store,
        active:      newUser.active,
        isActive:    newUser.isActive,
        shiftStatus: newUser.shiftStatus
      }
    });

  } catch (err) {
    if (err.code === 11000) {
      const field = Object.keys(err.keyPattern || {})[0] || "field";
      return res.status(409).json({ success: false, message: `This ${field} is already in use.` });
    }
    console.error("Registration error:", err.message);
    return res.status(500).json({ success: false, message: "Server error during registration.", error: err.message });
  }
});

// ── 4. CHANGE OWN PASSWORD (any authenticated user) ──────────────────
// Owner changes their own password by verifying current password first.
// Staff passwords are managed by the owner via PUT /:id.
router.put("/change-password", authMiddleware, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: "Current password and new password are required." });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: "New password must be at least 6 characters." });
    }
    if (currentPassword === newPassword) {
      return res.status(400).json({ success: false, message: "New password must be different from current password." });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: "Current password is incorrect." });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    return res.json({ success: true, message: "Password changed successfully." });

  } catch (err) {
    console.error("Change password error:", err.message);
    return res.status(500).json({ success: false, message: "Server error during password change.", error: err.message });
  }
});

// ── 5. TOGGLE USER ACTIVE STATUS (owner only) ────────────────────────
router.patch("/:id/toggle", authMiddleware, ownerOnly, async (req, res) => {
  try {
    const { id } = req.params;

    if (id === String(req.user.id)) {
      return res.status(403).json({ success: false, message: "You cannot deactivate your own account." });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, message: "Staff member not found." });
    }
    if (user.role === "owner") {
      return res.status(403).json({ success: false, message: "Owner accounts cannot be deactivated." });
    }

    user.active   = !user.active;
    user.isActive = user.active;
    await user.save();

    const io = req.app.get("io");
    broadcastStaffEvent(io, "staffToggled", user);
    // Deactivation needs to reach the affected user's own live session immediately —
    // their next API call would fail anyway, but this lets the client force a clean logout.
    if (io && !user.active) {
      io.to(String(user._id)).emit("accountDeactivated", { message: "Your account has been deactivated." });
    }

    return res.json({
      success: true,
      message: `Account ${user.active ? "activated" : "deactivated"} successfully.`,
      user: {
        id: user._id, _id: user._id, fullname: user.fullname,
        username: user.username, role: user.role, store: user.store,
        active: user.active, isActive: user.isActive, shiftStatus: user.shiftStatus
      }
    });

  } catch (err) {
    console.error("Toggle status error:", err.message);
    return res.status(500).json({ success: false, message: "Server error during status toggle.", error: err.message });
  }
});

// ── 6. SET OWN APPROVAL PIN (owner sets/changes their own PIN) ───────
// Must be defined BEFORE /:id to prevent Express swallowing it as a param.
router.put("/set-my-pin", authMiddleware, ownerOnly, async (req, res) => {
  try {
    const { currentPassword, pin } = req.body;

    if (!currentPassword || !pin) {
      return res.status(400).json({ success: false, message: "Current password and new PIN are required." });
    }

    const pinStr = String(pin).trim();
    if (!/^\d{4,6}$/.test(pinStr)) {
      return res.status(400).json({ success: false, message: "PIN must be 4–6 digits (numbers only)." });
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: "User not found." });

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: "Current password is incorrect." });
    }

    user.approvalPin = await bcrypt.hash(pinStr, 10);
    await user.save();
    return res.json({ success: true, message: "Approval PIN updated successfully." });

  } catch (err) {
    console.error("Set-my-pin error:", err.message);
    return res.status(500).json({ success: false, message: "Server error.", error: err.message });
  }
});

// ── 7. UPDATE USER PROFILE (owner only) ─────────────────────────────
router.put("/:id", authMiddleware, ownerOnly, async (req, res) => {
  try {
    const { id } = req.params;
    const { fullname, username, email, role, store, password } = req.body;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, message: "Staff member not found." });
    }
    if (role === "owner") {
      return res.status(403).json({ success: false, message: "Cannot assign owner role through this endpoint." });
    }

    if (username && username.trim().toLowerCase() !== user.username.toLowerCase()) {
      const sanitized    = username.trim();
      const existingUser = await User.findOne({ username: { $regex: new RegExp(`^${sanitized}$`, "i") } });
      if (existingUser) {
        return res.status(409).json({ success: false, message: "This username is already taken by another account." });
      }
      user.username = sanitized;
    }

    if (email !== undefined && email.trim().toLowerCase() !== user.email) {
      const existingEmail = await User.findOne({ email: email.trim().toLowerCase(), _id: { $ne: id } });
      if (existingEmail) {
        return res.status(409).json({ success: false, message: "This email is already registered to another account." });
      }
      user.email = email.trim().toLowerCase();
    }

    if (fullname)            user.fullname = fullname.trim();
    if (role)                user.role     = role;
    if (store !== undefined) user.store    = store;

    if (password && password.trim() !== "") {
      if (password.length < 6) {
        return res.status(400).json({ success: false, message: "Password must be at least 6 characters." });
      }
      user.password = await bcrypt.hash(password, 10);
    }

    await user.save();

    broadcastStaffEvent(req.app.get("io"), "staffUpdated", user);

    return res.json({
      success: true,
      message: "Staff profile updated successfully.",
      user: {
        id: user._id, _id: user._id, fullname: user.fullname,
        username: user.username, email: user.email, role: user.role,
        store: user.store, active: user.active, isActive: user.isActive,
        shiftStatus: user.shiftStatus
      }
    });

  } catch (err) {
    if (err.code === 11000) {
      const field = Object.keys(err.keyPattern || {})[0] || "field";
      return res.status(409).json({ success: false, message: `This ${field} is already in use.` });
    }
    console.error("User update error:", err.message);
    return res.status(500).json({ success: false, message: "Server error during profile update.", error: err.message });
  }
});

// ── 8. SET STAFF APPROVAL PIN (owner sets/resets any manager's PIN) ──
router.put("/:id/set-pin", authMiddleware, ownerOnly, async (req, res) => {
  try {
    const { pin } = req.body;

    const pinStr = String(pin || "").trim();
    if (!/^\d{4,6}$/.test(pinStr)) {
      return res.status(400).json({ success: false, message: "PIN must be 4–6 digits (numbers only)." });
    }

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: "Staff member not found." });
    if (user.role !== "manager") {
      return res.status(400).json({ success: false, message: "Approval PINs can only be set for managers." });
    }

    user.approvalPin = await bcrypt.hash(pinStr, 10);
    await user.save();
    return res.json({ success: true, message: `Approval PIN set for ${user.fullname || user.username}.` });

  } catch (err) {
    console.error("Set-staff-pin error:", err.message);
    return res.status(500).json({ success: false, message: "Server error.", error: err.message });
  }
});

// ── 9. DELETE STAFF ACCOUNT (owner only) ────────────────────────────
router.delete("/:id", authMiddleware, ownerOnly, async (req, res) => {
  try {
    const { id } = req.params;

    if (id === String(req.user.id)) {
      return res.status(403).json({ success: false, message: "You cannot delete your own account." });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, message: "Staff member not found." });
    }
    if (user.role === "owner") {
      return res.status(403).json({ success: false, message: "Owner accounts cannot be deleted." });
    }

    await User.findByIdAndDelete(id);

    broadcastStaffEvent(req.app.get("io"), "staffDeleted", user);

    return res.json({ success: true, message: "Staff account permanently removed.", id });

  } catch (err) {
    console.error("Delete user error:", err.message);
    return res.status(500).json({ success: false, message: "Server error during account deletion.", error: err.message });
  }
});

module.exports = router;
