import React from "react";
import { Card } from "~/components/Card";
import Link from "~/components/Link";
import { useFetchProfile } from "~/app/api/profile";
import { useFriendCourses } from "~/app/api/social";
import { useFetchCourseInfos } from "~/app/api/course";
import { discoverCourses, ownCourseIDs } from "~/app/friendCourses";
import { AuthErrorNotice } from "~/components/AuthErrorNotice";

/** At most this many courses are listed; the rest are the long tail of single-friend picks. */
const MAX_COURSES = 30;

/**
 * Courses the people you follow are taking or planning that are not on your profile yet, most
 * friends first. Only what each friend shares counts (see /social/friend-courses).
 */
const FriendCoursesPanel = ({ onFindPeople }: { onFindPeople: () => void }) => {
  const {
    data: friends,
    isPending,
    isError,
    error,
    refetch,
  } = useFriendCourses();
  const { data: profile } = useFetchProfile();
  const courses = discoverCourses(friends ?? [], ownCourseIDs(profile)).slice(
    0,
    MAX_COURSES
  );
  const infos = useFetchCourseInfos(courses.map((c) => c.courseID));
  const nameOf = (id: string) => infos.find((c) => c.courseID === id)?.name;

  if (isError) {
    return (
      <AuthErrorNotice error={error}>
        <div className="text-gray-500 text-sm">
          Couldn&apos;t load your friends&apos; courses.{" "}
          <button
            type="button"
            className="underline"
            onClick={() => void refetch()}
          >
            Retry
          </button>
        </div>
      </AuthErrorNotice>
    );
  }
  if (isPending) return <div className="text-gray-400 text-sm">Loading…</div>;

  if (courses.length === 0) {
    return (
      <Card>
        <p className="text-gray-500 text-sm">
          {(friends ?? []).length === 0
            ? "Nobody you follow shares their courses yet."
            : "Everything the people you follow are taking is already on your profile."}{" "}
          <button
            type="button"
            className="text-blue-600 hover:underline"
            onClick={onFindPeople}
          >
            Find people to follow
          </button>
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-gray-500 text-sm">
        Courses the people you follow are taking or planning, not yet on your
        profile. Most shared first.
      </p>
      {courses.map((course) => (
        <Card key={course.courseID}>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div className="min-w-0 text-gray-700">
              <Link href={`/course/${course.courseID}`}>{course.courseID}</Link>{" "}
              <span className="text-gray-600">{nameOf(course.courseID)}</span>
            </div>
            <div className="shrink-0 text-gray-500 text-sm">
              {course.friends.length}{" "}
              {course.friends.length === 1 ? "friend" : "friends"}
            </div>
          </div>
          <ul className="mt-1 space-y-0.5 text-sm">
            {course.friends.map((friend) => (
              <li key={friend.profileID} className="text-gray-700">
                {friend.displayName}{" "}
                <span className="text-gray-500">
                  · {friend.notes.join(" · ")}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ))}
    </div>
  );
};

export default FriendCoursesPanel;
