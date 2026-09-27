import React from "react";
import { useToggleFollow } from "~/app/api/social";
import {
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "~/components/profile/fields";

/**
 * Follow state in both directions, spelled out: "Connected" only when you follow each other,
 * "Following" when it is one-way from you, "Follow back" when only they follow you.
 */
export const FollowButton = ({
  profileID,
  following,
  followsMe,
}: {
  profileID: string;
  following: boolean;
  followsMe: boolean;
}) => {
  const follow = useToggleFollow();
  const label = following
    ? followsMe
      ? "Connected"
      : "Following"
    : followsMe
      ? "Follow back"
      : "Follow";
  return (
    <button
      type="button"
      // Never wraps or shrinks: a narrow column squeezed "Follow back" onto two lines.
      className={`${following ? SECONDARY_BUTTON_CLASS : PRIMARY_BUTTON_CLASS} shrink-0 whitespace-nowrap`}
      disabled={follow.isPending}
      title={following ? "Click to unfollow" : undefined}
      onClick={() => follow.mutate({ profileID, follow: !following })}
    >
      {label}
    </button>
  );
};

export const FollowsYouBadge = ({ show }: { show: boolean }) =>
  show ? (
    <span className="rounded bg-gray-100 px-2 py-0.5 text-gray-600 text-xs">
      Follows you
    </span>
  ) : null;
