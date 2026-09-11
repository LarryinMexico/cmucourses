import React from "react";
import { LIMITS, Profile, SKILLS } from "@cmucourses/profile";
import { Field, TaxonomyMultiSelect } from "./fields";
import { ProfileSection, useDraft } from "./ProfileSection";

export const SkillsSection = ({ profile }: { profile: Profile }) => {
  const { draft, setDraft, dirty } = useDraft({
    skillsHave: profile.skillsHave,
    skillsWant: profile.skillsWant,
  });

  return (
    <ProfileSection
      id="skills"
      title="Skills"
      profile={profile}
      shareable="skills"
      dirty={dirty}
      patch={draft}
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
