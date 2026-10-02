/// <reference types="bun-types" />
import { beforeEach, describe, expect, test } from "bun:test";
import { fakeDb, resetFakeDb } from "../test/fakeDb";
import { call } from "../test/http";
import {
  addPostComment,
  deletePost,
  deletePostComment,
  getFeed,
  listPostComments,
  reactToPost,
  sharePost,
} from "./posts";

const SCHED = "54b7f0c2a1d3e4f5a6b7c8d8";
const POST = "74b7f0c2a1d3e4f5a6b7c8d0";
const COMMENT = "84b7f0c2a1d3e4f5a6b7c8d1";
const THEM = { id: "64b7f0c2a1d3e4f5a6b7c8d9", clerkUserId: "user_them" };
const ME = { id: "44b7f0c2a1d3e4f5a6b7c8d7", clerkUserId: "user_me" };
const profile = (p: { id: string; clerkUserId: string }) => ({
  ...p,
  displayName: "X",
  bio: null,
  visibility: { academic: "PRIVATE", careers: "PRIVATE", skills: "PRIVATE", courses: "PRIVATE" },
  academic: null,
  careers: [],
  skillsHave: [],
  skillsWant: [],
  courses: [],
  busyBlocks: [],
});
const postRow = (over: object = {}) => ({
  id: POST,
  authorUserId: "user_them",
  name: "Fall plan",
  kind: "ACTUAL",
  semester: "fall",
  year: "2026",
  session: null,
  courses: [],
  createdAt: new Date("2026-09-01T00:00:00Z"),
  updatedAt: new Date("2026-09-02T00:00:00Z"),
  ...over,
});

beforeEach(resetFakeDb);

describe("sharePost", () => {
  const share = (body: Record<string, unknown> = {}) =>
    call(sharePost as never, "user_me", { savedScheduleId: SCHED, ...body });
  const upsertArgs = (n = 0) =>
    fakeDb.circlePosts!.upsert!.mock.calls[n]![0] as { where: object; create: object; update: object };
  const saved = {
    id: SCHED,
    clerkUserId: "user_me",
    name: "Plan",
    semester: "fall",
    year: "2026",
    session: null,
    courses: [{ courseID: "15-213", lecture: "Lec 1", section: null }],
  };

  test("copies the caller's saved schedule into their post for that semester and kind", async () => {
    fakeDb.savedSchedules!.findUnique!.mockResolvedValue(saved as never);
    fakeDb.circlePosts!.upsert!.mockResolvedValue(postRow({ authorUserId: "user_me" }) as never);
    const { status } = await share({ kind: "PLANNED" });
    expect(status).toBe(200);
    const args = upsertArgs();
    expect(args.where).toEqual({
      authorUserId_semester_year_kind: { authorUserId: "user_me", semester: "fall", year: "2026", kind: "PLANNED" },
    });
    expect(args.update).toMatchObject({ name: "Plan", courses: saved.courses, sourceScheduleId: SCHED });
    expect(args.create).toMatchObject({ authorUserId: "user_me", semester: "fall", year: "2026", kind: "PLANNED" });
  });

  test("a planned and an actual post for one semester are separate posts", async () => {
    fakeDb.savedSchedules!.findUnique!.mockResolvedValue(saved as never);
    fakeDb.circlePosts!.upsert!.mockResolvedValue(postRow({ authorUserId: "user_me" }) as never);
    await share({ kind: "PLANNED" });
    await share({ kind: "ACTUAL" });
    const keys = [upsertArgs(0), upsertArgs(1)].map(
      (args) =>
        (args.where as { authorUserId_semester_year_kind: { kind: string } }).authorUserId_semester_year_kind.kind
    );
    expect(keys).toEqual(["PLANNED", "ACTUAL"]);
  });

  test("an older client that sends no kind shares an actual schedule", async () => {
    fakeDb.savedSchedules!.findUnique!.mockResolvedValue(saved as never);
    fakeDb.circlePosts!.upsert!.mockResolvedValue(postRow({ authorUserId: "user_me" }) as never);
    await share();
    expect(upsertArgs().create).toMatchObject({ kind: "ACTUAL" });
  });

  test("an unknown kind is a 400", async () => {
    expect((await share({ kind: "MAYBE" })).status).toBe(400);
    expect(fakeDb.circlePosts!.upsert!.mock.calls).toHaveLength(0);
  });

  test("makes sure the sharer has a profile, so others can find and follow them", async () => {
    fakeDb.savedSchedules!.findUnique!.mockResolvedValue(saved as never);
    fakeDb.circlePosts!.upsert!.mockResolvedValue(postRow() as never);
    await share();
    const [args] = fakeDb.profiles!.upsert!.mock.calls[0] as [
      { where: object; update: object; create: { clerkUserId: string } },
    ];
    expect(args.where).toEqual({ clerkUserId: "user_me" });
    expect(args.update).toEqual({});
    expect(args.create.clerkUserId).toBe("user_me");
  });

  test("404 for someone else's saved schedule", async () => {
    fakeDb.savedSchedules!.findUnique!.mockResolvedValue({ ...saved, clerkUserId: "user_them" } as never);
    expect((await share()).status).toBe(404);
    expect(fakeDb.circlePosts!.upsert!.mock.calls).toHaveLength(0);
  });
});

describe("deletePost", () => {
  test("the author deletes the post with its reactions and comments", async () => {
    fakeDb.circlePosts!.findUnique!.mockResolvedValue(postRow({ authorUserId: "user_me" }) as never);
    expect((await call(deletePost as never, "user_me", { postId: POST })).status).toBe(200);
    expect(fakeDb.postReactions!.deleteMany!.mock.calls[0]).toEqual([{ where: { postId: POST } }]);
    expect(fakeDb.postComments!.deleteMany!.mock.calls[0]).toEqual([{ where: { postId: POST } }]);
    expect(fakeDb.circlePosts!.delete!.mock.calls[0]).toEqual([{ where: { id: POST } }]);
  });

  test("404 for someone else's post", async () => {
    fakeDb.circlePosts!.findUnique!.mockResolvedValue(postRow() as never);
    expect((await call(deletePost as never, "user_me", { postId: POST })).status).toBe(404);
    expect(fakeDb.circlePosts!.delete!.mock.calls).toHaveLength(0);
  });
});

describe("reactToPost", () => {
  const react = (reaction: unknown) => call(reactToPost as never, "user_me", { postId: POST, reaction });

  test("clearing is always allowed", async () => {
    expect((await react(null)).status).toBe(200);
    expect(fakeDb.postReactions!.deleteMany!.mock.calls[0]).toEqual([
      { where: { reactorUserId: "user_me", postId: POST } },
    ]);
  });

  test("403 unless following the author; saved when following", async () => {
    fakeDb.circlePosts!.findUnique!.mockResolvedValue(postRow() as never);
    fakeDb.profiles!.findUnique!.mockResolvedValue(THEM as never);
    fakeDb.follows!.findUnique!.mockResolvedValue(null as never);
    expect((await react("🔥")).status).toBe(403);
    fakeDb.follows!.findUnique!.mockResolvedValue({ id: "f" } as never);
    expect((await react("🔥")).status).toBe(200);
    expect(fakeDb.postReactions!.upsert!.mock.calls[0]).toMatchObject([
      { create: { reactorUserId: "user_me", postId: POST, reaction: "🔥" } },
    ]);
  });
});

describe("post comments", () => {
  test("adding needs a follow; the body is trimmed", async () => {
    fakeDb.circlePosts!.findUnique!.mockResolvedValue(postRow() as never);
    fakeDb.profiles!.findUnique!.mockResolvedValue(THEM as never);
    fakeDb.follows!.findUnique!.mockResolvedValue({ id: "f" } as never);
    expect((await call(addPostComment as never, "user_me", { postId: POST, body: "  hi  " })).status).toBe(200);
    expect(fakeDb.postComments!.create!.mock.calls[0]).toEqual([
      { data: { authorUserId: "user_me", postId: POST, body: "hi" } },
    ]);
  });

  test("listing names authors and says who may delete", async () => {
    fakeDb.circlePosts!.findUnique!.mockResolvedValue(postRow() as never);
    fakeDb.postComments!.findMany!.mockResolvedValue([
      { id: COMMENT, authorUserId: "user_me", postId: POST, body: "hi", createdAt: new Date("2026-09-03T00:00:00Z") },
    ] as never);
    fakeDb.profiles!.findMany!.mockResolvedValue([{ ...ME, displayName: "Me" }] as never);
    const { body } = await call(listPostComments as never, "user_stranger", { postId: POST });
    expect(body).toEqual([
      {
        commentID: COMMENT,
        authorProfileID: ME.id,
        authorName: "Me",
        body: "hi",
        createdAt: "2026-09-03T00:00:00.000Z",
        canDelete: false,
      },
    ]);
  });

  test("the comment's author or the post's author may delete; nobody else", async () => {
    fakeDb.postComments!.findUnique!.mockResolvedValue({ id: COMMENT, authorUserId: "user_x", postId: POST } as never);
    fakeDb.circlePosts!.findUnique!.mockResolvedValue(postRow() as never);
    expect((await call(deletePostComment as never, "user_stranger", { commentID: COMMENT })).status).toBe(403);
    expect((await call(deletePostComment as never, "user_them", { commentID: COMMENT })).status).toBe(200);
    expect((await call(deletePostComment as never, "user_x", { commentID: COMMENT })).status).toBe(200);
  });
});

describe("getFeed", () => {
  const feed = (body: Record<string, unknown> = {}) => call(getFeed as never, "user_me", body);

  test("newest first, one more than a page to know if there is another, and a cursor", async () => {
    const rows = Array.from({ length: 11 }, (_, i) =>
      postRow({ id: `7${String(i).padStart(23, "0")}`, updatedAt: new Date(Date.UTC(2026, 8, 20 - i)) })
    );
    fakeDb.circlePosts!.findMany!.mockResolvedValue(rows as never);
    fakeDb.profiles!.findMany!.mockResolvedValue([profile(THEM)] as never);
    const { body } = await feed();
    const [args] = fakeDb.circlePosts!.findMany!.mock.calls[0] as [{ orderBy: unknown; take: number; where: object }];
    expect(args.orderBy).toEqual([{ updatedAt: "desc" }, { id: "desc" }]);
    expect(args.take).toBe(11);
    const page = body as { posts: { postID: string }[]; nextCursor: string | null };
    expect(page.posts).toHaveLength(10);
    expect(page.nextCursor).toBe(`${rows[9]!.updatedAt.toISOString()}_${rows[9]!.id}`);
  });

  test("a cursor continues strictly after the last post seen", async () => {
    await feed({ cursor: `2026-09-10T00:00:00.000Z_${POST}` });
    const [args] = fakeDb.circlePosts!.findMany!.mock.calls[0] as [{ where: { OR: unknown } }];
    expect(args.where.OR).toEqual([
      { updatedAt: { lt: new Date("2026-09-10T00:00:00Z") } },
      { updatedAt: new Date("2026-09-10T00:00:00Z"), id: { lt: POST } },
    ]);
  });

  test("kind narrows to planned or actual posts; absent means both", async () => {
    await feed({ kind: "PLANNED" });
    expect((fakeDb.circlePosts!.findMany!.mock.calls[0] as [{ where: object }])[0].where).toMatchObject({
      kind: "PLANNED",
    });
    await feed();
    expect((fakeDb.circlePosts!.findMany!.mock.calls[1] as [{ where: object }])[0].where).not.toHaveProperty("kind");
  });

  test("each post says its kind", async () => {
    fakeDb.circlePosts!.findMany!.mockResolvedValue([postRow({ kind: "PLANNED" })] as never);
    fakeDb.profiles!.findMany!.mockResolvedValue([profile(THEM)] as never);
    const { body } = await feed();
    expect((body as { posts: { kind: string }[] }).posts[0]!.kind).toBe("PLANNED");
  });

  test("'mine' and 'following' narrow the authors", async () => {
    await feed({ filter: "mine" });
    expect((fakeDb.circlePosts!.findMany!.mock.calls[0] as [{ where: object }])[0].where).toMatchObject({
      authorUserId: "user_me",
    });
    resetFakeDb();
    fakeDb.follows!.findMany!.mockResolvedValue([{ followedProfileId: THEM.id }] as never);
    fakeDb.profiles!.findMany!.mockResolvedValue([profile(THEM)] as never);
    await feed({ filter: "following" });
    const calls = fakeDb.circlePosts!.findMany!.mock.calls as [{ where: object }][];
    expect(calls[0]![0].where).toMatchObject({ authorUserId: { in: ["user_them"] } });
  });

  test("a post whose author has no profile is skipped, and no Clerk id leaves", async () => {
    fakeDb.circlePosts!.findMany!.mockResolvedValue([
      postRow(),
      postRow({ id: "7".padEnd(24, "1"), authorUserId: "user_ghost" }),
    ] as never);
    fakeDb.profiles!.findMany!.mockResolvedValue([profile(THEM)] as never);
    const { body } = await feed();
    expect((body as { posts: unknown[] }).posts).toHaveLength(1);
    expect(JSON.stringify(body)).not.toContain("user_");
  });

  test("400 for a bad filter or cursor", async () => {
    expect((await feed({ filter: "friends" })).status).toBe(400);
    expect((await feed({ cursor: "garbage" })).status).toBe(400);
  });
});
