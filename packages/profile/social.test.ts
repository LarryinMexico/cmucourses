import { describe, expect, test } from "bun:test";
import { followInputSchema, profileIDSchema, publishedScheduleSchema, reactionInputSchema } from "./social";

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

  test("rejects invalid reactions and follow targets", () => {
    expect(reactionInputSchema.safeParse({ profileID: "p", reaction: "nope" }).success).toBe(false);
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

  test("the follow and reaction inputs use it and report the same message", () => {
    const followed = followInputSchema.safeParse({ profileID: "nope", follow: true });
    const reacted = reactionInputSchema.safeParse({ profileID: "nope", reaction: null });
    expect(followed.success || reacted.success).toBe(false);
    expect(!followed.success && followed.error.issues[0]?.message).toBe("Invalid profile ID");
    expect(!reacted.success && reacted.error.issues[0]?.message).toBe("Invalid profile ID");
  });
});
