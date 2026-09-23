import { RequestHandler } from "express";
import db from "@cmucourses/db";
import { commentDeleteSchema, commentInputSchema, profileIDSchema, type ScheduleComment } from "@cmucourses/profile";
import { UserLocals } from "./user";
import { checkInteractionTarget } from "./socialAccess";

type ErrorBody = { error: string };

const MAX_COMMENTS = 200;

/**
 * Comments on a published schedule. Anyone signed in can read them (including its owner, who
 * is not allowed to comment on their own schedule); writing needs the standing that
 * checkInteractionTarget describes. People are named by profile id, never by Clerk id.
 */
export const listComments: RequestHandler<
  unknown,
  ScheduleComment[] | ErrorBody,
  { token: string; profileID: unknown },
  unknown,
  UserLocals
> = async (req, res, next) => {
  const profileID = profileIDSchema.safeParse(req.body.profileID);
  if (!profileID.success) {
    res.status(400).json({ error: profileID.error.issues[0]?.message ?? "Invalid profile ID" });
    return;
  }
  try {
    const target = await db.profiles.findUnique({ where: { id: profileID.data } });
    if (!target) {
      res.status(404).json({ error: "Profile not found" });
      return;
    }
    const schedule = await db.socialSchedules.findUnique({ where: { clerkUserId: target.clerkUserId } });
    if (!schedule) {
      res.status(404).json({ error: "No published schedule" });
      return;
    }

    // Newest first so the cap drops the oldest, then flipped for reading order.
    const newestFirst = await db.scheduleComments.findMany({
      where: { targetProfileId: target.id },
      orderBy: { createdAt: "desc" },
      take: MAX_COMMENTS,
    });
    const authors = await db.profiles.findMany({
      where: { clerkUserId: { in: [...new Set(newestFirst.map((comment) => comment.authorUserId))] } },
    });
    const authorByUser = new Map(authors.map((author) => [author.clerkUserId, author]));
    const me = res.locals.userId;

    res.json(
      newestFirst.reverse().map((comment) => {
        const author = authorByUser.get(comment.authorUserId);
        return {
          commentID: comment.id,
          authorProfileID: author?.id ?? null,
          authorName: author?.displayName || "CMU student",
          body: comment.body,
          createdAt: comment.createdAt.toISOString(),
          canDelete: comment.authorUserId === me || target.clerkUserId === me,
        };
      })
    );
  } catch (error) {
    next(error);
  }
};

export const addComment: RequestHandler<
  unknown,
  { ok: true } | ErrorBody,
  { token: string; profileID: unknown; body: unknown },
  unknown,
  UserLocals
> = async (req, res, next) => {
  const parsed = commentInputSchema.safeParse({ profileID: req.body.profileID, body: req.body.body });
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid comment" });
    return;
  }
  try {
    const check = await checkInteractionTarget(res.locals.userId, parsed.data.profileID, "comment");
    if (!check.ok) {
      res.status(check.status).json({ error: check.error });
      return;
    }
    await db.scheduleComments.create({
      data: { authorUserId: res.locals.userId, targetProfileId: check.target.id, body: parsed.data.body },
    });
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
};

export const deleteComment: RequestHandler<
  unknown,
  { ok: true } | ErrorBody,
  { token: string; commentID: unknown },
  unknown,
  UserLocals
> = async (req, res, next) => {
  const parsed = commentDeleteSchema.safeParse({ commentID: req.body.commentID });
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid comment" });
    return;
  }
  try {
    const comment = await db.scheduleComments.findUnique({ where: { id: parsed.data.commentID } });
    if (!comment) {
      res.status(404).json({ error: "Comment not found" });
      return;
    }
    const owner = await db.profiles.findUnique({ where: { id: comment.targetProfileId } });
    const allowed = comment.authorUserId === res.locals.userId || owner?.clerkUserId === res.locals.userId;
    if (!allowed) {
      res.status(403).json({ error: "You can only delete your own comments" });
      return;
    }
    await db.scheduleComments.delete({ where: { id: comment.id } });
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
};
