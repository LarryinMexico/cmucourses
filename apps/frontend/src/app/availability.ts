import { useMemo } from "react";
import {
  availabilityFit,
  meetingGroupsFor,
  type AvailabilityFit,
} from "@cmucourses/profile";
import { useAuth } from "@clerk/nextjs";
import { useFetchProfile } from "./api/profile";
import { Schedule } from "./types";
import { compareSessions, filterSessions } from "./utils";

/**
 * Scores a course against the user's saved weekly busy times.
 *
 * The comparison runs client-side because the course catalog and the profile are served by
 * different backends, and because search results are paginated server-side ten at a time -
 * a badge stays correct under that pagination, where sorting or filtering would not.
 *
 * Returns null when there is nothing to show: signed out, no busy times saved, or no
 * schedule to judge.
 */
export const useAvailabilityFit = (
  schedules: Schedule[] | undefined
): AvailabilityFit | null => {
  const { isSignedIn } = useAuth();
  const { data: profile } = useFetchProfile();
  const busyBlocks = profile?.busyBlocks;

  return useMemo(() => {
    if (!isSignedIn || !busyBlocks || busyBlocks.length === 0) return null;

    // Judge the most recent offering, the same one CourseCard already summarises.
    const mostRecent = filterSessions(schedules || []).sort(compareSessions)[0];
    if (!mostRecent) return null;

    const groups = meetingGroupsFor(
      (mostRecent.lectures || []).map((lecture) => ({
        times: lecture.times || [],
      })),
      (mostRecent.sections || []).map((section) => ({
        times: section.times || [],
      }))
    );

    const fit = availabilityFit(groups, busyBlocks);
    return fit.status === "UNKNOWN" ? null : fit;
  }, [isSignedIn, busyBlocks, schedules]);
};
