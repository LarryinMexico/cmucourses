/// <reference types="bun-types" />
import { beforeEach, describe, expect, test } from "bun:test";
import { fakeDb, resetFakeDb } from "../test/fakeDb";
import { checkPostInteraction } from "./socialAccess";

const POST_ID = "74b7f0c2a1d3e4f5a6b7c8d0";
const AUTHOR_PROFILE = "64b7f0c2a1d3e4f5a6b7c8d9";
const post = { id: POST_ID, authorUserId: "user_them" };

beforeEach(resetFakeDb);

const stub = (opts: { post?: object | null; author?: object | null; follow?: object | null }) => {
  fakeDb.circlePosts!.findUnique!.mockResolvedValue(("post" in opts ? opts.post : post) as never);
  fakeDb.profiles!.findUnique!.mockResolvedValue(
    ("author" in opts ? opts.author : { id: AUTHOR_PROFILE, clerkUserId: "user_them" }) as never
  );
  fakeDb.follows!.findUnique!.mockResolvedValue(("follow" in opts ? opts.follow : { id: "f" }) as never);
};

describe("checkPostInteraction", () => {
  test("a follower may react to or comment on someone else's post", async () => {
    stub({});
    const result = await checkPostInteraction("user_me", POST_ID, "react");
    expect(result.ok).toBe(true);
    expect(fakeDb.follows!.findUnique!.mock.calls[0]).toEqual([
      { where: { followerUserId_followedProfileId: { followerUserId: "user_me", followedProfileId: AUTHOR_PROFILE } } },
    ]);
  });

  test("404 for a post that does not exist", async () => {
    stub({ post: null });
    expect(await checkPostInteraction("user_me", POST_ID, "react")).toEqual({
      ok: false,
      status: 404,
      error: "Post not found",
    });
  });

  test("404 for your own post, and when its author has no profile", async () => {
    stub({ post: { id: POST_ID, authorUserId: "user_me" } });
    expect(await checkPostInteraction("user_me", POST_ID, "comment")).toMatchObject({ ok: false, status: 404 });
    stub({ author: null });
    expect(await checkPostInteraction("user_me", POST_ID, "comment")).toMatchObject({ ok: false, status: 404 });
  });

  test("403 unless you follow the author, naming the action", async () => {
    stub({ follow: null });
    expect(await checkPostInteraction("user_me", POST_ID, "comment")).toEqual({
      ok: false,
      status: 403,
      error: "Follow this student to comment",
    });
  });
});
