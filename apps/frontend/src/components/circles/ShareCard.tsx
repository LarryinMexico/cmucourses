import React, { useState } from "react";
import type { MyPostSummary, PostKind } from "@cmucourses/profile";
import { Card } from "~/components/Card";
import Link from "~/components/Link";
import { useSavedSchedules } from "~/app/api/savedSchedules";
import { useDeletePost, useSharePost } from "~/app/api/social";
import { sessionToString } from "~/app/utils";
import { INPUT_CLASS, PRIMARY_BUTTON_CLASS } from "~/components/profile/fields";
import InlineConfirm from "~/components/InlineConfirm";
import { AuthErrorNotice } from "~/components/AuthErrorNotice";

const KIND_OPTIONS: { value: PostKind; label: string }[] = [
  { value: "ACTUAL", label: "Actual (what I'm taking)" },
  { value: "PLANNED", label: "Planned" },
];

const kindLabel = (kind: PostKind) =>
  kind === "PLANNED" ? "Planned" : "Actual";

const termOf = (s: { semester: string; year: string }) =>
  sessionToString({
    year: s.year,
    semester: s.semester as "fall" | "spring" | "summer",
  });

/**
 * Share one of your saved schedules. Each semester holds one planned and one actual post;
 * sharing again with the same kind replaces that one.
 */
const ShareCard = ({ myPosts }: { myPosts: MyPostSummary[] }) => {
  const {
    data: saved = [],
    isPending,
    isError,
    error,
    refetch,
  } = useSavedSchedules();
  const share = useSharePost();
  const remove = useDeletePost();
  const [chosen, setChosen] = useState<string>("");
  const [kind, setKind] = useState<PostKind>("ACTUAL");
  const selected = saved.find((s) => s.id === chosen) ?? saved[0];
  const replaces =
    selected &&
    myPosts.find(
      (p) =>
        p.semester === selected.semester &&
        p.year === selected.year &&
        p.kind === kind
    );

  return (
    <Card>
      <Card.Header>Share a schedule</Card.Header>
      {isPending ? (
        <div className="mt-2 text-gray-400 text-sm">
          Loading your schedules…
        </div>
      ) : isError ? (
        <AuthErrorNotice error={error} className="mt-2 text-sm">
          <div className="mt-2 text-gray-500 text-sm">
            Couldn&apos;t load your schedules ·{" "}
            <button
              type="button"
              className="text-gray-500 underline"
              onClick={() => void refetch()}
            >
              Retry
            </button>
          </div>
        </AuthErrorNotice>
      ) : saved.length === 0 ? (
        <p className="mt-2 text-gray-500 text-sm">
          Save a schedule first in <Link href="/schedules">Schedules</Link>{" "}
          (&quot;My saved schedules&quot;), then share it here.
        </p>
      ) : (
        <div className="mt-2 space-y-2">
          <select
            className={`${INPUT_CLASS} w-full`}
            aria-label="Schedule to share"
            value={selected?.id ?? ""}
            onChange={(e) => setChosen(e.target.value)}
          >
            {saved.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({termOf(s)})
              </option>
            ))}
          </select>
          <div
            className="flex flex-wrap gap-x-4 gap-y-1 text-gray-500 text-sm"
            role="radiogroup"
            aria-label="Kind of schedule"
          >
            {KIND_OPTIONS.map((option) => (
              <label key={option.value}>
                <input
                  type="radio"
                  name="post-kind"
                  className="mr-1"
                  checked={kind === option.value}
                  onChange={() => setKind(option.value)}
                />
                {option.label}
              </label>
            ))}
          </div>
          {replaces && (
            <div className="text-gray-500 text-xs">
              Replaces your {kindLabel(kind).toLowerCase()} {termOf(replaces)}{" "}
              post &quot;{replaces.name}&quot;.
            </div>
          )}
          <button
            type="button"
            className={`${PRIMARY_BUTTON_CLASS} w-full`}
            disabled={!selected || share.isPending}
            onClick={() =>
              selected && share.mutate({ savedScheduleId: selected.id, kind })
            }
          >
            {share.isPending ? "Sharing…" : "Share"}
          </button>
          <p className="text-gray-400 text-xs">
            Your post shows this schedule and your weekly busy times. What each
            busy time is for stays hidden unless you allow it on your{" "}
            <Link href="/profile#time">Profile</Link>.
          </p>
        </div>
      )}
      {myPosts.length > 0 && (
        <div className="mt-4">
          <div className="text-gray-500 text-xs">Your posts</div>
          <ul className="mt-1 divide-y divide-gray-100">
            {myPosts.map((p) => (
              <li
                key={p.postID}
                className="flex items-center justify-between gap-2 py-1 text-sm"
              >
                <span className="min-w-0 truncate text-gray-700">
                  {p.name}{" "}
                  <span className="text-gray-400">
                    · {kindLabel(p.kind)} · {termOf(p)}
                  </span>
                </span>
                <InlineConfirm
                  question="Delete this post and its comments?"
                  confirmLabel="Delete"
                  disabled={remove.isPending}
                  onConfirm={() => remove.mutate({ postId: p.postID })}
                  trigger={(open) => (
                    <button
                      type="button"
                      className="shrink-0 text-gray-500 text-xs underline"
                      disabled={remove.isPending}
                      onClick={open}
                    >
                      Delete
                    </button>
                  )}
                />
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
};

export default ShareCard;
