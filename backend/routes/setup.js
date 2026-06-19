const express  = require("express");
const router   = express.Router();
const multer   = require("multer");
const path     = require("path");
const fs       = require("fs");
const crypto   = require("crypto");
const Setting  = require("../models/Setting");
const User     = require("../models/User");
const bcrypt   = require("bcryptjs");
const { authMiddleware, ownerOnly } = require("../middleware/authMiddleware");

// ── 1. MULTER CONFIGURATION ──────────────────────────────────────────
const storage = multer.diskStorage({
  destination: "public/uploads/logo/",
  filename: (req, file, cb) => {
    cb(null, "client-logo-" + Date.now() + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  const allowed = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only JPEG, PNG, and WebP images are allowed for logo upload."), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 2 * 1024 * 1024 }
});

// ── 2. SMTP PASSWORD ENCRYPTION (AES-256-CBC) ────────────────────────
// Uses JWT_SECRET as encryption key so no extra env variable needed
const ENCRYPTION_KEY = crypto
  .createHash("sha256")
  .update(process.env.JWT_SECRET || "fallback-key-change-in-production")
  .digest() // returns 32-byte Buffer

function encryptPassword(text) {
  if (!text) return "";
  const iv        = crypto.randomBytes(16);
  const cipher    = crypto.createCipheriv("aes-256-cbc", ENCRYPTION_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  return iv.toString("hex") + ":" + encrypted.toString("hex");
}

function decryptPassword(text) {
  if (!text || !text.includes(":")) return "";
  try {
    const [ivHex, encHex] = text.split(":");
    const iv        = Buffer.from(ivHex, "hex");
    const encrypted = Buffer.from(encHex, "hex");
    const decipher  = crypto.createDecipheriv("aes-256-cbc", ENCRYPTION_KEY, iv);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
  } catch {
    return "";
  }
}

// ── 3. EMAIL VALIDATION HELPER ───────────────────────────────────────
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// ── 4. STATUS CHECK ──────────────────────────────────────────────────
router.get("/status", async (req, res) => {
  try {
    const settings    = await Setting.findOne();
    const ownerExists = await User.findOne({ role: "owner" });
    res.json({
      success:     true,
      isSetup:     !!settings && !!ownerExists,
      hasOwner:    !!ownerExists,
      isActivated: settings ? !!settings.isActivated : false
    });
  } catch (err) {
    console.error("Setup status error:", err.message);
    res.status(500).json({ success: false, message: "Failed to read system status.", error: err.message });
  }
});

// ── 5. GET SETTINGS DETAILS ──────────────────────────────────────────
// Never return the encrypted SMTP password to the frontend
router.get("/details", async (req, res) => {
  try {
    const settings = await Setting.findOne();
    if (!settings) {
      return res.status(404).json({ success: false, message: "System settings not found." });
    }
    // Strip password before sending — frontend never needs it
    const safe = settings.toObject();
    if (safe.smtp) safe.smtp.password = "";
    res.json({ success: true, settings: safe });
  } catch (err) {
    console.error("Setup details error:", err.message);
    res.status(500).json({ success: false, message: "Failed to fetch system settings.", error: err.message });
  }
});

// ── 6. INITIALIZE SYSTEM (first-time setup) ──────────────────────────
router.post("/initialize", upload.single("logo"), async (req, res) => {
  try {
    const {
      companyName, phone, email, location,
      ownerName, ownerEmail, ownerPassword, activationCode
    } = req.body;

    if (!companyName?.trim())  return res.status(400).json({ success: false, message: "Company name is required." });
    if (!ownerName?.trim())    return res.status(400).json({ success: false, message: "Owner name is required." });
    if (!ownerEmail?.trim())   return res.status(400).json({ success: false, message: "Owner email is required." });
    if (!ownerPassword || ownerPassword.length < 6) {
      return res.status(400).json({ success: false, message: "Password must be at least 6 characters." });
    }
    if (ownerEmail && !isValidEmail(ownerEmail.trim())) {
      return res.status(400).json({ success: false, message: "Invalid owner email format." });
    }

    const MASTER_LICENSE_KEY = process.env.ACTIVATION_CODE;
    if (!MASTER_LICENSE_KEY) {
      console.error("CRITICAL: ACTIVATION_CODE is not defined in environment.");
      return res.status(500).json({ success: false, message: "Server configuration error. Contact support." });
    }
    if (activationCode !== MASTER_LICENSE_KEY) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(401).json({ success: false, message: "Invalid activation license key." });
    }

    const existingSettings = await Setting.findOne();
    if (existingSettings) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(400).json({ success: false, message: "System is already initialized." });
    }

    const newSettings = new Setting({
      companyName: companyName.trim(),
      phone:       phone    ? phone.trim()               : "",
      email:       email    ? email.trim().toLowerCase() : "",
      location:    location ? location.trim()            : "",
      logo:        req.file ? `/uploads/logo/${req.file.filename}` : "",
      currency:    "KSh",
      isActivated: true,
      installedAt: new Date()
    });
    await newSettings.save();

    const hashedPassword = await bcrypt.hash(ownerPassword, 10);
    const newOwner = new User({
      fullname:    ownerName.trim(),
      username:    ownerEmail.trim().toLowerCase(),
      email:       ownerEmail.trim().toLowerCase(),
      password:    hashedPassword,
      role:        "owner",
      store:       "Headquarters",
      active:      true,
      isActive:    true,
      shiftStatus: "closed"
    });
    await newOwner.save();

    res.status(201).json({ success: true, message: "System initialized successfully." });

  } catch (err) {
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    if (err.code === 11000) {
      return res.status(409).json({ success: false, message: "This email is already registered." });
    }
    console.error("Setup initialize error:", err.message);
    res.status(500).json({ success: false, message: "Failed to initialize system.", error: err.message });
  }
});

// ── 7. UPDATE SETTINGS (owner only) ─────────────────────────────────
router.put("/update", authMiddleware, ownerOnly, upload.single("logo"), async (req, res) => {
  try {
    const {
      companyName, phone, email, location, currency, taxRate,
      receiptFooter, receiptPrefix, lowStockThreshold, timezone,
      paymentMethods, kraPin, printerType, printerIp,
      // Phase 6 additions
      businessAddress, businessWebsite,
      smtpHost, smtpPort, smtpSecure, smtpUser, smtpPassword, smtpFromName,
    } = req.body;

    const existing = await Setting.findOne();
    if (!existing) {
      return res.status(404).json({ success: false, message: "Settings not found. Run setup first." });
    }

    // ── Basic fields ─────────────────────────────────────────────────
    if (companyName !== undefined)   existing.companyName   = companyName.trim();
    if (phone !== undefined)         existing.phone         = phone.trim();
    if (location !== undefined)      existing.location      = location.trim();
    if (currency !== undefined)      existing.currency      = currency.trim();
    if (receiptFooter !== undefined) existing.receiptFooter = receiptFooter.trim();
    if (receiptPrefix !== undefined) existing.receiptPrefix = receiptPrefix.trim();
    if (timezone !== undefined)      existing.timezone      = timezone.trim();
    if (kraPin !== undefined)        existing.kraPin        = kraPin.trim();
    if (printerIp !== undefined)     existing.printerIp     = printerIp.trim();

    // ── Email validation ──────────────────────────────────────────────
    if (email !== undefined) {
      const emailVal = email.trim().toLowerCase();
      if (emailVal && !isValidEmail(emailVal)) {
        return res.status(400).json({ success: false, message: "Invalid business email address format." });
      }
      existing.email = emailVal;
    }

    // ── Printer type ──────────────────────────────────────────────────
    if (printerType !== undefined) {
      const validTypes = ["usb", "network", "browser"];
      if (!validTypes.includes(printerType)) {
        return res.status(400).json({ success: false, message: "Invalid printer type." });
      }
      existing.printerType = printerType;
    }

    // ── Tax rate ──────────────────────────────────────────────────────
    if (taxRate !== undefined) {
      const parsed = parseFloat(taxRate);
      if (isNaN(parsed) || parsed < 0 || parsed > 1) {
        return res.status(400).json({ success: false, message: "Tax rate must be a decimal between 0 and 1." });
      }
      existing.taxRate = parsed;
    }

    // ── Low stock threshold ───────────────────────────────────────────
    if (lowStockThreshold !== undefined) {
      const parsed = parseInt(lowStockThreshold);
      if (isNaN(parsed) || parsed < 0) {
        return res.status(400).json({ success: false, message: "Low stock threshold must be a positive number." });
      }
      existing.lowStockThreshold = parsed;
    }

    // ── Payment methods ───────────────────────────────────────────────
    if (paymentMethods !== undefined) {
      let methods;
      try {
        methods = Array.isArray(paymentMethods) ? paymentMethods : JSON.parse(paymentMethods);
      } catch {
        methods = String(paymentMethods).split(",").map(m => m.trim()).filter(Boolean);
      }
      const allowed = ["cash", "mpesa", "split", "credit", "card", "bank"];
      const valid   = methods.filter(m => allowed.includes(m));
      if (valid.length === 0) {
        return res.status(400).json({ success: false, message: "At least one valid payment method is required." });
      }
      existing.paymentMethods = valid;
    }

    // ── SMTP settings ─────────────────────────────────────────────────
    if (smtpHost     !== undefined) existing.smtp.host     = smtpHost.trim();
    if (smtpPort     !== undefined) existing.smtp.port     = Number(smtpPort) || 587;
    if (smtpSecure   !== undefined) existing.smtp.secure   = smtpSecure === "true" || smtpSecure === true;
    if (smtpUser     !== undefined) {
      const smtpUserVal = smtpUser.trim().toLowerCase();
      if (smtpUserVal && !isValidEmail(smtpUserVal)) {
        return res.status(400).json({ success: false, message: "Invalid SMTP sender email format." });
      }
      existing.smtp.user = smtpUserVal;
    }
    if (smtpFromName !== undefined) existing.smtp.fromName = smtpFromName.trim();
    // Only update password if a new one was provided
    if (smtpPassword !== undefined && smtpPassword.trim()) {
      existing.smtp.password = encryptPassword(smtpPassword.trim());
    }

    // ── Document info ─────────────────────────────────────────────────
    if (businessAddress !== undefined) existing.businessAddress = businessAddress.trim();
    if (businessWebsite !== undefined) existing.businessWebsite = businessWebsite.trim();

    // ── Logo update ───────────────────────────────────────────────────
    if (req.file) {
      if (existing.logo) {
        const oldPath = path.join(__dirname, "../public", existing.logo);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }
      existing.logo = `/uploads/logo/${req.file.filename}`;
    }

    existing.markModified('smtp');
    await existing.save();

    // Strip password before returning
    const safe = existing.toObject();
    if (safe.smtp) safe.smtp.password = "";
    res.json({ success: true, settings: safe });

  } catch (err) {
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    console.error("Settings update error:", err.message);
    res.status(500).json({ success: false, message: "Failed to update settings.", error: err.message });
  }
});

// ── 8. TEST EMAIL ─────────────────────────────────────────────────────
router.post("/test-email", authMiddleware, ownerOnly, async (req, res) => {
  try {
    const settings = await Setting.findOne();
    if (!settings?.smtp?.host || !settings?.smtp?.user) {
      return res.status(400).json({
        success: false,
        message: "SMTP not configured. Fill in all email settings and save first."
      });
    }

    const nodemailer  = require("nodemailer");
    const transporter = nodemailer.createTransport({
      host:   settings.smtp.host,
      port:   settings.smtp.port || 587,
      secure: settings.smtp.secure || false,
      auth: {
        user: settings.smtp.user,
        pass: decryptPassword(settings.smtp.password),
      },
    });

    // Verify connection first
    await transporter.verify();

    await transporter.sendMail({
      from:    `"${settings.smtp.fromName || settings.companyName}" <${settings.smtp.user}>`,
      to:      settings.smtp.user,
      subject: `✅ Email Configuration Test — ${settings.companyName} POS`,
      html: `
        <div style="font-family:'Segoe UI',sans-serif;max-width:480px;margin:0 auto;padding:24px">
          <div style="background:#0C3660;padding:20px 24px;border-radius:10px 10px 0 0">
            <h2 style="color:white;margin:0;font-size:18px">${settings.companyName}</h2>
          </div>
          <div style="background:white;padding:24px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 10px 10px">
            <div style="background:#D1FAE5;border-left:4px solid #10B981;padding:14px 18px;border-radius:0 8px 8px 0;margin-bottom:20px">
              <h3 style="color:#065F46;margin:0 0 4px">✅ Email Configuration Working</h3>
              <p style="color:#065F46;margin:0;font-size:13px">Your SMTP settings are correctly configured.</p>
            </div>
            <p style="color:#475569;font-size:13px">Purchase Order emails will be sent from:</p>
            <p style="color:#0C3660;font-weight:700;font-size:14px">${settings.smtp.fromName || settings.companyName} &lt;${settings.smtp.user}&gt;</p>
            <hr style="border:none;border-top:1px solid #e2e8f0;margin:16px 0"/>
            <p style="font-size:11px;color:#94A3B8;margin:0">${settings.companyName} POS System · ${new Date().toLocaleDateString()}</p>
          </div>
        </div>
      `,
    });

    res.json({ success: true, message: `Test email sent successfully to ${settings.smtp.user}` });

  } catch (err) {
    console.error("Test email error:", err.message);
    res.status(500).json({
      success: false,
      message: `Email test failed: ${err.message}. Check your SMTP settings.`
    });
  }
});

module.exports = router;
module.exports.decryptPassword = decryptPassword;
