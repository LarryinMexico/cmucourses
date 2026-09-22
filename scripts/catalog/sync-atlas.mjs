#!/usr/bin/env bun
/**
 * Syncs the CMU course catalog (courses + schedules + geneds) from ScottyLabs' public API
 * into the team's own Atlas cluster - the same one `profiles`/`ratings`/etc already live in.
 *
 * Why: `NEXT_PUBLIC_BACKEND_URL` normally points at ScottyLabs' public API for course search,
 * because the catalog lives only in their database. But that means it runs *their* deployed
 * backend, so any query parameter this repo's backend adds (classTimes, the schedule filters)
 * is silently ignored. Once Atlas holds a copy of the catalog, `NEXT_PUBLIC_BACKEND_URL` can
 * point at our own backend and `bun run dev` alone exercises everything - no more switching to
 * scripts/local-catalog/start.sh's throwaway in-memory database just to test a search change.
 *
 * Safety: writes ONLY the courses, schedules, and geneds collections. Never touches profiles,
 * ratings, or anything else, and never drops the database. Without --yes this only prints what
 * it would do and exits - nothing is written.
 *
 * Usage (from the repo root, so Bun loads .env):
 *   bun run catalog-sync            # dry run - prints the plan, writes nothing
 *   bun run catalog-sync -- --yes   # actually replaces courses/schedules/geneds
 *
 * The catalog is a point-in-time snapshot (cached under ~/.cache/cmucourses-local-catalog by
 * default). Re-run this after a new semester's schedules are published upstream.
 */
import { MongoClient } from "mongodb";
import { loadCatalog } from "./load.mjs";
import { downloadCatalog } from "./download.mjs";

const CACHE = process.env.CATALOG_CACHE || `${process.env.HOME}/.cache/cmucourses-local-catalog`;
const CATALOG_DIR = `${CACHE}/catalog`;
const CONFIRM = process.argv.includes("--yes");

const GENED_SCHOOLS = ["SCS", "CIT", "MCS", "Dietrich"];
const GENEDS_API = "https://course.apis.scottylabs.org/geneds";

const log = (...args) => console.log("[catalog-sync]", ...args);

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error(
    "[catalog-sync] MONGODB_URI is not set. Run this from the repo root (bun run catalog-sync) " +
      "so Bun loads the root .env, or export MONGODB_URI directly."
  );
  process.exit(1);
}

/**
 * The public /geneds?school=X response is already a joined view (course name/units/desc/fces
 * alongside the gened row), but every raw `geneds` field - courseID, tags, startsCounting,
 * stopsCounting - is present verbatim on each item. `school` is the parameter queried with,
 * since the response doesn't echo it back.
 */
const fetchGenedsForSchool = async (school) => {
  const res = await fetch(`${GENEDS_API}?school=${encodeURIComponent(school)}`, {
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`geneds fetch failed for ${school}: HTTP ${res.status}`);
  const rows = await res.json();
  return rows.map((row) => ({
    courseID: row.courseID,
    school,
    tags: row.tags ?? [],
    startsCounting: row.startsCounting ?? null,
    stopsCounting: row.stopsCounting ?? null,
    v: 0, // schema.prisma's `geneds.v` (mapped from __v) is required, unlike courses/schedules
  }));
};

const fetchAllGeneds = async () => {
  const perSchool = await Promise.all(GENED_SCHOOLS.map(fetchGenedsForSchool));
  return perSchool.flat();
};

log(`target: ${MONGODB_URI.replace(/\/\/[^@]*@/, "//<redacted>@")}`);
log("will replace: courses, schedules, geneds");
log("will NOT touch: profiles, ratings, or any other collection");

if (!CONFIRM) {
  log("dry run - pass --yes to actually write (e.g. `bun run catalog-sync -- --yes`)");
  process.exit(0);
}

log("downloading catalog pages (skips ones already cached)...");
const totalPages = await downloadCatalog(CATALOG_DIR);
log(`catalog cache has ${totalPages} pages`);

log("converting cached pages...");
const { courses, schedules } = loadCatalog(CATALOG_DIR);

log("fetching geneds for", GENED_SCHOOLS.join(", "), "...");
const geneds = await fetchAllGeneds();

const client = await MongoClient.connect(MONGODB_URI);
// No db name argument: the driver resolves the default database from MONGODB_URI itself,
// same as Prisma does from its `url = env("MONGODB_URI")` datasource - so this always targets
// whatever database the backend actually connects to, never a hardcoded guess.
const db = client.db();

if (!db.databaseName || db.databaseName === "test") {
  console.error(
    `[catalog-sync] MONGODB_URI resolved to database "${db.databaseName || "(none)"}", which ` +
      "looks like the driver's fallback rather than a real target. Add a database name to the " +
      "connection string's path before re-running."
  );
  await client.close();
  process.exit(1);
}
log(`resolved database: ${db.databaseName}`);

const counts = async () => ({
  courses: await db.collection("courses").countDocuments(),
  schedules: await db.collection("schedules").countDocuments(),
  geneds: await db.collection("geneds").countDocuments(),
});

const before = await counts();

await db.collection("courses").deleteMany({});
await db.collection("schedules").deleteMany({});
await db.collection("geneds").deleteMany({});

const courseList = [...courses.values()];
for (let i = 0; i < courseList.length; i += 1000) {
  await db.collection("courses").insertMany(courseList.slice(i, i + 1000));
}
for (let i = 0; i < schedules.length; i += 2000) {
  await db.collection("schedules").insertMany(schedules.slice(i, i + 2000));
}
if (geneds.length > 0) {
  await db.collection("geneds").insertMany(geneds);
}

// Mirror the indexes schema.prisma declares, so queries behave like production. On a database
// that has ever run `bun run db-migrate` (prisma db push), these already exist - just under
// Prisma's own naming convention (e.g. `courses_courseID_key` instead of the driver's default
// `courseID_1`) - so "already exists" (code 85/86) is expected and not a real failure; anything
// else should still stop the sync.
const ensureIndex = async (collection, spec, options) => {
  try {
    await db.collection(collection).createIndex(spec, options);
  } catch (err) {
    if (err.code === 85 || err.code === 86) {
      log(`  (${collection} already has an equivalent index - ${err.codeName})`);
    } else {
      throw err;
    }
  }
};

await ensureIndex(
  "courses",
  { name: "text", department: "text", desc: "text", prereqString: "text" },
  { name: "text" }
);
await ensureIndex("courses", { courseID: 1 }, { unique: true });
await ensureIndex("schedules", { courseID: 1 }, { name: "courseID_1" });

const after = await counts();
await client.close();

log("done");
log(`  courses:   ${before.courses} -> ${after.courses}`);
log(`  schedules: ${before.schedules} -> ${after.schedules}`);
log(`  geneds:    ${before.geneds} -> ${after.geneds}`);
