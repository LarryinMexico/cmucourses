import React from "react";
import { useToggleFollow } from "~/app/api/social";
import InlineConfirm from "~/components/InlineConfirm";
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
  displayName,
}: {
  profileID: string;
  following: boolean;
  followsMe: boolean;
  /** For the unfollow confirmation. */
  displayName: string;
}) => {
  const follow = useToggleFollow();
  const label = following
    ? followsMe
      ? "Connected"
      : "Following"
    : followsMe
      ? "Follow back"
      : "Follow";
  const button = (onClick: () => void) => (
    <button
      type="button"
      // Never wraps or shrinks: a narrow column squeezed "Follow back" onto two lines.
      className={`${following ? SECONDARY_BUTTON_CLASS : PRIMARY_BUTTON_CLASS} shrink-0 whitespace-nowrap`}
      disabled={follow.isPending}
      title={following ? "Click to unfollow" : undefined}
      onClick={onClick}
    >
      {label}
    </button>
  );
  const toggle = () => follow.mutate({ profileID, follow: !following });

  // Unfollowing a mutual connection also ends messaging, so it is asked first.
  if (following && followsMe)
    return (
      <InlineConfirm
        trigger={(open) => button(open)}
        question={`Unfollow ${displayName}? You won't be able to message each other.`}
        confirmLabel="Unfollow"
        disabled={follow.isPending}
        onConfirm={toggle}
      />
    );
  return button(toggle);
};

export const FollowsYouBadge = ({ show }: { show: boolean }) =>
  show ? (
    <span className="rounded bg-gray-100 px-2 py-0.5 text-gray-600 text-xs">
      Follows you
    </span>
  ) : null;
