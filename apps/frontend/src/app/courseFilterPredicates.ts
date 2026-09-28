import {
  availabilityFit,
  meetingGroupsFor,
  parseCatalogTime,
  type BusyBlock,
} from "@cmucourses/profile";
import type { Course, Schedule, Session, Time } from "./types";
import {
  compareSessions,
  filterSessions,
  isValidUnits,
  parseUnits,
} from "./utils";
import type { ClassTime, FiltersState } from "./filters";

export interface ClientCourseFilters {
  meetingDays?: number[];
  timeRange?: { begin: number; end: number };
  /**
   * When set, only judge these offerings (Offered in). Otherwise fit-availability judges the most
   * recent offering and class times / days / window any offering, as /search does.
   */
  sessions?: Session[];
  fitAvailability?: boolean;
  /** Department names, as the search sidebar stores them. */
  departments?: string[];
  /** Hundreds digit of the course number ("15-213" is level 2). */
  levels?: number[];
  units?: { min: number; max: number };
  classTimes?: ClassTime[];
}

/**
 * Same buckets as the backend's CLASS_TIME_PATTERNS, which match `begin` by pattern: 6-11 AM is
 * morning, 12-4 PM afternoon, 5-11 PM evening, and only a literal "TBA" is tba. Anything else
 * (a 5:30 AM or midnight start, a malformed time) is in no bucket, as on the backend.
 */
export const classTimeOf = (time: Time): ClassTime | null => {
  if (time.begin === "TBA") return "tba";
  const begin = parseCatalogTime(time.begin);
  if (begin === null) return null;
  if (begin >= 6 * 60 && begin < 12 * 60) return "morning";
  if (begin >= 12 * 60 && begin < 17 * 60) return "afternoon";
  if (begin >= 17 * 60) return "evening";
  return null;
};

/**
 * The backend converts `units` to a number and drops courses where that fails, so a units range
 * never matches "VAR", a range like "1-12" or a list like "3,5,9". Mirrored here.
 */
export const unitsInRange = (
  units: string,
  range: { min: number; max: number }
): boolean => {
  if (!isValidUnits(units)) return false;
  const value = parseUnits(units);
  return value >= range.min && value <= range.max;
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

/** Whether any filter is set, i.e. whether a course's catalog details are needed to judge it. */
export const hasClientFilters = (filters: ClientCourseFilters): boolean =>
  filters.departments !== undefined ||
  filters.levels !== undefined ||
  filters.units !== undefined ||
  filters.sessions !== undefined ||
  filters.meetingDays !== undefined ||
  filters.timeRange !== undefined ||
  filters.classTimes !== undefined ||
  !!filters.fitAvailability;

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

  // Like /search: class times, days and the time window must all hold on the same offering, which
  // is any offering unless Offered in narrows it (fit-availability below uses `scoped` instead).
  if (filters.classTimes || filters.meetingDays || filters.timeRange) {
    const offerings = filters.sessions ? scoped : (course.schedules ?? []);
    const selected = filters.classTimes;
    const matches = offerings.some((schedule) => {
      const times = allTimes(schedule);
      const classTimeOk =
        !selected ||
        times.some((time) => {
          const bucket = classTimeOf(time);
          return bucket !== null && selected.includes(bucket);
        });
      const daysAndWindowOk =
        (!filters.meetingDays && !filters.timeRange) ||
        times.some((time) =>
          meetingMatches(time, filters.meetingDays, filters.timeRange)
        );
      return classTimeOk && daysAndWindowOk;
    });
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
