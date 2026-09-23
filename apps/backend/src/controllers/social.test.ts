/// <reference types="bun-types" />
import { beforeEach, describe, expect, test } from "bun:test";
import { fakeDb, resetFakeDb } from "../test/fakeDb";
import { call } from "../test/http";
import { getSocialDirectory, updateScheduleReaction } from "./social";

const TARGET_ID = "64b7f0c2a1d3e4f5a6b7c8d9";
const ME_PROFILE_ID = "74b7f0c2a1d3e4f5a6b7c8d0";

beforeEach(resetFakeDb);

describe("updateScheduleReaction", () => {
  const react = (reaction: unknown) =>
    call(updateScheduleReaction as never, "user_me", { profileID: TARGET_ID, reaction });

  const target = { id: TARGET_ID, clerkUserId: "user_them" };
  const allowEverything = () => {
    fakeDb.profiles!.findUnique!.mockResolvedValue(target as never);
    fakeDb.socialSchedules!.findUnique!.mockResolvedValue({ name: "Fall" } as never);
    fakeDb.follows!.findUnique!.mockResolvedValue({ id: "f" } as never);
  };

  test("clearing a reaction never needs the follow check", async () => {
    const { status, body } = await react(null);
    expect(status).toBe(200);
    expect(body).toEqual({ ok: true });
    expect(fakeDb.scheduleReactions!.deleteMany!.mock.calls).toHaveLength(1);
    expect(fakeDb.profiles!.findUnique!.mock.calls).toHaveLength(0);
  });

  test("404 for an unknown profile and nothing is written", async () => {
    fakeDb.profiles!.findUnique!.mockResolvedValue(null as never);
    const { status, body } = await react("🔥");
    expect(status).toBe(404);
    expect(body).toEqual({ error: "Profile not found" });
    expect(fakeDb.scheduleReactions!.upsert!.mock.calls).toHaveLength(0);
  });

  test("404 when reacting to yourself", async () => {
    fakeDb.profiles!.findUnique!.mockResolvedValue({ id: TARGET_ID, clerkUserId: "user_me" } as never);
    expect((await react("🔥")).status).toBe(404);
  });

  test("404 when the target has not published a schedule", async () => {
    allowEverything();
    fakeDb.socialSchedules!.findUnique!.mockResolvedValue(null as never);
    const { status, body } = await react("🔥");
    expect(status).toBe(404);
    expect(body).toEqual({ error: "No published schedule" });
  });

  test("403 when the caller does not follow the owner", async () => {
    allowEverything();
    fakeDb.follows!.findUnique!.mockResolvedValue(null as never);
    const { status, body } = await react("🔥");
    expect(status).toBe(403);
    expect(body).toEqual({ error: "Follow this student to react" });
    expect(fakeDb.scheduleReactions!.upsert!.mock.calls).toHaveLength(0);
  });

  test("a follower's reaction is saved", async () => {
    allowEverything();
    const { status, body } = await react("🔥");
    expect(status).toBe(200);
    expect(body).toEqual({ ok: true });
    expect(fakeDb.scheduleReactions!.upsert!.mock.calls[0]).toMatchObject([
      { create: { reactorUserId: "user_me", targetProfileId: TARGET_ID, reaction: "🔥" } },
    ]);
  });

  test("400 for an emoji outside the allowed set", async () => {
    expect((await react("nope")).status).toBe(400);
  });
});

describe("getSocialDirectory", () => {
  const themRow = {
    id: TARGET_ID,
    clerkUserId: "user_them",
    displayName: "Ada",
    bio: null,
    visibility: { academic: "PUBLIC", careers: "PRIVATE", skills: "PRIVATE", courses: "PRIVATE" },
    academic: { college: "scs", majors: [] },
    careers: [],
    skillsHave: [],
    skillsWant: [],
    courses: [],
  };
  const mySchedule = {
    name: "My plan",
    semester: "fall",
    year: "2026",
    courses: [{ courseID: "15-213", lecture: "Lec 1", section: null }],
  };

  const load = () => call(getSocialDirectory as never, "user_me");

  test("asks the database for profiles with a public section or a published schedule, never the caller", async () => {
    fakeDb.socialSchedules!.findMany!.mockImplementation((async (args: { select?: unknown }) =>
      args.select ? [{ clerkUserId: "user_pub" }, { clerkUserId: "user_me" }] : []) as never);
    await load();

    const [args] = fakeDb.profiles!.findMany!.mock.calls[0] as [{ where: Record<string, unknown>; take: number }];
    expect(args.take).toBe(100);
    expect(args.where.clerkUserId).toEqual({ not: "user_me" });
    expect(args.where.OR).toEqual([
      { visibility: { is: { academic: "PUBLIC" } } },
      { visibility: { is: { careers: "PUBLIC" } } },
      { visibility: { is: { skills: "PUBLIC" } } },
      { visibility: { is: { courses: "PUBLIC" } } },
      { clerkUserId: { in: ["user_pub"] } },
    ]);
  });

  test("returns the caller's own published schedule and profile id, so a reload remembers it", async () => {
    fakeDb.profiles!.findUnique!.mockResolvedValue({ id: ME_PROFILE_ID, clerkUserId: "user_me" } as never);
    fakeDb.socialSchedules!.findUnique!.mockResolvedValue(mySchedule as never);
    const { body } = await load();
    expect((body as { me: unknown }).me).toEqual({
      profileID: ME_PROFILE_ID,
      publishedSchedule: { name: "My plan", semester: "fall", year: "2026", courses: mySchedule.courses },
    });
  });

  test("a caller with no profile can still have a published schedule", async () => {
    fakeDb.profiles!.findUnique!.mockResolvedValue(null as never);
    fakeDb.socialSchedules!.findUnique!.mockResolvedValue(mySchedule as never);
    const { body } = await load();
    const me = (body as { me: { profileID: string | null; publishedSchedule: unknown } }).me;
    expect(me.profileID).toBeNull();
    expect(me.publishedSchedule).not.toBeNull();
    expect(
      fakeDb.follows!.findMany!.mock.calls.every(([a]) => "followerUserId" in (a as { where: object }).where)
    ).toBe(true);
  });

  test("marks who follows the caller without leaking Clerk ids", async () => {
    fakeDb.profiles!.findUnique!.mockResolvedValue({ id: ME_PROFILE_ID, clerkUserId: "user_me" } as never);
    fakeDb.profiles!.findMany!.mockResolvedValue([themRow] as never);
    fakeDb.follows!.findMany!.mockImplementation((async (args: {
      where: { followerUserId?: string; followedProfileId?: string };
    }) =>
      args.where.followerUserId === "user_me"
        ? [{ followedProfileId: TARGET_ID }]
        : args.where.followedProfileId === ME_PROFILE_ID
          ? [{ followerUserId: "user_them" }]
          : []) as never);

    const { body } = await load();
    const { people } = body as { people: { following: boolean; followsMe: boolean }[] };
    expect(people).toHaveLength(1);
    expect([people[0]!.following, people[0]!.followsMe]).toEqual([true, true]);
    expect(JSON.stringify(body)).not.toContain("user_them");
  });
});
