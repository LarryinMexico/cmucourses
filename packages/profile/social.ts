import { z } from "zod";
import { PROFILE_SEMESTERS, standardizeCourseID } from "./schema";

export const SOCIAL_REACTIONS = ["👍", "🎉", "🔥", "📚"] as const;

export const publishedCourseSchema = z
  .object({
    courseID: z
      .string()
      .transform(standardizeCourseID)
      .refine((value) => /^\d{2}-\d{3}$/.test(value), "Invalid course ID"),
    lecture: z.string().max(50).nullable(),
    section: z.string().max(50).nullable(),
  })
  .strict();

export const publishedScheduleSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    semester: z.enum(PROFILE_SEMESTERS),
    year: z.string().regex(/^\d{4}$/),
    courses: z.array(publishedCourseSchema).max(30),
  })
  .strict();

/** A profile is addressed by its database id everywhere in the social API; Clerk ids never leave the server. */
export const profileIDSchema = z.string().regex(/^[a-f\d]{24}$/i, "Invalid profile ID");

export const COMMENT_LIMITS = { body: 500 } as const;

export const commentDeleteSchema = z
  .object({ commentID: z.string().regex(/^[a-f\d]{24}$/i, "Invalid comment ID") })
  .strict();

export const MESSAGE_LIMITS = { body: 1000 } as const;

export const sendMessageSchema = z
  .object({
    profileID: profileIDSchema,
    body: z.string().trim().min(1, "Write a message first").max(MESSAGE_LIMITS.body, "Message is too long"),
  })
  .strict();

export const threadQuerySchema = z.object({ profileID: profileIDSchema }).strict();

const postIDSchema = z.string().regex(/^[a-f\d]{24}$/i, "Invalid post ID");

/**
 * What a post says about its schedule: the plan before registering, or what the student is
 * actually taking. Each student has at most one of each per semester.
 */
export const POST_KINDS = ["PLANNED", "ACTUAL"] as const;
export type PostKind = (typeof POST_KINDS)[number];

/** Share a saved schedule: it becomes (or replaces) your post of that kind for that semester. */
export const sharePostInputSchema = z
  .object({
    savedScheduleId: z.string().regex(/^[a-f\d]{24}$/i, "Invalid schedule ID"),
    kind: z.enum(POST_KINDS).default("ACTUAL"),
  })
  .strict();

export const deletePostInputSchema = z.object({ postId: postIDSchema }).strict();

export const postReactionInputSchema = z
  .object({ postId: postIDSchema, reaction: z.enum(SOCIAL_REACTIONS).nullable() })
  .strict();

export const postCommentInputSchema = z
  .object({
    postId: postIDSchema,
    body: z.string().trim().min(1, "Write a comment first").max(COMMENT_LIMITS.body, "Comment is too long"),
  })
  .strict();

export const postCommentsQuerySchema = z.object({ postId: postIDSchema }).strict();

export const FEED_FILTERS = ["all", "following", "mine"] as const;
export const FEED_PAGE_SIZE = 10;

/** A feed page is asked for by the last post seen: `<updatedAt ISO>_<post id>`. */
export const feedQuerySchema = z
  .object({
    cursor: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}T[\d:.]+Z_[a-f\d]{24}$/i, "Invalid cursor")
      .optional(),
    filter: z.enum(FEED_FILTERS).default("all"),
    /** Only planned or only actual schedules; absent means both. */
    kind: z.enum(POST_KINDS).optional(),
  })
  .strict();

export const followInputSchema = z
  .object({
    profileID: profileIDSchema,
    follow: z.boolean(),
  })
  .strict();

export type PublishedSchedule = z.output<typeof publishedScheduleSchema>;
export type SocialReaction = (typeof SOCIAL_REACTIONS)[number];

export interface SocialDirectoryProfile {
  profileID: string;
  displayName: string;
  bio: string | null;
  /** College + major labels when academic visibility is public; otherwise empty. */
  academicSummary: string | null;
  careers: string[];
  skills: string[];
  currentCourseIDs: string[];
  /** Courses across this person's posts, for "courses you share". */
  postedCourseIDs: string[];
  postCount: number;
  /** You follow them. Reacting, commenting and messaging all start from this. */
  following: boolean;
  /** They follow you. With `following` this makes a mutual follow, which is what messaging needs. */
  followsMe: boolean;
}

/** The caller's own social state, so the page can show what is already published after a reload. */
export interface SocialMe {
  /** Null until the caller has saved a profile (sharing a post creates one). */
  profileID: string | null;
  /** Whether anyone else can find you: a public profile section, or at least one post. */
  visible: boolean;
  posts: MyPostSummary[];
}

export interface SocialDirectory {
  me: SocialMe;
  people: SocialDirectoryProfile[];
}

/** A comment on someone's published schedule, as the caller sees it. */
export interface ScheduleComment {
  commentID: string;
  /** Null when the author no longer has a profile. */
  authorProfileID: string | null;
  authorName: string;
  body: string;
  createdAt: string;
  /** The caller wrote it, or owns the schedule it is on. */
  canDelete: boolean;
}

export interface DirectMessage {
  messageID: string;
  body: string;
  createdAt: string;
  fromMe: boolean;
}

/** One row of the message list: the latest message with someone, and what you have not read. */
export interface ConversationSummary {
  profileID: string;
  displayName: string;
  lastMessage: { body: string; createdAt: string; fromMe: boolean };
  unreadCount: number;
  /** You follow each other right now. History stays readable after an unfollow, but sending stops. */
  canSend: boolean;
}

/** A busy time as others see it: always when, and why only if the author allows it. */
export interface PostBusyBlock {
  day: number;
  begin: number;
  end: number;
  label: string | null;
}

/** The author of a post, with each profile section already gated by its visibility. */
export interface PostAuthor {
  profileID: string;
  displayName: string;
  bio: string | null;
  academicSummary: string | null;
  careers: string[];
  skills: string[];
  currentCourseIDs: string[];
}

/** One student's schedule for one semester, as shown in the Circles feed. */
export interface CirclePost {
  postID: string;
  author: PostAuthor;
  busyBlocks: PostBusyBlock[];
  name: string;
  kind: PostKind;
  semester: PublishedSchedule["semester"];
  year: string;
  session: "summer one" | "summer two" | "summer all" | null;
  courses: PublishedSchedule["courses"];
  postedAt: string;
  updatedAt: string;
  isMine: boolean;
  following: boolean;
  followsMe: boolean;
  myReaction: SocialReaction | null;
  reactions: Partial<Record<SocialReaction, number>>;
  commentCount: number;
}

export interface FeedPage {
  posts: CirclePost[];
  nextCursor: string | null;
}

/** Your own posts, one per semester, for the share card. */
export interface MyPostSummary {
  postID: string;
  name: string;
  kind: PostKind;
  semester: PublishedSchedule["semester"];
  year: string;
}
