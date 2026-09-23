import {
  availabilityFit,
  meetingGroupsFor,
  parseCatalogTime,
  type BusyBlock,
} from "@cmucourses/profile";
import type { Course, Schedule, Session, Time } from "./types";
import { compareSessions, filterSessions } from "./utils";

export interface ClientCourseFilters {
  meetingDays?: number[];
  timeRange?: { begin: number; end: number };
  /** When set, only judge these offerings (Offered in). Otherwise most recent. */
  sessions?: Session[];
  fitAvailability?: boolean;
}

const allTimes = (schedule: Schedule): Time[] => [
  ...schedule.lectures.flatMap((lecture) => lecture.times || []),
  ...schedule.sections.flatMap((section) => section.times || []),
];

const schedulesInScope = (
  schedules: Schedule[],
  sessions: Session[] | undefined
): Schedule[] => {
  if (sessions && sessions.length > 0) {
    const keys = new Set(
      sessions.map((session) => `${session.year}-${session.semester}`)
    );
    return schedules.filter((schedule) =>
      keys.has(`${schedule.year}-${schedule.semester}`)
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
  const scoped = schedulesInScope(course.schedules ?? [], filters.sessions);
  if (scoped.length === 0) return false;

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
