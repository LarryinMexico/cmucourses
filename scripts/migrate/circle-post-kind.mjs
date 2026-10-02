/**
 * Gives every Circles post written before posts had a kind (PLANNED / ACTUAL) the kind ACTUAL.
 *
 *   bun run migrate-post-kind            dry run: counts the posts that would change
 *   bun run migrate-post-kind -- --yes   writes
 *
 * Run it BEFORE `bun run db-migrate` deploys the schema with `kind`: Prisma refuses to read a
 * post whose required `kind` is missing, so the feed and the share card would fail on old posts.
 * Run from the repo root so Bun loads MONGODB_URI from the root .env. It only sets `kind` where
 * it is missing; it never touches a post that already has one, or any other collection.
 */
import db from "../../packages/db/index.ts";

const CONFIRM = process.argv.includes("--yes");
const log = (...a) => console.log("[migrate-post-kind]", ...a);

const URI = process.env.MONGODB_URI;
if (!URI) {
  console.error("[migrate-post-kind] MONGODB_URI is not set. Run from the repo root or export it.");
  process.exit(1);
}
log("target:", URI.replace(/\/\/[^@]*@/, "//<redacted>@"));

const missing = { kind: { $exists: false } };
const count = async (filter) => (await db.$runCommandRaw({ count: "circlePosts", query: filter })).n;

const before = await count(missing);
log(`${await count({})} posts, ${before} without a kind`);

if (!CONFIRM) {
  log("dry run: nothing written. Add --yes to set kind = ACTUAL on those posts.");
} else if (before > 0) {
  const result = await db.$runCommandRaw({
    update: "circlePosts",
    updates: [{ q: missing, u: { $set: { kind: "ACTUAL" } }, multi: true }],
  });
  log(`updated ${result.nModified} posts; ${await count(missing)} still without a kind`);
}
await db.$disconnect();
