import { Listbox } from "@headlessui/react";
import { CheckIcon } from "@heroicons/react/20/solid";
import { ChevronUpDownIcon, XMarkIcon } from "@heroicons/react/24/outline";
import React from "react";
import { ClassTime, CLASS_TIMES, filtersSlice } from "~/app/filters";
import { useAppDispatch, useAppSelector } from "~/app/hooks";
import { classNames } from "~/app/utils";

export const CLASS_TIME_LABELS: Record<ClassTime, string> = {
  morning: "Morning (before 12pm)",
  afternoon: "Afternoon (12-5pm)",
  evening: "Evening (5pm onwards)",
  tba: "Time not set",
};

/** Shorter labels for the pills, where the full parenthetical does not fit. */
export const CLASS_TIME_SHORT_LABELS: Record<ClassTime, string> = {
  morning: "Morning",
  afternoon: "Afternoon",
  evening: "Evening",
  tba: "Time not set",
};

const ClassTimesFilter = () => {
  const dispatch = useAppDispatch();

  const { active, selected } = useAppSelector(
    (state) => state.filters.classTimes
  );

  const removeClassTime = (classTime: ClassTime) => {
    dispatch(filtersSlice.actions.deleteClassTime(classTime));
  };

  const updateSelection = (newSelection: ClassTime[]) => {
    dispatch(filtersSlice.actions.updateClassTimesActive(true));
    dispatch(filtersSlice.actions.updateClassTimes(newSelection));
  };

  return (
    <div className="relative mt-1 text-gray-500 text-sm">
      <Listbox value={selected} onChange={updateSelection} multiple>
        <Listbox.Label className="flex">
          <div>
            <input
              type="checkbox"
              className="mr-2"
              checked={active}
              onChange={(e) => {
                dispatch(
                  filtersSlice.actions.updateClassTimesActive(e.target.checked)
                );
              }}
            />
          </div>
          Class Times
        </Listbox.Label>
        <Listbox.Button className="relative mt-2 w-full cursor-default rounded border py-1 pl-1 pr-10 text-left transition duration-150 ease-in-out border-gray-200 sm:text-sm sm:leading-5">
          <span className="block flex flex-wrap gap-1">
            {selected.length === 0 ? (
              <span className="p-0.5">None</span>
            ) : (
              selected.map((classTime) => (
                <span
                  key={classTime}
                  className="flex items-center gap-1 rounded px-2 py-0.5 text-indigo-800 bg-indigo-50"
                >
                  <span>{CLASS_TIME_SHORT_LABELS[classTime]}</span>
                  <XMarkIcon
                    className="h-3 w-3 cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      removeClassTime(classTime);
                    }}
                  />
                </span>
              ))
            )}
          </span>
          <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
            <ChevronUpDownIcon className="h-5 w-5 stroke-gray-500 " />
          </span>
        </Listbox.Button>
        <div className="absolute mt-1 w-full rounded shadow-lg bg-white">
          <Listbox.Options className="shadow-xs relative z-50 max-h-60 overflow-auto rounded py-1 text-base leading-6 bg-white focus:outline-none sm:text-sm sm:leading-5">
            {CLASS_TIMES.map((classTime) => (
              <Listbox.Option
                key={classTime}
                value={classTime}
                className="relative cursor-pointer select-none py-2 pl-3 pr-9 focus:outline-none"
              >
                {({ selected: isSelected }) => (
                  <>
                    <span
                      className={classNames(
                        "block truncate",
                        isSelected ? "font-semibold" : "font-normal"
                      )}
                    >
                      {CLASS_TIME_LABELS[classTime]}
                    </span>
                    {isSelected && (
                      <span className="absolute inset-y-0 right-0 flex items-center pr-4">
                        <CheckIcon className="h-5 w-5" />
                      </span>
                    )}
                  </>
                )}
              </Listbox.Option>
            ))}
          </Listbox.Options>
        </div>
      </Listbox>
      <div className="mt-1 text-gray-400 text-xs">
        Matched on a section&apos;s start time. About half of all courses have
        no stated meeting time; add &ldquo;Time not set&rdquo; to include them.
      </div>
    </div>
  );
};

export default ClassTimesFilter;
