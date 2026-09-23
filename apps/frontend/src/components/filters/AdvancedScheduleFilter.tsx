import React, { useEffect } from "react";
import { filtersSlice } from "~/app/filters";
import { useAppDispatch, useAppSelector } from "~/app/hooks";
import { useFetchProfile } from "~/app/api/profile";
import {
  DAYS,
  minutesToTime,
  timeToMinutes,
} from "~/components/profile/options";
import { INPUT_CLASS } from "~/components/profile/fields";

const AdvancedScheduleFilter = () => {
  const dispatch = useAppDispatch();
  const meetingDays = useAppSelector((state) => state.filters.meetingDays) ?? {
    active: false,
    selected: [],
  };
  const timeRange = useAppSelector((state) => state.filters.timeRange) ?? {
    active: false,
    begin: 8 * 60,
    end: 18 * 60,
  };
  const fitAvailability =
    useAppSelector((state) => state.filters.fitAvailability) ?? false;
  const { data: profile, isPending: profilePending } = useFetchProfile();
  const hasBusyBlocks = !!profile && profile.busyBlocks.length > 0;

  // Persisted "fit" with no busy blocks would filter everything out and leave the
  // checkbox stuck disabled — clear it when we know the profile has none.
  useEffect(() => {
    if (profilePending) return;
    if (!hasBusyBlocks && fitAvailability) {
      dispatch(filtersSlice.actions.updateFitAvailability(false));
    }
  }, [profilePending, hasBusyBlocks, fitAvailability, dispatch]);

  return (
    <div className="space-y-3 text-gray-500 text-sm">
      <div>
        <label>
          <input
            type="checkbox"
            className="mr-2"
            checked={meetingDays.active}
            onChange={(e) =>
              dispatch(
                filtersSlice.actions.updateMeetingDaysActive(e.target.checked)
              )
            }
          />
          Meeting days
        </label>
        <div className="mt-1 flex flex-wrap gap-2 pl-5">
          {DAYS.slice(1, 6).map((day, offset) => {
            const value = offset + 1;
            return (
              <label key={day}>
                <input
                  type="checkbox"
                  className="mr-1"
                  checked={meetingDays.selected.includes(value)}
                  onChange={(e) =>
                    dispatch(
                      filtersSlice.actions.updateMeetingDays(
                        e.target.checked
                          ? [...meetingDays.selected, value].sort()
                          : meetingDays.selected.filter((d) => d !== value)
                      )
                    )
                  }
                />
                {day.slice(0, 3)}
              </label>
            );
          })}
        </div>
      </div>
      <div>
        <label>
          <input
            type="checkbox"
            className="mr-2"
            checked={timeRange.active}
            onChange={(e) =>
              dispatch(
                filtersSlice.actions.updateTimeRangeActive(e.target.checked)
              )
            }
          />
          Exact time window
        </label>
        <div className="mt-1 flex items-center gap-2 pl-5">
          <input
            type="time"
            className={INPUT_CLASS}
            value={minutesToTime(timeRange.begin)}
            onChange={(e) => {
              const begin = timeToMinutes(e.target.value);
              if (begin !== null)
                dispatch(
                  filtersSlice.actions.updateTimeRange([begin, timeRange.end])
                );
            }}
          />
          <span>to</span>
          <input
            type="time"
            className={INPUT_CLASS}
            value={minutesToTime(timeRange.end)}
            onChange={(e) => {
              const end = timeToMinutes(e.target.value);
              if (end !== null)
                dispatch(
                  filtersSlice.actions.updateTimeRange([timeRange.begin, end])
                );
            }}
          />
        </div>
      </div>
      <label className="block">
        <input
          type="checkbox"
          className="mr-2"
          checked={fitAvailability}
          disabled={!hasBusyBlocks}
          onChange={(e) =>
            dispatch(
              filtersSlice.actions.updateFitAvailability(e.target.checked)
            )
          }
        />
        Only courses that fit my availability
      </label>
      {!hasBusyBlocks && (
        <div className="pl-5 text-gray-400 text-xs">
          Add weekly busy times on your Profile to enable this filter.
        </div>
      )}
    </div>
  );
};

export default AdvancedScheduleFilter;
