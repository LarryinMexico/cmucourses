import React, { useEffect, useState } from "react";

/**
 * A destructive action asked twice, in place: the trigger becomes "{question} Yes · No".
 * Used instead of window.confirm, which blocks the page (and freezes browser automation).
 */
const InlineConfirm = ({
  trigger,
  question,
  confirmLabel = "Yes",
  onConfirm,
  disabled = false,
}: {
  trigger: (open: () => void) => React.ReactNode;
  question: string;
  confirmLabel?: string;
  onConfirm: () => void;
  disabled?: boolean;
}) => {
  const [asking, setAsking] = useState(false);

  useEffect(() => {
    if (!asking) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setAsking(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [asking]);

  if (!asking) return <>{trigger(() => setAsking(true))}</>;
  return (
    <span
      className="inline-flex flex-wrap items-center gap-2 text-gray-600 text-xs"
      role="group"
      aria-label={question}
    >
      <span>{question}</span>
      <button
        type="button"
        className="rounded px-2 py-1 font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
        disabled={disabled}
        onClick={() => {
          setAsking(false);
          onConfirm();
        }}
      >
        {confirmLabel}
      </button>
      <button
        type="button"
        autoFocus
        className="rounded px-2 py-1 text-gray-600 hover:bg-gray-50"
        onClick={() => setAsking(false)}
      >
        No
      </button>
    </span>
  );
};

export default InlineConfirm;
