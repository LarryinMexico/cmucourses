import React from "react";
import { useAuth } from "@clerk/nextjs";
import { Card } from "~/components/Card";
import Link from "~/components/Link";
import { useFriendCourses } from "~/app/api/social";
import { friendsTaking } from "~/app/friendCourses";
import { AuthErrorNotice } from "~/components/AuthErrorNotice";

/**
 * People you follow who are taking or planning this course, from what they share (public
 * courses, or their Circles posts). Shown only when signed in.
 */
const FriendsInCourseCard = ({ courseID }: { courseID: string }) => {
  const { isSignedIn } = useAuth();
  const {
    data: friends,
    isPending,
    isError,
    error,
    refetch,
  } = useFriendCourses();
  if (!isSignedIn) return null;

  const taking = friendsTaking(friends ?? [], courseID);

  return (
    <Card>
      <Card.Header>Friends in this course</Card.Header>
      {isError ? (
        <AuthErrorNotice error={error} className="mt-2 text-sm">
          <div className="mt-2 text-gray-500 text-sm">
            Couldn&apos;t load who you follow.{" "}
            <button
              type="button"
              className="underline"
              onClick={() => void refetch()}
            >
              Retry
            </button>
          </div>
        </AuthErrorNotice>
      ) : isPending ? (
        <div className="mt-2 text-gray-400 text-sm">Loading…</div>
      ) : taking.length === 0 ? (
        <p className="mt-2 text-gray-500 text-sm">
          None of the people you follow list this course.{" "}
          <Link href="/circles?tab=people">Find people in Circles</Link>
        </p>
      ) : (
        <ul className="mt-2 space-y-1 text-sm">
          {taking.map((friend) => (
            <li key={friend.profileID} className="text-gray-700">
              <span className="font-semibold text-gray-700">
                {friend.displayName}
              </span>{" "}
              <span className="text-gray-500">
                · {friend.notes.join(" · ")}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
};

export default FriendsInCourseCard;
