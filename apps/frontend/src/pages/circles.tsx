import type { NextPage } from "next";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import type { ParsedUrlQuery } from "querystring";
import { SignInButton, useAuth } from "@clerk/nextjs";
import { EyeSlashIcon } from "@heroicons/react/24/outline";
import type { CirclePost, SocialDirectoryProfile } from "@cmucourses/profile";
import { Page } from "~/components/Page";
import { Card } from "~/components/Card";
import Link from "~/components/Link";
import { useFetchProfile } from "~/app/api/profile";
import { useFeed, useSocialDirectory, type FeedFilter } from "~/app/api/social";
import { useConversations } from "~/app/api/messages";
import { unreadTotal } from "~/app/circles";
import { classNames } from "~/app/utils";
import Loading from "~/components/Loading";
import { PRIMARY_BUTTON_CLASS } from "~/components/profile/fields";
import PostCard from "~/components/circles/PostCard";
import ProfileCard from "~/components/circles/ProfileCard";
import ShareCard from "~/components/circles/ShareCard";
import { FollowButton } from "~/components/circles/FollowButton";
import MessagesPanel, {
  type OpenConversation,
} from "~/components/circles/MessagesPanel";

type Tab = "feed" | "people" | "messages";
const TABS: { id: Tab; label: string }[] = [
  { id: "feed", label: "Feed" },
  { id: "people", label: "People" },
  { id: "messages", label: "Messages" },
];
const FEED_FILTERS: { id: FeedFilter; label: string }[] = [
  { id: "all", label: "Everyone" },
  { id: "following", label: "Following" },
  { id: "mine", label: "My posts" },
];

const withoutDm = (query: ParsedUrlQuery) => {
  const next = { ...query };
  delete next.dm;
  return next;
};

const ErrorLine = ({ what, retry }: { what: string; retry: () => void }) => (
  <div className="text-gray-500 text-sm">
    Couldn&apos;t load {what}.{" "}
    <button type="button" className="underline" onClick={retry}>
      Retry
    </button>
  </div>
);

/** The feed, a page at a time: the next page loads when the bottom comes into view. */
const Feed = ({
  filter,
  setFilter,
  ownCourses,
  ownInterests,
  onMessage,
}: {
  filter: FeedFilter;
  setFilter: (filter: FeedFilter) => void;
  ownCourses: ReadonlySet<string>;
  ownInterests: ReadonlySet<string>;
  onMessage: (post: CirclePost) => void;
}) => {
  const feed = useFeed(filter);
  const sentinel = useRef<HTMLDivElement>(null);
  const posts = feed.data?.pages.flatMap((page) => page.posts) ?? [];
  const {
    hasNextPage,
    isFetchingNextPage,
    isFetchNextPageError,
    fetchNextPage,
  } = feed;

  // The page scrolls inside Page's content column, not the window, so observe against the viewport.
  useEffect(() => {
    const node = sentinel.current;
    if (!node) return;
    const observer = new IntersectionObserver((entries) => {
      if (
        entries.some((e) => e.isIntersecting) &&
        hasNextPage &&
        !isFetchingNextPage &&
        !isFetchNextPageError
      )
        void fetchNextPage();
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage]);

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {FEED_FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            aria-pressed={filter === f.id}
            className={classNames(
              "rounded-full border px-3 py-1 text-sm",
              filter === f.id
                ? "border-blue-300 bg-blue-50 text-blue-800"
                : "border-gray-200 text-gray-600"
            )}
            onClick={() => setFilter(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>
      {feed.isError && posts.length === 0 ? (
        <ErrorLine what="the feed" retry={() => void feed.refetch()} />
      ) : feed.isPending ? (
        <div className="text-gray-400 text-sm">Loading posts…</div>
      ) : posts.length === 0 ? (
        <Card>
          <p className="text-gray-500 text-sm">
            {filter === "mine"
              ? "You haven't shared a schedule yet."
              : filter === "following"
                ? "Nobody you follow has shared a schedule yet."
                : "No schedules shared yet. Be the first!"}
          </p>
        </Card>
      ) : (
        posts.map((post) => (
          <PostCard
            key={post.postID}
            post={post}
            ownCourses={ownCourses}
            ownInterests={ownInterests}
            onMessage={onMessage}
          />
        ))
      )}
      <div ref={sentinel} />
      {isFetchNextPageError && posts.length > 0 && (
        <div className="text-center text-gray-500 text-sm">
          Couldn&apos;t load more ·{" "}
          <button
            type="button"
            className="text-gray-500 underline"
            onClick={() => void fetchNextPage()}
          >
            Retry
          </button>
        </div>
      )}
      {isFetchingNextPage && (
        <div className="text-center text-gray-400 text-sm">Loading more…</div>
      )}
      {!hasNextPage && !isFetchNextPageError && posts.length > 0 && (
        <div className="py-4 text-center text-gray-400 text-xs">
          You&apos;re all caught up.
        </div>
      )}
    </div>
  );
};

const CirclesContent = () => {
  const { isLoaded, isSignedIn } = useAuth();
  const router = useRouter();
  const { data: profile } = useFetchProfile();
  const directory = useSocialDirectory();
  const people = useMemo(() => directory.data?.people ?? [], [directory.data]);
  const me = directory.data?.me;
  const [tab, setTab] = useState<Tab>("feed");
  const [feedFilter, setFeedFilter] = useState<FeedFilter>("all");
  // Names for threads opened this visit; which thread is open lives in ?dm= so Back closes it.
  const [opened, setOpened] = useState<OpenConversation | null>(null);
  const conversations = useConversations();
  const unread = unreadTotal(conversations.data);
  const dm = typeof router.query.dm === "string" ? router.query.dm : null;
  const listedDm = conversations.data?.find((c) => c.profileID === dm);
  const openConversation: OpenConversation | null = !dm
    ? null
    : opened?.profileID === dm
      ? opened
      : listedDm
        ? {
            profileID: dm,
            displayName: listedDm.displayName,
            canSend: listedDm.canSend,
          }
        : null;
  const [studyPartnersOnly, setStudyPartnersOnly] = useState(false);
  const [similarInterestsOnly, setSimilarInterestsOnly] = useState(false);

  // ?tab=feed|people|messages deep links (and reloads) land on that tab.
  useEffect(() => {
    const t = router.query.tab;
    if (t === "feed" || t === "people" || t === "messages") setTab(t);
  }, [router.query.tab]);
  const goTo = (next: Tab) => {
    setTab(next);
    const query = withoutDm(router.query);
    void router.replace({ query: { ...query, tab: next } }, undefined, {
      shallow: true,
    });
    if (next === "messages") void directory.refetch(); // pick up a follow-back before chatting
  };
  const openThread = (conversation: OpenConversation | null) => {
    const query = withoutDm(router.query);
    if (!conversation) {
      void router.replace({ query }, undefined, { shallow: true });
      return;
    }
    setOpened(conversation);
    setTab("messages");
    void router.push(
      { query: { ...query, tab: "messages", dm: conversation.profileID } },
      undefined,
      { shallow: true }
    );
  };
  const openChat = (profileID: string, displayName: string) => {
    void directory.refetch();
    openThread({ profileID, displayName, canSend: true });
  };

  const ownCourses = useMemo(
    () =>
      new Set([
        ...(profile?.courses
          .filter((c) => c.status === "IN_PROGRESS")
          .map((c) => c.courseID) ?? []),
        ...(profile?.plannedCourses.map((c) => c.courseID) ?? []),
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
  const matches = (person: SocialDirectoryProfile) => {
    const courses = [...person.currentCourseIDs, ...person.postedCourseIDs];
    return (
      (!studyPartnersOnly || courses.some((c) => ownCourses.has(c))) &&
      (!similarInterestsOnly ||
        [...person.careers, ...person.skills].some((i) => ownInterests.has(i)))
    );
  };
  const matching = people.filter(matches);
  const suggestions = people.filter((person) => !person.following).slice(0, 5);

  if (!isLoaded) return <Loading />;
  if (!isSignedIn) {
    return (
      <div className="mt-8 text-center">
        <SignInButton>
          <button type="button" className={PRIMARY_BUTTON_CLASS}>
            Sign in
          </button>
        </SignInButton>{" "}
        <span className="text-gray-500">to use Scotty Circles.</span>
      </div>
    );
  }

  return (
    <div className="m-auto max-w-6xl p-4 md:p-6">
      <div className="mb-4">
        <h1 className="text-gray-800 text-xl">Scotty Circles</h1>
        <p className="text-gray-500 text-sm">
          Share your semester, see what others are taking, and plan together.
        </p>
      </div>

      {me && !me.visible && (
        <div className="mb-4 flex gap-2 rounded border border-yellow-200 bg-yellow-50 p-3 text-yellow-800 text-sm">
          <EyeSlashIcon className="h-5 w-5 shrink-0" />
          <span>
            Others can&apos;t find you yet, so they can&apos;t follow or message
            you. Make a section public on your{" "}
            <Link href="/profile">Profile</Link> or share a schedule.
          </span>
        </div>
      )}

      <div className="mb-4 flex gap-1 border-gray-200 border-b">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            aria-current={tab === t.id ? "page" : undefined}
            className={classNames(
              "-mb-px border-b-2 px-4 py-2 text-sm",
              tab === t.id
                ? "border-blue-600 text-blue-800"
                : "border-transparent text-gray-500 hover:text-gray-700"
            )}
            onClick={() => goTo(t.id)}
          >
            {t.label}
            {t.id === "messages" && unread > 0 ? ` (${unread})` : ""}
          </button>
        ))}
      </div>

      {tab === "messages" ? (
        <MessagesPanel open={openConversation} onOpen={openThread} />
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="min-w-0 space-y-4">
            {tab === "feed" ? (
              <Feed
                filter={feedFilter}
                setFilter={setFeedFilter}
                ownCourses={ownCourses}
                ownInterests={ownInterests}
                onMessage={(post) =>
                  openChat(post.author.profileID, post.author.displayName)
                }
              />
            ) : (
              <div className="space-y-4">
                <div className="flex flex-wrap gap-4">
                  <label className="text-gray-500 text-sm">
                    <input
                      type="checkbox"
                      className="mr-2"
                      checked={studyPartnersOnly}
                      onChange={(e) => setStudyPartnersOnly(e.target.checked)}
                    />
                    Study partners in my courses
                  </label>
                  <label className="text-gray-500 text-sm">
                    <input
                      type="checkbox"
                      className="mr-2"
                      checked={similarInterestsOnly}
                      onChange={(e) =>
                        setSimilarInterestsOnly(e.target.checked)
                      }
                    />
                    Similar interests
                  </label>
                </div>
                {directory.isError ? (
                  <ErrorLine
                    what="people"
                    retry={() => void directory.refetch()}
                  />
                ) : directory.isPending ? (
                  <div className="text-gray-400 text-sm">Loading people…</div>
                ) : matching.length === 0 ? (
                  <div className="text-gray-400 text-sm">
                    {studyPartnersOnly && ownCourses.size === 0
                      ? "Add courses on your Profile to find study partners."
                      : people.length > 0
                        ? "No one matches these filters."
                        : "No one to show yet. People appear here once they make a profile section public or share a schedule."}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {matching.map((person) => (
                      <ProfileCard
                        key={person.profileID}
                        person={person}
                        ownCourses={ownCourses}
                        ownInterests={ownInterests}
                        onMessage={(p) => openChat(p.profileID, p.displayName)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          {/* On phones the sidebar (Share, suggestions) sits above the feed, which scrolls forever. */}
          <aside className="order-first space-y-4 lg:order-none">
            <ShareCard myPosts={me?.posts ?? []} />
            {suggestions.length > 0 && (
              <Card>
                <Card.Header>People you may know</Card.Header>
                <ul className="mt-2 space-y-3">
                  {suggestions.map((person) => (
                    <li
                      key={person.profileID}
                      className="flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-gray-800 text-sm">
                          {person.displayName}
                        </div>
                        <div className="truncate text-gray-500 text-xs">
                          {person.academicSummary ??
                            `${person.postCount} ${person.postCount === 1 ? "post" : "posts"}`}
                        </div>
                      </div>
                      <FollowButton
                        profileID={person.profileID}
                        following={person.following}
                        followsMe={person.followsMe}
                        displayName={person.displayName}
                      />
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </aside>
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
