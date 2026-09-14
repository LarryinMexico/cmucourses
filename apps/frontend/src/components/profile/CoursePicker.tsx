import React, { useDeferredValue, useMemo, useState } from "react";
import {
  Combobox,
  ComboboxButton,
  ComboboxInput,
  ComboboxOption,
  ComboboxOptions,
} from "@headlessui/react";
import { ChevronUpDownIcon } from "@heroicons/react/24/outline";
import { useCourseNames, useFetchAllCourses } from "~/app/api/course";

const MAX_RESULTS = 50;

// Same as ScheduleSearch: hyphenates 3 to 5 digit numbers, e.g. 152 -> 15-2, 15213 -> 15-213.
const unhyphenatedCourseCodeRegex = /^(\d{2})(\d{1,3})/g;

/** Picks one course from the full catalog. */
export const CoursePicker = ({
  value,
  onChange,
  exclude,
}: {
  value: string | null;
  onChange: (courseID: string | null) => void;
  exclude: string[];
}) => {
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const { data: allCourses = [] } = useFetchAllCourses();
  const { data: names } = useCourseNames();

  const excludeSet = useMemo(() => new Set(exclude), [exclude]);

  const indexed = useMemo(
    () =>
      allCourses.map((course) => ({
        courseID: course.courseID,
        nameLower: course.name.toLowerCase(),
        name: course.name,
      })),
    [allCourses]
  );

  const results = useMemo(() => {
    if (!deferredQuery) return [];
    const hyphenated = deferredQuery.replace(
      unhyphenatedCourseCodeRegex,
      "$1-$2"
    );
    const lowered = deferredQuery.toLowerCase();
    const matched: { courseID: string; name: string }[] = [];
    for (const course of indexed) {
      if (excludeSet.has(course.courseID)) continue;
      if (
        course.courseID.includes(hyphenated) ||
        course.nameLower.includes(lowered)
      ) {
        matched.push({ courseID: course.courseID, name: course.name });
        if (matched.length >= MAX_RESULTS) break;
      }
    }
    return matched;
  }, [deferredQuery, indexed, excludeSet]);

  const nameOf = (courseID: string) => names?.get(courseID) ?? "";

  return (
    <div className="relative min-w-0 flex-1 text-gray-500 text-sm">
      <Combobox value={value} onChange={onChange} onClose={() => setQuery("")}>
        <ComboboxButton
          as="div"
          className="relative w-full cursor-default rounded border py-1 pl-2 pr-10 text-left border-gray-200 sm:text-sm sm:leading-5"
        >
          <ComboboxInput
            className="w-full rounded py-0.5 text-base leading-6 bg-white focus:outline-none sm:text-sm sm:leading-5"
            placeholder="Search courses"
            displayValue={(courseID: string | null) =>
              courseID ? `${courseID} ${nameOf(courseID)}` : ""
            }
            onChange={(e) => setQuery(e.target.value)}
          />
          <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
            <ChevronUpDownIcon className="h-5 w-5 stroke-gray-500 " />
          </span>
        </ComboboxButton>
        {results.length > 0 && (
          <div className="absolute z-50 mt-1 w-full rounded shadow-lg bg-white">
            <ComboboxOptions className="shadow-xs relative max-h-60 overflow-auto rounded py-1 text-base leading-6 bg-white focus:outline-none sm:text-sm sm:leading-5">
              {results.map((course) => (
                <ComboboxOption
                  key={course.courseID}
                  value={course.courseID}
                  className="relative cursor-pointer select-none py-2 pl-3 pr-9 focus:outline-none"
                >
                  <span className="block truncate text-gray-700">
                    <span className="inline-block w-16 font-semibold">
                      {course.courseID}
                    </span>
                    {course.name}
                  </span>
                </ComboboxOption>
              ))}
            </ComboboxOptions>
          </div>
        )}
      </Combobox>
    </div>
  );
};
