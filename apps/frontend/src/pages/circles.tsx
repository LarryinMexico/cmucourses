import type { NextPage } from "next";
import React, { useMemo, useState } from "react";
import { SignInButton, useAuth } from "@clerk/nextjs";
import {
  COMMENT_LIMITS,
  SOCIAL_REACTIONS,
  type PublishedSchedule,
  type SocialDirectoryProfile,
} from "@cmucourses/profile";
import { ChatBubbleLeftIcon, TrashIcon } from "@heroicons/react/24/outline";
import { Page } from "~/components/Page";
import { Card } from "~/components/Card";
import Link from "~/components/Link";
import { useFetchProfile } from "~/app/api/profile";
import {
  useAddComment,
  useDeleteComment,
  usePublishSocialSchedule,
  useReactToSchedule,
  useScheduleComments,
  useSocialDirectory,
  useToggleFollow,
} from "~/app/api/social";
import { useAppSelector } from "~/app/hooks";
import { selectActiveUserSchedule } from "~/app/userSchedules";
import {
  INPUT_CLASS,
  PRIMARY_BUTTON_CLASS,
} from "~/components/profile/fields";
import { Pill } from "~/components/CourseTags";

const toPublishedSchedule = (
  schedule: ReturnType<typeof selectActiveUserSchedule>
): PublishedSchedule | null => {
  if (!schedule || schedule.session.semester === "" || !schedule.session.year)
    return null;
  return {
    name: schedule.name,
    semester: schedule.session.semester,
    year: schedule.session.year,
    courses: schedule.courses.map((courseID) => ({
      courseID,
      lecture: schedule.courseSessions[courseID]?.Lecture || null,
      section: schedule.courseSessions[courseID]?.Section || null,
    })),
  };
};

/** Comments under a published schedule; loaded only once opened. Writing needs following the owner. */
const Comments = ({ person }: { person: SocialDirectoryProfile }) => {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const { data: comments = [], isPending } = useScheduleComments(
    person.profileID,
    open
  );
  const add = useAddComment();
  const remove = useDeleteComment();

  return (
    <div className="mt-3">
      <button
        type="button"
        className="flex items-center gap-1 text-gray-500 text-xs"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <ChatBubbleLeftIcon className="h-4 w-4" />
        {open && !isPending ? `Comments (${comments.length})` : "Comments"}
      </button>
      {open && (
        <div className="mt-2 space-y-2">
          {isPending ? (
            <div className="text-gray-400 text-xs">Loading comments…</div>
          ) : comments.length === 0 ? (
            <div className="text-gray-400 text-xs">No comments yet.</div>
          ) : (
            <ul className="space-y-2">
              {comments.map((comment) => (
                <li key={comment.commentID} className="flex gap-2 text-sm">
                  <div className="min-w-0 flex-1">
                    <div className="text-gray-400 text-xs">
                      {comment.authorName} ·{" "}
                      {new Date(comment.createdAt).toLocaleDateString()}
                    </div>
                    <div className="break-words whitespace-pre-wrap text-gray-700">
                      {comment.body}
                    </div>
                  </div>
                  {comment.canDelete && (
                    <button
                      type="button"
                      aria-label="Delete comment"
                      title="Delete comment"
                      className="h-fit shrink-0 rounded p-1 text-gray-400 hover:bg-gray-50"
                      disabled={remove.isPending}
                      onClick={() =>
                        remove.mutate({
                          profileID: person.profileID,
                          commentID: comment.commentID,
                        })
                      }
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {person.following ? (
            <div className="space-y-2">
              <textarea
                className={`${INPUT_CLASS} w-full`}
                rows={2}
                maxLength={COMMENT_LIMITS.body}
                placeholder="Add a comment"
                aria-label={`Comment on ${person.displayName}'s schedule`}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
              />
              <button
                type="button"
                className={PRIMARY_BUTTON_CLASS}
                disabled={draft.trim() === "" || add.isPending}
                onClick={() =>
                  add.mutate(
                    { profileID: person.profileID, body: draft },
                    { onSuccess: () => setDraft("") }
                  )
                }
              >
                Post
              </button>
            </div>
          ) : (
            <div className="text-gray-400 text-xs">
              Connect with {person.displayName} to comment.
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const ProfileCard = ({
  person,
  ownCourses,
  ownInterests,
}: {
  person: SocialDirectoryProfile;
  ownCourses: ReadonlySet<string>;
  ownInterests: ReadonlySet<string>;
}) => {
  const follow = useToggleFollow();
  const react = useReactToSchedule();
  const commonCourses = [
    ...new Set([
      ...person.currentCourseIDs,
      ...(person.plannedSchedule?.courses.map((course) => course.courseID) ??
        []),
    ]),
  ].filter((course) => ownCourses.has(course));
  const commonInterests = [...person.careers, ...person.skills].filter((item) =>
    ownInterests.has(item)
  );

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div>
          <Card.Header>{person.displayName}</Card.Header>
          {person.academicSummary && (
            <p className="mt-1 text-gray-500 text-xs">{person.academicSummary}</p>
          )}
          {person.bio && (
            <p className="mt-1 text-gray-500 text-sm">{person.bio}</p>
          )}
        </div>
        <button
          type="button"
          className={PRIMARY_BUTTON_CLASS}
          disabled={follow.isPending}
          onClick={() =>
            follow.mutate({
              profileID: person.profileID,
              follow: !person.following,
            })
          }
        >
          {person.following ? "Connected" : "Connect"}
        </button>
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
        <div className="mt-3 text-gray-500 text-xs">
          Similar interests: {commonInterests.length}
        </div>
      )}

      {person.currentCourseIDs.length > 0 && (
        <div className="mt-3">
          <div className="text-gray-400 text-xs">Taking now</div>
          <div className="mt-1 flex flex-wrap gap-x-2 text-sm">
            {person.currentCourseIDs.map((courseID) => (
              <Link key={courseID} href={`/course/${courseID}`}>
                {courseID}
              </Link>
            ))}
          </div>
        </div>
      )}

      {person.plannedSchedule && (
        <div className="mt-3 rounded bg-gray-50 p-3">
          <div className="text-gray-700 text-sm">
            {person.plannedSchedule.name}
          </div>
          <div className="capitalize text-gray-400 text-xs">
            {person.plannedSchedule.semester} {person.plannedSchedule.year}
          </div>
          <div className="mt-2 flex flex-wrap gap-x-2 text-sm">
            {person.plannedSchedule.courses.map((course) => (
              <Link key={course.courseID} href={`/course/${course.courseID}`}>
                {course.courseID}
              </Link>
            ))}
          </div>
          {person.following ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {SOCIAL_REACTIONS.map((reaction) => (
                <button
                  type="button"
                  key={reaction}
                  className={`rounded border px-2 py-1 text-xs ${
                    person.myReaction === reaction
                      ? "border-blue-300 bg-blue-50"
                      : "border-gray-200"
                  }`}
                  onClick={() =>
                    react.mutate({
                      profileID: person.profileID,
                      reaction:
                        person.myReaction === reaction ? null : reaction,
                    })
                  }
                >
                  {reaction} {person.reactions[reaction] ?? 0}
                </button>
              ))}
            </div>
          ) : (
            <div className="mt-3 text-gray-400 text-xs">
              Connect with {person.displayName} to react to this schedule.
            </div>
          )}
          <Comments person={person} />
        </div>
      )}
    </Card>
  );
};

const CirclesContent = () => {
  const { isSignedIn } = useAuth();
  const { data: profile } = useFetchProfile();
  const { data: directory, isPending } = useSocialDirectory();
  const people = useMemo(() => directory?.people ?? [], [directory]);
  // Comes from the server, so it survives a reload; the directory refetches after publishing.
  const published = directory?.me.publishedSchedule ?? null;
  const activeSchedule = useAppSelector(selectActiveUserSchedule);
  const publish = usePublishSocialSchedule();
  const [studyPartnersOnly, setStudyPartnersOnly] = useState(false);
  const [similarInterestsOnly, setSimilarInterestsOnly] = useState(false);

  const ownCourses = useMemo(
    () =>
      new Set([
        ...(profile?.courses
          .filter((course) => course.status === "IN_PROGRESS")
          .map((course) => course.courseID) ?? []),
        ...(profile?.plannedCourses.map((course) => course.courseID) ?? []),
      ]),
    [profile]
  );
  const ownInterests = useMemo(
    () =>
      new Set([
        ...(profile?.careers ?? []),
        ...(profile?.skillsHave ?? []),
        ...(profile?.skillsWant ?? []),
      ]),
    [profile]
  );
  const visiblePeople = people.filter((person) => {
    const personCourses = [
      ...person.currentCourseIDs,
      ...(person.plannedSchedule?.courses.map((course) => course.courseID) ??
        []),
    ];
    const isStudyPartner = personCourses.some((course) =>
      ownCourses.has(course)
    );
    const hasSimilarInterest = [...person.careers, ...person.skills].some(
      (interest) => ownInterests.has(interest)
    );
    return (
      (!studyPartnersOnly || isStudyPartner) &&
      (!similarInterestsOnly || hasSimilarInterest)
    );
  });
  const friendCourses = [
    ...new Set(
      people
        .filter((person) => person.following)
        .flatMap((person) => [
          ...person.currentCourseIDs,
          ...(person.plannedSchedule?.courses.map(
            (course) => course.courseID
          ) ?? []),
        ])
        .filter((course) => !ownCourses.has(course))
    ),
  ];

  if (!isSignedIn) {
    return (
      <div className="mt-8 text-center text-gray-400">
        <SignInButton /> to use Scotty Circles.
      </div>
    );
  }

  const selectedForPublish = toPublishedSchedule(activeSchedule);

  return (
    <div className="m-auto max-w-5xl space-y-6 p-6">
      <div>
        <h1 className="text-gray-700 text-lg">Scotty Circles</h1>
        <p className="text-gray-400 text-sm">
          Connect around courses, plans, and shared interests.
        </p>
      </div>

      <Card>
        <Card.Header>Share schedules</Card.Header>
        <p className="mt-1 text-gray-500 text-sm">
          Publish the active planned schedule, or make Courses public on your
          Profile to share courses currently in progress.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            className={PRIMARY_BUTTON_CLASS}
            disabled={!selectedForPublish || publish.isPending}
            onClick={() => {
              if (!selectedForPublish) return;
              publish.mutate({ schedule: selectedForPublish });
            }}
          >
            Publish active planned schedule
          </button>
          {published && (
            <button
              type="button"
              className="rounded border border-gray-200 px-3 py-1.5 text-sm text-gray-600"
              disabled={publish.isPending}
              onClick={() => publish.mutate({ schedule: null })}
            >
              Unpublish
            </button>
          )}
          <Link href="/profile#courses">Manage actual schedule sharing</Link>
        </div>
        {published && (
          <p className="mt-2 capitalize text-gray-500 text-xs">
            Published: {published.name} · {published.semester}{" "}
            {published.year}
          </p>
        )}
      </Card>

      {friendCourses.length > 0 && (
        <Card>
          <Card.Header>Courses discovered through connections</Card.Header>
          <div className="mt-2 flex flex-wrap gap-x-3 text-sm">
            {friendCourses.map((courseID) => (
              <Link key={courseID} href={`/course/${courseID}`}>
                {courseID}
              </Link>
            ))}
          </div>
        </Card>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-gray-700 text-lg">People</h2>
        <div className="flex flex-wrap gap-4">
          <label className="text-gray-500 text-sm">
            <input
              type="checkbox"
              className="mr-2"
              checked={studyPartnersOnly}
              onChange={(event) => setStudyPartnersOnly(event.target.checked)}
            />
            Study partners in my courses
          </label>
          <label className="text-gray-500 text-sm">
            <input
              type="checkbox"
              className="mr-2"
              checked={similarInterestsOnly}
              onChange={(event) =>
                setSimilarInterestsOnly(event.target.checked)
              }
            />
            Similar interests
          </label>
        </div>
      </div>
      {isPending ? (
        <div className="text-gray-400">Loading people…</div>
      ) : visiblePeople.length === 0 ? (
        <div className="text-gray-400 text-sm">
          {people.length > 0 && (studyPartnersOnly || similarInterestsOnly)
            ? "No one matches these filters. Try clearing Study partners or Similar interests."
            : "No matching profiles yet. Profiles appear here after another student makes a profile section public or publishes a schedule."}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {visiblePeople.map((person) => (
            <ProfileCard
              key={person.profileID}
              person={person}
              ownCourses={ownCourses}
              ownInterests={ownInterests}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const CirclesPage: NextPage = () => (
  <Page
    activePage="circles"
    title="Scotty Circles - CMU Courses"
    content={<CirclesContent />}
  />
);

export default CirclesPage;
