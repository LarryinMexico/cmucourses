/// <reference types="bun-types" />
import { beforeEach, describe, expect, test } from "bun:test";
import { fakeDb, resetFakeDb } from "../test/fakeDb";
import { call } from "../test/http";
import { addComment, deleteComment, listComments } from "./comments";

const OWNER_PROFILE = "64b7f0c2a1d3e4f5a6b7c8d9";
const COMMENT_ID = "84b7f0c2a1d3e4f5a6b7c8d1";
const owner = { id: OWNER_PROFILE, clerkUserId: "user_owner" };

beforeEach(resetFakeDb);

const publishedTarget = () => {
  fakeDb.profiles!.findUnique!.mockResolvedValue(owner as never);
  fakeDb.socialSchedules!.findUnique!.mockResolvedValue({ name: "Fall" } as never);
};

describe("listComments", () => {
  const list = (userId = "user_me") => call(listComments as never, userId, { profileID: OWNER_PROFILE });

  test("404 for an unknown profile or an unpublished schedule", async () => {
    fakeDb.profiles!.findUnique!.mockResolvedValue(null as never);
    expect((await list()).status).toBe(404);

    publishedTarget();
    fakeDb.socialSchedules!.findUnique!.mockResolvedValue(null as never);
    expect((await list()).status).toBe(404);
  });

  test("400 for a malformed profile id", async () => {
    expect((await call(listComments as never, "user_me", { profileID: "x" })).status).toBe(400);
  });

  test("asks for the newest 200, returns them oldest first, and names authors", async () => {
    publishedTarget();
    fakeDb.scheduleComments!.findMany!.mockResolvedValue([
      // newest first, as the query returns them
      {
        id: "c2",
        authorUserId: "user_gone",
        targetProfileId: OWNER_PROFILE,
        body: "second",
        createdAt: new Date("2026-09-02"),
      },
      {
        id: "c1",
        authorUserId: "user_ada",
        targetProfileId: OWNER_PROFILE,
        body: "first",
        createdAt: new Date("2026-09-01"),
      },
    ] as never);
    fakeDb.profiles!.findMany!.mockResolvedValue([
      { id: "p_ada", clerkUserId: "user_ada", displayName: "Ada" },
    ] as never);

    const { body } = await list();
    expect(fakeDb.scheduleComments!.findMany!.mock.calls[0]).toEqual([
      { where: { targetProfileId: OWNER_PROFILE }, orderBy: { createdAt: "desc" }, take: 200 },
    ]);
    const comments = body as { commentID: string; authorName: string; authorProfileID: string | null; body: string }[];
    expect(comments.map((c) => c.body)).toEqual(["first", "second"]);
    expect(comments[0]).toMatchObject({ commentID: "c1", authorName: "Ada", authorProfileID: "p_ada" });
    expect(comments[1]).toMatchObject({ authorName: "CMU student", authorProfileID: null });
    expect(JSON.stringify(body)).not.toContain("user_");
  });

  test("the author and the schedule's owner can delete; a stranger cannot", async () => {
    publishedTarget();
    fakeDb.scheduleComments!.findMany!.mockResolvedValue([
      { id: "c1", authorUserId: "user_ada", targetProfileId: OWNER_PROFILE, body: "hi", createdAt: new Date() },
    ] as never);
    const canDelete = async (userId: string) => ((await list(userId)).body as { canDelete: boolean }[])[0]!.canDelete;
    expect(await canDelete("user_ada")).toBe(true);
    expect(await canDelete("user_owner")).toBe(true);
    expect(await canDelete("user_stranger")).toBe(false);
  });
});

describe("addComment", () => {
  const add = (body: unknown) => call(addComment as never, "user_me", { profileID: OWNER_PROFILE, body });
  const allow = () => {
    publishedTarget();
    fakeDb.follows!.findUnique!.mockResolvedValue({ id: "f" } as never);
  };

  test("400 for an empty or too long comment, and nothing is stored", async () => {
    allow();
    expect((await add("   ")).status).toBe(400);
    expect((await add("x".repeat(501))).status).toBe(400);
    expect(fakeDb.scheduleComments!.create!.mock.calls).toHaveLength(0);
  });

  test("403 unless the caller follows the owner", async () => {
    allow();
    fakeDb.follows!.findUnique!.mockResolvedValue(null as never);
    const { status, body } = await add("hello");
    expect(status).toBe(403);
    expect(body).toEqual({ error: "Follow this student to comment" });
    expect(fakeDb.scheduleComments!.create!.mock.calls).toHaveLength(0);
  });

  test("404 when the schedule is not published", async () => {
    allow();
    fakeDb.socialSchedules!.findUnique!.mockResolvedValue(null as never);
    expect((await add("hello")).status).toBe(404);
  });

  test("stores a trimmed comment under the caller", async () => {
    allow();
    const { status, body } = await add("  nice plan  ");
    expect(status).toBe(200);
    expect(body).toEqual({ ok: true });
    expect(fakeDb.scheduleComments!.create!.mock.calls[0]).toEqual([
      { data: { authorUserId: "user_me", targetProfileId: OWNER_PROFILE, body: "nice plan" } },
    ]);
  });
});

describe("deleteComment", () => {
  const remove = (userId: string, commentID: unknown = COMMENT_ID) =>
    call(deleteComment as never, userId, { commentID });
  const existing = () => {
    fakeDb.scheduleComments!.findUnique!.mockResolvedValue({
      id: COMMENT_ID,
      authorUserId: "user_ada",
      targetProfileId: OWNER_PROFILE,
    } as never);
    fakeDb.profiles!.findUnique!.mockResolvedValue(owner as never);
  };

  test("400 for a malformed id, 404 for a missing comment", async () => {
    expect((await remove("user_ada", "12")).status).toBe(400);
    fakeDb.scheduleComments!.findUnique!.mockResolvedValue(null as never);
    expect((await remove("user_ada")).status).toBe(404);
  });

  test("the author can delete their own comment", async () => {
    existing();
    expect((await remove("user_ada")).status).toBe(200);
    expect(fakeDb.scheduleComments!.delete!.mock.calls[0]).toEqual([{ where: { id: COMMENT_ID } }]);
  });

  test("the schedule's owner can delete any comment on it", async () => {
    existing();
    expect((await remove("user_owner")).status).toBe(200);
    expect(fakeDb.scheduleComments!.delete!.mock.calls).toHaveLength(1);
  });

  test("anyone else gets 403 and the comment stays", async () => {
    existing();
    const { status, body } = await remove("user_stranger");
    expect(status).toBe(403);
    expect(body).toEqual({ error: "You can only delete your own comments" });
    expect(fakeDb.scheduleComments!.delete!.mock.calls).toHaveLength(0);
  });
});
