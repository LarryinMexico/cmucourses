import React from "react";
import { useAppDispatch, useAppSelector } from "~/app/hooks";
import { uiSlice } from "~/app/ui";
import { useHasProfileGoals } from "~/app/api/profile";
import Link from "../Link";

/** Filters search to courses that match the user's Profile goals (full mapped list, not the current API page). */
const GoalsFilter = () => {
  const dispatch = useAppDispatch();
  const matchGoals = useAppSelector((state) => state.ui.matchGoals);
  const hasGoals = useHasProfileGoals();

  return (
    <div className="mt-2 flex text-gray-500 text-sm">
      <div>
        <input
          type="checkbox"
          className="mr-2"
          checked={matchGoals && hasGoals}
          disabled={!hasGoals}
          onChange={() => dispatch(uiSlice.actions.toggleMatchGoals())}
        />
      </div>
      <div>
        <div>Match my goals</div>
        {!hasGoals && (
          <div className="text-gray-400 text-xs">
            <Link href="/profile">Add career goals on your Profile</Link> to use
            this.
          </div>
        )}
      </div>
    </div>
  );
};

export default GoalsFilter;
