import React from "react";
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";
import { useAvailabilityFit } from "~/app/availability";
import { Schedule } from "~/app/types";
import { classNames } from "~/app/utils";
import { DAYS, minutesToTime } from "./profile/options";
import type { BusyBlock } from "@cmucourses/profile";

const describe = (block: BusyBlock): string => {
  if (block.label) return block.label;
  // The card's right-hand column is narrow, so abbreviate: "Wed", not "Wednesday".
  const day = (DAYS[block.day] ?? "").slice(0, 3);
  // A block ending at 1440 is "end of day"; minutesToTime would render it as 24:00.
  const end = minutesToTime(block.end % 1440);
  return `${day} ${minutesToTime(block.begin)}\u2013${end}`;
};

/** Flags a course as fitting or clashing with the busy times saved on the user's Profile. */
const AvailabilityBadge = ({ schedules }: { schedules?: Schedule[] }) => {
  const fit = useAvailabilityFit(schedules);
  if (!fit) return <></>;

  const fits = fit.status === "FITS";
  const Icon = fits ? CheckCircleIcon : ExclamationTriangleIcon;

  return (
    <span
      className={classNames(
        "mt-1 inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs",
        fits ? "text-green-800 bg-green-50" : "text-red-800 bg-red-50"
      )}
    >
      <Icon className="h-3 w-3 shrink-0" />
      {fits
        ? "Fits your availability"
        : `Conflicts with ${fit.conflict ? describe(fit.conflict) : "your availability"}`}
    </span>
  );
};

export default AvailabilityBadge;
