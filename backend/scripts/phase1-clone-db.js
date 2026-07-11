/**
 * Phase 1 rehearsal tool — clones an entire database within the same Atlas
 * cluster into a new, differently-named database, so the tenant-zero
 * migration can be rehearsed on a disposable copy before it ever touches
 * the real database.
 *
 * Usage:
 *   node backend/scripts/phase1-clone-db.js --source <dbName> --target <dbName>
 *
 * Both flags are mandatory — there is no default database. Refuses to run
 * if --source === --target, or if --target is "test" (the real database):
 * cloning must never be able to overwrite real data.
 */

require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") })
const { MongoClient } = require("mongodb")

const REAL_DB_NAME = "test"
const BATCH_SIZE = 500

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

async function run() {
  const args = parseArgs(process.argv.slice(2))
  const source = args.source
  const target = args.target

  if (!source || typeof source !== "string") {
    console.error("Missing --source <dbName>. Aborting — no default is assumed.")
    process.exit(1)
  }
  if (!target || typeof target !== "string") {
    console.error("Missing --target <dbName>. Aborting — no default is assumed.")
    process.exit(1)
  }
  if (source === target) {
    console.error(`--source and --target are both "${source}" — refusing to clone a database onto itself.`)
    process.exit(1)
  }
  if (target === REAL_DB_NAME) {
    console.error(`--target is "${REAL_DB_NAME}", the real database. Refusing to clone onto it.`)
    process.exit(1)
  }

  const MONGO_URI = process.env.MONGO_URI
  if (!MONGO_URI) {
    console.error("MONGO_URI is not defined in .env")
    process.exit(1)
  }

  const client = new MongoClient(MONGO_URI, { serverSelectionTimeoutMS: 5000 })
  await client.connect()
  console.log(`Connected to cluster.\n  Source database: "${source}"\n  Target database: "${target}"`)

  const sourceDb = client.db(source)
  const targetDb = client.db(target)

  console.log(`Dropping target database "${target}" (if it exists) for a clean, idempotent clone...`)
  await targetDb.dropDatabase()

  const collections = await sourceDb.listCollections().toArray()
  if (collections.length === 0) {
    console.warn(`Source database "${source}" has no collections — nothing to clone.`)
  }

  const report = []

  for (const { name: collName } of collections) {
    const sourceColl = sourceDb.collection(collName)
    const targetColl = targetDb.collection(collName)

    const sourceCount = await sourceColl.countDocuments()
    let copied = 0

    const cursor = sourceColl.find({})
    let batch = []
    while (await cursor.hasNext()) {
      batch.push(await cursor.next())
      if (batch.length >= BATCH_SIZE) {
        await targetColl.insertMany(batch, { ordered: true })
        copied += batch.length
        batch = []
      }
    }
    if (batch.length > 0) {
      await targetColl.insertMany(batch, { ordered: true })
      copied += batch.length
    }

    const targetCount = await targetColl.countDocuments()
    report.push({ collection: collName, sourceCount, copied, targetCount, match: sourceCount === targetCount })
  }

  console.log("\n── Clone report ─────────────────────────────────────────────────")
  for (const r of report) {
    const status = r.match ? "OK" : "MISMATCH"
    console.log(`${status.padEnd(8)} ${r.collection.padEnd(20)} source=${r.sourceCount}  copied=${r.copied}  target=${r.targetCount}`)
  }
  const allMatch = report.every(r => r.match)
  console.log("───────────────────────────────────────────────────────────────")
  console.log(allMatch
    ? `Clone complete: "${source}" -> "${target}", all ${report.length} collection(s) match.`
    : `Clone completed with MISMATCHES — inspect the report above before proceeding.`)

  await client.close()
  process.exit(allMatch ? 0 : 1)
}

run().catch(err => {
  console.error("Clone failed:", err)
  process.exit(1)
})
