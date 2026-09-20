import React from "react";
import {
  CAREERS,
  careersForCourse,
  labelOf,
  SKILLS,
  skillsForCourse,
} from "@cmucourses/profile";
import { useFetchProfile } from "~/app/api/profile";
import { classNames } from "~/app/utils";

const MAX_SKILLS = 4;
const MAX_CAREERS = 3;

export const Pill = ({
  children,
  highlighted,
}: {
  children: React.ReactNode;
  highlighted: boolean;
}) => (
  <span
    className={classNames(
      "rounded px-2 py-0.5 text-xs",
      highlighted ? "text-blue-800 bg-blue-50" : "text-gray-600 bg-gray-50"
    )}
  >
    {children}
  </span>
);

export const TagRow = ({
  ids,
  labels,
  highlightIDs,
  max,
}: {
  ids: readonly string[];
  labels: readonly { id: string; label: string }[];
  highlightIDs: ReadonlySet<string>;
  max: number;
}) => {
  if (ids.length === 0) return null;
  const shown = ids.slice(0, max);
  const hiddenCount = ids.length - shown.length;

  return (
    <div className="flex flex-wrap gap-1">
      {shown.map((id) => (
        <Pill key={id} highlighted={highlightIDs.has(id)}>
          {labelOf(labels, id)}
        </Pill>
      ))}
      {hiddenCount > 0 && <Pill highlighted={false}>+{hiddenCount}</Pill>}
    </div>
  );
};

/** Skill and career-path tags for a course, from the curated mapping in @cmucourses/profile. Renders nothing for a course that isn't mapped yet. */
const CourseTags = ({ courseID }: { courseID: string }) => {
  const { data: profile } = useFetchProfile();

  const skills = skillsForCourse(courseID);
  const careers = careersForCourse(courseID);
  if (skills.length === 0 && careers.length === 0) return null;

  const wantedSkills = new Set(profile?.skillsWant ?? []);
  const goalCareers = new Set(profile?.careers ?? []);

  return (
    <div className="mt-1 space-y-1">
      <TagRow
        ids={skills}
        labels={SKILLS}
        highlightIDs={wantedSkills}
        max={MAX_SKILLS}
      />
      <TagRow
        ids={careers}
        labels={CAREERS}
        highlightIDs={goalCareers}
        max={MAX_CAREERS}
      />
    </div>
  );
};

export default CourseTags;
