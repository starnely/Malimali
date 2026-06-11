const jwt = require("jsonwebtoken");

// ── 1. CORE AUTHENTICATION ───────────────────────────────────────────
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      message: "Authorization header missing or malformed."
    });
  }

  const token = authHeader.split(" ")[1];

  const JWT_SECRET = process.env.JWT_SECRET;
  if (!JWT_SECRET) {
    console.error("CRITICAL: JWT_SECRET is not defined in environment.");
    return res.status(500).json({
      success: false,
      message: "Server configuration error. Please contact support."
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Session expired. Please log in again."
      });
    }
    return res.status(401).json({
      success: false,
      message: "Invalid access token."
    });
  }
}

// ── 2. OWNER ONLY ────────────────────────────────────────────────────
function ownerOnly(req, res, next) {
  if (req.user?.role !== "owner") {
    return res.status(403).json({
      success: false,
      message: "Access denied: Owner clearance required."
    });
  }
  next();
}

// ── 3. MANAGER OR OWNER ──────────────────────────────────────────────
function managerOrOwner(req, res, next) {
  const role = req.user?.role;
  if (role !== "owner" && role !== "manager") {
    return res.status(403).json({
      success: false,
      message: "Access denied: Management clearance required."
    });
  }
  next();
}

// ── 4. STAFF ONLY (cashier / employee / manager) ─────────────────────
function employeeOnly(req, res, next) {
  const role = req.user?.role;
  if (role !== "employee" && role !== "cashier" && role !== "manager") {
    return res.status(403).json({
      success: false,
      message: "Access denied: Staff clearance required."
    });
  }
  next();
}

module.exports = { authMiddleware, ownerOnly, managerOrOwner, employeeOnly };