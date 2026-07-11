/**
 * Phase 1 — Tenant-Zero Migration
 *
 * Creates one "tenant-zero" Tenant document representing all pre-existing
 * data, then backfills tenantId = tenantZeroId onto every document across
 * the 20 scoped business-data collections (see SCOPED_MODEL_NAMES in
 * plugins/tenantScope.js). Report-only by default; --apply and --rollback
 * both require --confirm=<dbName> matching --db exactly.
 *
 * Usage:
 *   node backend/scripts/phase1-tenant-migration.js --db <dbName>
 *   node backend/scripts/phase1-tenant-migration.js --db <dbName> --apply    --confirm=<dbName>
 *   node backend/scripts/phase1-tenant-migration.js --db <dbName> --rollback --confirm=<dbName>
 *
 * --db is mandatory — never falls back to whatever MONGO_URI implies.
 */

require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") })
const mongoose = require("mongoose")

// Must run before any model file is required, so every schema compiles with
// the tenantId field + hooks already registered (same convention as server.js
// and tests/helpers/createApp.js).
require("../plugins/tenantScope")
const { SCOPED_MODEL_NAMES } = require("../plugins/tenantScope")
const Tenant = require("../models/Tenant")

const TENANT_ZERO_SLUG = "tenant-zero"

function parseArgs(argv) {
  const args = {}
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    const kv = arg.match(/^--([^=]+)=(.*)$/)
    if (kv) { args[kv[1]] = kv[2]; continue }
    const flag = arg.match(/^--([^=]+)$/)
    if (flag) {
      const next = argv[i + 1]
      if (next !== undefined && !next.startsWith("--")) {
        args[flag[1]] = next
        i++
      } else {
        args[flag[1]] = true
      }
    }
  }
  return args
}

function loadScopedModels() {
  const models = {}
  for (const name of SCOPED_MODEL_NAMES) {
    models[name] = require(`../models/${name}`)
  }
  return models
}

async function printReport(models) {
  console.log("\n── Report ────────────────────────────────────────────────────────")
  const tenantZero = await Tenant.findOne({ slug: TENANT_ZERO_SLUG }).lean()
  console.log(tenantZero
    ? `Tenant-zero exists: _id=${tenantZero._id}`
    : "Tenant-zero does NOT exist yet.")

  const rows = []
  for (const [name, Model] of Object.entries(models)) {
    const total = await Model.countDocuments({})
    const missing = await Model.countDocuments({ tenantId: { $exists: false } })
    const present = total - missing
    const sample = present > 0
      ? await Model.findOne({ tenantId: { $exists: true } }).select("_id tenantId").lean()
      : await Model.findOne({}).select("_id").lean()
    rows.push({ name, total, missing, present, sample })
  }

  for (const r of rows) {
    const sampleStr = r.sample
      ? `sample _id=${r.sample._id} tenantId=${r.sample.tenantId ?? "(none)"}`
      : "sample: (no documents)"
    console.log(`${r.name.padEnd(16)} total=${String(r.total).padEnd(6)} missing=${String(r.missing).padEnd(6)} present=${String(r.present).padEnd(6)} ${sampleStr}`)
  }
  const totalMissing = rows.reduce((s, r) => s + r.missing, 0)
  console.log("─────────────────────────────────────────────────────────────────")
  console.log(totalMissing === 0
    ? "All scoped collections: 0 documents missing tenantId."
    : `${totalMissing} document(s) still missing tenantId across scoped collections.`)

  return rows
}

async function applyMigration(models) {
  const session = await mongoose.startSession()
  session.startTransaction()
  try {
    const tenantZero = await Tenant.findOneAndUpdate(
      { slug: TENANT_ZERO_SLUG },
      { $setOnInsert: { name: "Tenant Zero (pre-multi-tenant data)", slug: TENANT_ZERO_SLUG, status: "active" } },
      { upsert: true, new: true, session }
    )
    console.log(`Tenant-zero resolved: _id=${tenantZero._id}`)

    for (const [name, Model] of Object.entries(models)) {
      const result = await Model.updateMany(
        { tenantId: { $exists: false } },
        { $set: { tenantId: tenantZero._id } },
        { session }
      )
      console.log(`  ${name.padEnd(16)} matched=${result.matchedCount} modified=${result.modifiedCount}`)
    }

    await session.commitTransaction()
    console.log("Transaction committed.")
    return tenantZero._id
  } catch (err) {
    await session.abortTransaction()
    throw err
  } finally {
    session.endSession()
  }
}

async function rollbackMigration(models) {
  const session = await mongoose.startSession()
  session.startTransaction()
  try {
    const tenantZero = await Tenant.findOne({ slug: TENANT_ZERO_SLUG }).session(session)
    if (!tenantZero) {
      console.log("No tenant-zero document found — nothing to roll back.")
      await session.commitTransaction()
      return
    }

    for (const [name, Model] of Object.entries(models)) {
      const result = await Model.updateMany(
        { tenantId: tenantZero._id },
        { $unset: { tenantId: "" } },
        { session }
      )
      console.log(`  ${name.padEnd(16)} matched=${result.matchedCount} modified=${result.modifiedCount}`)
    }

    await Tenant.deleteOne({ _id: tenantZero._id }, { session })
    console.log(`Deleted tenant-zero document _id=${tenantZero._id}`)

    await session.commitTransaction()
    console.log("Rollback transaction committed.")
  } catch (err) {
    await session.abortTransaction()
    throw err
  } finally {
    session.endSession()
  }
}

async function run() {
  const args = parseArgs(process.argv.slice(2))
  const dbName = args.db

  if (!dbName || typeof dbName !== "string") {
    console.error("Missing --db <dbName>. Aborting — no default database is assumed.")
    process.exit(1)
  }
  if (args.apply && args.rollback) {
    console.error("--apply and --rollback are mutually exclusive.")
    process.exit(1)
  }
  if ((args.apply || args.rollback) && args.confirm !== dbName) {
    console.error(`--apply/--rollback requires --confirm=${dbName} to match --db exactly (got: ${args.confirm ?? "(missing)"}).`)
    process.exit(1)
  }

  const MONGO_URI = process.env.MONGO_URI
  if (!MONGO_URI) {
    console.error("MONGO_URI is not defined in .env")
    process.exit(1)
  }

  await mongoose.connect(MONGO_URI, {
    dbName,
    serverSelectionTimeoutMS: 5000,
    bufferCommands: false,
  })
  const host = mongoose.connection.host
  console.log(`Connected to database: "${mongoose.connection.name}" on ${host}`)

  const models = loadScopedModels()

  if (args.apply) {
    console.log(`\n=== APPLY mode — database "${dbName}" ===`)
    await printReport(models)
    await applyMigration(models)
    console.log("\n=== Post-apply verification ===")
    await printReport(models)
  } else if (args.rollback) {
    console.log(`\n=== ROLLBACK mode — database "${dbName}" ===`)
    await printReport(models)
    await rollbackMigration(models)
    console.log("\n=== Post-rollback verification ===")
    await printReport(models)
  } else {
    console.log(`\n=== REPORT mode (read-only) — database "${dbName}" ===`)
    await printReport(models)
  }

  await mongoose.disconnect()
}

run().catch(err => {
  console.error("Migration script failed:", err)
  process.exit(1)
})
