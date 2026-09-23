import React, { useState } from "react";
import {
  LockClosedIcon,
  LockOpenIcon,
  NoSymbolIcon,
} from "@heroicons/react/24/outline";
import ProgressBar from "~/components/ProgressBar";
import { Card } from "~/components/Card";
import { PRIMARY_BUTTON_CLASS } from "~/components/profile/fields";
import { ScheduleCandidate, SectionRef } from "~/app/scheduleGenerator";
import { classNames } from "~/app/utils";

const COLLAPSED_REASONS = 4;

export const refOf = (
  pick: ScheduleCandidate["picks"][number]
): SectionRef => ({
  courseID: pick.courseID,
  lecture: pick.lecture,
  section: pick.section,
});

export const sameRef = (a: SectionRef, b: SectionRef) =>
  a.courseID === b.courseID &&
  a.lecture === b.lecture &&
  a.section === b.section;

const ICON_BUTTON_CLASS = "rounded p-1 hover:bg-gray-50";

const CandidateCard = ({
  candidate,
  index,
  locks,
  onToggleLock,
  onExclude,
  onUse,
}: {
  candidate: ScheduleCandidate;
  index: number;
  locks: readonly SectionRef[];
  onToggleLock: (ref: SectionRef) => void;
  onExclude: (ref: SectionRef) => void;
  onUse: () => void;
}) => {
  const [showAll, setShowAll] = useState(false);
  const { scores } = candidate;
  const reasons = showAll
    ? candidate.reasons
    : candidate.reasons.slice(0, COLLAPSED_REASONS);

  return (
    <Card>
      <div className="flex items-center justify-between">
        <Card.Header>Option {index + 1}</Card.Header>
        <span className="text-gray-400 text-xs">
          {Math.round(candidate.totalScore)} / 100
        </span>
      </div>
      <div className="mt-3 space-y-2">
        <ProgressBar
          value={scores.availability}
          max={100}
          label={`Availability fit — ${candidate.availability.status.toLowerCase()}`}
        />
        <ProgressBar
          value={scores.workload}
          max={100}
          label={`Workload — ${candidate.totalUnits} units (${candidate.workloadFit.toLowerCase().replace("_", " ")})`}
        />
        <ProgressBar value={scores.career} max={100} label="Career/skill fit" />
        <ProgressBar
          value={scores.preference}
          max={100}
          label="Saved preferences"
        />
      </div>
      <ul className="mt-3 divide-y divide-gray-100 text-gray-700 text-sm">
        {candidate.picks.map((pick) => {
          const ref = refOf(pick);
          const locked = locks.some((lock) => sameRef(lock, ref));
          const name = `${pick.courseID} ${pick.lecture}${pick.section ? ` / ${pick.section}` : ""}`;
          return (
            <li
              key={pick.courseID}
              className="flex items-center justify-between gap-2 py-1"
            >
              <span>
                {pick.courseID} — {pick.lecture}
                {pick.section ? ` / ${pick.section}` : ""}
              </span>
              <span className="flex shrink-0 gap-1">
                <button
                  type="button"
                  aria-pressed={locked}
                  aria-label={`${locked ? "Unlock" : "Lock"} ${name}`}
                  title={locked ? "Unlock this pick" : "Keep this pick"}
                  className={classNames(
                    ICON_BUTTON_CLASS,
                    locked ? "text-blue-900 bg-blue-50" : "text-gray-400"
                  )}
                  onClick={() => onToggleLock(ref)}
                >
                  {locked ? (
                    <LockClosedIcon className="h-4 w-4" />
                  ) : (
                    <LockOpenIcon className="h-4 w-4" />
                  )}
                </button>
                <button
                  type="button"
                  aria-label={`Exclude ${name}`}
                  title="Never pick this option"
                  className={classNames(ICON_BUTTON_CLASS, "text-gray-400")}
                  onClick={() => onExclude(ref)}
                >
                  <NoSymbolIcon className="h-4 w-4" />
                </button>
              </span>
            </li>
          );
        })}
      </ul>
      {candidate.reasons.length > 0 && (
        <>
          <ul className="mt-2 list-disc space-y-0.5 pl-4 text-gray-400 text-xs">
            {reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
          {candidate.reasons.length > COLLAPSED_REASONS && (
            <button
              type="button"
              className="mt-1 text-gray-500 text-xs underline"
              onClick={() => setShowAll(!showAll)}
            >
              {showAll
                ? "Show fewer"
                : `Show all ${candidate.reasons.length} reasons`}
            </button>
          )}
        </>
      )}
      <button
        type="button"
        onClick={onUse}
        className={`${PRIMARY_BUTTON_CLASS} mt-3 w-full`}
      >
        Use this schedule
      </button>
    </Card>
  );
};

export default CandidateCard;
