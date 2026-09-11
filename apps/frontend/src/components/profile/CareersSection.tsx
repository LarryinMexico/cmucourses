import React from "react";
import {
  ChevronDownIcon,
  ChevronUpIcon,
  XMarkIcon,
} from "@heroicons/react/20/solid";
import {
  activeItems,
  CAREERS,
  LIMITS,
  labelOf,
  Profile,
} from "@cmucourses/profile";
import { Select } from "./fields";
import { ProfileSection, useDraft } from "./ProfileSection";

const IconButton = ({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) => (
  <button
    type="button"
    aria-label={label}
    title={label}
    disabled={disabled}
    onClick={onClick}
    className="rounded p-1 text-gray-500 hover:bg-gray-50 disabled:opacity-30"
  >
    {children}
  </button>
);

/** Ordered career goals: the first one is the primary goal. Shared by the profile page and onboarding. */
export const CareerGoalsEditor = ({
  value,
  onChange,
}: {
  value: string[];
  onChange: (value: string[]) => void;
}) => {
  const move = (from: number, to: number) => {
    const next = [...value];
    const [item] = next.splice(from, 1);
    if (item === undefined) return;
    next.splice(to, 0, item);
    onChange(next);
  };

  const remaining = activeItems(CAREERS)
    .filter(({ id }) => !value.includes(id))
    .map(({ id, label }) => ({ value: id as string | null, label }));

  return (
    <div className="text-gray-700 text-sm">
      {value.length === 0 && (
        <div className="text-gray-400">No career goals yet.</div>
      )}
      <ol className="divide-y divide-gray-100">
        {value.map((id, index) => (
          <li key={id} className="flex items-center justify-between gap-2 py-2">
            <div className="flex items-center gap-2">
              <span className="w-4 text-gray-400">{index + 1}.</span>
              <span>{labelOf(CAREERS, id)}</span>
              {index === 0 && (
                <span className="rounded px-2 py-0.5 text-xs text-blue-800 bg-blue-50">
                  Primary
                </span>
              )}
            </div>
            <div className="flex items-center">
              <IconButton
                label="Move up"
                disabled={index === 0}
                onClick={() => move(index, index - 1)}
              >
                <ChevronUpIcon className="h-5 w-5" />
              </IconButton>
              <IconButton
                label="Move down"
                disabled={index === value.length - 1}
                onClick={() => move(index, index + 1)}
              >
                <ChevronDownIcon className="h-5 w-5" />
              </IconButton>
              <IconButton
                label="Remove"
                onClick={() => onChange(value.filter((other) => other !== id))}
              >
                <XMarkIcon className="h-5 w-5" />
              </IconButton>
            </div>
          </li>
        ))}
      </ol>
      {value.length < LIMITS.careers ? (
        <Select
          inline
          className="mt-2 sm:w-72"
          value={null}
          options={remaining}
          onChange={(id) => id && onChange([...value, id])}
          placeholder="Add career goal"
        />
      ) : (
        <div className="mt-2 text-gray-400">
          You can choose up to {LIMITS.careers} career goals.
        </div>
      )}
    </div>
  );
};

export const CareersSection = ({ profile }: { profile: Profile }) => {
  const { draft, setDraft, dirty } = useDraft(profile.careers);

  return (
    <ProfileSection
      id="careers"
      title="Career goals"
      description="Pick up to three, in order of priority."
      profile={profile}
      shareable="careers"
      dirty={dirty}
      patch={{ careers: draft }}
    >
      <CareerGoalsEditor value={draft} onChange={setDraft} />
    </ProfileSection>
  );
};
