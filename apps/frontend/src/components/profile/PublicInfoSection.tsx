import React from "react";
import { LIMITS } from "@cmucourses/profile";
import { classNames } from "~/app/utils";
import { Field, INPUT_CLASS } from "./fields";
import { ProfileSection } from "./ProfileSection";
import { useDraftFields } from "./ProfileDraftContext";

export const PublicInfoSection = () => {
  const { draft, setDraft } = useDraftFields(["displayName", "bio"] as const);

  return (
    <ProfileSection
      id="public-info"
      title="Public info"
      description="How you appear in Scotty Circles. Individual profile sections still follow their Public/Private controls."
      headerBadge="public"
    >
      <Field label="Display name">
        <input
          className={classNames(INPUT_CLASS, "mt-2 w-full sm:w-72")}
          value={draft.displayName}
          maxLength={LIMITS.displayName}
          onChange={(e) => setDraft({ ...draft, displayName: e.target.value })}
        />
      </Field>
      <Field label="Bio">
        <textarea
          className={classNames(INPUT_CLASS, "mt-2 w-full")}
          rows={3}
          value={draft.bio}
          maxLength={LIMITS.bio}
          onChange={(e) => setDraft({ ...draft, bio: e.target.value })}
        />
        <div className="text-right text-gray-400">
          {draft.bio.length} / {LIMITS.bio}
        </div>
      </Field>
    </ProfileSection>
  );
};
