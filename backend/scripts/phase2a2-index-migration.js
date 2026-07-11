/**
 * Phase 2a-2 — Per-Tenant Unique Index Migration
 *
 * For the 11 models that had a global unique constraint (see
 * phase-2a-plan.md §5), builds the new tenantId-leading compound unique
 * index, verifies it exists, then drops the old single-field/compound
 * index — per collection, in that order, so there is never a window
 * without a working unique constraint.
 *
 * Uses the raw MongoDB driver directly, not Mongoose — index management
 * (createIndex/dropIndex) isn't a transactionable operation, and going
 * through Mongoose models here would risk autoIndex side effects from
 * whatever schema shape happens to be loaded. Old/new index specs are
 * hardcoded below, taken directly from the 11 model files and confirmed
 * against a live inspection of the real database's current indexes.
 *
 * Usage:
 *   node backend/scripts/phase2a2-index-migration.js --db <dbName>
 *   node backend/scripts/phase2a2-index-migration.js --db <dbName> --apply --confirm=<dbName>
 *
 * --db is mandatory — never falls back to whatever MONGO_URI implies.
 */

require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") })
const { MongoClient } = require("mongodb")

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

// One entry per collection. `old` is the index being retired (omit if none
// currently exists, e.g. products.pluNumber_1 was never actually built).
// `new` is the tenantId-leading compound replacement — options (unique,
// sparse, partialFilterExpression) copied exactly from the model files.
const MIGRATIONS = [
  { collection: "users", fields: [
    { old: { key: { username: 1 }, options: { unique: true } },
      new: { key: { tenantId: 1, username: 1 }, options: { unique: true } } },
    { old: { key: { email: 1 }, options: { unique: true } },
      new: { key: { tenantId: 1, email: 1 }, options: { unique: true } } },
  ]},
  { collection: "stores", fields: [
    { old: { key: { name: 1 }, options: { unique: true } },
      new: { key: { tenantId: 1, name: 1 }, options: { unique: true } } },
  ]},
  { collection: "settings", fields: [
    { old: { key: { settingKey: 1 }, options: { unique: true } },
      new: { key: { tenantId: 1, settingKey: 1 }, options: { unique: true } } },
  ]},
  { collection: "suppliers", fields: [
    { old: { key: { company: 1 }, options: { unique: true, sparse: true } },
      new: { key: { tenantId: 1, company: 1 }, options: { unique: true, partialFilterExpression: { company: { $exists: true } } } } },
  ]},
  { collection: "products", fields: [
    { old: { key: { barcode: 1 }, options: { unique: true, sparse: true } },
      new: { key: { tenantId: 1, barcode: 1 }, options: { unique: true, partialFilterExpression: { barcode: { $exists: true } } } } },
    { old: null, // pluNumber_1 was never actually built on the real database
      new: { key: { tenantId: 1, pluNumber: 1 }, options: { unique: true, partialFilterExpression: { pluNumber: { $exists: true } } } } },
  ]},
  { collection: "sales", fields: [
    { old: { key: { receiptId: 1 }, options: { unique: true, sparse: true } },
      new: { key: { tenantId: 1, receiptId: 1 }, options: { unique: true, partialFilterExpression: { receiptId: { $exists: true } } } } },
  ]},
  { collection: "purchaseorders", fields: [
    { old: { key: { poNumber: 1 }, options: { unique: true } },
      new: { key: { tenantId: 1, poNumber: 1 }, options: { unique: true } } },
  ]},
  { collection: "categories", fields: [
    { old: { key: { name: 1, store: 1 }, options: { unique: true } },
      new: { key: { tenantId: 1, name: 1, store: 1 }, options: { unique: true } } },
  ]},
  { collection: "pettycashes", fields: [
    { old: { key: { store: 1, date: 1 }, options: { unique: true } },
      new: { key: { tenantId: 1, store: 1, date: 1 }, options: { unique: true } } },
  ]},
  { collection: "archives", fields: [
    { old: { key: { employeeName: 1, date: 1 }, options: { unique: true } },
      new: { key: { tenantId: 1, employeeName: 1, date: 1 }, options: { unique: true } } },
  ]},
  { collection: "customers", fields: [
    { old: { key: { phone: 1, store: 1 }, options: { unique: true, partialFilterExpression: { phone: { $gt: "" } } } },
      new: { key: { tenantId: 1, phone: 1, store: 1 }, options: { unique: true, partialFilterExpression: { phone: { $gt: "" } } } } },
  ]},
]

function keyMatches(a, b) {
  return JSON.stringify(a) === JSON.stringify(b)
}

async function findIndexByKey(db, collName, key) {
  const exists = await db.listCollections({ name: collName }).toArray()
  if (exists.length === 0) return { collectionExists: false, index: null }
  const indexes = await db.collection(collName).indexes()
  const index = indexes.find(i => keyMatches(i.key, key)) || null
  return { collectionExists: true, index }
}

async function report(db) {
  console.log("\n── Report ────────────────────────────────────────────────────────")
  for (const { collection, fields } of MIGRATIONS) {
    console.log(`\n${collection}:`)
    for (const { old, new: newSpec } of fields) {
      if (old) {
        const { collectionExists, index } = await findIndexByKey(db, collection, old.key)
        if (!collectionExists) {
          console.log(`  OLD ${JSON.stringify(old.key)} — collection does not exist yet`)
        } else {
          console.log(`  OLD ${JSON.stringify(old.key)} — ${index ? `present (${index.name}), would be dropped` : "already absent"}`)
        }
      }
      const { collectionExists, index } = await findIndexByKey(db, collection, newSpec.key)
      if (!collectionExists) {
        console.log(`  NEW ${JSON.stringify(newSpec.key)} — collection does not exist yet, would be created on first write`)
      } else {
        console.log(`  NEW ${JSON.stringify(newSpec.key)} — ${index ? "already exists, no-op" : "would be created"}`)
      }
    }
  }
}

async function apply(db) {
  for (const { collection, fields } of MIGRATIONS) {
    const exists = await db.listCollections({ name: collection }).toArray()
    if (exists.length === 0) {
      console.log(`\n${collection}: collection does not exist yet — skipping (nothing to migrate).`)
      continue
    }
    console.log(`\n${collection}:`)
    for (const { old, new: newSpec } of fields) {
      // 1. Build new index (skip if already present — idempotent)
      let { index: newIndex } = await findIndexByKey(db, collection, newSpec.key)
      if (newIndex) {
        console.log(`  NEW ${JSON.stringify(newSpec.key)} — already exists (${newIndex.name}), skipping build`)
      } else {
        await db.collection(collection).createIndex(newSpec.key, { ...newSpec.options, background: true })
        console.log(`  NEW ${JSON.stringify(newSpec.key)} — built`)
      }

      // 2. Verify it now exists
      const verify = await findIndexByKey(db, collection, newSpec.key)
      if (!verify.index) {
        throw new Error(`Verification failed: ${collection} new index ${JSON.stringify(newSpec.key)} not found after build.`)
      }
      console.log(`  NEW ${JSON.stringify(newSpec.key)} — verified present (${verify.index.name})`)

      // 3. Only now drop the old index, if it's still there
      if (old) {
        const { index: oldIndex } = await findIndexByKey(db, collection, old.key)
        if (!oldIndex) {
          console.log(`  OLD ${JSON.stringify(old.key)} — already absent, skipping drop`)
        } else {
          await db.collection(collection).dropIndex(oldIndex.name)
          console.log(`  OLD ${JSON.stringify(old.key)} — dropped (${oldIndex.name})`)
        }
      }
    }
  }
}

async function run() {
  const args = parseArgs(process.argv.slice(2))
  const dbName = args.db

  if (!dbName || typeof dbName !== "string") {
    console.error("Missing --db <dbName>. Aborting — no default database is assumed.")
    process.exit(1)
  }
  if (args.apply && args.confirm !== dbName) {
    console.error(`--apply requires --confirm=${dbName} to match --db exactly (got: ${args.confirm ?? "(missing)"}).`)
    process.exit(1)
  }

  const MONGO_URI = process.env.MONGO_URI
  if (!MONGO_URI) {
    console.error("MONGO_URI is not defined in .env")
    process.exit(1)
  }

  const client = new MongoClient(MONGO_URI, { serverSelectionTimeoutMS: 5000 })
  await client.connect()
  console.log(`Connected to database: "${dbName}"`)
  const db = client.db(dbName)

  if (args.apply) {
    console.log(`\n=== APPLY mode — database "${dbName}" ===`)
    await apply(db)
    console.log("\n=== Post-apply verification (report) ===")
    await report(db)
  } else {
    console.log(`\n=== REPORT mode (read-only) — database "${dbName}" ===`)
    await report(db)
  }

  await client.close()
}

run().catch(err => {
  console.error("Index migration script failed:", err)
  process.exit(1)
})
