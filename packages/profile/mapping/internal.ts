// Precomputed indices shared by index.ts and careerProgress.ts. Not part of the public API —
// kept in its own module (rather than inline in index.ts) so careerProgress.ts can import these
// without a circular dependency on index.ts, which re-exports careerProgress.ts.
import { CareerID } from "../taxonomy/careers";
import { SkillID } from "../taxonomy/skills";
import { COURSE_SKILLS } from "./courseSkills";
import { CAREER_SKILLS } from "./careerSkills";

// Indexing COURSE_SKILLS/CAREER_SKILLS by an arbitrary (not literal) string needs a type with an
// index signature; both `as const` objects are already structurally compatible with these, so
// this is a free reinterpretation, not a cast of the data.
export const courseSkillsIndex: Record<string, readonly SkillID[]> = COURSE_SKILLS;

type CareerSkillConfig = (typeof CAREER_SKILLS)[CareerID];
const careerSkillEntries = Object.entries(CAREER_SKILLS) as [CareerID, CareerSkillConfig][];

const CAREER_IDS: ReadonlySet<string> = new Set(careerSkillEntries.map(([career]) => career));
export const isCareerID = (id: string): id is CareerID => CAREER_IDS.has(id);

// Which skills establish a course's link to each career (see careersForCourse). CAREER_SKILLS
// itself is small enough that this isn't a hot-path optimization so much as documentation of
// "core skills decide the career link".
export const CAREER_CORE_SKILLS: ReadonlyMap<CareerID, ReadonlySet<SkillID>> = new Map(
  careerSkillEntries.map(([career, { core }]) => [career, new Set(core)])
);

// The reverse of COURSE_SKILLS, for "which courses would teach me this skill" (career gap
// suggestions). Course lists are sorted for stable output.
export const SKILL_COURSES: ReadonlyMap<SkillID, readonly string[]> = (() => {
  const bySkill = new Map<SkillID, string[]>();
  for (const [courseID, skills] of Object.entries(COURSE_SKILLS)) {
    for (const skill of skills) {
      const list = bySkill.get(skill);
      if (list) list.push(courseID);
      else bySkill.set(skill, [courseID]);
    }
  }
  for (const list of bySkill.values()) list.sort();
  return bySkill;
})();
