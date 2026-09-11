import React from "react";
import { LIMITS, Profile, Workload } from "@cmucourses/profile";
import { OptionalNumberInput } from "./fields";
import { ProfileSection, useDraft } from "./ProfileSection";

const EMPTY_WORKLOAD: Workload = {
  unitsMin: null,
  unitsMax: null,
  hoursPerWeek: null,
};

export const WorkloadSection = ({ profile }: { profile: Profile }) => {
  const { draft, setDraft, dirty } = useDraft(
    profile.workload ?? EMPTY_WORKLOAD
  );

  return (
    <ProfileSection
      id="workload"
      title="Course load"
      description="What a semester should look like for you."
      profile={profile}
      dirty={dirty}
      patch={{ workload: draft }}
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
