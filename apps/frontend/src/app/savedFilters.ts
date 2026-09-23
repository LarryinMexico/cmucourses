import type { ProfileSemester, SavedFilters } from "@cmucourses/profile";
import type { FiltersState } from "./filters";

/**
 * The filters as a student would want them kept as a default: what the search is actually using
 * (a group that is switched off counts as empty), without the search text, page or anything
 * derived. Pure and free of the profile/Clerk layer so it can be tested on its own.
 */
export const filtersToSaved = (
  filters: FiltersState,
  matchGoals: boolean
): SavedFilters => {
  const chosenUnits =
    filters.units.active &&
    (filters.units.min !== 0 || filters.units.max !== 24);
  return {
    departments: filters.departments.active
      ? [...filters.departments.names]
      : [],
    unitsMin: chosenUnits ? filters.units.min : null,
    unitsMax: chosenUnits ? filters.units.max : null,
    sessions: filters.semesters.active
      ? filters.semesters.sessions.flatMap(({ year, semester, session }) =>
          // Qatar summer is not something a saved set can hold, and Offered in never offers it.
          session === "qatar summer"
            ? []
            : [
                {
                  year,
                  semester: semester as ProfileSemester,
                  session: session ?? null,
                },
              ]
        )
      : [],
    levels: filters.levels.active
      ? filters.levels.selected.flatMap((on, level) => (on ? [level] : []))
      : [],
    classTimes: filters.classTimes.active
      ? [...filters.classTimes.selected]
      : [],
    meetingDays: filters.meetingDays.active
      ? [...filters.meetingDays.selected]
      : [],
    timeBegin: filters.timeRange.active ? filters.timeRange.begin : null,
    timeEnd: filters.timeRange.active ? filters.timeRange.end : null,
    fitAvailability: filters.fitAvailability,
    matchGoals,
  };
};
