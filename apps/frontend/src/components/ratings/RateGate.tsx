import React from "react";
import { SignInButton, useAuth } from "@clerk/nextjs";
import { standardizeCourseID } from "@cmucourses/profile";
import Link from "~/components/Link";
import { useFetchProfile } from "~/app/api/profile";
import { RatingTargetType, useFetchOwnRating } from "~/app/api/ratings";
import RatingForm from "./RatingForm";

/**
 * Renders RatingForm only once the signed-in user is allowed to rate this target: a course
 * needs to be marked Taken on their profile; an instructor has no client-side check (the
 * backend verifies via a TAKEN course's schedule), so the form always renders when signed in
 * and a 403 surfaces as a toast from useSubmitRating.
 */
const RateGate = ({
  targetType,
  targetID,
}: {
  targetType: RatingTargetType;
  targetID: string;
}) => {
  const { isSignedIn } = useAuth();
  const { data: profile } = useFetchProfile();
  const { data: ownRating } = useFetchOwnRating(targetType, targetID);

  if (!isSignedIn) {
    return (
      <div className="text-gray-400 text-sm">
        <SignInButton /> to rate this{" "}
        {targetType === "COURSE" ? "course" : "instructor"}.
      </div>
    );
  }

  if (targetType === "COURSE") {
    const canonical = standardizeCourseID(targetID);
    const taken =
      profile?.courses.some(
        (c) =>
          standardizeCourseID(c.courseID) === canonical &&
          c.status === "TAKEN"
      ) ?? false;
    if (!taken) {
      return (
        <div className="text-gray-400 text-sm">
          Mark this course as Taken on your{" "}
          <Link href="/profile">profile</Link> to rate it.
        </div>
      );
    }
  }

  return (
    <RatingForm
      targetType={targetType}
      targetID={targetID}
      existing={ownRating}
    />
  );
};

export default RateGate;
