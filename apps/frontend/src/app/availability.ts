import { useMemo } from "react";
import {
  availabilityFit,
  meetingGroupsFor,
  type AvailabilityFit,
} from "@cmucourses/profile";
import { useAuth } from "@clerk/nextjs";
import { useFetchProfile } from "./api/profile";
import { useAppSelector } from "./hooks";
import { Schedule } from "./types";
import { compareSessions, filterSessions } from "./utils";

/**
 * Scores a course against the user's saved weekly busy times.
 *
 * Uses Offered-in sessions when that filter is active; otherwise the most recent offering
 * (same as CourseCard). Must stay in sync with courseFilterPredicates' fitAvailability path.
 */
export const useAvailabilityFit = (
  schedules: Schedule[] | undefined
): AvailabilityFit | null => {
  const { isSignedIn } = useAuth();
  const { data: profile } = useFetchProfile();
  const busyBlocks = profile?.busyBlocks;
  const semesters = useAppSelector((state) => state.filters.semesters);

  return useMemo(() => {
    if (!isSignedIn || !busyBlocks || busyBlocks.length === 0) return null;

    const all = schedules || [];
    let scoped: Schedule[];
    if (semesters?.active && semesters.sessions.length > 0) {
      const keys = new Set(
        semesters.sessions.map((s) => `${s.year}-${s.semester}`)
      );
      scoped = all.filter((schedule) =>
        keys.has(`${schedule.year}-${schedule.semester}`)
      );
    } else {
      const mostRecent = filterSessions(all).sort(compareSessions)[0];
      scoped = mostRecent ? [mostRecent] : [];
    }
    if (scoped.length === 0) return null;

    // Prefer FITS if any scoped offering fits; otherwise report the first conflict.
    let firstConflict: AvailabilityFit | null = null;
    for (const schedule of scoped) {
      const groups = meetingGroupsFor(
        (schedule.lectures || []).map((lecture) => ({
          times: lecture.times || [],
        })),
        (schedule.sections || []).map((section) => ({
          times: section.times || [],
        }))
      );
      const fit = availabilityFit(groups, busyBlocks);
      if (fit.status === "FITS") return fit;
      if (fit.status === "CONFLICTS" && !firstConflict) firstConflict = fit;
    }
    return firstConflict;
  }, [isSignedIn, busyBlocks, schedules, semesters]);
};
