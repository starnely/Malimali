const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const { TEST_TENANT_ID } = require("./tenant");
const User = require("../../models/User");
const Product = require("../../models/Product");
const Category = require("../../models/Category");
const Supplier = require("../../models/Supplier");
const Store = require("../../models/Store");
const Archive = require("../../models/Archive");
const Message = require("../../models/Message");
const Setting = require("../../models/Setting");
const PurchaseOrder = require("../../models/PurchaseOrder");
const SupplierPayment = require("../../models/SupplierPayment");
const Customer = require("../../models/Customer");
const Sale = require("../../models/Sale");
const Repayment = require("../../models/Repayment");
const ExpiredStock = require("../../models/ExpiredStock");
const Expense = require("../../models/Expense");
const PettyCash = require("../../models/PettyCash");

const DEFAULT_PASSWORD = "password123";
// Cost factor 4 (minimum valid) keeps bcrypt fast in tests without changing production behavior.
const DEFAULT_PASSWORD_HASH = bcrypt.hashSync(DEFAULT_PASSWORD, 4);

// Hashes a plaintext approval PIN the same way routes compare it (bcrypt.compare
// against User.approvalPin) — pass the plaintext PIN as `approverPin` in the
// request body, and the hash as `approvalPin` when seeding the approving user.
function hashPin(pin) {
  return bcrypt.hashSync(pin, 4);
}

async function createUser(overrides = {}) {
  const count = await User.countDocuments();
  const role = overrides.role || "cashier";
  const store = overrides.store || "Main Store";

  return User.create({
    fullname: `Test ${role} ${count}`,
    username: `testuser${count}`,
    email: `testuser${count}@test.com`,
    password: DEFAULT_PASSWORD_HASH,
    role,
    store,
    active: true,
    isActive: true,
    shiftStatus: "closed",
    tenantId: TEST_TENANT_ID,
    ...overrides,
    // overrides may set role/store/email, but password must be hashed
    password:
      overrides.password !== undefined
        ? overrides.password
        : DEFAULT_PASSWORD_HASH,
  });
}

async function createProduct(overrides = {}) {
  return Product.create({
    name: "Test Product",
    category: "Test Category",
    unit: "pcs",
    buyPrice: 10,
    sellPrice: 15,
    stock: 100,
    store: "Main Store",
    tenantId: TEST_TENANT_ID,
    ...overrides,
  });
}

// Creates a PurchaseOrder via mongoose directly so the pre-save hook runs:
// poNumber is auto-assigned and totalOrderedCost is computed.
async function createPurchaseOrder(product, overrides = {}) {
  return PurchaseOrder.create({
    supplierName: "Test Supplier",
    store: "Main Store",
    status: "draft",
    items: [
      {
        productId: product._id,
        productName: product.name,
        unit: product.unit || "pcs",
        qtyOrdered: 10,
        unitCost: 8,
      },
    ],
    tenantId: TEST_TENANT_ID,
    ...overrides,
  });
}

// Records a SupplierPayment directly (bypasses route validation).
async function createSupplierPayment(po, overrides = {}) {
  return SupplierPayment.create({
    poId: po._id,
    poNumber: po.poNumber,
    supplierName: po.supplierName,
    store: po.store,
    amount: 100,
    method: "cash",
    tenantId: TEST_TENANT_ID,
    ...overrides,
  });
}

async function createCustomer(overrides = {}) {
  const count = await Customer.countDocuments();
  return Customer.create({
    name: `Test Customer ${count}`,
    store: "Main Store",
    tenantId: TEST_TENANT_ID,
    ...overrides,
  });
}

// Creates a credit Sale suitable for driving calcBalance in customers tests.
// paymentInfo overrides are deep-merged so callers only need to specify what differs.
async function createCreditSale(product, customerId, overrides = {}) {
  const { paymentInfo: paymentInfoOverrides = {}, ...rest } = overrides;
  return Sale.create({
    items: [{ productId: product._id, qty: 1, price: 100, buyPrice: 50 }],
    total: 100,
    store: "Main Store",
    cashier: "Test Cashier",
    date: "2024-01-01",
    time: "10:00:00 EAT",
    paymentInfo: {
      paymentMethod: "credit",
      customerId,
      finalTotal: 100,
      promiseDate: "",
      ...paymentInfoOverrides,
    },
    tenantId: TEST_TENANT_ID,
    ...rest,
  });
}

async function createRepayment(customer, overrides = {}) {
  return Repayment.create({
    customerId: customer._id,
    customerName: customer.name,
    store: customer.store,
    amount: 30,
    recordedBy: "Test User",
    tenantId: TEST_TENANT_ID,
    ...overrides,
  });
}

async function createExpiredStock(product, overrides = {}) {
  return ExpiredStock.create({
    productId: product._id,
    productName: product.name,
    category: product.category || "Test Category",
    store: product.store || "Main Store",
    quantity: 5,
    buyPrice: product.buyPrice || 10,
    totalLoss: (overrides.quantity || 5) * (product.buyPrice || 10),
    expiryDate: new Date("2024-01-01"),
    tenantId: TEST_TENANT_ID,
    ...overrides,
  });
}

async function createExpense(overrides = {}) {
  return Expense.create({
    amount: 100,
    category: "other",
    description: "Test expense",
    store: "Main Store",
    recordedBy: "Test User",
    tenantId: TEST_TENANT_ID,
    ...overrides,
  });
}

// One PettyCash document per store per day (unique index enforced by model).
async function createPettyCash(overrides = {}) {
  return PettyCash.create({
    date: "2024-01-15",
    store: "Main Store",
    openingFloat: 1000,
    transactions: [],
    tenantId: TEST_TENANT_ID,
    ...overrides,
  });
}

async function createCategory(overrides = {}) {
  return Category.create({
    name: "test category",
    store: null,
    description: "",
    tenantId: TEST_TENANT_ID,
    ...overrides,
  });
}

async function createSupplier(overrides = {}) {
  const count = await Supplier.countDocuments();
  return Supplier.create({
    name: `Test Supplier ${count}`,
    stores: [],
    isActive: true,
    tenantId: TEST_TENANT_ID,
    ...overrides,
  });
}

async function createStore(overrides = {}) {
  const count = await Store.countDocuments();
  return Store.create({
    name: `Test Store ${count}`,
    location: "",
    phone: "",
    tenantId: TEST_TENANT_ID,
    ...overrides,
  });
}

async function createArchive(overrides = {}) {
  return Archive.create({
    employeeName: "Test Employee",
    date: "2024-01-15",
    store: "Main Store",
    revenue: 0,
    profit: 0,
    transactions: 0,
    itemsSold: 0,
    tenantId: TEST_TENANT_ID,
    ...overrides,
  });
}

async function createMessage(overrides = {}) {
  return Message.create({
    senderId:     new mongoose.Types.ObjectId(),
    senderName:   "Test Sender",
    senderRole:   "cashier",
    receiverId:   new mongoose.Types.ObjectId(),
    receiverName: "Test Receiver",
    content:      "Test message content",
    isBroadcast:  false,
    readBy:       [],
    tenantId:     TEST_TENANT_ID,
    ...overrides,
  });
}

async function createSetting(overrides = {}) {
  return Setting.create({
    companyName: "Test Company",
    currency:    "KSh",
    isActivated: true,
    tenantId:    TEST_TENANT_ID,
    ...overrides,
  });
}

// General sale factory — productId defaults to a throw-away ObjectId so
// archive tests don't need a real Product document to exist.
async function createSale(overrides = {}) {
  return Sale.create({
    items: [{ productId: new mongoose.Types.ObjectId(), qty: 1, price: 50, buyPrice: 30 }],
    total: 50,
    store: "Main Store",
    cashier: "Test Cashier",
    date: "2024-01-01",
    time: "10:00:00 EAT",
    paymentInfo: { paymentMethod: "cash", finalTotal: 50 },
    tenantId: TEST_TENANT_ID,
    ...overrides,
  });
}

module.exports = {
  createUser,
  createProduct,
  createPurchaseOrder,
  createSupplierPayment,
  createCustomer,
  createCreditSale,
  createRepayment,
  createExpiredStock,
  createExpense,
  createPettyCash,
  createCategory,
  createSupplier,
  createStore,
  createArchive,
  createMessage,
  createSetting,
  createSale,
  DEFAULT_PASSWORD,
  hashPin,
};
