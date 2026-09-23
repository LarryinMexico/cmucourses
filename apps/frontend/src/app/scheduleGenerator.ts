import {
  generateSchedules,
  type PlannedCourse,
  type CandidateCourse,
  type GenLecture,
  type GeneratorInput,
  type Profile,
  type ScheduleCandidate,
  type SectionRef,
} from "@cmucourses/profile";
import { Course, Schedule } from "~/app/types";
import {
  isValidUnits,
  parseUnits,
  sessionToString,
  stringToSession,
} from "~/app/utils";

export type { ScheduleCandidate, SectionRef } from "@cmucourses/profile";

/** Per-run adjustments the student makes in the Generate panel; none of it is saved to the profile. */
export interface RefineOptions {
  locks?: readonly SectionRef[];
  excluded?: readonly SectionRef[];
  maxCandidates?: number;
  /** Courses the generator may add or leave out, to fit the units range. */
  poolIDs?: readonly string[];
  /** Replaces the profile's units-per-semester range for this run only. */
  unitsRange?: { min: number | null; max: number | null };
}

const toGenLectures = (schedule: Schedule | undefined): GenLecture[] => {
  if (!schedule) return [];
  return schedule.lectures.map((lecture) => ({
    name: lecture.name,
    times: lecture.times.map((time) => ({
      ...time,
      location: lecture.location,
    })),
    sections: schedule.sections
      .filter((section) => section.lecture === lecture.name)
      .map((section) => ({
        name: section.name,
        times: section.times.map((time) => ({
          ...time,
          location: section.location,
        })),
      })),
  }));
};

/** Builds the generator's input from the catalog data already fetched for a course list. */
export const buildGeneratorInput = (
  courseIDs: string[],
  courseDetails: Course[],
  selectedSession: string,
  profile: Profile,
  refine: RefineOptions = {}
): GeneratorInput => {
  const toCandidate = (courseID: string): CandidateCourse => {
    const course = courseDetails.find((c) => c.courseID === courseID);
    const schedule = course?.schedules?.find(
      (s) => sessionToString(s) === selectedSession
    );
    const units =
      course?.units && isValidUnits(course.units)
        ? parseUnits(course.units)
        : 0;
    return { courseID, units, lectures: toGenLectures(schedule) };
  };
  const courses = courseIDs.map(toCandidate);
  const optionalCourses = (refine.poolIDs ?? []).map(toCandidate);

  return {
    courses,
    optionalCourses,
    busyBlocks: profile.busyBlocks,
    workload: refine.unitsRange
      ? {
          unitsMin: refine.unitsRange.min,
          unitsMax: refine.unitsRange.max,
          hoursPerWeek: profile.workload?.hoursPerWeek ?? null,
        }
      : profile.workload,
    careers: profile.careers,
    skillsWant: profile.skillsWant,
    skillsHave: profile.skillsHave,
    preferences: profile.schedulePreferences,
    preferredModality: profile.modality,
    locks: refine.locks,
    excluded: refine.excluded,
    maxCandidates: refine.maxCandidates,
  };
};

export const generateCandidates = (
  input: GeneratorInput
): ScheduleCandidate[] => generateSchedules(input);

/** How many courses the pool holds at most; the search grows with it. */
export const MAX_POOL = 12;

/**
 * The planned courses that belong to the semester picked in the schedule builder. The plan says
 * "summer" where a schedule says which summer session, so any summer sub-session picks them up.
 */
export const plannedCourseIDsForSession = (
  planned: readonly PlannedCourse[],
  selectedSession: string
): string[] => {
  const session = stringToSession(selectedSession);
  if (!session.semester) return [];
  return [
    ...new Set(
      planned
        .filter(
          (course) =>
            course.semester === session.semester && course.year === session.year
        )
        .map((course) => course.courseID)
    ),
  ];
};

/** Saved and/or planned courses the generator may add, minus what is already scheduled. */
export const poolCourseIDs = ({
  saved,
  planned,
  scheduled,
  includeSaved,
  includePlanned,
}: {
  saved: readonly string[];
  planned: readonly string[];
  scheduled: readonly string[];
  includeSaved: boolean;
  includePlanned: boolean;
}): { ids: string[]; cut: number } => {
  const inSchedule = new Set(scheduled);
  const all = [
    ...new Set([
      ...(includePlanned ? planned : []),
      ...(includeSaved ? saved : []),
    ]),
  ].filter((id) => !inSchedule.has(id));
  return {
    ids: all.slice(0, MAX_POOL),
    cut: Math.max(0, all.length - MAX_POOL),
  };
};
