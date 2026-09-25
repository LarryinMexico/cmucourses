import { describe, expect, test } from "bun:test";
import {
  COMMENT_LIMITS,
  commentDeleteSchema,
  MESSAGE_LIMITS,
  followInputSchema,
  profileIDSchema,
  publishedScheduleSchema,
  sendMessageSchema,
  threadQuerySchema,
  deletePostInputSchema,
  feedQuerySchema,
  postCommentInputSchema,
  postReactionInputSchema,
  sharePostInputSchema,
} from "./social";

describe("social schemas", () => {
  test("accepts and normalizes a published schedule", () => {
    const result = publishedScheduleSchema.parse({
      name: "Fall plan",
      semester: "fall",
      year: "2026",
      courses: [{ courseID: "15213", lecture: "Lec 1", section: "A" }],
    });
    expect(result.courses[0]?.courseID).toBe("15-213");
  });

  test("rejects an invalid follow target", () => {
    expect(followInputSchema.safeParse({ profileID: "", follow: true }).success).toBe(false);
  });
});

describe("profileIDSchema", () => {
  test("accepts a 24-character hex object id and rejects anything else", () => {
    expect(profileIDSchema.safeParse("64b7f0c2a1d3e4f5a6b7c8d9").success).toBe(true);
    expect(profileIDSchema.safeParse("64B7F0C2A1D3E4F5A6B7C8D9").success).toBe(true);
    for (const bad of ["", "abc", "64b7f0c2a1d3e4f5a6b7c8d", "64b7f0c2a1d3e4f5a6b7c8dz", 12, null]) {
      expect(profileIDSchema.safeParse(bad).success).toBe(false);
    }
  });

  test("the follow input uses it and reports its message", () => {
    const followed = followInputSchema.safeParse({ profileID: "nope", follow: true });
    expect(!followed.success && followed.error.issues[0]?.message).toBe("Invalid profile ID");
  });
});

describe("message schemas", () => {
  const profileID = "64b7f0c2a1d3e4f5a6b7c8d9";

  test("trims the body and accepts up to the limit", () => {
    expect(sendMessageSchema.parse({ profileID, body: "  hey  " }).body).toBe("hey");
    expect(sendMessageSchema.safeParse({ profileID, body: "x".repeat(MESSAGE_LIMITS.body) }).success).toBe(true);
  });

  test("rejects an empty or too long message and unknown keys", () => {
    for (const body of ["", "  \n", "x".repeat(MESSAGE_LIMITS.body + 1)]) {
      expect(sendMessageSchema.safeParse({ profileID, body }).success).toBe(false);
    }
    expect(sendMessageSchema.safeParse({ profileID, body: "hi", recipientUserId: "user_x" }).success).toBe(false);
  });

  test("a thread is opened by profile id", () => {
    expect(threadQuerySchema.safeParse({ profileID }).success).toBe(true);
    expect(threadQuerySchema.safeParse({ profileID: "nope" }).success).toBe(false);
  });
});

describe("post schemas", () => {
  const id = "64b7f0c2a1d3e4f5a6b7c8d9";

  test("sharing names a saved schedule", () => {
    expect(sharePostInputSchema.safeParse({ savedScheduleId: id }).success).toBe(true);
    expect(sharePostInputSchema.safeParse({ savedScheduleId: "x" }).success).toBe(false);
    expect(sharePostInputSchema.safeParse({ savedScheduleId: id, authorUserId: "user_x" }).success).toBe(false);
  });

  test("deleting and reacting name a post", () => {
    expect(deletePostInputSchema.safeParse({ postId: id }).success).toBe(true);
    expect(postReactionInputSchema.safeParse({ postId: id, reaction: "🔥" }).success).toBe(true);
    expect(postReactionInputSchema.safeParse({ postId: id, reaction: null }).success).toBe(true);
    expect(postReactionInputSchema.safeParse({ postId: id, reaction: "nope" }).success).toBe(false);
  });

  test("a comment is trimmed and limited like schedule comments were", () => {
    expect(postCommentInputSchema.parse({ postId: id, body: "  hi  " }).body).toBe("hi");
    expect(postCommentInputSchema.safeParse({ postId: id, body: " " }).success).toBe(false);
    expect(postCommentInputSchema.safeParse({ postId: id, body: "x".repeat(COMMENT_LIMITS.body + 1) }).success).toBe(
      false
    );
  });

  test("the feed takes an optional cursor and a filter that defaults to everyone", () => {
    expect(feedQuerySchema.parse({})).toEqual({ filter: "all" });
    expect(feedQuerySchema.parse({ filter: "following", cursor: `2026-09-01T00:00:00.000Z_${id}` }).filter).toBe(
      "following"
    );
    expect(feedQuerySchema.safeParse({ cursor: "garbage" }).success).toBe(false);
    expect(feedQuerySchema.safeParse({ filter: "friends" }).success).toBe(false);
  });
});
