#!/usr/bin/env bun
/**
 * Checks every courseID referenced by COURSE_SKILLS and the degree-requirements data against
 * the live course catalog, and reports any that don't exist there (renumbered, dropped, or - for
 * requirements - handbook data ahead of the catalog). Manual maintenance tool — needs network
 * access, not run in CI.
 *
 * 95-867 (MISM's "Tech Strategy & Governance") is EXPECTED to be reported missing: it's in the
 * program handbook but does not exist anywhere in the catalog as of 2026-09-19. See the comment
 * in requirements/mism.ts. Anything else reported missing is a real problem to fix.
 *
 * Usage: bun run packages/profile/scripts/check-course-ids.ts
 */
import { COURSE_SKILLS } from "../mapping/courseSkills";
import { requirementsForMajor } from "../requirements";

const CATALOG_URL = "https://course.apis.scottylabs.org/courses/all";

interface CatalogEntry {
  courseID: string;
  name: string;
}

/** courseID -> source describing where it came from, for the report. */
const collectSourceIDs = (): Map<string, string> => {
  const bySource = new Map<string, string>();
  for (const id of Object.keys(COURSE_SKILLS)) bySource.set(id, `courseSkills.ts (${COURSE_SKILLS[id as keyof typeof COURSE_SKILLS].join(", ")})`);

  const mism = requirementsForMajor("mism");
  for (const requirement of mism?.core ?? []) {
    for (const option of requirement.options) bySource.set(option, `requirements/mism.ts (${requirement.id})`);
  }

  return bySource;
};

const main = async () => {
  console.log(`Fetching ${CATALOG_URL} ...`);
  const response = await fetch(CATALOG_URL);
  if (!response.ok) {
    console.error(`Catalog fetch failed: ${response.status} ${response.statusText}`);
    process.exit(1);
  }
  const catalog = (await response.json()) as CatalogEntry[];
  const validIDs = new Set(catalog.map((course) => course.courseID));

  const sourceIDs = collectSourceIDs();
  const missing = [...sourceIDs.keys()].filter((id) => !validIDs.has(id));

  console.log(`${sourceIDs.size} referenced course ids, ${catalog.length} in the live catalog.`);

  if (missing.length === 0) {
    console.log("All referenced course ids exist in the live catalog.");
    return;
  }

  console.log(`\n${missing.length} referenced course id(s) NOT found in the live catalog:`);
  for (const id of missing) {
    console.log(`  ${id}  (${sourceIDs.get(id)})`);
  }
  console.log(
    "\ncourseSkills.ts entries here were likely renumbered or dropped - fix or remove them.\n" +
      "requirements/*.ts entries here may be expected (see that file's header comment)."
  );
  process.exitCode = missing.length === 1 && missing[0] === "95-867" ? 0 : 1;
};

void main();
