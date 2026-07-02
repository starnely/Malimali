const SANDBOX_BASE = "https://sandbox.safaricom.co.ke";
const LIVE_BASE    = "https://api.safaricom.co.ke";

function getBaseUrl() {
  return process.env.MPESA_ENV === "production" ? LIVE_BASE : SANDBOX_BASE;
}

// In-process token cache — avoids a round-trip per transaction.
// Refreshed automatically 60 s before expiry.
let tokenCache = { token: null, expiresAt: 0 };

async function getAccessToken() {
  if (tokenCache.token && Date.now() < tokenCache.expiresAt) {
    return tokenCache.token;
  }

  const key    = process.env.MPESA_CONSUMER_KEY;
  const secret = process.env.MPESA_CONSUMER_SECRET;
  if (!key || !secret) {
    throw new Error("MPESA_CONSUMER_KEY and MPESA_CONSUMER_SECRET must be set in .env");
  }

  const creds = Buffer.from(`${key}:${secret}`).toString("base64");
  const res = await fetch(
    `${getBaseUrl()}/oauth/v1/generate?grant_type=client_credentials`,
    { headers: { Authorization: `Basic ${creds}` } }
  );

  console.log("[MPesa OAuth] HTTP status:", res.status);

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error("[MPesa OAuth] Failed response body:", text);
    throw new Error(`M-Pesa OAuth failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  console.log("[MPesa OAuth] Token obtained, expires_in:", data.expires_in);
  if (!data.access_token) throw new Error("M-Pesa OAuth returned no access_token");

  tokenCache = {
    token:     data.access_token,
    expiresAt: Date.now() + (parseInt(data.expires_in, 10) - 60) * 1000,
  };

  return tokenCache.token;
}

// YYYYMMDDHHmmss in EAT (+03:00) — what Safaricom expects
function getTimestamp() {
  return new Date(Date.now() + 3 * 60 * 60 * 1000)
    .toISOString()
    .replace(/[^0-9]/g, "")
    .slice(0, 14);
}

// Ensure phone is in 2547XXXXXXXX / 2541XXXXXXXX format
function normalizePhone(phone) {
  let p = String(phone).trim().replace(/\D/g, "");
  if (p.startsWith("0")) p = "254" + p.slice(1);
  if (p.startsWith("7") || p.startsWith("1")) p = "254" + p;
  return p;
}

/**
 * initiateSTKPush — sends a Lipa Na M-Pesa Online (STK Push) request.
 *
 * Returns { merchantRequestId, checkoutRequestId } on success.
 * Throws a descriptive Error on any failure — caller should catch and abort
 * the MongoDB transaction.
 */
async function initiateSTKPush({ phone, amount, accountReference, description }) {
  const shortcode   = process.env.MPESA_SHORTCODE;
  const passkey     = process.env.MPESA_PASSKEY;
  const callbackUrl = process.env.MPESA_CALLBACK_URL;

  if (!shortcode || !passkey || !callbackUrl) {
    throw new Error("MPESA_SHORTCODE, MPESA_PASSKEY, and MPESA_CALLBACK_URL must be set in .env");
  }

  const token     = await getAccessToken();
  const timestamp = getTimestamp();
  const password  = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString("base64");

  const body = {
    BusinessShortCode: shortcode,
    Password:          password,
    Timestamp:         timestamp,
    TransactionType:   "CustomerPayBillOnline",
    Amount:            Math.ceil(Number(amount)),           // M-Pesa requires a positive integer
    PartyA:            normalizePhone(phone),
    PartyB:            shortcode,
    PhoneNumber:       normalizePhone(phone),
    CallBackURL:       callbackUrl,
    AccountReference:  String(accountReference).slice(0, 12), // Safaricom limit: 12 chars
    TransactionDesc:   String(description || "POS Payment").slice(0, 13), // limit: 13 chars
  };

  // TEMPORARY DEBUG — remove before go-live
  console.log("[MPesa STK Debug] Request body:", JSON.stringify({
    BusinessShortCode: body.BusinessShortCode,
    Timestamp:         body.Timestamp,
    Password:          body.Password,
    PartyA:            body.PartyA,
    PartyB:            body.PartyB,
    PhoneNumber:       body.PhoneNumber,
    Amount:            body.Amount,
    CallBackURL:       body.CallBackURL,
    AccountReference:  body.AccountReference,
    TransactionDesc:   body.TransactionDesc,
    _PasswordPreimage: `${shortcode}${passkey}${timestamp}`,
  }, null, 2));

  const res = await fetch(`${getBaseUrl()}/mpesa/stkpush/v1/processrequest`, {
    method:  "POST",
    headers: {
      Authorization:  `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));

  console.log("[MPesa STK Response] HTTP status:", res.status, "| Body:", JSON.stringify(data));

  if (!res.ok || data.ResponseCode !== "0") {
    console.error("[MPesa STK Response] Error — ResponseCode:", data.ResponseCode,
      "| ResponseDescription:", data.ResponseDescription,
      "| errorMessage:", data.errorMessage);
    throw new Error(
      data.errorMessage || data.ResponseDescription || `STK Push failed (HTTP ${res.status})`
    );
  }

  console.log("[MPesa STK Response] Success — CheckoutRequestID:", data.CheckoutRequestID,
    "| MerchantRequestID:", data.MerchantRequestID);

  return {
    merchantRequestId: data.MerchantRequestID,
    checkoutRequestId: data.CheckoutRequestID,
  };
}

/**
 * queryStkStatus — queries Safaricom's STK Push Query API for a given CheckoutRequestID.
 *
 * Returns { resultCode, resultDesc } where:
 *   resultCode === 0    → payment confirmed
 *   resultCode  >  0    → payment failed/cancelled (code matches RESULT_MESSAGES below)
 *   resultCode === -1   → transaction still in progress or query itself failed (leave as pending)
 *
 * Throws only on network-level errors; Safaricom API errors are folded into resultCode -1.
 */
async function queryStkStatus(checkoutRequestId) {
  const shortcode = process.env.MPESA_SHORTCODE;
  const passkey   = process.env.MPESA_PASSKEY;
  if (!shortcode || !passkey) throw new Error("MPESA_SHORTCODE and MPESA_PASSKEY must be set");

  const token     = await getAccessToken();
  const timestamp = getTimestamp();
  const password  = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString("base64");

  const res = await fetch(`${getBaseUrl()}/mpesa/stkpushquery/v1/query`, {
    method:  "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      BusinessShortCode: shortcode,
      Password:          password,
      Timestamp:         timestamp,
      CheckoutRequestID: checkoutRequestId,
    }),
  });

  const data = await res.json().catch(() => ({}));
  console.log("[MPesa STK Query]", checkoutRequestId, "| HTTP:", res.status, "| Body:", JSON.stringify(data));

  // errorCode present means the transaction is still processing or the query failed
  if (data.errorCode || data.errorMessage) {
    console.warn("[MPesa STK Query] Still pending or query error:", data.errorMessage || data.errorCode);
    return { resultCode: -1, resultDesc: data.errorMessage || "In progress" };
  }

  if (!res.ok) {
    console.warn("[MPesa STK Query] HTTP error:", res.status);
    return { resultCode: -1, resultDesc: `HTTP ${res.status}` };
  }

  return {
    resultCode: Number(data.ResultCode ?? -1),
    resultDesc: data.ResultDesc || "",
  };
}

// Maps Safaricom result codes to user-facing messages shown in the POS UI
const RESULT_MESSAGES = {
  1:    "Insufficient M-Pesa balance",
  1032: "Payment was cancelled",
  2001: "Wrong M-Pesa PIN",
  1037: "Customer's phone did not respond",
  1019: "Payment request timed out",
  1001: "Service temporarily unavailable — please try again",
};

function getResultMessage(code, fallback) {
  return RESULT_MESSAGES[Number(code)] || fallback || "Payment failed";
}

module.exports = { getAccessToken, initiateSTKPush, queryStkStatus, getResultMessage };
