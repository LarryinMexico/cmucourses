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
          onClick={() => onChange(n)}
          className="text-yellow-500"
        >
          <Icon className="h-6 w-6" />
        </button>
      );
    })}
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
  const [hydratedFrom, setHydratedFrom] = useState<string | null>(null);

  // existing arrives after mount via react-query — fill once when it lands.
  useEffect(() => {
    if (!existing) return;
    const key = `${existing.targetType}:${existing.targetID}:${existing.updatedAt ?? existing.stars}`;
    if (hydratedFrom === key) return;
    setStars(existing.stars);
    setComment(existing.comment ?? "");
    setWishIKnew(existing.wishIKnew ?? "");
    setHydratedFrom(key);
  }, [existing, hydratedFrom]);

  return (
    <div className="space-y-2 text-sm">
      <StarPicker value={stars} onChange={setStars} />
      <textarea
        className="w-full rounded border border-gray-200 p-2 text-sm"
        rows={2}
        maxLength={RATING_LIMITS.comment}
        placeholder="Share your experience (optional)"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
      />
      {targetType === "COURSE" && (
        <textarea
          className="w-full rounded border border-gray-200 p-2 text-sm"
          rows={2}
          maxLength={RATING_LIMITS.wishIKnew}
          placeholder="What do you wish you knew before taking this course? (optional)"
          value={wishIKnew}
          onChange={(e) => setWishIKnew(e.target.value)}
        />
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
