import {
  COLLEGES,
  MAJORS,
  SOCIAL_REACTIONS,
  labelOf,
  type CirclePost,
  type PostAuthor,
  type SocialDirectoryProfile,
  type SocialReaction,
} from "@cmucourses/profile";

/** The columns of a `profiles` row these views read. Declared structurally so they can be tested without Prisma. */
export interface DirectoryProfileRow {
  id: string;
  clerkUserId: string;
  displayName: string | null;
  bio: string | null;
  /** `busyLabels` is absent on profiles saved before it existed; that reads as private. */
  visibility: { academic: string; careers: string; skills: string; courses: string; busyLabels?: string | null };
  academic: { college?: string | null; majors: string[] } | null;
  careers: string[];
  skillsHave: string[];
  skillsWant: string[];
  courses: { courseID: string; status: string }[];
  busyBlocks: { day: number; begin: number; end: number; label?: string | null }[];
}

export interface PostRow {
  id: string;
  authorUserId: string;
  name: string;
  semester: string;
  year: string;
  session?: string | null;
  courses: { courseID: string; lecture?: string | null; section?: string | null }[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ReactionRow {
  reactorUserId: string;
  reaction: string;
}

const isReaction = (value: unknown): value is SocialReaction => SOCIAL_REACTIONS.includes(value as SocialReaction);
const SUMMER_SESSIONS = ["summer one", "summer two", "summer all"] as const;

/** A profile as others may see it: private sections come back empty, and nothing carries a Clerk id. */
export const toPostAuthor = (profile: DirectoryProfileRow): PostAuthor => ({
  profileID: profile.id,
  displayName: profile.displayName || "CMU student",
  bio: profile.bio,
  academicSummary:
    profile.visibility.academic === "PUBLIC" && profile.academic
      ? [
          profile.academic.college ? labelOf(COLLEGES, profile.academic.college) : null,
          ...profile.academic.majors.map((id) => labelOf(MAJORS, id)),
        ]
          .filter(Boolean)
          .join(" · ") || null
      : null,
  careers: profile.visibility.careers === "PUBLIC" ? profile.careers : [],
  skills: profile.visibility.skills === "PUBLIC" ? [...new Set([...profile.skillsHave, ...profile.skillsWant])] : [],
  currentCourseIDs:
    profile.visibility.courses === "PUBLIC"
      ? profile.courses.filter((course) => course.status === "IN_PROGRESS").map((course) => course.courseID)
      : [],
});

export interface ViewerContext {
  viewerUserId: string;
  /** Profile ids the viewer follows. */
  followedProfileIDs: ReadonlySet<string>;
  /** Clerk ids of the people who follow the viewer. */
  followerUserIDs: ReadonlySet<string>;
}

/**
 * A post as `viewerUserId` sees it. Busy times always show (the author chose to post), but what
 * each one is for only when the author has made busy-time labels public.
 */
export const toCirclePost = (
  post: PostRow,
  author: DirectoryProfileRow,
  ctx: ViewerContext & { reactions: ReactionRow[]; commentCount: number }
): CirclePost => {
  const counts: Partial<Record<SocialReaction, number>> = {};
  for (const { reaction } of ctx.reactions) {
    if (isReaction(reaction)) counts[reaction] = (counts[reaction] ?? 0) + 1;
  }
  const own = ctx.reactions.find((reaction) => reaction.reactorUserId === ctx.viewerUserId)?.reaction;
  const showLabels = author.visibility.busyLabels === "PUBLIC";

  return {
    postID: post.id,
    author: toPostAuthor(author),
    busyBlocks: author.busyBlocks.map(({ day, begin, end, label }) => ({
      day,
      begin,
      end,
      label: showLabels ? (label ?? null) : null,
    })),
    name: post.name,
    semester: post.semester as CirclePost["semester"],
    year: post.year,
    session: SUMMER_SESSIONS.find((s) => s === post.session) ?? null,
    courses: post.courses.map((course) => ({
      courseID: course.courseID,
      lecture: course.lecture ?? null,
      section: course.section ?? null,
    })),
    postedAt: post.createdAt.toISOString(),
    updatedAt: post.updatedAt.toISOString(),
    isMine: post.authorUserId === ctx.viewerUserId,
    following: ctx.followedProfileIDs.has(author.id),
    followsMe: ctx.followerUserIDs.has(author.clerkUserId),
    myReaction: isReaction(own) ? own : null,
    reactions: counts,
    commentCount: ctx.commentCount,
  };
};

/** One person in the People tab. */
export const toDirectoryProfile = ({
  profile,
  posts,
  followedProfileIDs,
  followerUserIDs,
}: {
  profile: DirectoryProfileRow;
  posts: Pick<PostRow, "courses">[];
  followedProfileIDs: ReadonlySet<string>;
  followerUserIDs: ReadonlySet<string>;
}): SocialDirectoryProfile => {
  const { profileID, displayName, bio, academicSummary, careers, skills, currentCourseIDs } = toPostAuthor(profile);
  return {
    profileID,
    displayName,
    bio,
    academicSummary,
    careers,
    skills,
    currentCourseIDs,
    postedCourseIDs: [...new Set(posts.flatMap((post) => post.courses.map((course) => course.courseID)))],
    postCount: posts.length,
    following: followedProfileIDs.has(profile.id),
    followsMe: followerUserIDs.has(profile.clerkUserId),
  };
};

/** Feed pages continue after the last post seen, ordered by (updatedAt, id) descending. */
export const encodeCursor = (post: Pick<PostRow, "id" | "updatedAt">): string =>
  `${post.updatedAt.toISOString()}_${post.id}`;

export const decodeCursor = (cursor: string): { updatedAt: Date; id: string } => {
  const at = cursor.lastIndexOf("_");
  return { updatedAt: new Date(cursor.slice(0, at)), id: cursor.slice(at + 1) };
};
