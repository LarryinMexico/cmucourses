import React from "react";
import { isEqual } from "lodash-es";
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

// Real buttons, not text links: these were too small to notice (user feedback, 2026-09-25).
const LINK_BUTTON_CLASS =
  "rounded border border-gray-200 px-3 py-1.5 text-gray-700 text-sm hover:bg-gray-50 disabled:cursor-default disabled:opacity-50";

/** Keep the current filters as the default for this account, or bring the kept ones back. */
const DefaultFilterControls = () => {
  const { isSignedIn, userId } = useAuth();
  const { data: profile } = useFetchProfile();
  const save = useUpdateProfile();
  const clear = useUpdateProfile();
  const dispatch = useAppDispatch();
  const filters = useAppSelector((state) => state.filters);
  const matchGoals = useAppSelector((state) => state.ui.matchGoals);
  if (!isSignedIn) return null;

  const saved = profile?.savedFilters ?? null;
  const current = filtersToSaved(filters, matchGoals);
  const isDefault = !!saved && isEqual(saved, current);
  const busy = save.isPending || clear.isPending;

  return (
    <div className="mb-4">
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          className={`${LINK_BUTTON_CLASS} col-span-2`}
          disabled={busy || isDefault}
          onClick={() => {
            markDefaultFiltersApplied(userId);
            save.mutate({ savedFilters: current });
          }}
        >
          {isDefault ? "Saved as default" : "Save as default"}
        </button>
        <button
          type="button"
          className={LINK_BUTTON_CLASS}
          disabled={!saved}
          title={profile && !saved ? "No default saved yet" : undefined}
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
            disabled={busy}
            onClick={() => clear.mutate({ savedFilters: null })}
          >
            Clear default
          </button>
        )}
      </div>
      {profile && !saved && (
        <div className="mt-1 text-gray-400 text-xs">No default saved yet</div>
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
