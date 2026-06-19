module.exports = async function () {
  if (global.__REPLSET__) {
    await global.__REPLSET__.stop();
  }
};
