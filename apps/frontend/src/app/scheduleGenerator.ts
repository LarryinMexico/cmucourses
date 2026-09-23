import {
  generateSchedules,
  type CandidateCourse,
  type GenLecture,
  type GeneratorInput,
  type Profile,
  type ScheduleCandidate,
  type SectionRef,
} from "@cmucourses/profile";
import { Course, Schedule } from "~/app/types";
import { isValidUnits, parseUnits, sessionToString } from "~/app/utils";

export type { ScheduleCandidate, SectionRef } from "@cmucourses/profile";

/** Per-run adjustments the student makes in the Generate panel; none of it is saved to the profile. */
export interface RefineOptions {
  locks?: readonly SectionRef[];
  excluded?: readonly SectionRef[];
  maxCandidates?: number;
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
  const courses: CandidateCourse[] = courseIDs.map((courseID) => {
    const course = courseDetails.find((c) => c.courseID === courseID);
    const schedule = course?.schedules?.find(
      (s) => sessionToString(s) === selectedSession
    );
    const units =
      course?.units && isValidUnits(course.units)
        ? parseUnits(course.units)
        : 0;
    return { courseID, units, lectures: toGenLectures(schedule) };
  });

  return {
    courses,
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
