import {
  generateSchedules,
  type PlannedCourse,
  type CandidateCourse,
  type GenLecture,
  type GeneratorInput,
  type Profile,
  type ScheduleCandidate,
  type SectionPick,
  type SectionRef,
} from "@cmucourses/profile";
import type { CourseSessions } from "~/app/userSchedules";
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

const withLocation = (
  times: Schedule["lectures"][number]["times"],
  location: string
) => times.map((time) => ({ ...time, location }));

/**
 * The attendable options of one offering. Normally a lecture plus its linked sections; but many
 * catalog entries list only sections (no lectures), or sections whose `lecture` names no lecture.
 * Those sections become options of their own, or the generator would see a course it cannot place.
 */
const toGenLectures = (schedule: Schedule | undefined): GenLecture[] => {
  if (!schedule) return [];
  const lectureNames = new Set(
    schedule.lectures.map((lecture) => lecture.name)
  );
  const lectures: GenLecture[] = schedule.lectures.map((lecture) => ({
    name: lecture.name,
    times: withLocation(lecture.times, lecture.location),
    sections: schedule.sections
      .filter((section) => section.lecture === lecture.name)
      .map((section) => ({
        name: section.name,
        times: withLocation(section.times, section.location),
      })),
  }));
  const standalone: GenLecture[] = schedule.sections
    .filter((section) => !lectureNames.has(section.lecture))
    .map((section) => ({
      name: section.name,
      times: withLocation(section.times, section.location),
      sections: [],
    }));
  return [...lectures, ...standalone];
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

/**
 * The lecture/section choices after applying a generated candidate. Only the courses the candidate
 * placed change; a course it could not place keeps whatever the student had, so nothing disappears
 * from the calendar. A standalone section (no lecture) comes back from the generator as `lecture`.
 */
export const candidateToCourseSessions = (
  current: CourseSessions,
  picks: readonly Pick<SectionPick, "courseID" | "lecture" | "section">[],
  standaloneSections: ReadonlySet<string> = new Set()
): CourseSessions => {
  const next: CourseSessions = { ...current };
  for (const pick of picks) {
    const existing = next[pick.courseID];
    if (!existing) continue;
    const key = `${pick.courseID}:${pick.lecture}`;
    next[pick.courseID] = standaloneSections.has(key)
      ? { ...existing, Lecture: "", Section: pick.lecture }
      : { ...existing, Lecture: pick.lecture, Section: pick.section ?? "" };
  }
  return next;
};

/** `courseID:section` for every section in the chosen offering that belongs to no lecture. */
export const standaloneSectionKeys = (
  courseDetails: Course[],
  selectedSession: string
): Set<string> => {
  const keys = new Set<string>();
  for (const course of courseDetails) {
    const schedule = course.schedules?.find(
      (s) => sessionToString(s) === selectedSession
    );
    if (!schedule) continue;
    const lectureNames = new Set(schedule.lectures.map((l) => l.name));
    for (const section of schedule.sections) {
      if (!lectureNames.has(section.lecture))
        keys.add(`${course.courseID}:${section.name}`);
    }
  }
  return keys;
};
