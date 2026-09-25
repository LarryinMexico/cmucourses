/// <reference types="bun-types" />
import { beforeEach, describe, expect, test } from "bun:test";
import { fakeDb, resetFakeDb } from "../test/fakeDb";
import { call } from "../test/http";
import { getSocialDirectory } from "./social";

const THEM = "64b7f0c2a1d3e4f5a6b7c8d9";
const ME = "74b7f0c2a1d3e4f5a6b7c8d0";
const PRIVATE = { academic: "PRIVATE", careers: "PRIVATE", skills: "PRIVATE", courses: "PRIVATE" };
const themRow = {
  id: THEM,
  clerkUserId: "user_them",
  displayName: "Ada",
  bio: null,
  visibility: PRIVATE,
  academic: null,
  careers: [],
  skillsHave: [],
  skillsWant: [],
  courses: [],
  busyBlocks: [],
};
const post = (authorUserId: string, over: object = {}) => ({
  id: "84b7f0c2a1d3e4f5a6b7c8d1",
  authorUserId,
  name: "Fall plan",
  semester: "fall",
  year: "2026",
  courses: [{ courseID: "15-213" }],
  updatedAt: new Date(),
  ...over,
});

beforeEach(resetFakeDb);

const load = () => call(getSocialDirectory as never, "user_me");

describe("getSocialDirectory", () => {
  test("lists profiles with a public section or a post, never the caller", async () => {
    fakeDb.circlePosts!.findMany!.mockImplementation((async (args: { distinct?: unknown }) =>
      args.distinct ? [{ authorUserId: "user_poster" }, { authorUserId: "user_me" }] : []) as never);
    await load();
    const [args] = fakeDb.profiles!.findMany!.mock.calls[0] as [{ where: Record<string, unknown>; take: number }];
    expect(args.take).toBe(100);
    expect(args.where.clerkUserId).toEqual({ not: "user_me" });
    expect(args.where.OR).toEqual([
      { visibility: { is: { academic: "PUBLIC" } } },
      { visibility: { is: { careers: "PUBLIC" } } },
      { visibility: { is: { skills: "PUBLIC" } } },
      { visibility: { is: { courses: "PUBLIC" } } },
      { clerkUserId: { in: ["user_poster"] } },
    ]);
  });

  test("me: profile id, my posts, and whether anyone can find me", async () => {
    fakeDb.profiles!.findUnique!.mockResolvedValue({ id: ME, clerkUserId: "user_me", visibility: PRIVATE } as never);
    fakeDb.circlePosts!.findMany!.mockImplementation((async (args: { where?: { authorUserId?: string } }) =>
      args.where?.authorUserId === "user_me" ? [post("user_me")] : []) as never);
    const { body } = await load();
    expect((body as { me: unknown }).me).toEqual({
      profileID: ME,
      visible: true,
      posts: [{ postID: "84b7f0c2a1d3e4f5a6b7c8d1", name: "Fall plan", semester: "fall", year: "2026" }],
    });
  });

  test("an all-private profile without posts is not visible to others", async () => {
    fakeDb.profiles!.findUnique!.mockResolvedValue({ id: ME, clerkUserId: "user_me", visibility: PRIVATE } as never);
    expect(((await load()).body as { me: { visible: boolean } }).me.visible).toBe(false);
    fakeDb.profiles!.findUnique!.mockResolvedValue(null as never);
    expect(((await load()).body as { me: { visible: boolean; profileID: null } }).me).toMatchObject({
      visible: false,
      profileID: null,
    });
  });

  test("people carry post courses and both follow directions, and no Clerk ids", async () => {
    fakeDb.profiles!.findUnique!.mockResolvedValue({ id: ME, clerkUserId: "user_me", visibility: PRIVATE } as never);
    fakeDb.profiles!.findMany!.mockResolvedValue([themRow] as never);
    fakeDb.circlePosts!.findMany!.mockImplementation((async (args: { where?: { authorUserId?: { in?: string[] } } }) =>
      args.where?.authorUserId?.in ? [post("user_them")] : []) as never);
    fakeDb.follows!.findMany!.mockImplementation((async (args: {
      where: { followerUserId?: string; followedProfileId?: string };
    }) =>
      args.where.followerUserId === "user_me"
        ? [{ followedProfileId: THEM }]
        : args.where.followedProfileId === ME
          ? [{ followerUserId: "user_them" }]
          : []) as never);
    const { body } = await load();
    const [person] = (
      body as { people: { following: boolean; followsMe: boolean; postCount: number; postedCourseIDs: string[] }[] }
    ).people;
    expect(person).toMatchObject({ following: true, followsMe: true, postCount: 1, postedCourseIDs: ["15-213"] });
    expect(JSON.stringify(body)).not.toContain("user_them");
  });
});
