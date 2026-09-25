import React from "react";
import { ChatBubbleLeftRightIcon } from "@heroicons/react/24/outline";
import type { SocialDirectoryProfile } from "@cmucourses/profile";
import { Card } from "~/components/Card";
import Link from "~/components/Link";
import { Pill } from "~/components/CourseTags";
import { FollowButton, FollowsYouBadge } from "./FollowButton";

/** A person in the People tab: who they are, how you are connected, and what you have in common. */
const ProfileCard = ({
  person,
  ownCourses,
  ownInterests,
  onMessage,
}: {
  person: SocialDirectoryProfile;
  ownCourses: ReadonlySet<string>;
  ownInterests: ReadonlySet<string>;
  onMessage: (person: SocialDirectoryProfile) => void;
}) => {
  const mutual = person.following && person.followsMe;
  const commonCourses = [
    ...new Set([...person.currentCourseIDs, ...person.postedCourseIDs]),
  ].filter((course) => ownCourses.has(course));
  const commonInterests = [...person.careers, ...person.skills].filter((item) =>
    ownInterests.has(item)
  );

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-gray-800 text-lg">{person.displayName}</span>
            <FollowsYouBadge show={person.followsMe} />
          </div>
          {person.academicSummary && (
            <p className="mt-1 text-gray-500 text-xs">
              {person.academicSummary}
            </p>
          )}
          {person.bio && (
            <p className="mt-1 text-gray-500 text-sm">{person.bio}</p>
          )}
        </div>
        <FollowButton
          profileID={person.profileID}
          following={person.following}
          followsMe={person.followsMe}
        />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {mutual ? (
          <button
            type="button"
            className="flex items-center gap-1 rounded border border-gray-200 px-3 py-1.5 text-gray-700 text-sm hover:bg-gray-50"
            onClick={() => onMessage(person)}
          >
            <ChatBubbleLeftRightIcon className="h-4 w-4" />
            Message
          </button>
        ) : (
          <span className="text-gray-400 text-xs">
            {person.following
              ? `You can message ${person.displayName} once they follow you back.`
              : `Follow each other to message.`}
          </span>
        )}
        <span className="ml-auto text-gray-500 text-xs">
          {person.postCount} {person.postCount === 1 ? "post" : "posts"}
        </span>
      </div>
      {commonCourses.length > 0 && (
        <div className="mt-3">
          <div className="text-gray-400 text-xs">Courses you share</div>
          <div className="mt-1 flex flex-wrap gap-1">
            {commonCourses.map((course) => (
              <Pill key={course} highlighted>
                {course}
              </Pill>
            ))}
          </div>
        </div>
      )}
      {commonInterests.length > 0 && (
        <div className="mt-2 text-gray-500 text-xs">
          Similar interests: {commonInterests.length}
        </div>
      )}
      {person.currentCourseIDs.length > 0 && (
        <div className="mt-2 text-gray-500 text-xs">
          Taking now:{" "}
          {person.currentCourseIDs.map((id, i) => (
            <React.Fragment key={id}>
              {i > 0 && ", "}
              <Link href={`/course/${id}`}>{id}</Link>
            </React.Fragment>
          ))}
        </div>
      )}
    </Card>
  );
};

export default ProfileCard;
