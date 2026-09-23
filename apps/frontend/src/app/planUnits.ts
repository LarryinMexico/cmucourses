import { useMemo } from "react";
import type { PlanGroup, Workload } from "@cmucourses/profile";
import { useFetchCourseInfos } from "~/app/api/course";
import { isValidUnits, parseUnits } from "~/app/utils";

/** Catalog units as one number, or null when they are not one (VAR, "1-4", "3,5,9"). */
export const unitsByCourse = (
  courses: { courseID: string; units: string }[]
): Map<string, number | null> =>
  new Map(
    courses.map((course) => [
      course.courseID,
      isValidUnits(course.units) ? parseUnits(course.units) : null,
    ])
  );

/** Units for a list of course ids; `loading` until every course's details have arrived. */
export const usePlanUnits = (courseIDs: string[]) => {
  const unique = useMemo(() => [...new Set(courseIDs)], [courseIDs]);
  const details = useFetchCourseInfos(unique);
  return useMemo(
    () => ({
      units: unitsByCourse(details),
      loading: details.length < unique.length,
    }),
    [details, unique]
  );
};

const plural = (count: number, one: string, many: string) =>
  `${count} ${count === 1 ? one : many}`;

const rangeText = (workload: Workload | null) =>
  workload?.unitsMin != null && workload.unitsMax != null
    ? `${workload.unitsMin}–${workload.unitsMax}`
    : "unit";

/** The line under a semester: its total, how that sits against the range, and what was not counted. */
export const describeGroupTotal = (
  group: PlanGroup,
  workload: Workload | null
): { text: string; warn: boolean } => {
  const known = group.totalUnits > 0 || group.unknownUnits.length === 0;
  let text = known
    ? plural(group.totalUnits, "unit", "units")
    : "Units not known";

  const range = `your ${rangeText(workload)} range`;
  const relation = {
    IN_RANGE: `within ${range}`,
    UNDER: `below ${range}`,
    OVER: `above ${range}`,
    UNKNOWN: null,
  }[group.workloadFit];
  if (relation) text += `, ${relation}`;

  if (group.unknownUnits.length > 0) {
    text += ` · ${plural(group.unknownUnits.length, "course", "courses")} with variable units not counted`;
  }
  return {
    text,
    warn: group.workloadFit === "UNDER" || group.workloadFit === "OVER",
  };
};
