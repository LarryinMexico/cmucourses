import { RequestHandler } from "express";
import db from "@cmucourses/db";
import { followInputSchema, type MyPostSummary, type SocialDirectory } from "@cmucourses/profile";
import { UserLocals } from "./user";
import { toDirectoryProfile } from "./socialDirectory";

type ErrorBody = { error: string };

// A profile shows up in the directory when it has shared something: a public section, or a
// Circles post. Filtering happens in the query (not after `take`) so a page of private
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
    const [myProfile, myPosts, authors] = await Promise.all([
      db.profiles.findUnique({ where: { clerkUserId: me } }),
      db.circlePosts.findMany({ where: { authorUserId: me }, orderBy: { updatedAt: "desc" } }),
      db.circlePosts.findMany({ select: { authorUserId: true }, distinct: ["authorUserId"] }),
    ]);

    const profiles = await db.profiles.findMany({
      where: {
        clerkUserId: { not: me },
        OR: [
          ...SHAREABLE_SECTIONS.map((section) => ({ visibility: { is: { [section]: "PUBLIC" as const } } })),
          { clerkUserId: { in: authors.map((row) => row.authorUserId).filter((id) => id !== me) } },
        ],
      },
      take: 100,
    });

    const [posts, myFollows, followersOfMe] = await Promise.all([
      db.circlePosts.findMany({ where: { authorUserId: { in: profiles.map((profile) => profile.clerkUserId) } } }),
      db.follows.findMany({ where: { followerUserId: me } }),
      myProfile ? db.follows.findMany({ where: { followedProfileId: myProfile.id } }) : Promise.resolve([]),
    ]);
    const postsByUser = new Map<string, typeof posts>();
    for (const post of posts) postsByUser.set(post.authorUserId, [...(postsByUser.get(post.authorUserId) ?? []), post]);
    const followedProfileIDs = new Set(myFollows.map((follow) => follow.followedProfileId));
    const followerUserIDs = new Set(followersOfMe.map((follow) => follow.followerUserId));
    const visible =
      myPosts.length > 0 ||
      (!!myProfile && SHAREABLE_SECTIONS.some((section) => myProfile.visibility[section] === "PUBLIC"));

    res.json({
      me: {
        profileID: myProfile?.id ?? null,
        visible,
        posts: myPosts.map((post) => ({
          postID: post.id,
          name: post.name,
          kind: post.kind,
          semester: post.semester as MyPostSummary["semester"],
          year: post.year,
        })),
      },
      people: profiles.map((profile) =>
        toDirectoryProfile({
          profile,
          posts: postsByUser.get(profile.clerkUserId) ?? [],
          followedProfileIDs,
          followerUserIDs,
        })
      ),
    });
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
