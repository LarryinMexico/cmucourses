#!/usr/bin/env bun
/**
 * Suggests courses that MIGHT teach a given skill but aren't in COURSE_SKILLS yet, by running
 * keyword searches against the live search API. Output only — never writes courseSkills.ts.
 * Keyword hits are a starting point for a human to check, not a verdict: they come from
 * substring matches over course descriptions, so false positives (an unrelated course that
 * happens to mention the word) are expected. Manual tool, needs network access, not run in CI.
 *
 * Usage: bun run packages/profile/scripts/suggest-courses.ts <skill-id> <keyword...>
 * Example: bun run packages/profile/scripts/suggest-courses.ts python python "data science"
 */
import { SKILLS } from "../taxonomy/skills";
import { COURSE_SKILLS } from "../mapping/courseSkills";

const SEARCH_URL = "https://course.apis.scottylabs.org/courses/search";
const MAX_PAGES_PER_KEYWORD = 3;

interface SearchDoc {
  courseID: string;
  name: string;
  department: string;
}

interface SearchPage {
  docs: SearchDoc[];
  totalPages: number;
}

const searchKeyword = async (keyword: string): Promise<SearchDoc[]> => {
  const results: SearchDoc[] = [];
  for (let page = 1; page <= MAX_PAGES_PER_KEYWORD; page++) {
    const url = `${SEARCH_URL}?${new URLSearchParams({ keywords: keyword, page: String(page) })}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Search failed for "${keyword}": ${response.status} ${response.statusText}`);
    const body = (await response.json()) as SearchPage;
    results.push(...body.docs);
    if (page >= body.totalPages) break;
  }
  return results;
};

const main = async () => {
  const [skillID, ...keywords] = process.argv.slice(2);

  if (!skillID || keywords.length === 0) {
    console.error("Usage: bun run packages/profile/scripts/suggest-courses.ts <skill-id> <keyword...>");
    process.exit(1);
  }
  if (!SKILLS.some((skill) => skill.id === skillID)) {
    console.error(`"${skillID}" isn't a known skill id. Known ids: ${SKILLS.map((s) => s.id).join(", ")}`);
    process.exit(1);
  }

  const alreadyMapped = new Set(
    Object.entries(COURSE_SKILLS)
      .filter(([, skills]) => (skills as readonly string[]).includes(skillID))
      .map(([courseID]) => courseID)
  );

  const hitsByCourse = new Map<string, { doc: SearchDoc; keywords: Set<string> }>();
  for (const keyword of keywords) {
    console.log(`Searching "${keyword}" ...`);
    const docs = await searchKeyword(keyword);
    for (const doc of docs) {
      if (alreadyMapped.has(doc.courseID)) continue;
      const existing = hitsByCourse.get(doc.courseID);
      if (existing) existing.keywords.add(keyword);
      else hitsByCourse.set(doc.courseID, { doc, keywords: new Set([keyword]) });
    }
  }

  const suggestions = [...hitsByCourse.values()].sort((a, b) => a.doc.courseID.localeCompare(b.doc.courseID));

  console.log(
    `\n${suggestions.length} candidate(s) for "${skillID}" not already mapped to it ` +
      `(${alreadyMapped.size} course(s) already are):`
  );
  for (const { doc, keywords: matched } of suggestions) {
    console.log(`  ${doc.courseID.padEnd(8)} ${doc.name.padEnd(55)} [${[...matched].join(", ")}]`);
  }
  console.log("\nCheck each one before adding it to courseSkills.ts — this list is unverified.");
};

void main();
