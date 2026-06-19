const express = require("express")
const router = require("express").Router()
const multer = require("multer")
const path = require("path")
const fs = require("fs")
const PurchaseOrder = require("../models/PurchaseOrder")
const SupplierPayment = require("../models/SupplierPayment")
const Product = require("../models/Product")
const Supplier = require("../models/Supplier")
// NOTE: Expense import removed — supplier payments are covered by COGS,
// not logged as expenses to avoid double-counting in P&L reports.
const { authMiddleware, ownerOnly, managerOrOwner } = require("../middleware/authMiddleware")

// ── Multer for invoice photo uploads ─────────────────────────────────
const invoiceStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, "../public/uploads/invoices")
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    cb(null, dir)
  },
  filename: (req, file, cb) => {
    cb(null, `invoice-${Date.now()}${path.extname(file.originalname)}`)
  },
})
const uploadInvoice = multer({
  storage: invoiceStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ["image/jpeg", "image/jpg", "image/png", "image/webp", "application/pdf"]
    allowed.includes(file.mimetype) ? cb(null, true) : cb(new Error("Only images and PDFs allowed"))
  },
})

router.use((req, res, next) => {
  if (req.method === "GET" && req.path.endsWith("/pdf")) return next()
  authMiddleware(req, res, next)
})

// ── 1. LIST PURCHASE ORDERS ───────────────────────────────────────────
router.get("/", async (req, res) => {
  try {
    const filter = {}
    if (req.query.store) filter.store = req.query.store
    if (req.query.status) filter.status = req.query.status
    if (req.query.supplierId) filter.supplierId = req.query.supplierId
    if (req.query.paymentStatus) filter.paymentStatus = req.query.paymentStatus
    if (req.query.from || req.query.to) {
      filter.date = {}
      if (req.query.from) filter.date.$gte = req.query.from
      if (req.query.to) filter.date.$lte = req.query.to
    }
    const pos = await PurchaseOrder.find(filter)
      .populate("supplierId", "name company phone email")
      .populate("items.productId", "name category stock reorderLevel")
      .sort({ createdAt: -1 })
      .limit(200)
    res.json({ success: true, purchaseOrders: pos, count: pos.length })
  } catch (err) {
    console.error("PO list error:", err.message)
    res.status(500).json({ success: false, message: "Failed to fetch purchase orders." })
  }
})

// ── 2. GET OUTSTANDING POs (unpaid/partial) ───────────────────────────
router.get("/outstanding", async (req, res) => {
  try {
    const filter = {
      paymentStatus: { $in: ["unpaid", "partial"] },
      invoiceAmount: { $gt: 0 },
      status: { $in: ["received", "partial"] },
    }
    if (req.query.store) filter.store = req.query.store
    if (req.query.supplierId) filter.supplierId = req.query.supplierId

    const pos = await PurchaseOrder.find(filter)
      .populate("supplierId", "name company phone email")
      .sort({ invoiceDate: 1 })

    const totalOutstanding = pos.reduce((s, po) => s + (po.balance || 0), 0)
    res.json({ success: true, purchaseOrders: pos, totalOutstanding, count: pos.length })
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to fetch outstanding POs." })
  }
})

// ── SUPPLIER PAYMENTS LIST — used by financial advisory ──────────────
router.get("/supplier-payments", async (req, res) => {
  try {
    const filter = {}
    if (req.query.store) filter.store = req.query.store
    if (req.query.from || req.query.to) {
      filter.date = {}
      if (req.query.from) filter.date.$gte = req.query.from
      if (req.query.to) filter.date.$lte = req.query.to
    }
    const payments = await SupplierPayment.find(filter).sort({ date: -1 })
    const total = payments.reduce((s, p) => s + p.amount, 0)
    res.json({ success: true, payments, total })
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to fetch supplier payments." })
  }
})

// ── 3. GET SINGLE PO ──────────────────────────────────────────────────
router.get("/:id", async (req, res) => {
  try {
    if (["pdf", "send-email", "outstanding"].includes(req.params.id))
      return res.status(404).json({ success: false, message: "Not found." })
    const po = await PurchaseOrder.findById(req.params.id)
      .populate("supplierId", "name company phone address email")
      .populate("items.productId", "name category stock reorderLevel buyPrice sellPrice")
    if (!po) return res.status(404).json({ success: false, message: "Purchase order not found." })
    res.json({ success: true, purchaseOrder: po })
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to fetch purchase order." })
  }
})

// ── 4. CREATE PO ──────────────────────────────────────────────────────
router.post("/", managerOrOwner, async (req, res) => {
  try {
    const { supplierId, supplierName, supplierPhone, store, items, notes, expectedDate } = req.body
    if (!items?.length)
      return res.status(400).json({ success: false, message: "Purchase order must have at least one item." })

    const validatedItems = []
    for (const item of items) {
      if (!item.productId || !item.qtyOrdered || !item.unitCost)
        return res.status(400).json({ success: false, message: "Each item needs productId, qtyOrdered, and unitCost." })
      const product = await Product.findById(item.productId).lean()
      if (!product) return res.status(404).json({ success: false, message: `Product ${item.productId} not found.` })
      validatedItems.push({
        productId: item.productId, productName: product.name,
        unit: product.unit || "pcs",
        qtyOrdered: Number(item.qtyOrdered), qtyReceived: 0,
        unitCost: Number(item.unitCost), receivedCost: 0,
      })
    }

    let sName = supplierName || "Manual / Walk-in"
    let sPhone = supplierPhone || ""
    if (supplierId) {
      const supplier = await Supplier.findById(supplierId).lean()
      if (supplier) { sName = supplier.name; sPhone = supplier.phone }
    }

    const po = await new PurchaseOrder({
      supplierId: supplierId || null, supplierName: sName, supplierPhone: sPhone,
      store: store || "Main Store", items: validatedItems, notes: notes || "",
      expectedDate: expectedDate || "",
      createdBy: req.user?.name || req.user?.username || "",
      createdById: req.user?._id || null, status: "draft",
    }).save()
    res.status(201).json({ success: true, purchaseOrder: po })
  } catch (err) {
    console.error("PO create error:", err.message)
    res.status(500).json({ success: false, message: "Failed to create purchase order.", error: err.message })
  }
})

// ── 5. UPDATE DRAFT PO ───────────────────────────────────────────────
router.put("/:id", managerOrOwner, async (req, res) => {
  try {
    const po = await PurchaseOrder.findById(req.params.id)
    if (!po) return res.status(404).json({ success: false, message: "Purchase order not found." })
    if (po.status !== "draft")
      return res.status(400).json({ success: false, message: "Only draft orders can be edited." })

    const { supplierId, supplierName, supplierPhone, store, items, notes, expectedDate } = req.body
    if (items?.length) {
      const validatedItems = []
      for (const item of items) {
        const product = await Product.findById(item.productId).lean()
        validatedItems.push({
          productId: item.productId, productName: product?.name || item.productName || "",
          unit: product?.unit || item.unit || "pcs",
          qtyOrdered: Number(item.qtyOrdered), qtyReceived: 0,
          unitCost: Number(item.unitCost), receivedCost: 0,
        })
      }
      po.items = validatedItems
    }
    if (supplierId !== undefined) po.supplierId = supplierId || null
    if (supplierName) po.supplierName = supplierName
    if (supplierPhone) po.supplierPhone = supplierPhone
    if (store) po.store = store
    if (notes !== undefined) po.notes = notes
    if (expectedDate !== undefined) po.expectedDate = expectedDate
    await po.save()
    res.json({ success: true, purchaseOrder: po })
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to update purchase order.", error: err.message })
  }
})

// ── 6. MARK AS SENT ───────────────────────────────────────────────────
router.patch("/:id/send", managerOrOwner, async (req, res) => {
  try {
    const po = await PurchaseOrder.findById(req.params.id)
    if (!po) return res.status(404).json({ success: false, message: "Purchase order not found." })
    if (po.status !== "draft")
      return res.status(400).json({ success: false, message: `PO is already ${po.status}.` })
    po.status = "sent"; po.sentAt = new Date()
    po.sentBy = req.user?.name || req.user?.username || ""
    await po.save()
    res.json({ success: true, purchaseOrder: po, message: `PO ${po.poNumber} marked as sent.` })
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to mark PO as sent." })
  }
})

// ── 7. RECEIVE STOCK ──────────────────────────────────────────────────
router.patch("/:id/receive", managerOrOwner, async (req, res) => {
  try {
    const po = await PurchaseOrder.findById(req.params.id)
    if (!po) return res.status(404).json({ success: false, message: "Purchase order not found." })
    if (po.status === "received" || po.status === "cancelled")
      return res.status(400).json({ success: false, message: `PO is already ${po.status}.` })

    const { items: receivedItems } = req.body
    if (!receivedItems?.length)
      return res.status(400).json({ success: false, message: "Provide items with quantities received." })

    const io = req.app.get("io")
    const stockUpdates = [], lowStockAlerts = []

    for (const recv of receivedItems) {
      const poItem = po.items.id(recv.itemId)
      if (!poItem) continue
      const qty = Number(recv.qtyReceived)
      if (qty < 0) continue
      poItem.qtyReceived = poItem.qtyReceived + qty
      poItem.receivedCost = poItem.qtyReceived * poItem.unitCost
      const product = await Product.findByIdAndUpdate(poItem.productId, { $inc: { stock: qty } }, { new: true })
      if (product) {
        stockUpdates.push({ productId: product._id, productName: product.name, qtyAdded: qty, newStock: product.stock })
        if (product.stock <= (product.reorderLevel ?? 5))
          lowStockAlerts.push({ productId: product._id, productName: product.name, stock: product.stock, reorderLevel: product.reorderLevel, store: product.store, unit: product.unit || 'pcs' })
      }
    }

    po.totalReceivedCost = po.items.reduce((s, i) => s + i.receivedCost, 0)
    const allReceived = po.items.every(i => i.qtyReceived >= i.qtyOrdered)
    const anyReceived = po.items.some(i => i.qtyReceived > 0)
    po.status = allReceived ? "received" : anyReceived ? "partial" : po.status
    po.receivedAt = new Date()
    po.receivedBy = req.user?.name || req.user?.username || ""
    await po.save()

    if (io) {
      io.emit("productsUpdated")
      io.to("owner").emit("stockReceived", { poNumber: po.poNumber, supplierName: po.supplierName, stockUpdates, receivedBy: po.receivedBy, time: new Date().toLocaleTimeString() })
      lowStockAlerts.forEach(alert => io.to("owner").emit("lowStockAlert", alert))
    }

    res.json({ success: true, purchaseOrder: po, stockUpdates, message: `Stock updated. PO status: ${po.status}.` })
  } catch (err) {
    console.error("PO receive error:", err.message)
    res.status(500).json({ success: false, message: "Failed to receive stock.", error: err.message })
  }
})

// ── 8. RECORD INVOICE ─────────────────────────────────────────────────
router.patch("/:id/invoice", managerOrOwner, uploadInvoice.single("invoicePhoto"), async (req, res) => {
  try {
    const po = await PurchaseOrder.findById(req.params.id)
    if (!po) return res.status(404).json({ success: false, message: "Purchase order not found." })

    const { invoiceNumber, invoiceAmount, invoiceDate } = req.body

    if (!invoiceAmount || Number(invoiceAmount) <= 0)
      return res.status(400).json({ success: false, message: "Invoice amount is required and must be greater than 0." })

    po.invoiceNumber = invoiceNumber?.trim() || ""
    po.invoiceAmount = Number(invoiceAmount)
    po.invoiceDate = invoiceDate || ""

    if (req.file) {
      if (po.invoicePhoto) {
        const oldPath = path.join(__dirname, "../public", po.invoicePhoto)
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath)
      }
      po.invoicePhoto = `/uploads/invoices/${req.file.filename}`
    }

    po.balance = Math.max(0, po.invoiceAmount - po.amountPaid)
    if (po.balance === 0 && po.invoiceAmount > 0) {
      po.paymentStatus = "paid"
    } else if (po.amountPaid > 0) {
      po.paymentStatus = "partial"
    } else {
      po.paymentStatus = "unpaid"
    }

    await po.save()
    res.json({ success: true, purchaseOrder: po, message: "Invoice recorded." })
  } catch (err) {
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path)
    console.error("Invoice record error:", err.message)
    res.status(500).json({ success: false, message: "Failed to record invoice.", error: err.message })
  }
})

// ── 9. RECORD PAYMENT ─────────────────────────────────────────────────
// NOTE: Supplier payments are NOT auto-logged as expenses.
// Stock cost is already captured via COGS (buyPrice × qty) at point of sale.
// Logging payments as expenses would double-count the same cost in P&L reports.
router.post("/:id/payments", managerOrOwner, async (req, res) => {
  try {
    const po = await PurchaseOrder.findById(req.params.id)
      .populate("supplierId", "name")
    if (!po) return res.status(404).json({ success: false, message: "Purchase order not found." })

    if (!po.invoiceAmount || po.invoiceAmount <= 0)
      return res.status(400).json({ success: false, message: "Record the supplier invoice first before making a payment." })

    if (po.paymentStatus === "paid")
      return res.status(400).json({ success: false, message: "This PO is already fully paid." })

    const { amount, method, reference, notes } = req.body

    if (!amount || Number(amount) <= 0)
      return res.status(400).json({ success: false, message: "Payment amount must be greater than 0." })

    if (!["cash", "mpesa", "bank"].includes(method))
      return res.status(400).json({ success: false, message: "Method must be cash, mpesa, or bank." })

    const payAmount = Number(amount)
    const remaining = po.balance

    if (payAmount > remaining)
      return res.status(400).json({
        success: false,
        message: `Amount exceeds balance. Maximum payable: KSh ${remaining.toLocaleString()}`
      })

    // ── Create supplier payment record ────────────────────────────────
    const payment = await new SupplierPayment({
      poId: po._id,
      poNumber: po.poNumber,
      supplierId: po.supplierId?._id || po.supplierId || null,
      supplierName: po.supplierName,
      store: po.store,
      amount: payAmount,
      method,
      reference: reference?.trim() || "",
      notes: notes?.trim() || "",
      paidBy: req.user?.name || req.user?.username || "",
      paidById: req.user?._id || null,
    }).save()

    // ── Update PO payment totals ──────────────────────────────────────
    po.amountPaid = po.amountPaid + payAmount
    po.balance = Math.max(0, po.invoiceAmount - po.amountPaid)
    po.paymentStatus = po.balance === 0 ? "paid" : "partial"
    await po.save()

    // ── Notify owner via socket ───────────────────────────────────────
    const io = req.app.get("io")
    if (io) {
      io.to("owner").emit("supplierPaymentMade", {
        poNumber: po.poNumber,
        supplierName: po.supplierName,
        amount: payAmount,
        method,
        paidBy: payment.paidBy,
        balance: po.balance,
      })
    }

    res.status(201).json({
      success: true,
      payment,
      purchaseOrder: po,
      message: `Payment of KSh ${payAmount.toLocaleString()} recorded via ${method}.`,
    })
  } catch (err) {
    console.error("Payment error:", err.message)
    res.status(500).json({ success: false, message: "Failed to record payment.", error: err.message })
  }
})

// ── 10. GET PAYMENTS FOR A PO ─────────────────────────────────────────
router.get("/:id/payments", async (req, res) => {
  try {
    const payments = await SupplierPayment.find({ poId: req.params.id }).sort({ createdAt: -1 })
    const total = payments.reduce((s, p) => s + p.amount, 0)
    res.json({ success: true, payments, total })
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to fetch payments." })
  }
})

// ── 11. CANCEL PO ─────────────────────────────────────────────────────
router.patch("/:id/cancel", ownerOnly, async (req, res) => {
  try {
    const po = await PurchaseOrder.findById(req.params.id)
    if (!po) return res.status(404).json({ success: false, message: "Purchase order not found." })
    if (po.status === "received")
      return res.status(400).json({ success: false, message: "Cannot cancel a fully received PO." })
    po.status = "cancelled"; po.cancelledAt = new Date()
    po.cancelledBy = req.user?.name || req.user?.username || ""
    po.cancelReason = req.body.reason || ""
    await po.save()
    res.json({ success: true, purchaseOrder: po, message: `PO ${po.poNumber} cancelled.` })
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to cancel purchase order." })
  }
})

// ── 12. DELETE DRAFT PO ───────────────────────────────────────────────
router.delete("/:id", ownerOnly, async (req, res) => {
  try {
    const po = await PurchaseOrder.findById(req.params.id)
    if (!po) return res.status(404).json({ success: false, message: "Purchase order not found." })
    if (po.status !== "draft" && po.status !== "cancelled")
      return res.status(400).json({ success: false, message: "Only draft or cancelled POs can be deleted." })
    await po.deleteOne()
    res.json({ success: true, message: `PO ${po.poNumber} deleted.` })
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to delete purchase order." })
  }
})

// ── 13. GENERATE PDF ──────────────────────────────────────────────────
router.get("/:id/pdf", async (req, res) => {
  const jwt = require("jsonwebtoken")
  const authHeader = req.headers.authorization
  const token = authHeader?.startsWith("Bearer ") ? authHeader.split(" ")[1] : req.query.token
  if (!token) return res.status(401).json({ success: false, message: "Authorization required." })
  try { req.user = jwt.verify(token, process.env.JWT_SECRET) }
  catch { return res.status(401).json({ success: false, message: "Invalid or expired token." }) }
  const role = req.user?.role
  if (role !== "owner" && role !== "manager")
    return res.status(403).json({ success: false, message: "Access denied." })

  try {
    const po = await PurchaseOrder.findById(req.params.id)
      .populate("supplierId", "name company phone address email")
      .populate("items.productId", "name")
    if (!po) return res.status(404).json({ success: false, message: "Purchase order not found." })

    const Setting = require("../models/Setting")
    const PDFDocument = require("pdfkit")
    const settings = await Setting.findOne()

    const doc = new PDFDocument({ margin: 50, size: "A4" })
    res.setHeader("Content-Type", "application/pdf")
    res.setHeader("Content-Disposition", `attachment; filename="${po.poNumber}.pdf"`)
    doc.pipe(res)

    const C = { primary: "#1E5FA5", dark: "#0C3660", light: "#E6F1FB", muted: "#94A3B8", text: "#0F172A", border: "#E2E8F0", bg: "#F5F7FF" }
    const W = doc.page.width - 100
    const LEFT = 50

    doc.rect(0, 0, doc.page.width, 115).fill(C.dark)
    if (settings?.logo) {
      const logoPath = path.join(__dirname, "../public", settings.logo)
      if (fs.existsSync(logoPath)) { try { doc.image(logoPath, LEFT, 16, { height: 54, fit: [110, 54] }) } catch { } }
    }
    doc.fillColor("white").fontSize(17).font("Helvetica-Bold")
      .text(settings?.companyName || "Company", 190, 20, { width: 360, align: "right" })
    const headerSub = [settings?.businessAddress || settings?.location || "", settings?.phone || "", settings?.email || "", settings?.businessWebsite || ""].filter(Boolean).join("  ·  ")
    doc.fillColor("rgba(255,255,255,0.7)").fontSize(8.5).font("Helvetica").text(headerSub, 190, 44, { width: 360, align: "right" })
    if (settings?.kraPin) doc.fillColor("rgba(255,255,255,0.5)").fontSize(8).text(`KRA PIN: ${settings.kraPin}`, 190, 76, { width: 360, align: "right" })

    doc.rect(0, 115, doc.page.width, 42).fill(C.primary)
    doc.fillColor("white").fontSize(19).font("Helvetica-Bold").text("PURCHASE ORDER", LEFT, 125, { width: W, align: "center" })
    let y = 176

    doc.rect(LEFT, y, W, 46).fill(C.light).stroke(C.border)
    const cw = W / 4
      ;[{ label: "PO NUMBER", value: po.poNumber }, { label: "DATE", value: po.date }, { label: "STATUS", value: po.status.toUpperCase() }, { label: "EXPECTED BY", value: po.expectedDate || "—" }]
        .forEach((col, i) => {
          const x = LEFT + i * cw
          doc.fillColor(C.muted).fontSize(7).font("Helvetica").text(col.label, x + 8, y + 8)
          doc.fillColor(C.dark).fontSize(10).font("Helvetica-Bold").text(col.value, x + 8, y + 20, { width: cw - 12 })
        })
    y += 60

    const hw = (W - 14) / 2
    doc.rect(LEFT, y, hw, 88).stroke(C.border)
    doc.fillColor(C.primary).fontSize(7.5).font("Helvetica-Bold").text("SUPPLIER", LEFT + 10, y + 10)
    doc.fillColor(C.text).fontSize(10).font("Helvetica-Bold").text(po.supplierName || "—", LEFT + 10, y + 23)
    doc.fillColor(C.muted).fontSize(9).font("Helvetica")
      ;[po.supplierId?.company || "", po.supplierId?.phone || po.supplierPhone || "", po.supplierId?.email || "", po.supplierId?.address || ""].filter(Boolean).forEach((l, i) => doc.text(l, LEFT + 10, y + 37 + i * 12))
    const dx = LEFT + hw + 14
    doc.rect(dx, y, hw, 88).stroke(C.border)
    doc.fillColor(C.primary).fontSize(7.5).font("Helvetica-Bold").text("DELIVER TO", dx + 10, y + 10)
    doc.fillColor(C.text).fontSize(10).font("Helvetica-Bold").text(settings?.companyName || "—", dx + 10, y + 23)
    doc.fillColor(C.muted).fontSize(9).font("Helvetica")
      ;[settings?.businessAddress || settings?.location || "", settings?.phone || ""].filter(Boolean).forEach((l, i) => doc.text(l, dx + 10, y + 37 + i * 12))
    y += 102

    const COL = { num: 28, name: 200, qty: 58, unit: 88, total: 90 }
    doc.rect(LEFT, y, W, 22).fill(C.primary)
    doc.fillColor("white").fontSize(8).font("Helvetica-Bold")
    let cx = LEFT + 6
      ;["#", "DESCRIPTION", "QTY", "COST/UNIT", "LINE TOTAL"].forEach((h, i) => {
        const widths = [COL.num, COL.name, COL.qty, COL.unit, COL.total - 6]
        const aligns = ["left", "left", "center", "right", "right"]
        doc.text(h, cx, y + 7, { width: widths[i], align: aligns[i] })
        cx += widths[i]
      })
    y += 22

    po.items.forEach((item, i) => {
      const rh = 26
      doc.rect(LEFT, y, W, rh).fill(i % 2 === 0 ? "white" : C.bg)
      doc.moveTo(LEFT, y + rh).lineTo(LEFT + W, y + rh).strokeColor(C.border).lineWidth(0.4).stroke()
      let rx = LEFT + 6
      doc.fillColor(C.muted).fontSize(8.5).font("Helvetica").text(String(i + 1), rx, y + 7, { width: COL.num }); rx += COL.num
      doc.fillColor(C.text).font("Helvetica-Bold").text(item.productName || "—", rx, y + 7, { width: COL.name - 6 }); rx += COL.name
      doc.fillColor(C.text).font("Helvetica").text(`${item.qtyOrdered} ${item.unit || "pcs"}`, rx, y + 7, { width: COL.qty, align: "center" }); rx += COL.qty
      doc.text(`KSh ${Number(item.unitCost).toLocaleString()}/${item.unit || "pcs"}`, rx, y + 7, { width: COL.unit, align: "right" }); rx += COL.unit
      doc.fillColor(C.primary).font("Helvetica-Bold").text(`KSh ${(item.qtyOrdered * item.unitCost).toLocaleString()}`, rx, y + 7, { width: COL.total - 6, align: "right" })
      y += rh
    })
    y += 10

    const totX = LEFT + W - 220
      ;[{ label: "Subtotal", value: `KSh ${po.totalOrderedCost.toLocaleString()}` }, { label: "Tax (0%)", value: "KSh 0" }].forEach(row => {
        doc.fillColor(C.muted).fontSize(9).font("Helvetica").text(row.label, totX, y + 3, { width: 110 })
        doc.fillColor(C.text).font("Helvetica-Bold").text(row.value, totX + 110, y + 3, { width: 100, align: "right" })
        y += 18
      })
    doc.rect(totX - 8, y - 2, 220, 26).fill(C.primary)
    doc.fillColor("white").fontSize(11).font("Helvetica-Bold")
      .text("GRAND TOTAL", totX, y + 4, { width: 110 })
      .text(`KSh ${po.totalOrderedCost.toLocaleString()}`, totX + 110, y + 4, { width: 100, align: "right" })
    y += 36

    if (po.invoiceAmount > 0) {
      y += 8
      doc.rect(LEFT, y, W, 26).fill(C.light).stroke(C.border)
      doc.fillColor(C.primary).fontSize(8).font("Helvetica-Bold").text("INVOICE & PAYMENT STATUS", LEFT + 10, y + 8)
      y += 26
      const invCols = [
        { label: "Invoice No", value: po.invoiceNumber || "—" },
        { label: "Invoice Amount", value: `KSh ${po.invoiceAmount.toLocaleString()}` },
        { label: "Amount Paid", value: `KSh ${po.amountPaid.toLocaleString()}` },
        { label: "Balance Due", value: `KSh ${po.balance.toLocaleString()}` },
      ]
      const icw = W / 4
      invCols.forEach((col, i) => {
        const x = LEFT + i * icw
        doc.fillColor(C.muted).fontSize(7).font("Helvetica").text(col.label, x + 8, y + 5)
        doc.fillColor(i === 3 && po.balance > 0 ? "#DC2626" : C.dark).fontSize(10).font("Helvetica-Bold").text(col.value, x + 8, y + 17, { width: icw - 12 })
      })
      y += 42
    }

    if (po.notes) {
      doc.rect(LEFT, y, W, 48).stroke(C.border)
      doc.fillColor(C.primary).fontSize(7.5).font("Helvetica-Bold").text("NOTES / SPECIAL INSTRUCTIONS", LEFT + 10, y + 9)
      doc.fillColor(C.muted).fontSize(9).font("Helvetica").text(po.notes, LEFT + 10, y + 22, { width: W - 20 })
      y += 62
    }
    y += 10

    const sw = (W - 20) / 2
    doc.rect(LEFT, y, sw, 68).stroke(C.border)
    doc.fillColor(C.muted).fontSize(7).font("Helvetica").text("PREPARED BY", LEFT + 10, y + 9)
    doc.fillColor(C.text).fontSize(9.5).font("Helvetica-Bold").text(po.createdBy || "—", LEFT + 10, y + 22)
    doc.fillColor(C.muted).fontSize(8).font("Helvetica").text(po.date, LEFT + 10, y + 36)
    doc.moveTo(LEFT + 10, y + 56).lineTo(LEFT + sw - 10, y + 56).strokeColor(C.border).lineWidth(1).stroke()
    doc.fillColor(C.muted).fontSize(7).text("Signature", LEFT + 10, y + 58)
    const ax = LEFT + sw + 20
    doc.rect(ax, y, sw, 68).stroke(C.border)
    doc.fillColor(C.muted).fontSize(7).font("Helvetica").text("AUTHORIZED BY", ax + 10, y + 9)
    doc.fillColor(C.text).fontSize(9.5).font("Helvetica-Bold").text(settings?.companyName || "—", ax + 10, y + 22)
    doc.fillColor(C.muted).fontSize(8).font("Helvetica").text("Owner / Director", ax + 10, y + 36)
    doc.moveTo(ax + 10, y + 56).lineTo(ax + sw - 10, y + 56).strokeColor(C.border).lineWidth(1).stroke()
    doc.fillColor(C.muted).fontSize(7).text("Authorized Signature & Company Stamp", ax + 10, y + 58)
    y += 82

    doc.rect(0, doc.page.height - 38, doc.page.width, 38).fill(C.dark)
    const footerText = [settings?.companyName || "", settings?.phone || "", settings?.email || "", settings?.businessWebsite || ""].filter(Boolean).join("   |   ")
    doc.fillColor("rgba(255,255,255,0.75)").fontSize(8).font("Helvetica").text(footerText, LEFT, doc.page.height - 24, { width: W, align: "center" })
    doc.end()

  } catch (err) {
    console.error("PDF generation error:", err.message)
    if (!res.headersSent) res.status(500).json({ success: false, message: "Failed to generate PDF.", error: err.message })
  }
})

// ── 14. SEND EMAIL TO SUPPLIER ────────────────────────────────────────
router.post("/:id/send-email", managerOrOwner, async (req, res) => {
  try {
    const po = await PurchaseOrder.findById(req.params.id)
      .populate("supplierId", "name company phone email")
      .populate("items.productId", "name")
    if (!po) return res.status(404).json({ success: false, message: "Purchase order not found." })

    const Setting = require("../models/Setting")
    const { decryptPassword } = require("./setup")
    const nodemailer = require("nodemailer")
    const settings = await Setting.findOne()

    if (!settings?.smtp?.host || !settings?.smtp?.user)
      return res.status(400).json({ success: false, message: "SMTP not configured. Go to Settings → Email & Documents to set up email first." })

    const recipientEmail = req.body.recipientEmail || po.supplierId?.email || ""
    const subject = req.body.subject || `Purchase Order ${po.poNumber} — ${settings.companyName}`
    const customMessage = req.body.message || ""

    if (!recipientEmail)
      return res.status(400).json({ success: false, message: "No recipient email. Add an email to this supplier or enter one manually." })
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail))
      return res.status(400).json({ success: false, message: "Invalid recipient email address." })

    const itemsHtml = po.items.map((item, i) => `
      <tr style="background:${i % 2 === 0 ? "#ffffff" : "#F5F7FF"}">
        <td style="padding:10px 14px;border-bottom:1px solid #E2E8F0;color:#0F172A;font-weight:600">${item.productName}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #E2E8F0;text-align:center;color:#475569">${item.qtyOrdered} ${item.unit || "pcs"}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #E2E8F0;text-align:right;color:#475569">KSh ${Number(item.unitCost).toLocaleString()}/${item.unit || "pcs"}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #E2E8F0;text-align:right;font-weight:700;color:#1E5FA5">KSh ${(item.qtyOrdered * item.unitCost).toLocaleString()}</td>
      </tr>`).join("")

    const html = `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#F5F7FF;font-family:'Segoe UI',Arial,sans-serif">
      <div style="max-width:640px;margin:24px auto;padding:0 16px 24px">
        <div style="background:#0C3660;padding:26px 30px;border-radius:12px 12px 0 0">
          <h1 style="color:white;margin:0 0 4px;font-size:20px">${settings.companyName}</h1>
          <p style="color:rgba(255,255,255,0.65);margin:0;font-size:12px">${[settings.businessAddress || settings.location, settings.phone, settings.email].filter(Boolean).join("  ·  ")}</p>
        </div>
        <div style="background:white;padding:30px;border-radius:0 0 12px 12px;box-shadow:0 4px 16px rgba(0,0,0,0.08)">
          <div style="background:#E6F1FB;border-left:4px solid #1E5FA5;padding:14px 18px;border-radius:0 8px 8px 0;margin-bottom:22px">
            <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#1E5FA5;margin-bottom:4px">Purchase Order</div>
            <div style="font-size:22px;font-weight:900;color:#0C3660;font-family:monospace">${po.poNumber}</div>
          </div>
          <p style="color:#334155;margin:0 0 6px;font-size:14px">Dear <strong>${po.supplierName}</strong>,</p>
          <p style="color:#64748B;line-height:1.65;margin:0 0 22px;font-size:13px">Please find below our purchase order. Kindly confirm receipt and advise on the expected delivery date.${customMessage ? `<br/><br/><span style="color:#0F172A">${customMessage}</span>` : ""}</p>
          <table style="width:100%;border-collapse:collapse;margin-bottom:14px;border:1px solid #E2E8F0">
            <thead><tr style="background:#1E5FA5">
              <th style="padding:10px 14px;text-align:left;color:white;font-size:11px;text-transform:uppercase">Product</th>
              <th style="padding:10px 14px;text-align:center;color:white;font-size:11px;text-transform:uppercase">Qty</th>
              <th style="padding:10px 14px;text-align:right;color:white;font-size:11px;text-transform:uppercase">Unit Cost</th>
              <th style="padding:10px 14px;text-align:right;color:white;font-size:11px;text-transform:uppercase">Total</th>
            </tr></thead>
            <tbody>${itemsHtml}</tbody>
          </table>
          <div style="display:flex;justify-content:flex-end;margin-bottom:26px">
            <div style="background:#0C3660;color:white;padding:14px 22px;border-radius:8px;text-align:right;min-width:190px">
              <div style="font-size:10px;opacity:0.65;text-transform:uppercase;margin-bottom:4px">Grand Total</div>
              <div style="font-size:20px;font-weight:900">KSh ${po.totalOrderedCost.toLocaleString()}</div>
            </div>
          </div>
          ${po.notes ? `<div style="background:#FFFBEB;border:1px solid #FDE68A;border-radius:8px;padding:12px 16px;margin-bottom:22px"><div style="font-size:10px;font-weight:700;color:#92400E;text-transform:uppercase;margin-bottom:4px">Notes</div><div style="font-size:13px;color:#78350F">${po.notes}</div></div>` : ""}
          <div style="margin-top:22px;padding:14px 18px;background:#F5F7FF;border-radius:8px;text-align:center">
            <p style="margin:0;font-size:12px;color:#64748B">Please <strong>reply to this email</strong> to confirm receipt.<br/>${settings.companyName} · ${settings.email || settings.smtp.user}${settings.phone ? " · " + settings.phone : ""}</p>
          </div>
        </div>
        <p style="text-align:center;margin:16px 0 0;font-size:11px;color:#94A3B8">Sent by ${settings.companyName} POS System</p>
      </div></body></html>`

    const transporter = nodemailer.createTransport({
      host: settings.smtp.host, port: settings.smtp.port || 587, secure: settings.smtp.secure || false,
      auth: { user: settings.smtp.user, pass: decryptPassword(settings.smtp.password) },
    })
    await transporter.sendMail({ from: `"${settings.smtp.fromName || settings.companyName}" <${settings.smtp.user}>`, to: recipientEmail, subject, html })

    if (po.status === "draft") {
      po.status = "sent"; po.sentAt = new Date()
      po.sentBy = req.user?.name || req.user?.username || ""
      await po.save()
    }
    res.json({ success: true, message: `Email sent successfully to ${recipientEmail}`, poStatus: po.status })
  } catch (err) {
    console.error("Send email error:", err.message)
    res.status(500).json({ success: false, message: `Failed to send email: ${err.message}` })
  }
})

// ── 15. SUPPLIER STATEMENT PDF ────────────────────────────────────────
router.get("/supplier/:supplierId/statement", async (req, res) => {
  const jwt = require("jsonwebtoken")
  const authHeader = req.headers.authorization
  const token = authHeader?.startsWith("Bearer ") ? authHeader.split(" ")[1] : req.query.token
  if (!token) return res.status(401).json({ success: false, message: "Authorization required." })
  try { req.user = jwt.verify(token, process.env.JWT_SECRET) }
  catch { return res.status(401).json({ success: false, message: "Invalid or expired token." }) }
  if (req.user?.role !== "owner" && req.user?.role !== "manager")
    return res.status(403).json({ success: false, message: "Access denied." })

  try {
    const supplier = await Supplier.findById(req.params.supplierId)
    if (!supplier) return res.status(404).json({ success: false, message: "Supplier not found." })

    const pos = await PurchaseOrder.find({ supplierId: req.params.supplierId })
      .sort({ date: -1 }).limit(50)

    const payments = await SupplierPayment.find({ supplierId: req.params.supplierId })
      .sort({ date: -1 })

    const Setting = require("../models/Setting")
    const PDFDocument = require("pdfkit")
    const settings = await Setting.findOne()

    const doc = new PDFDocument({ margin: 50, size: "A4" })
    res.setHeader("Content-Type", "application/pdf")
    res.setHeader("Content-Disposition", `attachment; filename="statement-${supplier.name.replace(/\s+/g, '-')}.pdf"`)
    doc.pipe(res)

    const C = { primary: "#1E5FA5", dark: "#0C3660", light: "#E6F1FB", muted: "#94A3B8", text: "#0F172A", border: "#E2E8F0", bg: "#F5F7FF", danger: "#EF4444", success: "#10B981" }
    const W = doc.page.width - 100
    const LEFT = 50

    doc.rect(0, 0, doc.page.width, 115).fill(C.dark)
    if (settings?.logo) {
      const logoPath = path.join(__dirname, "../public", settings.logo)
      if (fs.existsSync(logoPath)) { try { doc.image(logoPath, LEFT, 16, { height: 54, fit: [110, 54] }) } catch { } }
    }
    doc.fillColor("white").fontSize(17).font("Helvetica-Bold").text(settings?.companyName || "Company", 190, 20, { width: 360, align: "right" })
    doc.fillColor("rgba(255,255,255,0.7)").fontSize(8.5).font("Helvetica")
      .text([settings?.businessAddress || settings?.location || "", settings?.phone || "", settings?.email || ""].filter(Boolean).join("  ·  "), 190, 44, { width: 360, align: "right" })

    doc.rect(0, 115, doc.page.width, 42).fill(C.primary)
    doc.fillColor("white").fontSize(19).font("Helvetica-Bold").text("SUPPLIER STATEMENT", LEFT, 125, { width: W, align: "center" })
    let y = 176

    const hw = (W - 14) / 2
    doc.rect(LEFT, y, hw, 80).stroke(C.border)
    doc.fillColor(C.primary).fontSize(7.5).font("Helvetica-Bold").text("SUPPLIER", LEFT + 10, y + 10)
    doc.fillColor(C.text).fontSize(11).font("Helvetica-Bold").text(supplier.name, LEFT + 10, y + 24)
    doc.fillColor(C.muted).fontSize(9).font("Helvetica")
      ;[supplier.company || "", supplier.phone || "", supplier.email || ""].filter(Boolean).forEach((l, i) => doc.text(l, LEFT + 10, y + 40 + i * 13))

    doc.rect(LEFT + hw + 14, y, hw, 80).stroke(C.border)
    doc.fillColor(C.primary).fontSize(7.5).font("Helvetica-Bold").text("STATEMENT DATE", LEFT + hw + 24, y + 10)
    doc.fillColor(C.dark).fontSize(11).font("Helvetica-Bold").text(new Date().toLocaleDateString("en-KE", { day: "2-digit", month: "long", year: "numeric" }), LEFT + hw + 24, y + 24)

    const totalInvoiced = pos.reduce((s, p) => s + (p.invoiceAmount || 0), 0)
    const totalPaid = payments.reduce((s, p) => s + p.amount, 0)
    const totalBalance = Math.max(0, totalInvoiced - totalPaid)

    doc.fillColor(C.muted).fontSize(8).font("Helvetica").text("Total Invoiced", LEFT + hw + 24, y + 44)
    doc.fillColor(C.text).fontSize(10).font("Helvetica-Bold").text(`KSh ${totalInvoiced.toLocaleString()}`, LEFT + hw + 24, y + 56)
    doc.fillColor(C.muted).fontSize(8).font("Helvetica").text("Balance Due", LEFT + hw + 130, y + 44)
    doc.fillColor(totalBalance > 0 ? C.danger : C.success).fontSize(10).font("Helvetica-Bold").text(`KSh ${totalBalance.toLocaleString()}`, LEFT + hw + 130, y + 56)
    y += 96

    doc.rect(LEFT, y, W, 22).fill(C.primary)
    doc.fillColor("white").fontSize(8).font("Helvetica-Bold")
    const poColW = [80, 90, 90, 80, 80, 80]
      ;["PO Number", "Date", "Invoice No", "Invoice Amt", "Paid", "Balance"].forEach((h, i) => {
        const x = LEFT + poColW.slice(0, i).reduce((s, v) => s + v, 0)
        doc.text(h, x + 6, y + 7, { width: poColW[i] - 6, align: i > 2 ? "right" : "left" })
      })
    y += 22

    pos.forEach((po, i) => {
      const rh = 24
      doc.rect(LEFT, y, W, rh).fill(i % 2 === 0 ? "white" : C.bg)
      doc.moveTo(LEFT, y + rh).lineTo(LEFT + W, y + rh).strokeColor(C.border).lineWidth(0.4).stroke()
      const vals = [po.poNumber, po.date, po.invoiceNumber || "—", po.invoiceAmount ? `KSh ${po.invoiceAmount.toLocaleString()}` : "—", po.amountPaid ? `KSh ${po.amountPaid.toLocaleString()}` : "—", po.balance > 0 ? `KSh ${po.balance.toLocaleString()}` : "✓ Paid"]
      vals.forEach((v, j) => {
        const x = LEFT + poColW.slice(0, j).reduce((s, w) => s + w, 0)
        doc.fillColor(j === 5 && po.balance === 0 ? C.success : j === 5 ? C.danger : C.text)
          .fontSize(9).font(j === 0 ? "Helvetica-Bold" : "Helvetica")
          .text(v, x + 6, y + 7, { width: poColW[j] - 6, align: j > 2 ? "right" : "left" })
      })
      y += rh
    })

    y += 16
    doc.rect(LEFT + W - 220, y, 220, 28).fill(totalBalance > 0 ? "#FEE2E2" : "#D1FAE5")
    doc.fillColor(totalBalance > 0 ? C.danger : C.success).fontSize(11).font("Helvetica-Bold")
      .text("TOTAL BALANCE DUE", LEFT + W - 214, y + 8, { width: 120 })
      .text(`KSh ${totalBalance.toLocaleString()}`, LEFT + W - 94, y + 8, { width: 86, align: "right" })
    y += 44

    if (payments.length > 0) {
      doc.fillColor(C.primary).fontSize(9).font("Helvetica-Bold").text("PAYMENT HISTORY", LEFT, y); y += 16
      doc.rect(LEFT, y, W, 20).fill(C.primary)
      doc.fillColor("white").fontSize(8).font("Helvetica-Bold")
        ;["Date", "PO Number", "Method", "Reference", "Amount"].forEach((h, i) => {
          const colWs = [80, 100, 80, 160, 80]
          const x = LEFT + colWs.slice(0, i).reduce((s, v) => s + v, 0)
          doc.text(h, x + 6, y + 6, { width: colWs[i] - 6, align: i === 4 ? "right" : "left" })
        })
      y += 20
      payments.forEach((p, i) => {
        const rh = 22
        doc.rect(LEFT, y, W, rh).fill(i % 2 === 0 ? "white" : C.bg)
        const methodIcons = { cash: "💵", mpesa: "📱", bank: "🏦" }
        const colWs = [80, 100, 80, 160, 80]
          ;[p.date, p.poNumber, `${methodIcons[p.method] || ""} ${p.method}`, p.reference || "—", `KSh ${p.amount.toLocaleString()}`].forEach((v, j) => {
            const x = LEFT + colWs.slice(0, j).reduce((s, w) => s + w, 0)
            doc.fillColor(j === 4 ? C.success : C.text).fontSize(9).font(j === 4 ? "Helvetica-Bold" : "Helvetica")
              .text(v, x + 6, y + 6, { width: colWs[j] - 6, align: j === 4 ? "right" : "left" })
          })
        y += rh
      })
    }

    doc.rect(0, doc.page.height - 38, doc.page.width, 38).fill(C.dark)
    doc.fillColor("rgba(255,255,255,0.75)").fontSize(8).font("Helvetica")
      .text([settings?.companyName || "", settings?.phone || "", settings?.email || ""].filter(Boolean).join("   |   "), LEFT, doc.page.height - 24, { width: W, align: "center" })
    doc.end()

  } catch (err) {
    console.error("Statement PDF error:", err.message)
    if (!res.headersSent) res.status(500).json({ success: false, message: "Failed to generate statement.", error: err.message })
  }
})



module.exports = router
