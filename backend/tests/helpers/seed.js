const bcrypt = require("bcryptjs");
const User = require("../../models/User");
const Product = require("../../models/Product");

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

module.exports = { createUser, createProduct, DEFAULT_PASSWORD };
