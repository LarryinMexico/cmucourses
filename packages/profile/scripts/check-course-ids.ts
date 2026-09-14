#!/usr/bin/env bun
/**
 * Checks every courseID in COURSE_SKILLS against the live course catalog and reports any that
 * no longer exist there (renumbered or dropped courses). Manual maintenance tool — needs
 * network access, not run in CI.
 *
 * Usage: bun run packages/profile/scripts/check-course-ids.ts
 */
import { COURSE_SKILLS } from "../mapping/courseSkills";

const CATALOG_URL = "https://course.apis.scottylabs.org/courses/all";

interface CatalogEntry {
  courseID: string;
  name: string;
}

const main = async () => {
  console.log(`Fetching ${CATALOG_URL} ...`);
  const response = await fetch(CATALOG_URL);
  if (!response.ok) {
    console.error(`Catalog fetch failed: ${response.status} ${response.statusText}`);
    process.exit(1);
  }
  const catalog = (await response.json()) as CatalogEntry[];
  const validIDs = new Set(catalog.map((course) => course.courseID));

  const mappedIDs = Object.keys(COURSE_SKILLS);
  const missing = mappedIDs.filter((id) => !validIDs.has(id));

  console.log(`${mappedIDs.length} courses in COURSE_SKILLS, ${catalog.length} in the live catalog.`);

  if (missing.length === 0) {
    console.log("All mapped course ids exist in the live catalog.");
    return;
  }

  console.log(`\n${missing.length} mapped course id(s) NOT found in the live catalog:`);
  for (const id of missing) {
    console.log(`  ${id}  (skills: ${COURSE_SKILLS[id as keyof typeof COURSE_SKILLS].join(", ")})`);
  }
  console.log("\nThese were likely renumbered or dropped — fix or remove their entries in courseSkills.ts.");
  process.exitCode = 1;
};

void main();
