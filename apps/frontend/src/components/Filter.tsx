import React from "react";
import { useAuth } from "@clerk/nextjs";
import { filtersSlice } from "~/app/filters";
import { useAppDispatch, useAppSelector } from "~/app/hooks";
import { uiSlice } from "~/app/ui";
import { useFetchProfile, useUpdateProfile } from "~/app/api/profile";
import { filtersToSaved } from "~/app/savedFilters";
import { markDefaultFiltersApplied } from "~/app/defaultFilters";
import DepartmentFilter from "./filters/DepartmentFilter";
import UnitsFilter from "./filters/UnitsFilter";
import SemestersOfferedFilter from "./filters/SemestersOfferedFilter";
import LevelFilter from "./filters/LevelFilter";
import GoalsFilter from "./filters/GoalsFilter";
import ClassTimesFilter from "./filters/ClassTimesFilter";
import AdvancedScheduleFilter from "./filters/AdvancedScheduleFilter";

const LINK_BUTTON_CLASS =
  "text-gray-500 text-xs hover:text-blue-500 hover:underline disabled:cursor-default disabled:opacity-50 disabled:hover:no-underline";

/** Keep the current filters as the default for this account, or bring the kept ones back. */
const DefaultFilterControls = () => {
  const { isSignedIn, userId } = useAuth();
  const { data: profile } = useFetchProfile();
  const update = useUpdateProfile();
  const dispatch = useAppDispatch();
  const filters = useAppSelector((state) => state.filters);
  const matchGoals = useAppSelector((state) => state.ui.matchGoals);
  if (!isSignedIn) return null;

  const saved = profile?.savedFilters ?? null;

  return (
    <div className="mb-3 flex flex-wrap gap-x-3 gap-y-1">
      <button
        type="button"
        className={LINK_BUTTON_CLASS}
        disabled={update.isPending}
        onClick={() => {
          markDefaultFiltersApplied(userId);
          update.mutate({ savedFilters: filtersToSaved(filters, matchGoals) });
        }}
      >
        {update.isSuccess && !update.isPending
          ? "Saved as default"
          : "Save as default"}
      </button>
      <button
        type="button"
        className={LINK_BUTTON_CLASS}
        disabled={!saved}
        onClick={() => {
          if (!saved) return;
          dispatch(filtersSlice.actions.applySavedFilters(saved));
          dispatch(uiSlice.actions.setMatchGoals(saved.matchGoals));
        }}
      >
        Use my default
      </button>
      {saved && (
        <button
          type="button"
          className={LINK_BUTTON_CLASS}
          disabled={update.isPending}
          onClick={() => update.mutate({ savedFilters: null })}
        >
          Clear default
        </button>
      )}
    </div>
  );
};

const Filter = () => {
  return (
    <div>
      <div className="mb-1 text-lg">Filter by</div>
      <DefaultFilterControls />
      <div className="space-y-4 text-sm">
        <GoalsFilter />
        <DepartmentFilter />
        <UnitsFilter />
        <SemestersOfferedFilter />
        <ClassTimesFilter />
        <AdvancedScheduleFilter />
        <LevelFilter />
      </div>
    </div>
  );
};

export default Filter;
