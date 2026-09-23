import { RequestHandler } from "express";
import db from "@cmucourses/db";
import {
  sendMessageSchema,
  threadQuerySchema,
  type ConversationSummary,
  type DirectMessage,
} from "@cmucourses/profile";
import { UserLocals } from "./user";

type ErrorBody = { error: string };

const THREAD_LIMIT = 100;

/**
 * A message has no `readAt` field until it is read. Prisma's `readAt: null` only matches a field
 * that is explicitly null, not a missing one, so on MongoDB "unread" needs `isSet: false` too.
 * (Found by running the handlers against a real database; a mocked one cannot tell.)
 */
const UNREAD = { OR: [{ readAt: null }, { readAt: { isSet: false } }] };
const CONVERSATION_SCAN_LIMIT = 1000;

/** The two Clerk ids sorted and joined, so both sides of a conversation share one key. Stays on the server. */
export const conversationKey = (a: string, b: string): string => [a, b].sort().join(":");

interface MessageRow {
  id: string;
  senderUserId: string;
  recipientUserId: string;
  body: string;
  createdAt: Date;
}

/** Groups a newest-first list into one entry per other person, keeping each one's latest message. */
export const groupConversations = (messages: MessageRow[], me: string) => {
  const latest = new Map<string, { otherUserId: string; last: MessageRow }>();
  for (const message of messages) {
    const otherUserId = message.senderUserId === me ? message.recipientUserId : message.senderUserId;
    if (!latest.has(otherUserId)) latest.set(otherUserId, { otherUserId, last: message });
  }
  return [...latest.values()].sort((a, b) => b.last.createdAt.getTime() - a.last.createdAt.getTime());
};

/**
 * Messaging is for a mutual follow: you follow them and they follow you. "Follows" store the
 * follower as a Clerk id and the followed one as a profile id, so the caller needs a profile of
 * their own to be on the receiving end. Without one nobody can follow them, hence not mutual.
 */
const isMutualFollow = async (callerUserId: string, other: { id: string; clerkUserId: string }): Promise<boolean> => {
  const mine = await db.profiles.findUnique({ where: { clerkUserId: callerUserId } });
  if (!mine) return false;
  const [iFollow, theyFollow] = await Promise.all([
    db.follows.findUnique({
      where: { followerUserId_followedProfileId: { followerUserId: callerUserId, followedProfileId: other.id } },
    }),
    db.follows.findUnique({
      where: { followerUserId_followedProfileId: { followerUserId: other.clerkUserId, followedProfileId: mine.id } },
    }),
  ]);
  return !!iFollow && !!theyFollow;
};

export const listConversations: RequestHandler<
  unknown,
  ConversationSummary[] | ErrorBody,
  { token: string },
  unknown,
  UserLocals
> = async (_req, res, next) => {
  const me = res.locals.userId;
  try {
    const [recent, unread, myProfile] = await Promise.all([
      db.directMessages.findMany({
        where: { OR: [{ senderUserId: me }, { recipientUserId: me }] },
        orderBy: { createdAt: "desc" },
        take: CONVERSATION_SCAN_LIMIT,
      }),
      // Counted from their own query so an old unread message is not lost to the scan limit above.
      db.directMessages.findMany({ where: { recipientUserId: me, ...UNREAD }, select: { senderUserId: true } }),
      db.profiles.findUnique({ where: { clerkUserId: me } }),
    ]);
    const groups = groupConversations(recent, me);

    const [people, myFollows, followersOfMe] = await Promise.all([
      db.profiles.findMany({ where: { clerkUserId: { in: groups.map((group) => group.otherUserId) } } }),
      db.follows.findMany({ where: { followerUserId: me } }),
      myProfile ? db.follows.findMany({ where: { followedProfileId: myProfile.id } }) : Promise.resolve([]),
    ]);
    const personByUser = new Map(people.map((person) => [person.clerkUserId, person]));
    const followed = new Set(myFollows.map((follow) => follow.followedProfileId));
    const followers = new Set(followersOfMe.map((follow) => follow.followerUserId));
    const unreadByUser = new Map<string, number>();
    for (const { senderUserId } of unread) unreadByUser.set(senderUserId, (unreadByUser.get(senderUserId) ?? 0) + 1);

    res.json(
      groups.flatMap(({ otherUserId, last }): ConversationSummary[] => {
        const person = personByUser.get(otherUserId);
        if (!person) return []; // no profile to show them as
        return [
          {
            profileID: person.id,
            displayName: person.displayName || "CMU student",
            lastMessage: { body: last.body, createdAt: last.createdAt.toISOString(), fromMe: last.senderUserId === me },
            unreadCount: unreadByUser.get(otherUserId) ?? 0,
            canSend: followed.has(person.id) && followers.has(otherUserId),
          },
        ];
      })
    );
  } catch (error) {
    next(error);
  }
};

/** Opening a thread marks what was sent to you as read: a read with a write side effect, on purpose. */
export const getThread: RequestHandler<
  unknown,
  DirectMessage[] | ErrorBody,
  { token: string; profileID: unknown },
  unknown,
  UserLocals
> = async (req, res, next) => {
  const parsed = threadQuerySchema.safeParse({ profileID: req.body.profileID });
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid profile ID" });
    return;
  }
  const me = res.locals.userId;
  try {
    const other = await db.profiles.findUnique({ where: { id: parsed.data.profileID } });
    if (!other || other.clerkUserId === me) {
      res.status(404).json({ error: "Profile not found" });
      return;
    }
    const key = conversationKey(me, other.clerkUserId);
    const newestFirst = await db.directMessages.findMany({
      where: { conversationKey: key },
      orderBy: { createdAt: "desc" },
      take: THREAD_LIMIT,
    });
    await db.directMessages.updateMany({
      where: { conversationKey: key, recipientUserId: me, ...UNREAD },
      data: { readAt: new Date() },
    });

    res.json(
      newestFirst.reverse().map((message) => ({
        messageID: message.id,
        body: message.body,
        createdAt: message.createdAt.toISOString(),
        fromMe: message.senderUserId === me,
      }))
    );
  } catch (error) {
    next(error);
  }
};

export const sendMessage: RequestHandler<
  unknown,
  { ok: true } | ErrorBody,
  { token: string; profileID: unknown; body: unknown },
  unknown,
  UserLocals
> = async (req, res, next) => {
  const parsed = sendMessageSchema.safeParse({ profileID: req.body.profileID, body: req.body.body });
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid message" });
    return;
  }
  const me = res.locals.userId;
  try {
    const other = await db.profiles.findUnique({ where: { id: parsed.data.profileID } });
    if (!other || other.clerkUserId === me) {
      res.status(404).json({ error: "Profile not found" });
      return;
    }
    if (!(await isMutualFollow(me, other))) {
      res.status(403).json({ error: "You can message students you follow who follow you back" });
      return;
    }
    await db.directMessages.create({
      data: {
        conversationKey: conversationKey(me, other.clerkUserId),
        senderUserId: me,
        recipientUserId: other.clerkUserId,
        body: parsed.data.body,
      },
    });
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
};
