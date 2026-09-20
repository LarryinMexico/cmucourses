import { standardizeCourseID } from "../schema";
import { CareerID, CAREERS } from "../taxonomy/careers";
import { SkillID, SKILLS } from "../taxonomy/skills";
import { labelOf } from "../taxonomy/types";
import { CAREER_SKILLS } from "./careerSkills";
import { courseSkillsIndex, isCareerID, SKILL_COURSES } from "./internal";

export interface SkillGap {
  skill: SkillID;
  label: string;
  /** Courses that teach it, from coursesForSkill. May be empty. */
  courseIDs: readonly string[];
}

export interface CareerProgress {
  career: CareerID;
  label: string;
  coreTotal: number;
  coreCovered: number;
  /** Core skills not yet covered, each with courses that would close it. */
  gaps: SkillGap[];
  /** Core skills already covered. */
  covered: SkillID[];
}

export interface CareerProgressInput {
  /** profile.careers — ordered by priority. */
  careers: readonly string[];
  skillsHave: readonly string[];
  /** courseIDs already taken or in progress (profile.courses). */
  takenCourseIDs: readonly string[];
}

/**
 * "Skills you have" for progress purposes is skillsHave plus whatever the student's taken/
 * in-progress courses teach — having taken 15-213 counts as having systems-programming, without
 * the student re-declaring it by hand.
 */
const effectiveSkills = (skillsHave: readonly string[], takenCourseIDs: readonly string[]): Set<SkillID> => {
  const have = new Set(skillsHave as SkillID[]);
  for (const courseID of takenCourseIDs) {
    const skills = courseSkillsIndex[standardizeCourseID(courseID)] ?? [];
    for (const skill of skills) have.add(skill);
  }
  return have;
};

const progressFor = (career: CareerID, have: ReadonlySet<SkillID>): CareerProgress => {
  const { core } = CAREER_SKILLS[career];
  const covered: SkillID[] = [];
  const gaps: SkillGap[] = [];

  for (const skill of core) {
    if (have.has(skill)) {
      covered.push(skill);
    } else {
      gaps.push({ skill, label: labelOf(SKILLS, skill), courseIDs: SKILL_COURSES.get(skill) ?? [] });
    }
  }

  return {
    career,
    label: labelOf(CAREERS, career),
    coreTotal: core.length,
    coreCovered: covered.length,
    gaps,
    covered,
  };
};

/** Progress toward each of the student's selected careers, in their priority order. */
export const careerProgress = ({ careers, skillsHave, takenCourseIDs }: CareerProgressInput): CareerProgress[] => {
  const have = effectiveSkills(skillsHave, takenCourseIDs);
  return careers.filter(isCareerID).map((career) => progressFor(career, have));
};

/** The same computation over every career, for browsing rather than the student's own goals. */
export const allCareerProgress = (
  skillsHave: readonly string[],
  takenCourseIDs: readonly string[]
): CareerProgress[] => {
  const have = effectiveSkills(skillsHave, takenCourseIDs);
  return CAREERS.map(({ id }) => progressFor(id, have));
};
