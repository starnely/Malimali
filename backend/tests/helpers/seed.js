const bcrypt = require("bcryptjs");
const User = require("../../models/User");
const Product = require("../../models/Product");
const Category = require("../../models/Category");
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
    ...overrides,
  });
}

async function createCustomer(overrides = {}) {
  const count = await Customer.countDocuments();
  return Customer.create({
    name: `Test Customer ${count}`,
    store: "Main Store",
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
    ...overrides,
  });
}

async function createCategory(overrides = {}) {
  return Category.create({
    name: "test category",
    store: null,
    description: "",
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
  DEFAULT_PASSWORD,
};
