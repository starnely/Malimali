const { MongoMemoryReplSet } = require("mongodb-memory-server");

module.exports = async function () {
  const replset = await MongoMemoryReplSet.create({
    replSet: { count: 1 },
  });

  global.__REPLSET__ = replset;

  // Workers inherit process.env set here because they fork after globalSetup completes.
  process.env.MONGO_URI = replset.getUri();
  process.env.JWT_SECRET = "test-jwt-secret-key";
  process.env.ACTIVATION_CODE = "TEST-ACTIVATION-CODE";
};
