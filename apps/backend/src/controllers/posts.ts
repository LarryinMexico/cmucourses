import { RequestHandler } from "express";
import db from "@cmucourses/db";
import {
  DEFAULT_VISIBILITY,
  FEED_PAGE_SIZE,
  commentDeleteSchema,
  deletePostInputSchema,
  feedQuerySchema,
  postCommentInputSchema,
  postCommentsQuerySchema,
  postReactionInputSchema,
  sharePostInputSchema,
  type CirclePost,
  type FeedPage,
  type ScheduleComment,
} from "@cmucourses/profile";
import { UserLocals } from "./user";
import { checkPostInteraction } from "./socialAccess";
import { decodeCursor, encodeCursor, toCirclePost } from "./socialDirectory";

type ErrorBody = { error: string };
const MAX_COMMENTS = 200;

const firstIssue = (error: { issues: { message: string }[] }, fallback: string) => error.issues[0]?.message ?? fallback;

/**
 * The Circles feed: posts newest first (by last update), a page at a time. `following` keeps the
 * authors you follow, `mine` your own. A post whose author has no profile is skipped.
 */
export const getFeed: RequestHandler<
  unknown,
  FeedPage | ErrorBody,
  { token: string; cursor?: unknown; filter?: unknown },
  unknown,
  UserLocals
> = async (req, res, next) => {
  const parsed = feedQuerySchema.safeParse({ cursor: req.body.cursor, filter: req.body.filter });
  if (!parsed.success) {
    res.status(400).json({ error: firstIssue(parsed.error, "Invalid feed request") });
    return;
  }
  const me = res.locals.userId;
  const { cursor, filter } = parsed.data;
  try {
    const [myProfile, myFollows] = await Promise.all([
      db.profiles.findUnique({ where: { clerkUserId: me } }),
      db.follows.findMany({ where: { followerUserId: me } }),
    ]);

    let authorFilter: object = {};
    if (filter === "mine") authorFilter = { authorUserId: me };
    if (filter === "following") {
      const followed = await db.profiles.findMany({
        where: { id: { in: myFollows.map((follow) => follow.followedProfileId) } },
        select: { clerkUserId: true },
      });
      authorFilter = { authorUserId: { in: followed.map((p) => p.clerkUserId) } };
    }
    const after = cursor ? decodeCursor(cursor) : null;
    const rows = await db.circlePosts.findMany({
      where: {
        ...authorFilter,
        ...(after
          ? { OR: [{ updatedAt: { lt: after.updatedAt } }, { updatedAt: after.updatedAt, id: { lt: after.id } }] }
          : {}),
      },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: FEED_PAGE_SIZE + 1,
    });
    const page = rows.slice(0, FEED_PAGE_SIZE);
    const postIds = page.map((post) => post.id);

    const [authors, followersOfMe, reactions, comments] = await Promise.all([
      db.profiles.findMany({ where: { clerkUserId: { in: [...new Set(page.map((post) => post.authorUserId))] } } }),
      myProfile ? db.follows.findMany({ where: { followedProfileId: myProfile.id } }) : Promise.resolve([]),
      db.postReactions.findMany({ where: { postId: { in: postIds } } }),
      db.postComments.findMany({ where: { postId: { in: postIds } }, select: { postId: true } }),
    ]);
    const authorByUser = new Map(authors.map((author) => [author.clerkUserId, author]));
    const followedProfileIDs = new Set(myFollows.map((follow) => follow.followedProfileId));
    const followerUserIDs = new Set(followersOfMe.map((follow) => follow.followerUserId));
    const commentCounts = new Map<string, number>();
    for (const { postId } of comments) commentCounts.set(postId, (commentCounts.get(postId) ?? 0) + 1);

    const posts: CirclePost[] = page.flatMap((post) => {
      const author = authorByUser.get(post.authorUserId);
      if (!author) return [];
      return [
        toCirclePost(post, author, {
          viewerUserId: me,
          followedProfileIDs,
          followerUserIDs,
          reactions: reactions.filter((reaction) => reaction.postId === post.id),
          commentCount: commentCounts.get(post.id) ?? 0,
        }),
      ];
    });
    const last = page[page.length - 1];
    res.json({ posts, nextCursor: rows.length > FEED_PAGE_SIZE && last ? encodeCursor(last) : null });
  } catch (error) {
    next(error);
  }
};

/**
 * Shares one of the caller's saved schedules: it becomes their post for that semester, replacing
 * any earlier one (and moving it to the top of the feed). Sharing also creates a bare profile if
 * the caller has none, since nobody could find or follow them otherwise.
 */
export const sharePost: RequestHandler<
  unknown,
  { postID: string } | ErrorBody,
  { token: string; savedScheduleId: unknown },
  unknown,
  UserLocals
> = async (req, res, next) => {
  const parsed = sharePostInputSchema.safeParse({ savedScheduleId: req.body.savedScheduleId });
  if (!parsed.success) {
    res.status(400).json({ error: firstIssue(parsed.error, "Invalid schedule ID") });
    return;
  }
  const me = res.locals.userId;
  try {
    const saved = await db.savedSchedules.findUnique({ where: { id: parsed.data.savedScheduleId } });
    if (!saved || saved.clerkUserId !== me) {
      res.status(404).json({ error: "Schedule not found" });
      return;
    }
    await db.profiles.upsert({
      where: { clerkUserId: me },
      update: {},
      create: { clerkUserId: me, visibility: DEFAULT_VISIBILITY },
    });
    const content = {
      name: saved.name,
      session: saved.session ?? null,
      courses: saved.courses.map(({ courseID, lecture, section }) => ({
        courseID,
        lecture: lecture ?? null,
        section: section ?? null,
      })),
      sourceScheduleId: saved.id,
    };
    const post = await db.circlePosts.upsert({
      where: { authorUserId_semester_year: { authorUserId: me, semester: saved.semester, year: saved.year } },
      update: content,
      create: { ...content, authorUserId: me, semester: saved.semester, year: saved.year },
    });
    res.json({ postID: post.id });
  } catch (error) {
    next(error);
  }
};

export const deletePost: RequestHandler<
  unknown,
  { ok: true } | ErrorBody,
  { token: string; postId: unknown },
  unknown,
  UserLocals
> = async (req, res, next) => {
  const parsed = deletePostInputSchema.safeParse({ postId: req.body.postId });
  if (!parsed.success) {
    res.status(400).json({ error: firstIssue(parsed.error, "Invalid post ID") });
    return;
  }
  try {
    const post = await db.circlePosts.findUnique({ where: { id: parsed.data.postId } });
    if (!post || post.authorUserId !== res.locals.userId) {
      res.status(404).json({ error: "Post not found" });
      return;
    }
    await db.postReactions.deleteMany({ where: { postId: post.id } });
    await db.postComments.deleteMany({ where: { postId: post.id } });
    await db.circlePosts.delete({ where: { id: post.id } });
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
};

export const reactToPost: RequestHandler<
  unknown,
  { ok: true } | ErrorBody,
  { token: string; postId: unknown; reaction: unknown },
  unknown,
  UserLocals
> = async (req, res, next) => {
  const parsed = postReactionInputSchema.safeParse({ postId: req.body.postId, reaction: req.body.reaction });
  if (!parsed.success) {
    res.status(400).json({ error: firstIssue(parsed.error, "Invalid reaction") });
    return;
  }
  const me = res.locals.userId;
  const { postId, reaction } = parsed.data;
  try {
    // Taking a reaction back is always allowed; putting one on needs the same standing as commenting.
    if (reaction === null) {
      await db.postReactions.deleteMany({ where: { reactorUserId: me, postId } });
      res.json({ ok: true });
      return;
    }
    const check = await checkPostInteraction(me, postId, "react");
    if (!check.ok) {
      res.status(check.status).json({ error: check.error });
      return;
    }
    await db.postReactions.upsert({
      where: { reactorUserId_postId: { reactorUserId: me, postId } },
      update: { reaction },
      create: { reactorUserId: me, postId, reaction },
    });
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
};

/** Comments on a post, oldest first (the newest 200). Anyone signed in can read them. */
export const listPostComments: RequestHandler<
  unknown,
  ScheduleComment[] | ErrorBody,
  { token: string; postId: unknown },
  unknown,
  UserLocals
> = async (req, res, next) => {
  const parsed = postCommentsQuerySchema.safeParse({ postId: req.body.postId });
  if (!parsed.success) {
    res.status(400).json({ error: firstIssue(parsed.error, "Invalid post ID") });
    return;
  }
  const me = res.locals.userId;
  try {
    const post = await db.circlePosts.findUnique({ where: { id: parsed.data.postId } });
    if (!post) {
      res.status(404).json({ error: "Post not found" });
      return;
    }
    const newestFirst = await db.postComments.findMany({
      where: { postId: post.id },
      orderBy: { createdAt: "desc" },
      take: MAX_COMMENTS,
    });
    const authors = await db.profiles.findMany({
      where: { clerkUserId: { in: [...new Set(newestFirst.map((comment) => comment.authorUserId))] } },
    });
    const authorByUser = new Map(authors.map((author) => [author.clerkUserId, author]));
    res.json(
      newestFirst.reverse().map((comment) => {
        const author = authorByUser.get(comment.authorUserId);
        return {
          commentID: comment.id,
          authorProfileID: author?.id ?? null,
          authorName: author?.displayName || "CMU student",
          body: comment.body,
          createdAt: comment.createdAt.toISOString(),
          canDelete: comment.authorUserId === me || post.authorUserId === me,
        };
      })
    );
  } catch (error) {
    next(error);
  }
};

export const addPostComment: RequestHandler<
  unknown,
  { ok: true } | ErrorBody,
  { token: string; postId: unknown; body: unknown },
  unknown,
  UserLocals
> = async (req, res, next) => {
  const parsed = postCommentInputSchema.safeParse({ postId: req.body.postId, body: req.body.body });
  if (!parsed.success) {
    res.status(400).json({ error: firstIssue(parsed.error, "Invalid comment") });
    return;
  }
  try {
    const check = await checkPostInteraction(res.locals.userId, parsed.data.postId, "comment");
    if (!check.ok) {
      res.status(check.status).json({ error: check.error });
      return;
    }
    await db.postComments.create({
      data: { authorUserId: res.locals.userId, postId: check.post.id, body: parsed.data.body },
    });
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
};

/** The comment's author, or the post's author, may delete it. */
export const deletePostComment: RequestHandler<
  unknown,
  { ok: true } | ErrorBody,
  { token: string; commentID: unknown },
  unknown,
  UserLocals
> = async (req, res, next) => {
  const parsed = commentDeleteSchema.safeParse({ commentID: req.body.commentID });
  if (!parsed.success) {
    res.status(400).json({ error: firstIssue(parsed.error, "Invalid comment ID") });
    return;
  }
  try {
    const comment = await db.postComments.findUnique({ where: { id: parsed.data.commentID } });
    if (!comment) {
      res.status(404).json({ error: "Comment not found" });
      return;
    }
    const post = await db.circlePosts.findUnique({ where: { id: comment.postId } });
    const me = res.locals.userId;
    if (comment.authorUserId !== me && post?.authorUserId !== me) {
      res.status(403).json({ error: "You can only delete your own comments" });
      return;
    }
    await db.postComments.delete({ where: { id: comment.id } });
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
};
