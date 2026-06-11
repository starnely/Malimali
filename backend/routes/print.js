const express = require("express");
const router = express.Router();
const { authMiddleware } = require("../middleware/authMiddleware");
const net = require("net");

router.use(authMiddleware);

// ── ESC/POS command helpers ───────────────────────────────────────────
const ESC = 0x1b;
const GS = 0x1d;

function esc(...args) { return Buffer.from([ESC, ...args]); }
function gs(...args) { return Buffer.from([GS, ...args]); }

const CMD = {
  init: esc(0x40),
  alignLeft: esc(0x61, 0x00),
  alignCenter: esc(0x61, 0x01),
  alignRight: esc(0x61, 0x02),
  bold: esc(0x45, 0x01),
  boldOff: esc(0x45, 0x00),
  doubleHeight: esc(0x21, 0x10),
  normal: esc(0x21, 0x00),
  cut: gs(0x56, 0x42, 0x00),
  feed: Buffer.from([0x0a]),
  feed3: Buffer.from([0x0a, 0x0a, 0x0a]),
};

// ── Text formatting helpers ────────────────────────────────────────────
const WIDTH = 42; // 80mm paper = ~42 chars

function line(text = '') {
  return Buffer.from(text.substring(0, WIDTH) + '\n', 'utf8');
}

function center(text) {
  const pad = Math.max(0, Math.floor((WIDTH - text.length) / 2));
  return Buffer.from(' '.repeat(pad) + text.substring(0, WIDTH) + '\n', 'utf8');
}

function divider(char = '-') {
  return Buffer.from(char.repeat(WIDTH) + '\n', 'utf8');
}

function twoCol(left, right) {
  const maxLeft = WIDTH - right.length - 1;
  const l = left.substring(0, maxLeft).padEnd(maxLeft);
  return Buffer.from(l + ' ' + right + '\n', 'utf8');
}

function threeCol(col1, col2, col3) {
  const c1Width = 5;
  const c3Width = 10;
  const c2Width = WIDTH - c1Width - c3Width - 2;
  const c1 = col1.substring(0, c1Width).padEnd(c1Width);
  const c2 = col2.substring(0, c2Width).padEnd(c2Width);
  const c3 = col3.substring(0, c3Width).padStart(c3Width);
  return Buffer.from(`${c1} ${c2} ${c3}\n`, 'utf8');
}

// ── Build receipt buffer ───────────────────────────────────────────────
function buildReceiptBuffer(data) {
  const chunks = [];

  const push = (...bufs) => bufs.forEach(b => chunks.push(b));

  const currency = data.currency || 'KSh';

  // Init
  push(CMD.init);

  // ── Header ──────────────────────────────────────────────────────────
  push(CMD.alignCenter, CMD.bold, CMD.doubleHeight);
  push(center(data.businessName || 'Retail POS'));
  push(CMD.normal, CMD.boldOff);

  if (data.branch) push(center(`Branch: ${data.branch}`));
  if (data.address) push(center(data.address));
  if (data.phone) push(center(`Tel: ${data.phone}`));

  push(CMD.feed);
  push(CMD.bold);
  push(twoCol('Receipt ID:', data.receiptId || 'N/A'));
  push(CMD.boldOff);
  push(twoCol('Date:', data.date || ''));
  push(twoCol('Time:', data.time || ''));
  push(divider('-'));

  // ── Items ────────────────────────────────────────────────────────────
  push(CMD.bold);
  push(threeCol('Qty', 'Description', 'Amount'));
  push(CMD.boldOff);
  push(divider('-'));

  (data.items || []).forEach(item => {
    const price = Number(item.price || item.sellPrice || 0);
    const qty = item.qty || 1;
    const total = price * qty;
    push(threeCol(
      String(qty),
      item.name || 'Item',
      `${currency} ${total.toLocaleString()}`
    ));
    push(Buffer.from(`      @ ${currency} ${price.toLocaleString()} each\n`, 'utf8'));
  });

  push(divider('-'));

  // ── Totals ───────────────────────────────────────────────────────────
  const subtotal = (data.items || []).reduce(
    (sum, i) => sum + (Number(i.price || i.sellPrice || 0) * (i.qty || 1)), 0
  );
  push(twoCol('Subtotal:', `${currency} ${subtotal.toLocaleString()}`));

  if (Number(data.discount) > 0) {
    push(twoCol('Discount:', `- ${currency} ${Number(data.discount).toLocaleString()}`));
  }

  push(CMD.bold);
  push(twoCol('TOTAL:', `${currency} ${Number(data.finalTotal || data.total || subtotal).toLocaleString()}`));
  push(CMD.boldOff);
  push(divider('='));

  // ── Payment ──────────────────────────────────────────────────────────
  const method = data.paymentMethod || 'cash';
  const methodLabel = method === 'bank' ? 'Bank Transfer'
    : method.charAt(0).toUpperCase() + method.slice(1);

  push(twoCol('Paid via:', methodLabel));

  if (method === 'cash') {
    if (Number(data.cashGiven) > 0)
      push(twoCol('Amount Tendered:', `${currency} ${Number(data.cashGiven).toLocaleString()}`));
    if (Number(data.change) > 0)
      push(CMD.bold, twoCol('Change Due:', `${currency} ${Number(data.change).toLocaleString()}`), CMD.boldOff);
  }

  if (method === 'mpesa' && data.mpesaPhone) {
    push(twoCol('M-Pesa No:', data.mpesaPhone));
  }

  if (method === 'split') {
    push(twoCol('  Cash Portion:', `${currency} ${Number(data.cashPart || 0).toLocaleString()}`));
    push(twoCol('  M-Pesa Portion:', `${currency} ${Number(data.mpesaPart || 0).toLocaleString()}`));
  }

  if (method === 'card' && data.cardApprovalCode) {
    push(twoCol('Approval Code:', data.cardApprovalCode));
  }

  if (method === 'bank' && data.bankReference) {
    push(twoCol('Transfer Ref:', data.bankReference));
  }

  if (method === 'credit') {
    push(CMD.bold);
    push(center('*** CREDIT SALE - UNPAID ***'));
    push(CMD.boldOff);
    if (data.customerName) push(twoCol('Customer:', data.customerName));
    if (data.customerPhone) push(twoCol('Phone:', data.customerPhone));
    if (data.promiseDate) {
      const d = new Date(data.promiseDate + 'T00:00:00').toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' });
      push(CMD.bold);
      push(twoCol('Pay by:', d));
      push(CMD.boldOff);
    }
  }

  push(divider('-'));

  // ── Footer ───────────────────────────────────────────────────────────
  push(CMD.alignCenter);
  push(center(`Served by: ${data.cashier || 'Staff'}`));
  push(CMD.feed);
  push(CMD.bold);
  push(center(data.receiptFooter || 'Thank you for your business!'));
  push(CMD.boldOff);

  if (data.kraPin) {
    push(CMD.feed);
    push(center(`KRA PIN: ${data.kraPin}`));
  }

  // ── Cut ──────────────────────────────────────────────────────────────
  push(CMD.feed3);
  push(CMD.cut);

  return Buffer.concat(chunks);
}

// ── Send to network printer ────────────────────────────────────────────
function printToNetwork(ip, port, buffer) {
  return new Promise((resolve, reject) => {
    const client = new net.Socket();
    const timeout = setTimeout(() => {
      client.destroy();
      reject(new Error(`Connection to ${ip}:${port} timed out`));
    }, 5000);

    client.connect(port, ip, () => {
      client.write(buffer, (err) => {
        clearTimeout(timeout);
        client.destroy();
        if (err) reject(err);
        else resolve();
      });
    });

    client.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

// ── Send to USB printer ────────────────────────────────────────────────
async function printToUSB(buffer) {
  try {
    const escpos = require('escpos');
    const USB = require('escpos-usb');
    escpos.USB = USB;

    const devices = USB.findPrinter();
    if (!devices || devices.length === 0) {
      throw new Error('No USB printer found. Check USB connection and driver.');
    }

    return new Promise((resolve, reject) => {
      const device = new escpos.USB();
      device.open((err) => {
        if (err) return reject(new Error(`Cannot open USB printer: ${err.message}`));
        device.write(buffer, (writeErr) => {
          device.close();
          if (writeErr) reject(writeErr);
          else resolve();
        });
      });
    });
  } catch (err) {
    throw new Error(`USB print failed: ${err.message}`);
  }
}

// ── POST /api/print/receipt ────────────────────────────────────────────
router.post("/receipt", async (req, res) => {
  try {
    const {
      printerType, printerIp, printerPort,
      // Receipt data
      businessName, branch, address, phone,
      receiptId, date, time, items,
      total, finalTotal, discount,
      paymentMethod, cashGiven, change,
      mpesaPhone, cashPart, mpesaPart,
      cardApprovalCode, bankReference,
      customerName, cashier,
      receiptFooter, kraPin, currency,customerPhone, promiseDate,
    } = req.body;

    const buffer = buildReceiptBuffer({
      businessName, branch, address, phone,
      receiptId, date, time, items,
      total, finalTotal, discount,
      paymentMethod, cashGiven, change,
      mpesaPhone, cashPart, mpesaPart,
      cardApprovalCode, bankReference,
      customerName, cashier,
      receiptFooter, kraPin, currency, customerPhone, promiseDate,
    });

    const type = printerType || 'browser';

    if (type === 'network') {
      const ip = printerIp || '192.168.1.100';
      const port = Number(printerPort) || 9100;
      await printToNetwork(ip, port, buffer);
      return res.json({ success: true, method: 'network' });
    }

    if (type === 'usb') {
      await printToUSB(buffer);
      return res.json({ success: true, method: 'usb' });
    }

    // browser type — frontend handles it
    return res.json({ success: false, fallback: true, message: 'Browser print mode — use window.print()' });

  } catch (err) {
    console.error('🖨️ Print error:', err.message);
    return res.status(500).json({
      success: false,
      fallback: true,
      message: err.message || 'Printer unreachable'
    });
  }
});

module.exports = router;
