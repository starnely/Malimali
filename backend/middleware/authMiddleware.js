// middleware/auth.js
const jwt = require("jsonwebtoken")

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, message: "Authorization header missing or malformed" })
  }

  const token = authHeader.split(" ")[1]
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "secretkey")
    req.user = decoded // { id, role }
    next()
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ success: false, message: "Token expired" })
    }
    return res.status(401).json({ success: false, message: "Invalid token" })
  }
}

function ownerOnly(req, res, next) {
  if (req.user?.role !== "owner") {
    return res.status(403).json({ success: false, message: "Access denied: owner only" })
  }
  next()
}

function employeeOnly(req, res, next) {
  if (req.user?.role !== "employee") {
    return res.status(403).json({ success: false, message: "Access denied: employee only" })
  }
  next()
}

module.exports = { authMiddleware, ownerOnly, employeeOnly }
