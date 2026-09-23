/// <reference types="bun-types" />
import { describe, expect, test } from "bun:test";
import { toDirectoryProfile, toPublishedSchedule, type DirectoryProfileRow } from "./socialDirectory";

const row = (overrides: Partial<DirectoryProfileRow> = {}): DirectoryProfileRow => ({
  id: "64b7f0c2a1d3e4f5a6b7c8d9",
  clerkUserId: "user_them",
  displayName: "Ada",
  bio: "hello",
  visibility: { academic: "PRIVATE", careers: "PRIVATE", skills: "PRIVATE", courses: "PRIVATE" },
  academic: { college: "scs", majors: [] },
  careers: ["swe"],
  skillsHave: ["python"],
  skillsWant: ["ml"],
  courses: [
    { courseID: "15-213", status: "IN_PROGRESS" },
    { courseID: "15-122", status: "TAKEN" },
  ],
  ...overrides,
});

const base = {
  schedule: null,
  reactions: [],
  viewerUserId: "user_me",
  followedProfileIDs: new Set<string>(),
  followerUserIDs: new Set<string>(),
};

describe("toDirectoryProfile", () => {
  test("hides every private section even when the data exists", () => {
    const person = toDirectoryProfile({ ...base, profile: row() });
    expect(person.academicSummary).toBeNull();
    expect(person.careers).toEqual([]);
    expect(person.skills).toEqual([]);
    expect(person.currentCourseIDs).toEqual([]);
  });

  test("shows a section once it is public", () => {
    const person = toDirectoryProfile({
      ...base,
      profile: row({ visibility: { academic: "PUBLIC", careers: "PUBLIC", skills: "PUBLIC", courses: "PUBLIC" } }),
    });
    expect(person.academicSummary).toContain("School of Computer Science");
    expect(person.careers).toEqual(["swe"]);
    expect(person.skills).toEqual(["python", "ml"]);
    expect(person.currentCourseIDs).toEqual(["15-213"]); // only in-progress, not taken
  });

  test("falls back to a generic name and never exposes the Clerk id", () => {
    const person = toDirectoryProfile({ ...base, profile: row({ displayName: null }) });
    expect(person.displayName).toBe("CMU student");
    expect(JSON.stringify(person)).not.toContain("user_them");
  });

  test("following and followsMe are independent", () => {
    const id = "64b7f0c2a1d3e4f5a6b7c8d9";
    const oneWay = toDirectoryProfile({ ...base, profile: row(), followedProfileIDs: new Set([id]) });
    expect([oneWay.following, oneWay.followsMe]).toEqual([true, false]);
    const other = toDirectoryProfile({ ...base, profile: row(), followerUserIDs: new Set(["user_them"]) });
    expect([other.following, other.followsMe]).toEqual([false, true]);
  });

  test("counts known reactions, ignores unknown ones and reports the viewer's own", () => {
    const person = toDirectoryProfile({
      ...base,
      profile: row(),
      reactions: [
        { reactorUserId: "user_me", reaction: "🔥" },
        { reactorUserId: "user_a", reaction: "🔥" },
        { reactorUserId: "user_b", reaction: "👍" },
        { reactorUserId: "user_c", reaction: "not-an-emoji" },
      ],
    });
    expect(person.reactions).toEqual({ "🔥": 2, "👍": 1 });
    expect(person.myReaction).toBe("🔥");
  });

  test("maps the published schedule", () => {
    const person = toDirectoryProfile({
      ...base,
      profile: row(),
      schedule: {
        name: "Fall plan",
        semester: "fall",
        year: "2026",
        courses: [{ courseID: "15-213", lecture: "Lec 1", section: undefined }],
      },
    });
    expect(person.plannedSchedule).toEqual({
      name: "Fall plan",
      semester: "fall",
      year: "2026",
      courses: [{ courseID: "15-213", lecture: "Lec 1", section: null }],
    });
  });
});

describe("toPublishedSchedule", () => {
  test("returns null when nothing is published", () => {
    expect(toPublishedSchedule(null)).toBeNull();
    expect(toPublishedSchedule(undefined)).toBeNull();
  });
});
