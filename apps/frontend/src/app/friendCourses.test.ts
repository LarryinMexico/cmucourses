import type { FriendCourses } from "@cmucourses/profile";
import { emptyProfile } from "@cmucourses/profile";
import {
  describeEntry,
  discoverCourses,
  friendsTaking,
  ownCourseIDs,
} from "./friendCourses";

const alice: FriendCourses = {
  profileID: "a",
  displayName: "Alice",
  courses: [
    { courseID: "15-213", source: "IN_PROGRESS" },
    {
      courseID: "15-213",
      source: "POST",
      semester: "fall",
      year: "2026",
      kind: "ACTUAL",
    },
    { courseID: "10-301", source: "PLANNED", semester: "spring", year: "2027" },
  ],
};
const bob: FriendCourses = {
  profileID: "b",
  displayName: "Bob",
  courses: [
    {
      courseID: "15-213",
      source: "POST",
      semester: "fall",
      year: "2026",
      kind: "PLANNED",
    },
    {
      courseID: "36-401",
      source: "POST",
      semester: "fall",
      year: "2026",
      kind: "ACTUAL",
    },
  ],
};

describe("friendsTaking", () => {
  test("lists each friend once with every way they relate to the course", () => {
    expect(friendsTaking([alice, bob], "15-213")).toEqual([
      {
        profileID: "a",
        displayName: "Alice",
        notes: ["Taking now", "On their Fall 2026 actual schedule"],
      },
      {
        profileID: "b",
        displayName: "Bob",
        notes: ["On their Fall 2026 planned schedule"],
      },
    ]);
  });

  test("nobody for a course no friend lists", () => {
    expect(friendsTaking([alice, bob], "21-127")).toEqual([]);
  });
});

describe("describeEntry", () => {
  test("planned course names the term", () => {
    expect(describeEntry(alice.courses[2]!)).toBe("Planning for Spring 2027");
  });
});

describe("discoverCourses", () => {
  test("ranks by number of friends, then course number, and skips my own courses", () => {
    const mine = new Set(["10-301"]);
    expect(
      discoverCourses([alice, bob], mine).map((c) => [
        c.courseID,
        c.friends.length,
      ])
    ).toEqual([
      ["15-213", 2],
      ["36-401", 1],
    ]);
  });

  test("taken, in-progress and planned courses all count as mine", () => {
    const profile = {
      ...emptyProfile(),
      courses: [
        {
          courseID: "15-213",
          status: "TAKEN" as const,
          semester: null,
          year: null,
        },
        {
          courseID: "36-401",
          status: "IN_PROGRESS" as const,
          semester: null,
          year: null,
        },
      ],
      plannedCourses: [
        { courseID: "10-301", semester: "spring" as const, year: "2027" },
      ],
    };
    expect(discoverCourses([alice, bob], ownCourseIDs(profile))).toEqual([]);
  });
});
