// ── M-Pesa callback IP allowlist ──────────────────────────────────────
//
// Defense-in-depth only: the callback route never trusts the callback
// PAYLOAD either way (see routes/mpesa.js — every result is re-confirmed
// via the Daraja Query API before anything is written), so a request that
// slips past this check still can't forge a payment on its own. What this
// stops is unrelated traffic hitting the endpoint at all.
//
// Ships in LOG mode by default and stays there until two things are BOTH
// confirmed against real traffic:
//   1. TRUST_PROXY_HOPS (server.js §0b) resolves req.ip correctly — Render's
//      hop count isn't reliably documented.
//   2. MPESA_CALLBACK_IP_ALLOWLIST is populated with Safaricom's actual
//      current callback source IPs — get these from your Daraja account
//      manager / go-live contact, not from a web search. Safaricom does not
//      publish a stable public list; old blog-post IPs are reported to go
//      stale as their infrastructure rotates.
// Flip MPESA_IP_ALLOWLIST_MODE=enforce only once both are verified. Same
// shadow-mode-then-enforce pattern as plugins/tenantScope.js.

function normalizeIp(ip) {
  if (!ip) return "";
  return ip.startsWith("::ffff:") ? ip.slice(7) : ip;
}

function ipToInt(ip) {
  const parts = String(ip).split(".").map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return null;
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

// Accepts a plain IPv4 address ("196.201.214.200") or CIDR ("196.201.212.0/24").
function matchesEntry(clientIpInt, entry) {
  if (clientIpInt === null) return false;

  if (entry.includes("/")) {
    const [rangeIp, prefixStr] = entry.split("/");
    const prefix = parseInt(prefixStr, 10);
    const rangeInt = ipToInt(rangeIp);
    if (rangeInt === null || !Number.isInteger(prefix) || prefix < 0 || prefix > 32) return false;
    const mask = prefix === 0 ? 0 : (0xFFFFFFFF << (32 - prefix)) >>> 0;
    return (clientIpInt & mask) === (rangeInt & mask);
  }

  const entryInt = ipToInt(entry);
  return entryInt !== null && clientIpInt === entryInt;
}

function parseAllowlist() {
  return (process.env.MPESA_CALLBACK_IP_ALLOWLIST || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function mpesaIpAllowlist(req, res, next) {
  const mode = (process.env.MPESA_IP_ALLOWLIST_MODE || "log").toLowerCase();
  const allowlist = parseAllowlist();
  const clientIp = normalizeIp(req.ip);
  const clientIpInt = ipToInt(clientIp);
  const allowed = allowlist.some((entry) => matchesEntry(clientIpInt, entry));

  // Always logged — this is the empirical-verification trail the comment
  // block above depends on. Once both prerequisites are confirmed, every
  // real Safaricom hit should log allowed:true; anything else is either a
  // wrong hop count or genuinely unwanted traffic.
  console.log(
    `[MPesa IP Allowlist] mode=${mode} clientIp=${clientIp} x-forwarded-for="${req.headers["x-forwarded-for"] || ""}" ` +
    `socketRemoteAddress=${req.socket?.remoteAddress || ""} allowlistSize=${allowlist.length} allowed=${allowed}`
  );

  if (mode !== "enforce") return next();

  if (allowlist.length === 0) {
    // Fail closed: an empty allowlist in enforce mode is a misconfiguration,
    // not "allow everyone" — better to loudly reject real Safaricom traffic
    // (immediately noticed) than silently accept forged callbacks.
    console.error("[MPesa IP Allowlist] enforce mode is on but MPESA_CALLBACK_IP_ALLOWLIST is empty — rejecting.");
    return res.status(403).json({ success: false, message: "Forbidden." });
  }

  if (!allowed) {
    return res.status(403).json({ success: false, message: "Forbidden." });
  }

  next();
}

module.exports = { mpesaIpAllowlist };
