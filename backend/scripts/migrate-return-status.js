/**
 * One-time migration: update Return documents with status "pending" to "pending_manager".
 *
 * Run manually:
 *   node backend/scripts/migrate-return-status.js
 */

require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") })
const mongoose = require("mongoose")
const Return   = require("../models/Return")

async function run() {
  await mongoose.connect(process.env.MONGO_URI)
  console.log("Connected to MongoDB")

  const result = await Return.updateMany(
    { status: "pending" },
    { $set: { status: "pending_manager" } }
  )

  console.log(`Migration complete — updated ${result.modifiedCount} Return document(s)`)
  await mongoose.disconnect()
}

run().catch(err => {
  console.error("Migration failed:", err.message)
  process.exit(1)
})
