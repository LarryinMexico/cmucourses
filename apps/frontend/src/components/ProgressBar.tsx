import React from "react";

/** A minimal labeled progress bar: a filled track sized by percentage. */
const ProgressBar = ({
  value,
  max,
  label,
}: {
  value: number;
  max: number;
  /** e.g. "3 / 4 core skills". Shown above the bar. */
  label?: string;
}) => {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;

  return (
    <div>
      {label && <div className="mb-1 text-gray-500 text-xs">{label}</div>}
      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-gray-200"
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
      >
        <div
          className="h-full rounded-full bg-blue-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
};

export default ProgressBar;
