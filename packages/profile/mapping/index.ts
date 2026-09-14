import { standardizeCourseID } from "../schema";
import { CareerID, CAREERS } from "../taxonomy/careers";
import { SkillID, SKILLS } from "../taxonomy/skills";
import { labelOf } from "../taxonomy/types";
import { COURSE_SKILLS } from "./courseSkills";
import { CAREER_SKILLS } from "./careerSkills";

export { COURSE_SKILLS } from "./courseSkills";
export { CAREER_SKILLS } from "./careerSkills";

// Indexing COURSE_SKILLS/CAREER_SKILLS by an arbitrary (not literal) string needs a type with an
// index signature; both `as const` objects are already structurally compatible with these, so
// this is a free reinterpretation, not a cast of the data.
const courseSkillsIndex: Record<string, readonly SkillID[]> = COURSE_SKILLS;
type CareerSkillConfig = (typeof CAREER_SKILLS)[CareerID];
const careerSkillEntries = Object.entries(CAREER_SKILLS) as [CareerID, CareerSkillConfig][];

const CAREER_IDS: ReadonlySet<string> = new Set(careerSkillEntries.map(([career]) => career));
const isCareerID = (id: string): id is CareerID => CAREER_IDS.has(id);

// Precomputed once at module load: which skills establish a course's link to each career (see
// careersForCourse). CAREER_SKILLS itself is small enough that this isn't a hot-path
// optimization so much as documentation of "core skills decide the career link".
const CAREER_CORE_SKILLS: ReadonlyMap<CareerID, ReadonlySet<SkillID>> = new Map(
  careerSkillEntries.map(([career, { core }]) => [career, new Set(core)])
);

/** The skills a course teaches, standardizing the course ID first. `[]` if not mapped yet. */
export const skillsForCourse = (courseID: string): readonly SkillID[] =>
  courseSkillsIndex[standardizeCourseID(courseID)] ?? [];

/** The careers a course serves: those whose core skills overlap what the course teaches. */
export const careersForCourse = (courseID: string): CareerID[] => {
  const skills = skillsForCourse(courseID);
  if (skills.length === 0) return [];

  const careers: CareerID[] = [];
  for (const [career, coreSkills] of CAREER_CORE_SKILLS) {
    if (skills.some((skill) => coreSkills.has(skill))) careers.push(career);
  }
  return careers;
};

export interface CourseRecommendation {
  courseID: string;
  score: number;
  /** Skill labels that contributed to the score, e.g. ["Machine Learning", "Python"]. */
  reasons: string[];
}

export interface RecommendCoursesInput {
  /** profile.careers — ordered by priority; the first is weighted highest. */
  careers: readonly string[];
  skillsWant: readonly string[];
  skillsHave: readonly string[];
  /** courseIDs already taken or in progress (profile.courses) — excluded from results. */
  takenCourseIDs: readonly string[];
  limit?: number;
}

const CORE_WEIGHT_PRIMARY = 3;
const CORE_WEIGHT_OTHER = 2;
const SUPPORTING_WEIGHT = 1;
const WANT_WEIGHT = 2;
const DEFAULT_LIMIT = 50;

/**
 * Ranks courses by how well they serve the student's goals. Only skills the student doesn't
 * already have count; a course that teaches nothing new scores 0 and is dropped, along with any
 * course already taken or in progress.
 *
 * Scoring, summed per matching skill: the primary career's core skills score
 * CORE_WEIGHT_PRIMARY, other selected careers' core skills score CORE_WEIGHT_OTHER, any selected
 * career's supporting skills score SUPPORTING_WEIGHT, and skillsWant scores WANT_WEIGHT
 * independently of career — so a skill that is both a career's core skill and on the student's
 * want list scores both.
 */
export const recommendCourses = ({
  careers,
  skillsWant,
  skillsHave,
  takenCourseIDs,
  limit = DEFAULT_LIMIT,
}: RecommendCoursesInput): CourseRecommendation[] => {
  const taken = new Set(takenCourseIDs.map(standardizeCourseID));
  const have = new Set(skillsHave);
  const want = new Set(skillsWant);
  const [primaryCareer, ...otherCareers] = careers.filter(isCareerID);

  const scoreAgainstCareer = (
    career: CareerID,
    coreWeight: number,
    newSkills: readonly SkillID[],
    reasonSkills: Set<SkillID>
  ): number => {
    const { core, supporting } = CAREER_SKILLS[career];
    let careerScore = 0;
    for (const skill of newSkills) {
      if ((core as readonly SkillID[]).includes(skill)) {
        careerScore += coreWeight;
        reasonSkills.add(skill);
      } else if ((supporting as readonly SkillID[]).includes(skill)) {
        careerScore += SUPPORTING_WEIGHT;
        reasonSkills.add(skill);
      }
    }
    return careerScore;
  };

  const results: CourseRecommendation[] = [];

  for (const [courseID, skills] of Object.entries(COURSE_SKILLS)) {
    if (taken.has(courseID)) continue;

    const newSkills = skills.filter((skill) => !have.has(skill));
    if (newSkills.length === 0) continue;

    const reasonSkills = new Set<SkillID>();
    let score = 0;
    if (primaryCareer) score += scoreAgainstCareer(primaryCareer, CORE_WEIGHT_PRIMARY, newSkills, reasonSkills);
    for (const career of otherCareers) score += scoreAgainstCareer(career, CORE_WEIGHT_OTHER, newSkills, reasonSkills);
    for (const skill of newSkills) {
      if (want.has(skill)) {
        score += WANT_WEIGHT;
        reasonSkills.add(skill);
      }
    }

    if (score === 0) continue;
    results.push({ courseID, score, reasons: [...reasonSkills].map((id) => labelOf(SKILLS, id)) });
  }

  results.sort((a, b) => b.score - a.score || a.courseID.localeCompare(b.courseID));
  return results.slice(0, limit);
};

/** For diagnostics/scripts: every career id, so a script can iterate without importing taxonomy directly. */
export const ALL_CAREER_IDS: readonly CareerID[] = CAREERS.map((career) => career.id);
