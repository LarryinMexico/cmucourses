import { describe, expect, test } from "bun:test";
import { profilePatchSchema, standardizeCourseID } from "./schema";
import { CAREERS } from "./taxonomy/careers";
import { SKILLS } from "./taxonomy/skills";
import { COLLEGES, MAJORS, majorsForCollege, MINORS } from "./taxonomy/colleges";

const parse = (input: unknown) => profilePatchSchema.safeParse(input);

const academic = {
  college: "scs",
  majors: ["cs"],
  minors: [],
  degree: "UNDERGRAD",
  gradSemester: "spring",
  gradYear: 2028,
};

describe("taxonomies", () => {
  test.each([
    ["CAREERS", CAREERS],
    ["SKILLS", SKILLS],
    ["COLLEGES", COLLEGES],
    ["MAJORS", MAJORS],
    ["MINORS", MINORS],
  ] as const)("%s ids are unique", (_, items) => {
    const ids = items.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("profilePatchSchema", () => {
  test("accepts an empty patch", () => {
    expect(parse({}).success).toBe(true);
  });

  test("accepts a full valid patch", () => {
    const result = parse({
      displayName: "Scotty",
      bio: "Hi",
      careers: ["ml-ai", "swe"],
      skillsHave: ["python"],
      skillsWant: ["deep-learning"],
      academic,
      workload: { unitsMin: 36, unitsMax: 54, hoursPerWeek: 50 },
      modality: "IN_PERSON",
      busyBlocks: [{ day: 2, begin: 840, end: 960, label: "Lab" }],
      courses: [{ courseID: "15-122", status: "TAKEN", semester: "fall", year: "2025" }],
      visibility: { academic: "PUBLIC", careers: "PUBLIC", skills: "PRIVATE", courses: "PRIVATE" },
      completeOnboarding: true,
    });
    expect(result.success).toBe(true);
  });

  test("rejects more than 3 careers", () => {
    expect(parse({ careers: ["swe", "ml-ai", "security", "research"] }).success).toBe(false);
  });

  test("rejects duplicate careers", () => {
    expect(parse({ careers: ["swe", "swe"] }).success).toBe(false);
  });

  test("rejects unknown taxonomy ids", () => {
    expect(parse({ careers: ["astronaut"] }).success).toBe(false);
    expect(parse({ skillsHave: ["juggling"] }).success).toBe(false);
    expect(parse({ academic: { ...academic, majors: ["underwater-basketry"] } }).success).toBe(false);
    expect(parse({ academic: { ...academic, college: "hogwarts" } }).success).toBe(false);
  });

  test("rejects a major from another college", () => {
    const result = parse({ academic: { ...academic, college: "heinz", majors: ["cs"] } });
    expect(result.success).toBe(false);
    expect(!result.success && result.error.issues[0]?.message).toBe(
      "Computer Science isn't offered by Heinz College of Information Systems and Public Policy"
    );
  });

  test("joint programs are available in every college that offers them", () => {
    for (const college of ["dietrich", "heinz"]) {
      expect(parse({ academic: { ...academic, college, majors: ["information-systems"] } }).success).toBe(true);
    }
    for (const college of ["heinz", "cfa"]) {
      expect(parse({ academic: { ...academic, college, majors: ["mam", "meim"] } }).success).toBe(true);
    }
    expect(parse({ academic: { ...academic, college: "scs", majors: ["mam"] } }).success).toBe(false);
  });

  test("Heinz lists its MISM tracks and AIM", () => {
    const heinz = majorsForCollege("heinz").map((major) => major.id);
    expect(heinz).toEqual(
      expect.arrayContaining(["mism", "mism-bida", "aim", "msppm", "information-systems", "other"])
    );
    expect(heinz).not.toContain("cs");
  });

  test("accepts the college's own majors, college-less majors, and any minor", () => {
    expect(
      parse({ academic: { ...academic, college: "heinz", majors: ["mism", "other"], minors: ["cs"] } }).success
    ).toBe(true);
    expect(parse({ academic: { ...academic, college: null, majors: ["cs", "mism"] } }).success).toBe(true);
  });

  test("rejects unknown top-level and nested keys", () => {
    expect(parse({ clerkUserId: "user_123" }).success).toBe(false);
    expect(parse({ onboardedAt: "2020-01-01" }).success).toBe(false);
    expect(parse({ academic: { ...academic, extra: 1 } }).success).toBe(false);
  });

  test("rejects invalid busy blocks", () => {
    expect(parse({ busyBlocks: [{ day: 9, begin: 0, end: 60 }] }).success).toBe(false);
    expect(parse({ busyBlocks: [{ day: 1, begin: 900, end: 840 }] }).success).toBe(false);
    expect(parse({ busyBlocks: [{ day: 1, begin: 840, end: 840 }] }).success).toBe(false);
    expect(parse({ busyBlocks: [{ day: 1, begin: 0, end: 1441 }] }).success).toBe(false);
  });

  test("defaults a missing busy block label to null", () => {
    const result = parse({ busyBlocks: [{ day: 1, begin: 0, end: 60 }] });
    expect(result.success && result.data.busyBlocks?.[0]?.label).toBe(null);
  });

  test("rejects units minimum above maximum", () => {
    expect(parse({ workload: { unitsMin: 60, unitsMax: 36, hoursPerWeek: null } }).success).toBe(false);
    expect(parse({ workload: { unitsMin: 36, unitsMax: null, hoursPerWeek: null } }).success).toBe(true);
  });

  test("standardizes and dedupes course IDs", () => {
    const result = parse({
      courses: [
        { courseID: "15122", status: "IN_PROGRESS", semester: null, year: null },
        { courseID: "15-122", status: "TAKEN", semester: "fall", year: "2025" },
        { courseID: " 10301 ", status: "TAKEN", semester: null, year: null },
      ],
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.courses).toEqual([
      { courseID: "15-122", status: "TAKEN", semester: "fall", year: "2025" },
      { courseID: "10-301", status: "TAKEN", semester: null, year: null },
    ]);
  });

  test("rejects malformed course IDs", () => {
    expect(parse({ courses: [{ courseID: "abc", status: "TAKEN", semester: null, year: null }] }).success).toBe(false);
  });

  test("turns blank text into null", () => {
    const result = parse({ displayName: "   ", bio: "" });
    expect(result.success && result.data).toEqual({ displayName: null, bio: null });
  });

  test("rejects text over the limit", () => {
    expect(parse({ displayName: "x".repeat(51) }).success).toBe(false);
  });

  test("only accepts completeOnboarding: true", () => {
    expect(parse({ completeOnboarding: false }).success).toBe(false);
  });
});

test("standardizeCourseID", () => {
  expect(standardizeCourseID("15122")).toBe("15-122");
  expect(standardizeCourseID("15-122")).toBe("15-122");
});
