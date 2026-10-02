import React from "react";
import { GlobeAltIcon, LockClosedIcon } from "@heroicons/react/24/outline";
import { ShareableSection, Visibility } from "@cmucourses/profile";
import { Card } from "~/components/Card";
import { Select } from "./fields";
import { useProfileDraft } from "./ProfileDraftContext";

/** A profile section, or the setting for whether Circles posts show what busy times are for. */
type ToggleableVisibility = ShareableSection | "busyLabels";

const VISIBILITY_OPTIONS: { value: Visibility; label: string }[] = [
  { value: "PRIVATE", label: "Private" },
  { value: "PUBLIC", label: "Public" },
];

/** A Private/Public switch. It edits the page draft; nothing is written until Save all. */
export const VisibilityToggle = ({
  section,
  label,
}: {
  section: ToggleableVisibility;
  /** Shown before the switch and used as its accessible name. */
  label?: string;
}) => {
  const { draft, update } = useProfileDraft();
  const value = draft.visibility[section];
  const Icon = value === "PUBLIC" ? GlobeAltIcon : LockClosedIcon;

  return (
    <div className="flex items-center gap-1">
      {label && <span className="mr-1 text-gray-500 text-sm">{label}</span>}
      <Icon className="h-4 w-4 stroke-gray-500" />
      <Select
        inline
        ariaLabel={label}
        className="w-28"
        value={value}
        options={VISIBILITY_OPTIONS}
        onChange={(next) =>
          update("visibility", { ...draft.visibility, [section]: next })
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

export const AlwaysPublic = () => (
  <div className="flex items-center gap-1 text-gray-500 text-sm">
    <GlobeAltIcon className="h-4 w-4 stroke-gray-500" />
    Shown in Scotty Circles
  </div>
);

type Props = {
  id: string;
  title: string;
  description?: string;
  /** Which visibility setting the Public/Private switch in the header controls. */
  shareable?: ToggleableVisibility;
  /** The fixed badge shown when there is no switch. Defaults to "private". */
  headerBadge?: "private" | "public" | "none";
  children: React.ReactNode;
};

export const ProfileSection = ({
  id,
  title,
  description,
  shareable,
  headerBadge = "private",
  children,
}: Props) => {
  // Saving happens once for the whole page (ProfileSaveBar); a card only shows its own errors.
  const error = useProfileDraft().errors[id];

  return (
    <div id={id} className="scroll-mt-6">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <Card.Header>{title}</Card.Header>
            {description && (
              <div className="mt-1 text-gray-500 text-sm">{description}</div>
            )}
          </div>
          <div className="shrink-0">
            {shareable ? (
              <VisibilityToggle section={shareable} />
            ) : headerBadge === "public" ? (
              <AlwaysPublic />
            ) : headerBadge === "private" ? (
              <AlwaysPrivate />
            ) : null}
          </div>
        </div>
        <div className="mt-4 space-y-4">{children}</div>
        {error && <div className="mt-4 text-red-600 text-sm">{error}</div>}
      </Card>
    </div>
  );
};
