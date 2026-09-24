import { useMemo } from "react";
import {
  availabilityFit,
  meetingGroupsFor,
  type AvailabilityFit,
  type BusyBlock,
} from "@cmucourses/profile";
import { useAuth } from "@clerk/nextjs";
import { useFetchProfile } from "./api/profile";
import { useAppSelector } from "./hooks";
import { Schedule } from "./types";
import { schedulesInScope } from "./courseFilterPredicates";
import { useFetchCourseInfosByPage } from "./api/course";

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

    const scoped = schedulesInScope(
      schedules || [],
      semesters?.active ? semesters.sessions : undefined
    );
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

const NO_BUSY: BusyBlock[] = [];

/**
 * What the catalog search has to fit around: the profile's busy blocks when "Only courses that fit
 * my availability" is on, otherwise nothing. `waiting` holds the search back while a rehydrated
 * toggle's busy times are still loading, so it never fires once unfiltered and again filtered
 * (isLoading, not isPending: signed out, the profile query never runs and never will).
 */
export const useSearchBusyBlocks = (): {
  busy: BusyBlock[];
  waiting: boolean;
} => {
  const fitAvailability = useAppSelector(
    (state) => state.filters.fitAvailability
  );
  const { data: profile, isLoading } = useFetchProfile();
  return {
    busy: fitAvailability && profile ? profile.busyBlocks : NO_BUSY,
    waiting: !!fitAvailability && isLoading,
  };
};

/**
 * The current page of catalog search results: the filters in the store plus the busy blocks the
 * availability filter needs. Every component that reads the results (the list, the result count)
 * must go through this so they all ask the same question.
 */
export const useSearchPage = (options?: { enabled?: boolean }) => {
  const { busy, waiting } = useSearchBusyBlocks();
  return useFetchCourseInfosByPage({
    enabled: (options?.enabled ?? true) && !waiting,
    busy,
  });
};
