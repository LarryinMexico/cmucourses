import type { PlannedCourse, ProfileSemester, Workload } from "./schema";
import { workloadFitFor, type WorkloadFit } from "./scheduleGenerator";

export interface PlanGroup {
  year: string;
  semester: ProfileSemester;
  courses: { courseID: string; units: number | null }[];
  /** Units of the courses whose units are known. */
  totalUnits: number;
  /** Courses left out of `totalUnits` because their units are variable or not known (yet). */
  unknownUnits: string[];
  /** The total against the profile's unit range; UNKNOWN when there is no range or no known units. */
  workloadFit: WorkloadFit;
}

/** Order within a year: the academic calendar this planner sorts by. */
const SEMESTER_ORDER: Record<ProfileSemester, number> = { spring: 0, summer: 1, fall: 2 };

/**
 * Splits a course plan into its semesters, earliest first, with each semester's unit total and
 * how it sits against the student's target range. The same course may appear in several
 * semesters (a retake, or a plan still being shuffled).
 *
 * `units` maps a course id to its units, or null for variable units; an id that is missing is
 * treated the same way (its details may not have loaded).
 */
export const groupPlanBySemester = (
  planned: readonly PlannedCourse[],
  units: ReadonlyMap<string, number | null>,
  workload: Workload | null
): PlanGroup[] => {
  const byTerm = new Map<string, PlanGroup>();
  for (const { courseID, semester, year } of planned) {
    const key = `${year}:${semester}`;
    const group = byTerm.get(key) ?? {
      year,
      semester,
      courses: [],
      totalUnits: 0,
      unknownUnits: [],
      workloadFit: "UNKNOWN" as WorkloadFit,
    };
    const courseUnits = units.get(courseID) ?? null;
    group.courses.push({ courseID, units: courseUnits });
    if (courseUnits === null) group.unknownUnits.push(courseID);
    else group.totalUnits += courseUnits;
    byTerm.set(key, group);
  }

  const groups = [...byTerm.values()].sort(
    (a, b) => a.year.localeCompare(b.year) || SEMESTER_ORDER[a.semester] - SEMESTER_ORDER[b.semester]
  );
  for (const group of groups) {
    group.courses.sort((a, b) => a.courseID.localeCompare(b.courseID));
    group.unknownUnits.sort();
    const anyKnown = group.courses.some((course) => course.units !== null);
    group.workloadFit = anyKnown ? workloadFitFor(group.totalUnits, workload).fit : "UNKNOWN";
  }
  return groups;
};
