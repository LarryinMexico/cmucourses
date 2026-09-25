/// <reference types="bun-types" />
import { describe, expect, test } from "bun:test";
import {
  decodeCursor,
  encodeCursor,
  toCirclePost,
  toDirectoryProfile,
  toPostAuthor,
  type DirectoryProfileRow,
  type PostRow,
} from "./socialDirectory";

const PRIVATE = { academic: "PRIVATE", careers: "PRIVATE", skills: "PRIVATE", courses: "PRIVATE" };
const row = (overrides: Partial<DirectoryProfileRow> = {}): DirectoryProfileRow => ({
  id: "64b7f0c2a1d3e4f5a6b7c8d9",
  clerkUserId: "user_them",
  displayName: "Ada",
  bio: "hello",
  visibility: PRIVATE,
  academic: { college: "scs", majors: [] },
  careers: ["swe"],
  skillsHave: ["python"],
  skillsWant: ["ml"],
  courses: [
    { courseID: "15-213", status: "IN_PROGRESS" },
    { courseID: "15-122", status: "TAKEN" },
  ],
  busyBlocks: [{ day: 1, begin: 540, end: 600, label: "Work at the lab" }],
  ...overrides,
});
const post = (overrides: Partial<PostRow> = {}): PostRow => ({
  id: "74b7f0c2a1d3e4f5a6b7c8d0",
  authorUserId: "user_them",
  name: "Fall plan",
  semester: "fall",
  year: "2026",
  session: null,
  courses: [{ courseID: "15-213", lecture: "Lec 1", section: undefined }],
  createdAt: new Date("2026-09-01T00:00:00Z"),
  updatedAt: new Date("2026-09-02T00:00:00Z"),
  ...overrides,
});

describe("toPostAuthor", () => {
  test("hides every private section even when the data exists", () => {
    const author = toPostAuthor(row());
    expect(author.academicSummary).toBeNull();
    expect(author.careers).toEqual([]);
    expect(author.skills).toEqual([]);
    expect(author.currentCourseIDs).toEqual([]);
  });

  test("shows a section once it is public, and never the Clerk id", () => {
    const author = toPostAuthor(
      row({ visibility: { academic: "PUBLIC", careers: "PUBLIC", skills: "PUBLIC", courses: "PUBLIC" } })
    );
    expect(author.academicSummary).toContain("School of Computer Science");
    expect(author.careers).toEqual(["swe"]);
    expect(author.skills).toEqual(["python", "ml"]);
    expect(author.currentCourseIDs).toEqual(["15-213"]);
    expect(JSON.stringify(author)).not.toContain("user_them");
  });

  test("falls back to a generic name", () => {
    expect(toPostAuthor(row({ displayName: null })).displayName).toBe("CMU student");
  });
});

describe("toCirclePost", () => {
  const ctx = {
    viewerUserId: "user_me",
    followedProfileIDs: new Set<string>(),
    followerUserIDs: new Set<string>(),
    reactions: [] as { reactorUserId: string; reaction: string }[],
    commentCount: 0,
  };

  test("busy times always show, but what they are for only when allowed", () => {
    expect(toCirclePost(post(), row(), ctx).busyBlocks).toEqual([{ day: 1, begin: 540, end: 600, label: null }]);
    const allowed = toCirclePost(post(), row({ visibility: { ...PRIVATE, busyLabels: "PUBLIC" } }), ctx);
    expect(allowed.busyBlocks[0]!.label).toBe("Work at the lab");
  });

  test("a profile saved before busyLabels existed counts as private", () => {
    expect(toCirclePost(post(), row({ visibility: PRIVATE }), ctx).busyBlocks[0]!.label).toBeNull();
  });

  test("maps the schedule, dates and flags", () => {
    const view = toCirclePost(post(), row(), {
      ...ctx,
      followedProfileIDs: new Set(["64b7f0c2a1d3e4f5a6b7c8d9"]),
      commentCount: 3,
      reactions: [
        { reactorUserId: "user_me", reaction: "🔥" },
        { reactorUserId: "user_x", reaction: "🔥" },
        { reactorUserId: "user_y", reaction: "bogus" },
      ],
    });
    expect(view).toMatchObject({
      postID: "74b7f0c2a1d3e4f5a6b7c8d0",
      name: "Fall plan",
      semester: "fall",
      year: "2026",
      session: null,
      courses: [{ courseID: "15-213", lecture: "Lec 1", section: null }],
      postedAt: "2026-09-01T00:00:00.000Z",
      updatedAt: "2026-09-02T00:00:00.000Z",
      isMine: false,
      following: true,
      followsMe: false,
      myReaction: "🔥",
      reactions: { "🔥": 2 },
      commentCount: 3,
    });
    expect(JSON.stringify(view)).not.toContain("user_");
  });

  test("isMine for the viewer's own post", () => {
    expect(toCirclePost(post({ authorUserId: "user_me" }), row({ clerkUserId: "user_me" }), ctx).isMine).toBe(true);
  });
});

describe("toDirectoryProfile", () => {
  test("carries post courses, a post count and both follow directions", () => {
    const person = toDirectoryProfile({
      profile: row(),
      posts: [post(), post({ id: "84b7f0c2a1d3e4f5a6b7c8d1", semester: "spring", courses: [{ courseID: "21-127" }] })],
      followedProfileIDs: new Set(),
      followerUserIDs: new Set(["user_them"]),
    });
    expect(person.postCount).toBe(2);
    expect(person.postedCourseIDs).toEqual(["15-213", "21-127"]);
    expect([person.following, person.followsMe]).toEqual([false, true]);
  });
});

describe("feed cursor", () => {
  test("round-trips the last post's time and id", () => {
    const cursor = encodeCursor(post());
    expect(cursor).toBe("2026-09-02T00:00:00.000Z_74b7f0c2a1d3e4f5a6b7c8d0");
    expect(decodeCursor(cursor)).toEqual({
      updatedAt: new Date("2026-09-02T00:00:00Z"),
      id: "74b7f0c2a1d3e4f5a6b7c8d0",
    });
  });
});
