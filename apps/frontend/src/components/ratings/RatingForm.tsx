import React, { useEffect, useState } from "react";
import { StarIcon } from "@heroicons/react/24/solid";
import { StarIcon as StarOutlineIcon } from "@heroicons/react/24/outline";
import { RATING_LIMITS } from "@cmucourses/profile";
import { PRIMARY_BUTTON_CLASS } from "~/components/profile/fields";
import { Rating, RatingTargetType, useSubmitRating } from "~/app/api/ratings";

const StarPicker = ({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) => (
  <div className="flex gap-1">
    {[1, 2, 3, 4, 5].map((n) => {
      const Icon = n <= value ? StarIcon : StarOutlineIcon;
      return (
        <button
          key={n}
          type="button"
          aria-label={`${n} star${n === 1 ? "" : "s"}`}
          aria-pressed={n === value}
          onClick={() => onChange(n)}
          className="text-yellow-500"
        >
          <Icon className="h-6 w-6" />
        </button>
      );
    })}
  </div>
);

/**
 * A 1-5 answer with named ends. Numbers rather than stars: for workload a higher number is not
 * "better", and stars would say it is. Clearing sends null, which removes an earlier answer.
 */
const ScalePicker = ({
  label,
  low,
  high,
  value,
  onChange,
}: {
  label: string;
  low: string;
  high: string;
  value: number | null;
  onChange: (value: number | null) => void;
}) => (
  <div>
    <div className="flex flex-wrap items-baseline gap-2 text-gray-500">
      <span className="text-gray-700">{label}</span>
      <span className="text-gray-400 text-xs">
        1 {low} · 5 {high}
      </span>
      {value !== null && (
        <button
          type="button"
          className="text-gray-500 text-xs underline"
          onClick={() => onChange(null)}
        >
          Clear
        </button>
      )}
    </div>
    <div className="mt-1 flex gap-1" role="group" aria-label={label}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          aria-pressed={value === n}
          className={`h-7 w-7 rounded border text-gray-700 text-xs ${
            value === n ? "border-blue-300 bg-blue-50" : "border-gray-200"
          }`}
          onClick={() => onChange(n)}
        >
          {n}
        </button>
      ))}
    </div>
  </div>
);

/** Star + optional comment (+ wishIKnew for courses) form, prefilled when editing an existing rating. */
const RatingForm = ({
  targetType,
  targetID,
  existing,
}: {
  targetType: RatingTargetType;
  targetID: string;
  existing: Rating | null | undefined;
}) => {
  const submit = useSubmitRating();
  const [stars, setStars] = useState(existing?.stars ?? 0);
  const [comment, setComment] = useState(existing?.comment ?? "");
  const [wishIKnew, setWishIKnew] = useState(existing?.wishIKnew ?? "");
  const [workload, setWorkload] = useState<number | null>(
    existing?.workload ?? null
  );
  const [gradingFairness, setGradingFairness] = useState<number | null>(
    existing?.gradingFairness ?? null
  );
  const [transparency, setTransparency] = useState<number | null>(
    existing?.transparency ?? null
  );
  const [hydratedFrom, setHydratedFrom] = useState<string | null>(null);

  // existing arrives after mount via react-query — fill once when it lands.
  useEffect(() => {
    if (!existing) return;
    const key = `${existing.targetType}:${existing.targetID}:${existing.updatedAt ?? existing.stars}`;
    if (hydratedFrom === key) return;
    setStars(existing.stars);
    setComment(existing.comment ?? "");
    setWishIKnew(existing.wishIKnew ?? "");
    setWorkload(existing.workload ?? null);
    setGradingFairness(existing.gradingFairness ?? null);
    setTransparency(existing.transparency ?? null);
    setHydratedFrom(key);
  }, [existing, hydratedFrom]);

  return (
    <div className="space-y-2 text-sm">
      <StarPicker value={stars} onChange={setStars} />
      <div className="space-y-2">
        {targetType === "COURSE" && (
          <ScalePicker
            label="Workload"
            low="light"
            high="heavy"
            value={workload}
            onChange={setWorkload}
          />
        )}
        <ScalePicker
          label="Grading fairness"
          low="unfair"
          high="fair"
          value={gradingFairness}
          onChange={setGradingFairness}
        />
        <ScalePicker
          label="Transparency"
          low="unclear"
          high="clear"
          value={transparency}
          onChange={setTransparency}
        />
      </div>
      <textarea
        className="w-full rounded border border-gray-200 p-2 text-gray-700 text-sm"
        rows={2}
        maxLength={RATING_LIMITS.comment}
        placeholder="Share your experience (optional)"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
      />
      {targetType === "COURSE" && (
        <textarea
          className="w-full rounded border border-gray-200 p-2 text-gray-700 text-sm"
          rows={2}
          maxLength={RATING_LIMITS.wishIKnew}
          placeholder="What do you wish you knew before taking this course? (optional)"
          value={wishIKnew}
          onChange={(e) => setWishIKnew(e.target.value)}
        />
      )}
      {stars === 0 && (
        <div className="text-gray-400 text-xs">
          Pick a star rating to submit.
        </div>
      )}
      <button
        type="button"
        disabled={stars === 0 || submit.isPending}
        onClick={() =>
          submit.mutate({
            targetType,
            targetID,
            stars,
            comment: comment.trim() || null,
            wishIKnew:
              targetType === "COURSE" ? wishIKnew.trim() || null : null,
            workload: targetType === "COURSE" ? workload : null,
            gradingFairness,
            transparency,
          })
        }
        className={PRIMARY_BUTTON_CLASS}
      >
        {submit.isPending
          ? "Saving..."
          : existing
            ? "Update rating"
            : "Submit rating"}
      </button>
    </div>
  );
};

export default RatingForm;
