import React, { useState } from "react";
import {
  ChatBubbleLeftIcon,
  ChatBubbleLeftRightIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import {
  CAREERS,
  SKILLS,
  SOCIAL_REACTIONS,
  type CirclePost,
} from "@cmucourses/profile";
import { Card } from "~/components/Card";
import Link from "~/components/Link";
import { Pill, TagRow } from "~/components/CourseTags";
import { useDeletePost, useReactToPost } from "~/app/api/social";
import { useCourseInfosStatus } from "~/app/api/course";
import InlineConfirm from "~/components/InlineConfirm";
import {
  displayUnits,
  isValidUnits,
  parseUnits,
  sessionToString,
} from "~/app/utils";
import WeekGrid from "./WeekGrid";
import PostComments from "./PostComments";
import { FollowButton, FollowsYouBadge } from "./FollowButton";

const timeAgo = (iso: string) => {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return days < 30 ? `${days} d ago` : new Date(iso).toLocaleDateString();
};

/**
 * One post in the feed: who shared it, their public profile details, the schedule as a week grid
 * with their busy times, the course list, reactions and comments.
 */
const PostCard = ({
  post,
  ownCourses,
  ownInterests,
  onMessage,
}: {
  post: CirclePost;
  ownCourses: ReadonlySet<string>;
  ownInterests: ReadonlySet<string>;
  onMessage: (post: CirclePost) => void;
}) => {
  const [showComments, setShowComments] = useState(false);
  const react = useReactToPost();
  const remove = useDeletePost();
  const { courses: details, isPending: detailsPending } = useCourseInfosStatus(
    post.courses.map((course) => course.courseID)
  );
  const { author } = post;
  const mutual = post.following && post.followsMe;
  const semester = sessionToString({
    year: post.year,
    semester: post.semester,
    ...(post.session ? { session: post.session } : {}),
  });
  const units = post.courses.map(
    (course) => details.find((d) => d.courseID === course.courseID)?.units
  );
  const totalUnits = units.reduce(
    (sum, u) => sum + (u && isValidUnits(u) ? parseUnits(u) : 0),
    0
  );
  const shared = post.courses
    .filter((course) => ownCourses.has(course.courseID))
    .map((c) => c.courseID);

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="min-w-0 wrap-anywhere text-gray-800 text-lg">
              {author.displayName}
            </span>
            {post.isMine ? (
              <span className="rounded bg-blue-50 px-2 py-0.5 text-blue-800 text-xs">
                Your post
              </span>
            ) : (
              <FollowsYouBadge show={post.followsMe} />
            )}
          </div>
          {author.academicSummary && (
            <div className="text-gray-500 text-xs">
              {author.academicSummary}
            </div>
          )}
          <div className="text-gray-400 text-xs">
            {semester} · updated {timeAgo(post.updatedAt)}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {post.isMine ? (
            <InlineConfirm
              question="Delete this post and its comments?"
              confirmLabel="Delete"
              disabled={remove.isPending}
              onConfirm={() => remove.mutate({ postId: post.postID })}
              trigger={(open) => (
                <button
                  type="button"
                  className="flex items-center gap-1 rounded px-2 py-1 text-gray-500 text-sm hover:bg-gray-50"
                  disabled={remove.isPending}
                  onClick={open}
                >
                  <TrashIcon className="h-4 w-4" />
                  Delete
                </button>
              )}
            />
          ) : (
            <>
              {mutual && (
                <button
                  type="button"
                  className="flex items-center gap-1 rounded border border-gray-200 px-3 py-2 text-gray-700 text-sm hover:bg-gray-50"
                  onClick={() => onMessage(post)}
                >
                  <ChatBubbleLeftRightIcon className="h-4 w-4" />
                  Message
                </button>
              )}
              <FollowButton
                profileID={author.profileID}
                following={post.following}
                followsMe={post.followsMe}
                displayName={author.displayName}
              />
            </>
          )}
        </div>
      </div>

      {author.bio && (
        <p className="mt-2 wrap-anywhere text-gray-600 text-sm">{author.bio}</p>
      )}
      <div className="mt-2 space-y-1">
        <TagRow
          ids={author.careers}
          labels={CAREERS}
          highlightIDs={ownInterests}
          max={3}
        />
        <TagRow
          ids={author.skills}
          labels={SKILLS}
          highlightIDs={ownInterests}
          max={6}
        />
      </div>
      {author.currentCourseIDs.length > 0 && (
        <div className="mt-2 text-gray-500 text-xs">
          Taking now:{" "}
          {author.currentCourseIDs.map((id, i) => (
            <React.Fragment key={id}>
              {i > 0 && ", "}
              <Link href={`/course/${id}`}>{id}</Link>
            </React.Fragment>
          ))}
        </div>
      )}

      <div className="mt-4">
        <div className="mb-2 text-gray-700 text-sm font-semibold">
          {post.name}
        </div>
        <WeekGrid post={post} />
      </div>

      <ul className="mt-3 divide-y divide-gray-100 text-sm">
        {post.courses.map((course, i) => (
          <li
            key={course.courseID}
            className="flex items-center justify-between gap-2 py-1"
          >
            <span className="text-gray-700">
              <Link href={`/course/${course.courseID}`}>{course.courseID}</Link>
              <span className="ml-2 text-gray-500">
                {[course.lecture, course.section && `Section ${course.section}`]
                  .filter(Boolean)
                  .join(" · ") || "No section picked"}
              </span>
            </span>
            <span className="text-gray-500 text-xs">
              {units[i] ? `${displayUnits(units[i])} units` : ""}
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-gray-500 text-xs">
        <span>
          {/* A partial total while details load would be wrong, so wait. */}
          {!detailsPending && totalUnits > 0 ? `${totalUnits} units total` : ""}
        </span>
        {shared.length > 0 && (
          <span className="flex flex-wrap items-center gap-1">
            Courses you share:
            {shared.map((id) => (
              <Pill key={id} highlighted>
                {id}
              </Pill>
            ))}
          </span>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 border-gray-100 border-t pt-3">
        {post.following && !post.isMine ? (
          SOCIAL_REACTIONS.map((reaction) => (
            <button
              type="button"
              key={reaction}
              aria-pressed={post.myReaction === reaction}
              className={`rounded border px-2 py-1 text-gray-700 text-xs ${
                post.myReaction === reaction
                  ? "border-blue-300 bg-blue-50"
                  : "border-gray-200"
              }`}
              disabled={react.isPending}
              onClick={() =>
                react.mutate({
                  postId: post.postID,
                  reaction: post.myReaction === reaction ? null : reaction,
                })
              }
            >
              {reaction} {post.reactions[reaction] ?? 0}
            </button>
          ))
        ) : (
          <span className="text-gray-500 text-xs">
            {SOCIAL_REACTIONS.filter((r) => post.reactions[r])
              .map((r) => `${r} ${post.reactions[r]}`)
              .join("  ") ||
              (post.isMine
                ? "No reactions yet"
                : `Follow ${author.displayName} to react`)}
          </span>
        )}
        <button
          type="button"
          className="ml-auto flex items-center gap-1 text-gray-500 text-sm hover:underline"
          aria-expanded={showComments}
          onClick={() => setShowComments(!showComments)}
        >
          <ChatBubbleLeftIcon className="h-4 w-4" />
          {post.commentCount} {post.commentCount === 1 ? "comment" : "comments"}
        </button>
      </div>
      {showComments && <PostComments post={post} />}
    </Card>
  );
};

export default PostCard;
