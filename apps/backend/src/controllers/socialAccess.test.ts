/// <reference types="bun-types" />
import { beforeEach, describe, expect, test } from "bun:test";
import { fakeDb, resetFakeDb } from "../test/fakeDb";
import { checkInteractionTarget } from "./socialAccess";

const TARGET_ID = "64b7f0c2a1d3e4f5a6b7c8d9";

beforeEach(resetFakeDb);

const stub = (opts: { profile?: object | null; schedule?: object | null; follow?: object | null }) => {
  fakeDb.profiles!.findUnique!.mockResolvedValue(
    "profile" in opts ? opts.profile : ({ id: TARGET_ID, clerkUserId: "user_them" } as never)
  );
  fakeDb.socialSchedules!.findUnique!.mockResolvedValue(
    "schedule" in opts ? opts.schedule : ({ name: "Fall" } as never)
  );
  fakeDb.follows!.findUnique!.mockResolvedValue("follow" in opts ? opts.follow : ({ id: "f" } as never));
};

describe("checkInteractionTarget", () => {
  test("allows a follower to interact with a published schedule", async () => {
    stub({});
    const result = await checkInteractionTarget("user_me", TARGET_ID, "react");
    expect(result.ok).toBe(true);
    expect(fakeDb.follows!.findUnique!.mock.calls[0]).toEqual([
      { where: { followerUserId_followedProfileId: { followerUserId: "user_me", followedProfileId: TARGET_ID } } },
    ]);
  });

  test("404 for a profile that does not exist", async () => {
    stub({ profile: null });
    expect(await checkInteractionTarget("user_me", TARGET_ID, "react")).toEqual({
      ok: false,
      status: 404,
      error: "Profile not found",
    });
  });

  test("404 when the target is the caller", async () => {
    stub({ profile: { id: TARGET_ID, clerkUserId: "user_me" } });
    expect(await checkInteractionTarget("user_me", TARGET_ID, "react")).toMatchObject({ ok: false, status: 404 });
  });

  test("404 when nothing is published, before any follow check", async () => {
    stub({ schedule: null, follow: null });
    expect(await checkInteractionTarget("user_me", TARGET_ID, "comment")).toEqual({
      ok: false,
      status: 404,
      error: "No published schedule",
    });
    expect(fakeDb.follows!.findUnique!.mock.calls).toHaveLength(0);
  });

  test("403 unless the caller follows the owner, naming the action", async () => {
    stub({ follow: null });
    expect(await checkInteractionTarget("user_me", TARGET_ID, "comment")).toEqual({
      ok: false,
      status: 403,
      error: "Follow this student to comment",
    });
    expect(await checkInteractionTarget("user_me", TARGET_ID, "react")).toMatchObject({
      error: "Follow this student to react",
    });
  });
});
