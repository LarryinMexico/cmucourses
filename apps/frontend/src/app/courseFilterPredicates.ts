import {
  availabilityFit,
  meetingGroupsFor,
  parseCatalogTime,
  type BusyBlock,
} from "@cmucourses/profile";
import type { Course, Schedule, Session, Time } from "./types";
import { compareSessions, filterSessions } from "./utils";
import type { ClassTime, FiltersState } from "./filters";

export interface ClientCourseFilters {
  meetingDays?: number[];
  timeRange?: { begin: number; end: number };
  /** When set, only judge these offerings (Offered in). Otherwise most recent. */
  sessions?: Session[];
  fitAvailability?: boolean;
  /** Department names, as the search sidebar stores them. */
  departments?: string[];
  /** Hundreds digit of the course number ("15-213" is level 2). */
  levels?: number[];
  units?: { min: number; max: number };
  classTimes?: ClassTime[];
}


/** Same buckets as the backend's CLASS_TIME_PATTERNS: by begin time, tba when untimed. */
export const classTimeOf = (time: Time): ClassTime => {
  const begin = parseCatalogTime(time.begin);
  if (begin === null) return "tba";
  if (begin >= 6 * 60 && begin < 12 * 60) return "morning";
  if (begin >= 12 * 60 && begin < 17 * 60) return "afternoon";
  if (begin >= 17 * 60) return "evening";
  return "tba";
};

/** "12", a range "1-12" or a list "3,5,9" matches when any value is in range; "VAR" always does. */
export const unitsInRange = (
  units: string,
  range: { min: number; max: number }
): boolean => {
  const values = units
    .split(/[-,]/)
    .map((part) => parseFloat(part))
    .filter((n) => !Number.isNaN(n));
  if (values.length === 0) return true;
  const inRange = (n: number) => n >= range.min && n <= range.max;
  if (units.includes("-") && values.length === 2) {
    const [low, high] = values as [number, number];
    return low <= range.max && high >= range.min;
  }
  return values.some(inRange);
};

const courseLevel = (courseID: string) => parseInt(courseID.charAt(3), 10);

const allTimes = (schedule: Schedule): Time[] => [
  ...schedule.lectures.flatMap((lecture) => lecture.times || []),
  ...schedule.sections.flatMap((section) => section.times || []),
];

/**
 * Is this schedule one of the chosen "Offered in" sessions? A summer choice with a sub-session
 * (Summer One) only matches that sub-session; a plain Summer choice matches all of them.
 * The API sends `year` as a number and a chosen Session holds it as a string, hence String().
 */
const scheduleInSession = (schedule: Schedule, session: Session): boolean =>
  String(schedule.year) === String(session.year) &&
  schedule.semester === session.semester &&
  (!session.session || schedule.session === session.session);

/**
 * The offerings a course is judged on: the chosen sessions, else only the most recent one.
 * The backend's fitAvailabilityStage mirrors this; keep the two in step.
 */
export const schedulesInScope = (
  schedules: Schedule[],
  sessions: Session[] | undefined
): Schedule[] => {
  if (sessions && sessions.length > 0) {
    return schedules.filter((schedule) =>
      sessions.some((session) => scheduleInSession(schedule, session))
    );
  }
  const mostRecent = filterSessions(schedules).sort(compareSessions)[0];
  return mostRecent ? [mostRecent] : [];
};

const meetingMatches = (
  time: Time,
  days: number[] | undefined,
  range: ClientCourseFilters["timeRange"]
) => {
  // Any selected weekday on the slot is enough (Mon+Wed survives Monday-only).
  if (
    days &&
    days.length > 0 &&
    !time.days.some((day) => days.includes(day))
  )
    return false;
  if (!range) return true;
  const begin = parseCatalogTime(time.begin);
  const end = parseCatalogTime(time.end);
  return (
    begin !== null && end !== null && begin >= range.begin && end <= range.end
  );
};

export const courseMatchesClientFilters = (
  course: Course,
  filters: ClientCourseFilters,
  busyBlocks: BusyBlock[]
): boolean => {
  if (filters.departments && !filters.departments.includes(course.department))
    return false;
  if (filters.levels && !filters.levels.includes(courseLevel(course.courseID)))
    return false;
  if (filters.units && !unitsInRange(course.units, filters.units)) return false;

  const needsSchedules =
    filters.sessions !== undefined ||
    filters.meetingDays !== undefined ||
    filters.timeRange !== undefined ||
    filters.classTimes !== undefined ||
    !!filters.fitAvailability;
  if (!needsSchedules) return true;

  const scoped = schedulesInScope(course.schedules ?? [], filters.sessions);
  if (scoped.length === 0) return false;

  if (filters.classTimes) {
    const selected = filters.classTimes;
    const matches = scoped.some((schedule) =>
      allTimes(schedule).some((time) => selected.includes(classTimeOf(time)))
    );
    if (!matches) return false;
  }

  if (filters.meetingDays || filters.timeRange) {
    const matches = scoped.some((schedule) =>
      allTimes(schedule).some((time) =>
        meetingMatches(time, filters.meetingDays, filters.timeRange)
      )
    );
    if (!matches) return false;
  }

  // No busy times (or profile still loading) → do not hide everything.
  if (filters.fitAvailability) {
    if (busyBlocks.length === 0) return true;
    const fits = scoped.some((schedule) => {
      const groups = meetingGroupsFor(schedule.lectures, schedule.sections);
      return availabilityFit(groups, busyBlocks).status === "FITS";
    });
    if (!fits) return false;
  }

  return true;
};

/**
 * The sidebar's filters as a Match-my-goals list applies them: the same active, non-empty groups
 * fetchCourseInfosByPage sends to /search (units only when narrower than 0-24).
 */
export const clientFiltersFromState = (
  filters: FiltersState,
  fitAvailability: boolean
): ClientCourseFilters => {
  const levels = filters.levels.selected.flatMap((on, index) =>
    on ? [index] : []
  );
  return {
    departments:
      filters.departments.active && filters.departments.names.length > 0
        ? filters.departments.names
        : undefined,
    levels: filters.levels.active && levels.length > 0 ? levels : undefined,
    units:
      filters.units.active &&
      (filters.units.min !== 0 || filters.units.max !== 24)
        ? { min: filters.units.min, max: filters.units.max }
        : undefined,
    sessions:
      filters.semesters.active && filters.semesters.sessions.length > 0
        ? filters.semesters.sessions
        : undefined,
    classTimes:
      filters.classTimes.active && filters.classTimes.selected.length > 0
        ? filters.classTimes.selected
        : undefined,
    meetingDays:
      filters.meetingDays?.active && filters.meetingDays.selected.length > 0
        ? filters.meetingDays.selected
        : undefined,
    timeRange: filters.timeRange?.active
      ? { begin: filters.timeRange.begin, end: filters.timeRange.end }
      : undefined,
    fitAvailability,
  };
};
