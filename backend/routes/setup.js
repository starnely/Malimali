const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const Setting = require('../models/Setting');
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const { authMiddleware, ownerOnly } = require('../middleware/authMiddleware');

// 1. Configure Multer for Logo Storage
const storage = multer.diskStorage({
  destination: 'public/uploads/logo/',
  filename: (req, file, cb) => {
    cb(null, 'client-logo-' + Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

// 2. Status Check
router.get('/status', async (req, res) => {
  try {
    const settings = await Setting.findOne();
    const ownerExists = await User.findOne({ role: 'owner' });
    res.json({
      isSetup: !!settings,
      hasOwner: !!ownerExists,
      isActivated: !!settings
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Complete Onboarding (Company + Admin + License Check)
router.post('/initialize', upload.single('logo'), async (req, res) => {
  try {
    const {
      companyName, phone, email, location,
      ownerName, ownerEmail, ownerPassword,
      activationCode
    } = req.body;

    if (!ownerPassword || ownerPassword.length < 6) {
      return res.status(400).json({ message: "Failed password: Too short or missing" });
    }

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
      isActivated: true
    });
    await newSettings.save();

    // Create Owner User
    const hashedPassword = await bcrypt.hash(ownerPassword, 10);

    const newOwner = new User({
      fullname: ownerName,
      username: ownerEmail, 
      email: ownerEmail,  
      password: hashedPassword,
      role: 'owner', 
      store: 'Headquarters', 
      shiftStatus: 'closed'
    });

    await newOwner.save();

    res.status(201).json({ success: true, message: "System initialized successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server Error: " + err.message });
  }
});

// 4. Update Settings (Used by the Settings Page)
// Added protection so only the Owner can change shop details
router.put("/update", authMiddleware, ownerOnly, async (req, res) => {
  try {
    const { companyName, email, phone, location } = req.body;

    // {} finds the first/only document in the settings collection
    const updatedSettings = await Setting.findOneAndUpdate(
      {},
      { companyName, email, phone, location },
      { new: true }
    );

    if (!updatedSettings) {
      return res.status(404).json({ success: false, message: "Settings not found" });
    }

    res.json({ success: true, settings: updatedSettings });
  } catch (err) {
    console.error("Update settings error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/details', async (req, res) => {
  try {
    const settings = await Setting.findOne();
    if (!settings) {
      return res.status(404).json({ message: "No settings found" });
    }
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;