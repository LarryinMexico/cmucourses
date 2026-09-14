import { useMemo } from "react";
import { recommendCourses } from "@cmucourses/profile";
import { useAppSelector } from "~/app/hooks";
import { useFetchAllCourses } from "~/app/api/course";
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
