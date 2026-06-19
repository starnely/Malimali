
const express = require("express")
const router  = express.Router()
const Product = require("../models/Product")
const { authMiddleware } = require("../middleware/authMiddleware")

router.use(authMiddleware)

// ══════════════════════════════════════════════════════════════════════
//  VARIABLE WEIGHT EAN-13 FORMAT (DIGI SM-500 compatible)
//
//  Full 13-digit structure:
//  Pos:  0    1-5     6-10    11   12
//        "2"  PLU     W×10    "0"  check
//
//  [0]     = "2"  — GS1 variable-weight prefix
//  [1-5]   = PLU number, zero-padded to 5 digits (e.g. "00001")
//  [6-10]  = Weight in grams × 10, zero-padded to 5 digits
//              e.g. 432g → 4320 → "04320"
//              e.g. 50g  → 500  → "00500"
//  [11]    = "0"  — padding digit (ignored by decoder)
//  [12]    = EAN-13 check digit (computed over positions 0-11)
//
//  At checkout: scan → detect starts with "2" and length 13 →
//    plu    = substring(1,6)  → find product
//    weight = substring(6,11) → divide by 10000 to get kg
//    price  = weightKg × pricePerKg
// ══════════════════════════════════════════════════════════════════════

function calcEAN13CheckDigit(digits12) {
  // digits12 must be a 12-character string of digits
  const d = digits12.split("").map(Number)
  const sum = d.reduce((acc, digit, i) => acc + digit * (i % 2 === 0 ? 1 : 3), 0)
  return (10 - (sum % 10)) % 10
}

function generateWeightBarcode(pluNumber, weightGrams) {
  const plu = String(pluNumber).padStart(5, "0")

  // Weight in grams × 10, capped to 5 digits (max 9999.0g)
  const weightEncoded = Math.round(weightGrams * 10)
  const weightStr = String(weightEncoded).padStart(5, "0").slice(-5)

  // 12-digit body: prefix + PLU + weight + padding "0"
  const body12 = `2${plu}${weightStr}0`
  const check  = calcEAN13CheckDigit(body12)

  return `${body12}${check}` // proper 13-digit EAN-13
}

function decodeWeightBarcode(barcode) {
  // Returns { pluNumber, weightKg, isValid } or null if not a weight barcode
  const code = String(barcode).trim()
  if (code.length !== 13 || !code.startsWith("2")) return null

  const plu         = parseInt(code.substring(1, 6), 10)
  const weightRaw   = parseInt(code.substring(6, 11), 10)
  const weightGrams = weightRaw / 10        // e.g. 4320 → 432.0g
  const weightKg    = weightGrams / 1000    // e.g. 432.0g → 0.432 kg

  // Verify check digit
  const expectedCheck = calcEAN13CheckDigit(code.substring(0, 12))
  const actualCheck   = parseInt(code[12], 10)
  const isValid       = expectedCheck === actualCheck

  return { pluNumber: plu, weightKg, weightGrams, isValid }
}

// ── GET ALL WEIGHED PRODUCTS ──────────────────────────────────────────
router.get("/products", async (req, res) => {
  try {
    const filter = { isWeighed: true, isExpired: { $ne: true } }
    if (req.query.store) {
      filter.store = req.query.store
    } else if (req.user.role !== "owner") {
      filter.store = req.user.store
    }

    const products = await Product.find(filter).sort({ name: 1 })
    res.json({ success: true, products })
  } catch (err) {
    console.error("Weigh station products error:", err.message)
    res.status(500).json({ success: false, message: "Failed to fetch weighed products." })
  }
})

// ── GENERATE WEIGHT BARCODE ───────────────────────────────────────────
// POST /api/weigh-station/generate
// Body: { productId, weightGrams }
// Returns: { barcode, weightKg, weightGrams, pricePerKg, totalPrice, productName }
router.post("/generate", async (req, res) => {
  try {
    const { productId, weightGrams } = req.body

    if (!productId || !weightGrams) {
      return res.status(400).json({ success: false, message: "productId and weightGrams are required." })
    }

    const grams = Number(weightGrams)
    if (isNaN(grams) || grams <= 0 || grams > 99990) {
      return res.status(400).json({ success: false, message: "Weight must be between 1g and 9999g." })
    }

    const product = await Product.findById(productId)
    if (!product) return res.status(404).json({ success: false, message: "Product not found." })
    if (!product.isWeighed) return res.status(400).json({ success: false, message: "This product is not a weighed item." })
    if (!product.pluNumber) return res.status(400).json({ success: false, message: "Product has no PLU number assigned. Edit the product to add one." })

    const barcode    = generateWeightBarcode(product.pluNumber, grams)
    const weightKg   = grams / 1000
    const pricePerKg = product.pricePerKg || product.sellPrice || 0
    const totalPrice = Math.round(weightKg * pricePerKg * 100) / 100

    res.json({
      success: true,
      barcode,
      weightGrams: grams,
      weightKg,
      pricePerKg,
      totalPrice,
      productName: product.name,
      productId:   product._id,
      pluNumber:   product.pluNumber,
      store:       product.store,
    })
  } catch (err) {
    console.error("Generate weight barcode error:", err.message)
    res.status(500).json({ success: false, message: "Failed to generate barcode." })
  }
})

// ── DECODE WEIGHT BARCODE ─────────────────────────────────────────────
// POST /api/weigh-station/decode
// Body: { barcode }
// Returns: { product, weightKg, totalPrice }
// Used at checkout to resolve a scanned weight barcode into a cart item
router.post("/decode", async (req, res) => {
  try {
    const { barcode } = req.body
    if (!barcode) return res.status(400).json({ success: false, message: "Barcode is required." })

    const decoded = decodeWeightBarcode(barcode)
    if (!decoded) {
      return res.status(400).json({ success: false, message: "Not a valid weight barcode." })
    }

    if (!decoded.isValid) {
      return res.status(400).json({ success: false, message: "Barcode check digit is invalid." })
    }

    const product = await Product.findOne({
      pluNumber: decoded.pluNumber,
      isWeighed: true,
      isExpired: { $ne: true },
    })

    if (!product) {
      return res.status(404).json({
        success: false,
        message: `No weighed product found with PLU ${decoded.pluNumber}.`,
      })
    }

    const pricePerKg = product.pricePerKg || product.sellPrice || 0
    const totalPrice = Math.round(decoded.weightKg * pricePerKg * 100) / 100

    res.json({
      success: true,
      product: {
        _id:        product._id,
        name:       product.name,
        category:   product.category,
        pluNumber:  product.pluNumber,
        pricePerKg,
        sellPrice:  pricePerKg,  // alias so cart works normally
        buyPrice:   product.buyPrice,
        stock:      product.stock,
        store:      product.store,
        barcode:    barcode,     // keep the scanned barcode as cart identifier
        isWeighed:  true,
      },
      weightKg:   decoded.weightKg,
      weightGrams: decoded.weightGrams,
      totalPrice,
      pricePerKg,
      pluNumber:  decoded.pluNumber,
    })
  } catch (err) {
    console.error("Decode weight barcode error:", err.message)
    res.status(500).json({ success: false, message: "Failed to decode barcode." })
  }
})

// ── EXPORT PLU FILE FOR DIGI SM-500 ──────────────────────────────────
// GET /api/weigh-station/plu-export?store=Main Store
// Returns CSV text that can be loaded onto the DIGI SM-500 scale
// Format: PLU_NO,NAME,UNIT_PRICE,TARE,DEPT
router.get("/plu-export", async (req, res) => {
  try {
    const filter = { isWeighed: true, isExpired: { $ne: true } }
    if (req.query.store && req.query.store !== "All") filter.store = req.query.store

    const products = await Product.find(filter).sort({ pluNumber: 1 })

    const lines = ["PLU_NO,NAME,UNIT_PRICE,TARE,DEPT"]
    for (const p of products) {
      if (!p.pluNumber) continue
      const name  = (p.name || "").replace(/,/g, " ").substring(0, 20).toUpperCase()
      const price = (p.pricePerKg || p.sellPrice || 0).toFixed(2)
      lines.push(`${p.pluNumber},${name},${price},0,1`)
    }

    res.setHeader("Content-Type", "text/csv")
    res.setHeader("Content-Disposition", `attachment; filename="plu-list-${Date.now()}.csv"`)
    res.send(lines.join("\r\n"))
  } catch (err) {
    console.error("PLU export error:", err.message)
    res.status(500).json({ success: false, message: "Failed to export PLU file." })
  }
})

// ── EXPORT HELPERS (used by ScanPanel) ──────────────────────────────
module.exports = router
module.exports.decodeWeightBarcode = decodeWeightBarcode
module.exports.generateWeightBarcode = generateWeightBarcode