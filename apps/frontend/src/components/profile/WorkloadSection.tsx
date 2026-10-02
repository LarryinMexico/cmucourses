import React from "react";
import { LIMITS } from "@cmucourses/profile";
import { OptionalNumberInput } from "./fields";
import { ProfileSection } from "./ProfileSection";
import { useDraftField } from "./ProfileDraftContext";

export const WorkloadSection = () => {
  const { draft, setDraft } = useDraftField("workload");

  return (
    <ProfileSection
      id="workload"
      title="Course load"
      description="What a semester should look like for you."
    >
      <div className="flex flex-wrap items-baseline gap-2 text-gray-500 text-sm">
        <div className="mr-2 w-40">Units per semester</div>
        <OptionalNumberInput
          value={draft.unitsMin}
          min={0}
          max={LIMITS.units}
          onChange={(unitsMin) => setDraft({ ...draft, unitsMin })}
        />
        <span>to</span>
        <OptionalNumberInput
          value={draft.unitsMax}
          min={0}
          max={LIMITS.units}
          onChange={(unitsMax) => setDraft({ ...draft, unitsMax })}
        />
      </div>
      <div className="flex flex-wrap items-baseline gap-2 text-gray-500 text-sm">
        <div className="mr-2 w-40">Hours per week</div>
        <OptionalNumberInput
          value={draft.hoursPerWeek}
          min={0}
          max={LIMITS.hoursPerWeek}
          onChange={(hoursPerWeek) => setDraft({ ...draft, hoursPerWeek })}
        />
        <span>across all courses</span>
      </div>
    </ProfileSection>
  );
};
