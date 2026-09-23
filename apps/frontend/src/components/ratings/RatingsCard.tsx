import React from "react";
import { StarIcon } from "@heroicons/react/24/solid";
import { Card } from "~/components/Card";
import { RatingTargetType, useFetchRatings } from "~/app/api/ratings";
import { Average, summarizeRatings } from "~/app/ratings";
import RateGate from "./RateGate";

const StatRow = ({ label, hint, stat }: { label: string; hint: string; stat: Average }) => (
  <div className="flex flex-wrap items-baseline justify-between gap-2">
    <span className="text-gray-700">
      {label} <span className="text-gray-400 text-xs">{hint}</span>
    </span>
    <span className="text-gray-500">
      {stat.average === null ? "No data yet" : `${stat.average.toFixed(1)} / 5 (${stat.count})`}
    </span>
  </div>
);

/** Aggregate stars, written feedback, and (courses only) "wish I knew" list, plus the rate form. */
const RatingsCard = ({ targetType, targetID }: { targetType: RatingTargetType; targetID: string }) => {
  const { data: ratings } = useFetchRatings(targetType, targetID);
  const list = ratings ?? [];
  const summary = summarizeRatings(list);
  const avg = summary.stars.average ?? 0;
  const comments = list.filter((r) => r.comment);
  const wishIKnews = targetType === "COURSE" ? list.filter((r) => r.wishIKnew) : [];

  return (
    <Card>
      <div className="flex items-center justify-between">
        <Card.Header>Ratings</Card.Header>
        {list.length > 0 && (
          <div className="flex items-center gap-1 text-gray-500 text-sm">
            <StarIcon className="h-4 w-4 text-yellow-500" />
            {avg.toFixed(1)} ({list.length} rating{list.length === 1 ? "" : "s"})
          </div>
        )}
      </div>

      {list.length === 0 && <div className="mt-2 text-gray-400 text-sm">No ratings yet.</div>}

      {list.length > 0 && (
        <div className="mt-3 space-y-1 text-sm">
          {targetType === "COURSE" && (
            <StatRow label="Workload" hint="1 light, 5 heavy" stat={summary.workload} />
          )}
          <StatRow label="Grading fairness" hint="5 = fair" stat={summary.gradingFairness} />
          <StatRow label="Transparency" hint="5 = clear" stat={summary.transparency} />
        </div>
      )}

      {comments.length > 0 && (
        <div className="mt-3">
          <div className="mb-1 text-gray-500 text-xs">Student feedback</div>
          <ul className="space-y-2 text-sm">
            {comments.map((rating, i) => (
              <li key={i} className="rounded bg-gray-50 p-2 text-gray-700">
                <div className="flex items-center gap-0.5 text-yellow-500">
                  {Array.from({ length: rating.stars }).map((_, j) => (
                    <StarIcon key={j} className="h-3 w-3" />
                  ))}
                </div>
                {rating.comment}
              </li>
            ))}
          </ul>
        </div>
      )}

      {wishIKnews.length > 0 && (
        <div className="mt-3">
          <div className="mb-1 text-gray-500 text-xs">What students wish they knew</div>
          <ul className="list-disc space-y-1 pl-4 text-gray-700 text-sm">
            {wishIKnews.map((rating, i) => (
              <li key={i}>{rating.wishIKnew}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-4 border-gray-100 border-t pt-3">
        <RateGate targetType={targetType} targetID={targetID} />
      </div>
    </Card>
  );
};

export default RatingsCard;
