/**
 * Reads the cached catalog pages (see download.mjs) and converts them into insertable
 * `courses`/`schedules` documents. Pure - no DB, no network. Shared by
 * scripts/local-catalog/seed.mjs (in-memory dev rig) and scripts/catalog/sync-atlas.mjs
 * (writes to the team's real Atlas cluster) so the conversion logic exists exactly once.
 */
import { ObjectId } from "mongodb";
import fs from "node:fs";
import path from "node:path";

const oid = (v) => {
  const hex = typeof v === "string" ? v : v && typeof v === "object" ? v.$oid : null;
  return typeof hex === "string" && /^[0-9a-f]{24}$/.test(hex) ? new ObjectId(hex) : new ObjectId();
};

/** Prisma's typed reads require _id on every nested composite (lectures/sections/times). */
const conv = (v) => {
  if (Array.isArray(v)) return v.map(conv);
  if (v && typeof v === "object") {
    const out = {};
    for (const [k, val] of Object.entries(v)) {
      if (k === "id" || k === "_id") out._id = oid(val);
      else if (k === "v" || k === "__v") continue;
      else out[k] = conv(val);
    }
    if (!out._id) out._id = new ObjectId();
    return out;
  }
  return v;
};

/**
 * Reads every cached page under `catalogDir` (scripts/local-catalog/start.sh's
 * `$CACHE/catalog`, or download.mjs's output) and returns converted, insert-ready documents.
 *
 * @param {string} catalogDir
 * @returns {{ courses: Map<string, object>, schedules: object[] }}
 */
export const loadCatalog = (catalogDir) => {
  const courses = new Map();
  const schedules = [];

  for (const file of fs.readdirSync(catalogDir).filter((f) => f.endsWith(".json"))) {
    const page = JSON.parse(fs.readFileSync(path.join(catalogDir, file), "utf8"));
    for (const raw of page.docs || []) {
      const { schedules: scheds, ...rest } = raw;
      const course = conv(rest);
      courses.set(course.courseID, course);
      for (const s of scheds || []) {
        const sc = conv(s);
        schedules.push({ ...sc, courseID: sc.courseID ?? course.courseID });
      }
    }
  }

  return { courses, schedules };
};

/** The fields of the courses text index; must match `@@fulltext` on `courses` in schema.prisma. */
export const COURSE_TEXT_INDEX_FIELDS = ["courseID", "name", "department", "desc", "prereqString"];

/**
 * Makes the courses text index cover COURSE_TEXT_INDEX_FIELDS. A collection allows one text index,
 * and createIndex will not change an existing one's fields (it fails with a conflict), so an older
 * index - e.g. the one without courseID, which made a course unsearchable by its own number - is
 * dropped and rebuilt.
 */
export const ensureCourseTextIndex = async (db, log = console.log) => {
  const courses = db.collection("courses");
  const existing = (await courses.indexes()).find((index) => index.key?._fts === "text");
  if (existing) {
    const current = Object.keys(existing.weights ?? {}).sort();
    const wanted = [...COURSE_TEXT_INDEX_FIELDS].sort();
    if (current.length === wanted.length && current.every((field, i) => field === wanted[i])) return;
    log(`rebuilding courses text index "${existing.name}" to cover ${COURSE_TEXT_INDEX_FIELDS.join(", ")}`);
    await courses.dropIndex(existing.name);
  }
  await courses.createIndex(Object.fromEntries(COURSE_TEXT_INDEX_FIELDS.map((field) => [field, "text"])), {
    name: "text",
  });
};
