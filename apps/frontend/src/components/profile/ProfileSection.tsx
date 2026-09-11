import React, { useState } from "react";
import { isEqual } from "lodash-es";
import { GlobeAltIcon, LockClosedIcon } from "@heroicons/react/24/outline";
import {
  Profile,
  ProfilePatchInput,
  profilePatchSchema,
  ShareableSection,
  Visibility,
} from "@cmucourses/profile";
import { Card } from "~/components/Card";
import { useUpdateProfile } from "~/app/api/profile";
import { PRIMARY_BUTTON_CLASS, Select } from "./fields";

/**
 * Local edits of one saved value. When the saved value changes (a save elsewhere, a refetch)
 * and there are no unsaved edits, the draft follows it.
 */
export function useDraft<T>(saved: T) {
  const [draft, setDraft] = useState(saved);
  const [base, setBase] = useState(saved);
  if (!isEqual(saved, base)) {
    if (isEqual(draft, base)) setDraft(saved);
    setBase(saved);
  }
  return { draft, setDraft, dirty: !isEqual(draft, saved) };
}

const VISIBILITY_OPTIONS: { value: Visibility; label: string }[] = [
  { value: "PRIVATE", label: "Private" },
  { value: "PUBLIC", label: "Public" },
];

const VisibilityToggle = ({
  profile,
  section,
}: {
  profile: Profile;
  section: ShareableSection;
}) => {
  const update = useUpdateProfile();
  const value = profile.visibility[section];
  const Icon = value === "PUBLIC" ? GlobeAltIcon : LockClosedIcon;

  return (
    <div className="flex items-center gap-1">
      <Icon className="h-4 w-4 stroke-gray-500" />
      <Select
        inline
        className="w-28"
        value={value}
        options={VISIBILITY_OPTIONS}
        onChange={(next) =>
          update.mutate({
            visibility: { ...profile.visibility, [section]: next },
          })
        }
      />
    </div>
  );
};

export const AlwaysPrivate = () => (
  <div className="flex items-center gap-1 text-gray-500 text-sm">
    <LockClosedIcon className="h-4 w-4 stroke-gray-500" />
    Always private
  </div>
);

type Props = {
  id: string;
  title: string;
  description?: string;
  profile: Profile;
  /** Shows the public/private control for this section. */
  shareable?: ShareableSection;
  dirty: boolean;
  /** The sections to save when the user clicks Save. */
  patch: ProfilePatchInput;
  onSaved?: () => void;
  children: React.ReactNode;
};

export const ProfileSection = ({
  id,
  title,
  description,
  profile,
  shareable,
  dirty,
  patch,
  onSaved,
  children,
}: Props) => {
  const update = useUpdateProfile();
  const [error, setError] = useState<string | null>(null);

  const save = () => {
    const parsed = profilePatchSchema.safeParse(patch);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Please check this section.");
      return;
    }
    setError(null);
    update.mutate(patch, { onSuccess: onSaved });
  };

  return (
    <div id={id} className="scroll-mt-6">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <Card.Header>{title}</Card.Header>
            {description && (
              <div className="mt-1 text-gray-500 text-sm">{description}</div>
            )}
          </div>
          {shareable ? (
            <VisibilityToggle profile={profile} section={shareable} />
          ) : (
            <AlwaysPrivate />
          )}
        </div>
        <div className="mt-4 space-y-4">{children}</div>
        <div className="mt-4 flex items-center justify-end gap-3">
          {error && <div className="text-red-600 text-sm">{error}</div>}
          <button
            type="button"
            className={PRIMARY_BUTTON_CLASS}
            disabled={!dirty || update.isPending}
            onClick={save}
          >
            {update.isPending ? "Saving..." : "Save"}
          </button>
        </div>
      </Card>
    </div>
  );
};
