import { RequestHandler } from "express";
import db from "@cmucourses/db";
import {
  followInputSchema,
  publishScheduleInputSchema,
  reactionInputSchema,
  type SocialDirectory,
} from "@cmucourses/profile";
import { UserLocals } from "./user";
import { checkInteractionTarget } from "./socialAccess";
import { toDirectoryProfile, toPublishedSchedule } from "./socialDirectory";

type ErrorBody = { error: string };

// A profile shows up in the directory when it has shared something: a public section, or a
// published schedule. Filtering happens in the query (not after `take`) so a page of private
// profiles cannot push public ones out of the first 100.
const SHAREABLE_SECTIONS = ["academic", "careers", "skills", "courses"] as const;

export const getSocialDirectory: RequestHandler<
  unknown,
  SocialDirectory | ErrorBody,
  { token: string },
  unknown,
  UserLocals
> = async (_req, res, next) => {
  const me = res.locals.userId;
  try {
    const [myProfile, mySchedule, published] = await Promise.all([
      db.profiles.findUnique({ where: { clerkUserId: me } }),
      db.socialSchedules.findUnique({ where: { clerkUserId: me } }),
      db.socialSchedules.findMany({ select: { clerkUserId: true } }),
    ]);

    const profiles = await db.profiles.findMany({
      where: {
        clerkUserId: { not: me },
        OR: [
          ...SHAREABLE_SECTIONS.map((section) => ({ visibility: { is: { [section]: "PUBLIC" as const } } })),
          { clerkUserId: { in: published.map((row) => row.clerkUserId).filter((id) => id !== me) } },
        ],
      },
      take: 100,
    });
    const userIDs = profiles.map((profile) => profile.clerkUserId);
    const profileIDs = profiles.map((profile) => profile.id);

    const [schedules, myFollows, followersOfMe, reactions] = await Promise.all([
      db.socialSchedules.findMany({ where: { clerkUserId: { in: userIDs } } }),
      db.follows.findMany({ where: { followerUserId: me } }),
      myProfile ? db.follows.findMany({ where: { followedProfileId: myProfile.id } }) : Promise.resolve([]),
      db.scheduleReactions.findMany({ where: { targetProfileId: { in: profileIDs } } }),
    ]);

    const scheduleByUser = new Map(schedules.map((schedule) => [schedule.clerkUserId, schedule]));
    const followedProfileIDs = new Set(myFollows.map((follow) => follow.followedProfileId));
    const followerUserIDs = new Set(followersOfMe.map((follow) => follow.followerUserId));
    const reactionsByProfile = new Map<string, typeof reactions>();
    for (const reaction of reactions) {
      const list = reactionsByProfile.get(reaction.targetProfileId) ?? [];
      list.push(reaction);
      reactionsByProfile.set(reaction.targetProfileId, list);
    }

    res.json({
      me: { profileID: myProfile?.id ?? null, publishedSchedule: toPublishedSchedule(mySchedule) },
      people: profiles.map((profile) =>
        toDirectoryProfile({
          profile,
          schedule: scheduleByUser.get(profile.clerkUserId),
          reactions: reactionsByProfile.get(profile.id) ?? [],
          viewerUserId: me,
          followedProfileIDs,
          followerUserIDs,
        })
      ),
    });
  } catch (error) {
    next(error);
  }
};

export const publishSocialSchedule: RequestHandler<
  unknown,
  { ok: true } | ErrorBody,
  { token: string; schedule: unknown },
  unknown,
  UserLocals
> = async (req, res, next) => {
  const parsed = publishScheduleInputSchema.safeParse({
    schedule: req.body.schedule,
  });
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid schedule" });
    return;
  }
  try {
    if (parsed.data.schedule === null) {
      await db.socialSchedules.deleteMany({
        where: { clerkUserId: res.locals.userId },
      });
      // Comments belong to the published schedule, so they go with it. Republishing keeps them.
      const profile = await db.profiles.findUnique({ where: { clerkUserId: res.locals.userId } });
      if (profile) await db.scheduleComments.deleteMany({ where: { targetProfileId: profile.id } });
    } else {
      await db.socialSchedules.upsert({
        where: { clerkUserId: res.locals.userId },
        update: parsed.data.schedule,
        create: {
          clerkUserId: res.locals.userId,
          ...parsed.data.schedule,
        },
      });
    }
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
};

export const updateFollow: RequestHandler<
  unknown,
  { ok: true } | ErrorBody,
  { token: string; profileID: unknown; follow: unknown },
  unknown,
  UserLocals
> = async (req, res, next) => {
  const parsed = followInputSchema.safeParse({
    profileID: req.body.profileID,
    follow: req.body.follow,
  });
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid follow" });
    return;
  }
  try {
    const target = await db.profiles.findUnique({
      where: { id: parsed.data.profileID },
    });
    if (!target || target.clerkUserId === res.locals.userId) {
      res.status(404).json({ error: "Profile not found" });
      return;
    }
    if (parsed.data.follow) {
      await db.follows.upsert({
        where: {
          followerUserId_followedProfileId: {
            followerUserId: res.locals.userId,
            followedProfileId: parsed.data.profileID,
          },
        },
        update: {},
        create: {
          followerUserId: res.locals.userId,
          followedProfileId: parsed.data.profileID,
        },
      });
    } else {
      await db.follows.deleteMany({
        where: {
          followerUserId: res.locals.userId,
          followedProfileId: parsed.data.profileID,
        },
      });
    }
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
};

export const updateScheduleReaction: RequestHandler<
  unknown,
  { ok: true } | ErrorBody,
  { token: string; profileID: unknown; reaction: unknown },
  unknown,
  UserLocals
> = async (req, res, next) => {
  const parsed = reactionInputSchema.safeParse({
    profileID: req.body.profileID,
    reaction: req.body.reaction,
  });
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid reaction" });
    return;
  }
  try {
    // Taking a reaction back is always allowed; putting one on needs the same standing as commenting.
    if (parsed.data.reaction !== null) {
      const check = await checkInteractionTarget(res.locals.userId, parsed.data.profileID, "react");
      if (!check.ok) {
        res.status(check.status).json({ error: check.error });
        return;
      }
    }
    if (parsed.data.reaction === null) {
      await db.scheduleReactions.deleteMany({
        where: {
          reactorUserId: res.locals.userId,
          targetProfileId: parsed.data.profileID,
        },
      });
    } else {
      await db.scheduleReactions.upsert({
        where: {
          reactorUserId_targetProfileId: {
            reactorUserId: res.locals.userId,
            targetProfileId: parsed.data.profileID,
          },
        },
        update: { reaction: parsed.data.reaction },
        create: {
          reactorUserId: res.locals.userId,
          targetProfileId: parsed.data.profileID,
          reaction: parsed.data.reaction,
        },
      });
    }
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
};
