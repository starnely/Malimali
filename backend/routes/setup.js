const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const Setting = require('../models/Setting');
const User = require('../models/User');
const bcrypt = require('bcryptjs');

// 1. Configure Multer for Logo Storage
const storage = multer.diskStorage({
  destination: './public/uploads/logo/',
  filename: (req, file, cb) => {
    cb(null, 'client-logo-' + Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

// 2. Initial Check: Is the system already set up?
router.get('/status', async (req, res) => {
  const settings = await Setting.findOne();
  const adminExists = await User.findOne({ role: 'admin' });
  res.json({
    isSetup: !!settings,
    hasAdmin: !!adminExists
  });
});

// 3. Complete Onboarding (Company + Admin + License Check)
router.post('/initialize', upload.single('logo'), async (req, res) => {
  try {
    const {
      companyName, phone, email, location,
      adminName, adminEmail, adminPassword,
      activationCode
    } = req.body;

    // ── THE LICENSE CHECK ──
    // This is your "Master Key". You give this to customers after they pay.
    const MASTER_LICENSE_KEY = "MALI-2026-PRO";

    if (activationCode !== MASTER_LICENSE_KEY) {
      return res.status(401).json({
        success: false,
        error: "Invalid License Key. Access Denied."
      });
    }

    // ── Check if already initialized ──
    const existingSettings = await Setting.findOne();
    if (existingSettings) {
      return res.status(400).json({ error: "System is already initialized." });
    }

    // Create Settings
    const newSettings = new Setting({
      companyName,
      phone,
      email,
      location,
      logo: req.file ? `/uploads/logo/${req.file.filename}` : '',
      setupCompleted: true
    });
    await newSettings.save();

    // Create Admin User
    const hashedPassword = await bcrypt.hash(adminPassword, 10);

    const newAdmin = new User({
      name: adminName,
      username: adminEmail, // 👈 Satisfies 'required: true'
      email: adminEmail,    // Keep this if you have an email field, otherwise remove
      password: hashedPassword,
      role: 'owner',        // 👈 Matches your enum: ["owner", "employee"]
      shiftStatus: 'open'   // 👈 Matches your new shift tracking field
    });

    await newAdmin.save();

    res.status(201).json({ success: true, message: "System initialized successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server Error: " + err.message });
  }
});

router.put("/update", async (req, res) => {
  try {
    const { companyName, email, phone, location } = req.body;
    // Find the first settings document and update it
    const updatedSettings = await Setting.findOneAndUpdate(
      {}, 
      { companyName, email, phone, location },
      { new: true }
    );
    res.json({ success: true, settings: updatedSettings });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;