import { useMemo } from "react";
import { recommendCourses } from "@cmucourses/profile";
import { useAppSelector } from "~/app/hooks";
import { useCourseInfosStatus, useFetchAllCourses } from "~/app/api/course";
import {
  clientFiltersFromState,
  courseMatchesClientFilters,
  hasClientFilters,
} from "~/app/courseFilterPredicates";
import { useFetchProfile, useHasProfileGoals } from "~/app/api/profile";

const GOAL_LIST_LIMIT = 500;

// Same hyphenation as search / CoursePicker for partial course codes.
const unhyphenatedCourseCodeRegex = /^(\d{2})(\d{1,3})/;

/**
 * When "Match my goals" is on, the course list is every mapped course that scores
 * against the profile (not the current API search page). Optional search text
 * further narrows that list by course ID or name. Pagination is client-side.
 */
export const useMatchGoalsCourseIDs = (): {
  active: boolean;
  ready: boolean;
  courseIDs: string[];
} => {
  const matchGoals = useAppSelector((state) => state.ui.matchGoals);
  const hasGoals = useHasProfileGoals();
  const search = useAppSelector((state) => state.filters.search);
  const active = matchGoals && hasGoals;
  const needsNames = search.trim().length > 0;
  const { data: profile, isPending: profilePending } = useFetchProfile();
  const { data: allCourses = [], isPending: coursesPending } =
    useFetchAllCourses({ enabled: active && needsNames });

  const courseIDs = useMemo(() => {
    if (!active || !profile) return [];

    let ids = recommendCourses({
      careers: profile.careers,
      skillsWant: profile.skillsWant,
      skillsHave: profile.skillsHave,
      takenCourseIDs: profile.courses.map((course) => course.courseID),
      limit: GOAL_LIST_LIMIT,
    }).map((row) => row.courseID);

    const q = search.trim();
    if (q) {
      const hyphenated = q.replace(unhyphenatedCourseCodeRegex, "$1-$2");
      const lowered = q.toLowerCase();
      const nameById = new Map(
        allCourses.map((course) => [course.courseID, course.name.toLowerCase()])
      );
      ids = ids.filter((courseID) => {
        if (courseID.includes(hyphenated) || courseID.includes(q)) return true;
        const name = nameById.get(courseID);
        return !!name && name.includes(lowered);
      });
    }

    return ids;
  }, [active, profile, search, allCourses]);

  return {
    active,
    // Names are only needed when narrowing by the search box.
    ready:
      !active ||
      (!!profile && !profilePending && (!needsNames || !coursesPending)),
    courseIDs,
  };
};

/**
 * The Match-my-goals list with every sidebar filter applied, in recommendation order. When a
 * filter is set, the whole list is fetched (one batched request; at most ~100 mapped courses) and
 * filtered before paging, so the count, the pages and the rows agree; with none, nothing is fetched.
 */
export const useFilteredGoalCourseIDs = (): {
  active: boolean;
  ready: boolean;
  courseIDs: string[];
  /** Goal courses whose details failed to load; they cannot be filtered, so they are left out. */
  failedCount: number;
  retryFailed: () => void;
} => {
  const goals = useMatchGoalsCourseIDs();
  const filters = useAppSelector((state) => state.filters);
  const { data: profile, isPending: profilePending } = useFetchProfile();
  const busyBlocks = useMemo(() => profile?.busyBlocks ?? [], [profile]);
  // Skip availability while the profile loads so a rehydrated flag does not empty the list, and
  // with no busy times, where /search does not filter either.
  const client = useMemo(
    () =>
      clientFiltersFromState(
        filters,
        !profilePending &&
          (filters.fitAvailability ?? false) &&
          busyBlocks.length > 0
      ),
    [filters, profilePending, busyBlocks]
  );
  // With no filter set, the list is the goal list as is: skip fetching every course's schedules.
  const filtering = hasClientFilters(client);
  const details = useCourseInfosStatus(filtering ? goals.courseIDs : []);

  const courseIDs = useMemo(() => {
    if (!filtering) return goals.courseIDs;
    const byID = new Map(details.courses.map((c) => [c.courseID, c]));
    return goals.courseIDs.filter((id) => {
      const course = byID.get(id);
      return !!course && courseMatchesClientFilters(course, client, busyBlocks);
    });
  }, [filtering, goals.courseIDs, details.courses, client, busyBlocks]);

  return {
    active: goals.active,
    ready: goals.ready && !details.isPending,
    courseIDs,
    failedCount: details.failed.length,
    retryFailed: details.retryFailed,
  };
};
