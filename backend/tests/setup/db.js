const mongoose = require("mongoose");

async function connect() {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(process.env.MONGO_URI);
  }
}

async function clear() {
  for (const collection of Object.values(mongoose.connection.collections)) {
    await collection.deleteMany({});
  }
}

async function close() {
  await mongoose.connection.close();
}

module.exports = { connect, clear, close };
