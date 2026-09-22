/**
 * Starts a throwaway in-memory MongoDB replica set and loads the CMU course catalog into it,
 * so the backend in this repo can be developed against real course data.
 *
 * The catalog lives only in ScottyLabs' production database, so it is fetched once from their
 * public API and cached under ~/.cache/cmucourses-local-catalog. Prisma rejects a standalone
 * mongod, hence the replica set.
 *
 * Run via scripts/local-catalog/start.sh, not directly.
 */
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { MongoClient } from "mongodb";
import path from "node:path";
import { loadCatalog } from "../catalog/load.mjs";

const CACHE = process.env.CATALOG_CACHE;
const PORT = Number(process.env.MONGO_PORT || 27018);
const catalogDir = path.join(CACHE, "catalog");

const repl = await MongoMemoryReplSet.create({
  replSet: { count: 1, storageEngine: "wiredTiger" },
  instanceOpts: [{ port: PORT, launchTimeout: 120000 }],
});
const uri = repl.getUri("cmucourses");

const client = await MongoClient.connect(uri);
const db = client.db("cmucourses");

const { courses, schedules } = loadCatalog(catalogDir);

await db.collection("courses").deleteMany({});
await db.collection("schedules").deleteMany({});
for (let i = 0; i < courses.size; i += 1000) {
  await db.collection("courses").insertMany([...courses.values()].slice(i, i + 1000));
}
for (let i = 0; i < schedules.length; i += 2000) {
  await db.collection("schedules").insertMany(schedules.slice(i, i + 2000));
}

// Mirror the indexes schema.prisma declares, so queries behave like production.
await db.collection("courses").createIndex(
  { name: "text", department: "text", desc: "text", prereqString: "text" },
  { name: "text" }
);
await db.collection("courses").createIndex({ courseID: 1 }, { unique: true });
await db.collection("schedules").createIndex({ courseID: 1 }, { name: "courseID_1" });

console.log(`[catalog] ${courses.size} courses, ${schedules.length} schedules on port ${PORT}`);
console.log("[catalog] READY");
await client.close();

const stop = async () => {
  await repl.stop();
  process.exit(0);
};
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
setInterval(() => {}, 1 << 30);
