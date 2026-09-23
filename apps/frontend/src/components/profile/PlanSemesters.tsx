import React, { useMemo } from "react";
import { XMarkIcon } from "@heroicons/react/20/solid";
import {
  groupPlanBySemester,
  type PlannedCourse,
  type Workload,
} from "@cmucourses/profile";
import Link from "~/components/Link";
import { useCourseNames } from "~/app/api/course";
import { describeGroupTotal, usePlanUnits } from "~/app/planUnits";

export const sameEntry = (a: PlannedCourse, b: PlannedCourse) =>
  a.courseID === b.courseID && a.semester === b.semester && a.year === b.year;

/**
 * A course plan laid out one semester at a time, with each semester's units and how they sit
 * against the student's unit range. Read-only unless `onRemove` is given.
 */
export const PlanSemesters = ({
  planned,
  workload,
  onRemove,
}: {
  planned: PlannedCourse[];
  workload: Workload | null;
  onRemove?: (course: PlannedCourse) => void;
}) => {
  const { data: names } = useCourseNames();
  const { units, loading } = usePlanUnits(planned.map((c) => c.courseID));
  const groups = useMemo(
    () => groupPlanBySemester(planned, units, workload),
    [planned, units, workload]
  );

  return (
    <div className="space-y-4">
      {groups.map((group) => {
        const total = describeGroupTotal(group, workload);
        return (
          <div key={`${group.year}:${group.semester}`}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div className="capitalize text-gray-700 text-sm">
                {group.semester} {group.year}
              </div>
              <div
                className={`text-xs ${total.warn ? "text-yellow-800" : "text-gray-500"}`}
              >
                {loading ? "Counting units…" : total.text}
              </div>
            </div>
            <ul className="mt-1 divide-y divide-gray-100">
              {group.courses.map((course) => {
                const entry: PlannedCourse = {
                  courseID: course.courseID,
                  semester: group.semester,
                  year: group.year,
                };
                return (
                  <li
                    key={course.courseID}
                    className="flex items-center gap-2 py-2 text-gray-700 text-sm"
                  >
                    <div className="min-w-0 flex-1 truncate">
                      <Link href={`/course/${course.courseID}`}>
                        {course.courseID}
                      </Link>
                      <span className="ml-2">
                        {names?.get(course.courseID)}
                      </span>
                    </div>
                    <span className="text-gray-500">
                      {course.units === null ? "" : `${course.units} units`}
                    </span>
                    {onRemove && (
                      <button
                        type="button"
                        aria-label={`Remove ${course.courseID} from ${group.semester} ${group.year}`}
                        className="rounded p-1 text-gray-500 hover:bg-gray-50"
                        onClick={() => onRemove(entry)}
                      >
                        <XMarkIcon className="h-5 w-5" />
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
};
