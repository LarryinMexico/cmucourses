import React from "react";
import { LIMITS, SKILLS } from "@cmucourses/profile";
import { Field, TaxonomyMultiSelect } from "./fields";
import { ProfileSection } from "./ProfileSection";
import { useDraftFields } from "./ProfileDraftContext";

export const SkillsSection = () => {
  const { draft, setDraft } = useDraftFields([
    "skillsHave",
    "skillsWant",
  ] as const);

  return (
    <ProfileSection
      id="skills"
      title="Skills"
      shareable="skills"
    >
      <Field label="Skills you have">
        <TaxonomyMultiSelect
          items={SKILLS}
          value={draft.skillsHave}
          onChange={(skillsHave) => setDraft({ ...draft, skillsHave })}
          max={LIMITS.skills}
        />
      </Field>
      <Field label="Skills you want to learn">
        <TaxonomyMultiSelect
          items={SKILLS}
          value={draft.skillsWant}
          onChange={(skillsWant) => setDraft({ ...draft, skillsWant })}
          max={LIMITS.skills}
        />
      </Field>
    </ProfileSection>
  );
};
